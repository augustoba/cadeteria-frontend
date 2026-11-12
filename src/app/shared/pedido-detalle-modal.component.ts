import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Comentario, Pedido, PrecioLog } from '../core/models/pedido.model';
import { Incidencia } from '../core/models/incidencia.model';
import { ReporteCliente } from '../core/models/cliente.model';
import { PedidoService } from '../core/services/pedido.service';
import { IncidenciaService } from '../core/services/incidencia.service';
import { ClienteService } from '../core/services/cliente.service';
import { ToastService } from '../core/services/toast.service';
import { LightboxService } from '../core/services/lightbox.service';
import { claseEstadoPedido } from '../features/dashboard/tabla-pedidos.component';
import { NuevaIncidenciaModalComponent } from './nueva-incidencia-modal.component';
import { ESTILOS_BOTONES } from './estilos-botones';

/** Textos de los reportes del cadete sobre el cliente (ReporteCliente.tipo). */
const TIPOS_REPORTE: Record<string, string> = {
  DEMORO: 'Demoró',
  NO_DECLARO_VALORES: 'No declaró valores',
  PEDIDO_FALSO: 'Pedido falso',
  OTRO: 'Otro',
};

/**
 * Detalle completo de un pedido (2026-11-11): sacado del dashboard para usarlo igual en la pantalla
 * "Pedidos" (historial). Se muestra mientras `pedidoId` no sea null y pide todo lo que necesita:
 * el pedido, comentarios, incidencias y los reportes del cadete sobre el cliente en este pedido.
 */
@Component({
  selector: 'app-pedido-detalle-modal',
  styles: [ESTILOS_BOTONES],
  imports: [DatePipe, FormsModule, RouterLink, NuevaIncidenciaModalComponent],
  template: `
    @if (pedidoDetalle(); as p) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModalDetalle()">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-5 py-4 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <h2 class="font-semibold text-base">Pedido #{{ p.numero }}</h2>
              <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="claseEstado(p)">{{ textoEstado(p) }}</span>
            </div>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarModalDetalle()">
              ✕
            </button>
          </div>

          <div class="p-4 flex flex-col gap-3 text-sm max-h-[75vh] overflow-y-auto bg-gray-50">
            @if (p.smsFallido) {
              <div class="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2">
                📵 No se le pudo avisar por SMS al cliente (se agotaron los reintentos).
              </div>
            }

            <section class="bg-white rounded-lg border border-gray-200 p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Cliente</h3>
              <div class="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <div class="text-xs text-gray-400">Nombre</div>
                  <div class="font-medium text-gray-800">{{ p.clienteNombre }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-400">Teléfono</div>
                  <div class="font-medium text-gray-800">{{ p.clienteTelefono }}</div>
                </div>
              </div>
            </section>

            <section class="bg-white rounded-lg border border-gray-200 p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Envío</h3>
              <div class="flex flex-col gap-2.5">
                <div>
                  <div class="text-xs text-gray-400">Origen</div>
                  <div class="font-medium text-gray-800">{{ p.origenDireccion }}</div>
                  @if (p.origenPiso || p.origenDepto) {
                    <div class="text-gray-700">
                      @if (p.origenPiso) { Piso {{ p.origenPiso }} }
                      @if (p.origenPiso && p.origenDepto) { · }
                      @if (p.origenDepto) { Depto {{ p.origenDepto }} }
                    </div>
                  }
                  @if (p.origenObservaciones) {
                    <div class="text-xs text-gray-500">📝 {{ p.origenObservaciones }}</div>
                  }
                </div>
                @for (parada of p.paradas; track parada.id) {
                  <div>
                    <div class="text-xs text-gray-400">Parada {{ parada.orden }}</div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-medium text-gray-800">{{ parada.direccion }}</span>
                      @if (parada.entregadoEn) {
                        <span class="text-emerald-600 text-xs" [title]="'Entregada ' + (parada.entregadoEn | date: 'dd/MM/yyyy HH:mm')">✓</span>
                      } @else {
                        <span class="text-amber-600 text-xs">pendiente</span>
                      }
                    </div>
                  </div>
                }
                <div>
                  <div class="text-xs text-gray-400">Destino</div>
                  <div class="font-medium text-gray-800">{{ p.destinoDireccion }}</div>
                  @if (p.destinoPiso || p.destinoDepto) {
                    <div class="text-gray-700">
                      @if (p.destinoPiso) { Piso {{ p.destinoPiso }} }
                      @if (p.destinoPiso && p.destinoDepto) { · }
                      @if (p.destinoDepto) { Depto {{ p.destinoDepto }} }
                    </div>
                  }
                  @if (p.destinoObservaciones) {
                    <div class="text-xs text-gray-500">📝 {{ p.destinoObservaciones }}</div>
                  }
                </div>
              </div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-2.5 pt-2.5 border-t border-gray-100">
                <div>
                  <div class="text-xs text-gray-400">Vehículo</div>
                  <div class="font-medium text-gray-800">{{ p.requiereMoto ? 'Requiere moto' : 'Cualquier vehículo' }}</div>
                </div>
                @if (p.origenCarga) {
                  <div>
                    <div class="text-xs text-gray-400">Cargado</div>
                    <div class="font-medium text-gray-800">
                      {{ p.origenCarga === 'WEB' ? 'Online (cliente)' : 'Panel' + (p.creadoPorUsername ? ' — ' + p.creadoPorUsername : '') }}
                    </div>
                  </div>
                }
                @if (p.detalle) {
                  <div class="col-span-2">
                    <div class="text-xs text-gray-400">Detalle del pedido</div>
                    <div class="font-medium text-gray-800">{{ p.detalle }}</div>
                  </div>
                }
              </div>
            </section>

            <section class="bg-white rounded-lg border border-gray-200 p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Importes</h3>
              <div class="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <div class="text-xs text-gray-400">Valor trámite</div>
                  @if (editandoPrecio()) {
                    <div class="flex items-center gap-1">
                      <input type="number" min="0" step="0.01" class="input !py-1 !text-sm w-24" [(ngModel)]="precioEditado" name="precioEditado" />
                      <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="guardarPrecio(p.id)">✔</button>
                      <button type="button" class="btn-mini bg-gray-400 hover:bg-gray-500" (click)="editandoPrecio.set(false)">✕</button>
                    </div>
                  } @else {
                    <div class="font-medium text-gray-800 flex items-center gap-1.5">
                      $ {{ p.precio }}
                      @if (p.estado.id !== 'FINALIZADO' && p.estado.id !== 'CANCELADO') {
                        <button type="button" class="text-xs text-brand-600 hover:underline" (click)="empezarEditarPrecio(p.precio)">✏️</button>
                      }
                    </div>
                  }
                </div>
                <div>
                  <div class="text-xs text-gray-400">Dinero</div>
                  <div class="font-medium text-gray-800">$ {{ p.montoDeclarado }}</div>
                </div>
                @if (p.montoDisponer) {
                  <div>
                    <div class="text-xs text-gray-400">El cadete debe disponer de</div>
                    <div class="font-medium text-gray-800">$ {{ p.montoDisponer }}</div>
                  </div>
                }
              </div>
              <button type="button" class="text-xs text-gray-400 hover:underline mt-2" (click)="verHistorialPrecio(p.id)">
                {{ historialPrecioAbierto() ? '▲ Ocultar historial de precio' : '▼ Ver historial de precio' }}
              </button>
              @if (historialPrecioAbierto()) {
                @if (historialPrecio().length === 0) {
                  <p class="text-xs text-gray-400 mt-1">Sin cambios de precio.</p>
                } @else {
                  <div class="flex flex-col gap-1 mt-1.5">
                    @for (h of historialPrecio(); track h.id) {
                      <div class="text-xs text-gray-500">
                        $ {{ h.precioAnterior }} → $ {{ h.precioNuevo }} — {{ h.cambiadoPorUsername }} ({{ h.cambiadoEn | date: 'dd/MM/yyyy HH:mm' }})
                      </div>
                    }
                  </div>
                }
              }
            </section>

            @if (p.cadeteAsignado) {
              <section class="bg-white rounded-lg border border-gray-200 p-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Cadete asignado</h3>
                <div class="font-medium text-gray-800">
                  {{ p.cadeteAsignado.nombre }} {{ p.cadeteAsignado.apellido }}
                </div>
                <div class="text-xs text-gray-400">{{ p.cadeteAsignado.tipoVehiculo.nombre }}</div>
              </section>
            }

            <section class="bg-white rounded-lg border border-gray-200 p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2.5">Timeline</h3>
              <!-- Datos del pedido, no de un paso: el intento pudo ser en el Retirado, una parada o la entrega. -->
              @if (p.ubicacionSimulada) {
                <div class="text-xs text-red-600 font-medium mb-2">
                  🚫 En este pedido el cadete intentó marcar con una app de ubicación simulada (GPS falso): no lo dejó.
                </div>
              }
              @if (p.ubicacionImprecisa) {
                <div class="text-xs text-amber-700 mb-2">📡 En este pedido marcó con la ubicación imprecisa (GPS con mucho error).</div>
              }
              <div class="flex flex-col">
                <div class="flex gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                  <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-brand-500"></span>
                  <span class="text-gray-500">Creado</span>
                  <span class="ml-auto text-gray-800">{{ p.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                </div>
                @if (p.asignadoEn) {
                  <div class="flex gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-brand-500"></span>
                    <span class="text-gray-500">
                      Asignado
                      @if (p.asignadoPorUsername) {
                        <span class="text-gray-400">por {{ p.asignadoPorUsername }}</span>
                      }
                    </span>
                    <span class="ml-auto text-gray-800">{{ p.asignadoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                }
                @if (p.vistoEn) {
                  <div class="flex gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-amber-500"></span>
                    <span class="text-gray-500">
                      👁 Visto
                      @if (!p.aceptadoEn && p.estado.id === 'PENDIENTE') {
                        <span class="text-amber-600">— todavía no lo aceptó</span>
                      }
                    </span>
                    <span class="ml-auto text-gray-800">{{ p.vistoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                }
                @if (p.aceptadoEn) {
                  <div class="flex gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-brand-500"></span>
                    <span class="text-gray-500">Aceptado</span>
                    <span class="ml-auto text-gray-800">{{ p.aceptadoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                }
                @if (p.retiradoEn) {
                  <div class="flex items-center gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-brand-500"></span>
                    <span class="text-gray-500">Retirado</span>
                    <span class="ml-auto text-gray-800">{{ p.retiradoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                    @if (p.retiroLat != null && p.retiroLng != null) {
                      <a
                        [routerLink]="['/mapa']"
                        [queryParams]="{ lat: p.retiroLat, lng: p.retiroLng, label: 'Retiro pedido ' + p.numero }"
                        target="_blank"
                        class="btn-mini bg-indigo-600 hover:bg-indigo-700"
                      >
                        🗺
                      </a>
                    }
                  </div>
                  @if (p.retiroFueraZona) {
                    <div class="text-xs text-red-600 font-medium border-l-2 border-gray-200 pl-3 -ml-px pb-3 -mt-2">
                      ⚠️ Fuera de zona: marcó con "Estoy en el lugar"{{ p.retiroDistanciaM != null ? ' a ' + distanciaLegible(p.retiroDistanciaM) + ' del retiro' : ' sin ubicación' }} (con foto)
                    </div>
                  }
                }
                @for (pa of p.paradas; track pa.id) {
                  @if (pa.fueraZona) {
                    <div class="text-xs text-red-600 font-medium border-l-2 border-gray-200 pl-3 -ml-px pb-3">
                      ⚠️ Parada {{ pa.orden }} fuera de zona{{ pa.distanciaM != null ? ': a ' + distanciaLegible(pa.distanciaM) : '' }}
                      @if (pa.fotoUrl) {
                        <button type="button" class="underline" (click)="lightbox.abrir(pa.fotoUrl!)">ver foto</button>
                      }
                    </div>
                  }
                }
                @if (p.finalizadoEn) {
                  <div class="flex items-center gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="text-gray-500">Entregado</span>
                    <span class="ml-auto text-gray-800">{{ p.finalizadoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                    @if (p.entregaLat != null && p.entregaLng != null) {
                      <a
                        [routerLink]="['/mapa']"
                        [queryParams]="{ lat: p.entregaLat, lng: p.entregaLng, label: 'Entrega pedido ' + p.numero }"
                        target="_blank"
                        class="btn-mini bg-indigo-600 hover:bg-indigo-700"
                      >
                        🗺
                      </a>
                    }
                  </div>
                  @if (p.entregaFueraZona) {
                    <div class="text-xs text-red-600 font-medium border-l-2 border-gray-200 pl-3 -ml-px pb-3 -mt-2">
                      ⚠️ Fuera de zona: marcó con "Estoy en el lugar"{{ p.entregaDistanciaM != null ? ' a ' + distanciaLegible(p.entregaDistanciaM) + ' del destino' : ' sin ubicación' }} (con foto)
                    </div>
                  }
                  @if (p.finalizadoPorAdmin) {
                    <div class="text-xs text-amber-700 font-medium border-l-2 border-gray-200 pl-3 -ml-px pb-3 -mt-2">
                      🛠 Finalizado por el admin ({{ p.finalizadoPorAdmin }}): {{ p.finalizadoAdminMotivo }}
                    </div>
                  }
                }
                @if (p.canceladoEn) {
                  <div class="flex gap-2.5 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-red-500"></span>
                    <span class="text-gray-500">
                      Cancelado
                      @if (p.canceladoPorUsername) {
                        <span class="text-gray-400">por {{ p.canceladoPorUsername }}</span>
                      }
                    </span>
                    <span class="ml-auto text-gray-800">{{ p.canceladoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                }
              </div>
              @if (p.retiradoEn) {
                <a
                  [routerLink]="['/mapa']"
                  [queryParams]="{ pedidoId: p.id }"
                  target="_blank"
                  class="btn-mini bg-purple-600 hover:bg-purple-700 inline-block mt-1"
                >
                  🛣 Ver recorrido real en el mapa
                </a>
              }
            </section>

            <!-- Fotos también con el pedido sin terminar (2026-11-11): la de retiro existe desde que retiró. -->
            @if (p.estado.id === 'FINALIZADO' || p.retiradoEn || p.fotoRecepcionUrl || p.entregaFotoUrl || p.firmaReceptorUrl) {
              <section class="bg-white rounded-lg border border-gray-200 p-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  {{ p.estado.id === 'FINALIZADO' ? 'Entrega' : 'Fotos' }}
                </h3>
                @if (p.estado.id === 'FINALIZADO') {
                  <div>
                    <div class="text-xs text-gray-400">Recibió</div>
                    <div class="font-medium text-gray-800">{{ p.entregaReceptorNombre || '—' }}</div>
                  </div>
                }
                @if (p.fotoRecepcionUrl || p.entregaFotoUrl || p.firmaReceptorUrl) {
                  <div class="flex gap-2 mt-2.5 flex-wrap">
                    @if (p.fotoRecepcionUrl) {
                      <button type="button" (click)="lightbox.abrir(p.fotoRecepcionUrl!)" class="btn-mini bg-gray-500 hover:bg-gray-600">
                        👁 Foto de retiro
                      </button>
                    }
                    @if (p.entregaFotoUrl) {
                      <button type="button" (click)="lightbox.abrir(p.entregaFotoUrl!)" class="btn-mini bg-gray-500 hover:bg-gray-600">
                        👁 Foto de entrega
                      </button>
                    }
                    @if (p.firmaReceptorUrl) {
                      <button type="button" (click)="lightbox.abrir(p.firmaReceptorUrl!)" class="btn-mini bg-gray-500 hover:bg-gray-600">
                        ✍️ Firma del receptor
                      </button>
                    }
                  </div>
                } @else {
                  <div class="text-xs text-gray-400 mt-2">
                    Sin fotos guardadas (las fotos se borran pasado el plazo de retención).
                  </div>
                }
                @if (p.estado.id === 'FINALIZADO') {
                  <div class="mt-2.5 pt-2.5 border-t border-gray-100">
                    @if (p.calificacionEstrellas != null) {
                      <div class="text-xs text-gray-400">Calificación del cliente</div>
                      <div class="font-medium text-gray-800">
                        {{ '⭐'.repeat(p.calificacionEstrellas) }} ({{ p.calificacionEstrellas }}/5)
                      </div>
                      @if (p.calificacionComentario) {
                        <div class="text-gray-600 italic mt-0.5">"{{ p.calificacionComentario }}"</div>
                      }
                    } @else {
                      <div class="text-xs text-gray-400">El cliente todavía no calificó este pedido.</div>
                    }
                  </div>
                }
              </section>
            }

            <!-- Reclamo del cliente desde el seguimiento (2026-11-11: antes solo se veía mientras estaba abierto). -->
            @if (p.reclamoTipo) {
              <section class="rounded-lg border border-red-200 bg-red-50 p-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">Reclamo del cliente</h3>
                <div class="font-medium text-gray-800">📣 {{ textoReclamo(p) }}</div>
                @if (p.reclamoDetalle) {
                  <div class="text-gray-700 mt-1">{{ p.reclamoDetalle }}</div>
                }
                <div class="text-xs text-gray-500 mt-1">
                  @if (p.reclamoEn) {
                    {{ p.reclamoEn | date: 'dd/MM/yyyy HH:mm' }} ·
                  }
                  {{ textoEstadoReclamo(p) }}
                </div>
              </section>
            }

            @if (reportesDelPedido().length) {
              <section class="bg-white rounded-lg border border-gray-200 p-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Reportes del cadete sobre el cliente</h3>
                <div class="flex flex-col gap-2">
                  @for (r of reportesDelPedido(); track r.id) {
                    <div class="bg-gray-50 rounded-md px-2.5 py-1.5">
                      <div class="text-gray-700 font-medium">{{ textoReporte(r.tipo) }}</div>
                      @if (r.nota) {
                        <div class="text-gray-600 mt-0.5">{{ r.nota }}</div>
                      }
                      <div class="text-xs text-gray-400 mt-0.5">{{ r.cadeteNombre || '—' }} · {{ r.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</div>
                    </div>
                  }
                </div>
              </section>
            }

            @if (p.estado.id === 'CANCELADO') {
              <section class="bg-white rounded-lg border border-gray-200 p-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Motivo de cancelación</h3>
                <div class="font-medium text-gray-800">
                  {{ p.motivoCancelacion === 'CLIENTE' ? 'El cliente canceló' : p.motivoCancelacion === 'OTRO' ? 'Otro motivo' : 'Sin especificar' }}
                </div>
              </section>
            }

            @if (p.estado.id === 'NO_ENTREGADO') {
              <section class="bg-white rounded-lg border border-orange-200 bg-orange-50 p-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-2">No se pudo entregar</h3>
                <div class="font-medium text-gray-800">{{ p.motivoNoEntrega || 'Sin motivo especificado.' }}</div>
                @if (p.noEntregadoEn) {
                  <div class="text-xs text-gray-500 mt-1">{{ p.noEntregadoEn | date: 'dd/MM/yyyy HH:mm' }}</div>
                }
                <p class="text-xs text-gray-500 mt-2">
                  El pedido sigue activo — usá "Reintentar entrega" en el dashboard para volver a ofrecerlo sin
                  cargarlo de cero.
                </p>
              </section>
            }

            <section class="bg-white rounded-lg border border-gray-200 p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Comentarios</h3>
              @if (comentariosDetalle().length === 0) {
                <div class="text-xs text-gray-400">Todavía no hay comentarios.</div>
              } @else {
                <div class="flex flex-col gap-2">
                  @for (c of comentariosDetalle(); track c.id) {
                    <div class="rounded-md px-2.5 py-1.5" [class.bg-gray-50]="!c.esAdmin" [class.bg-indigo-50]="c.esAdmin">
                      <div class="text-gray-700">{{ c.texto }}</div>
                      <div class="text-xs text-gray-400 mt-0.5">{{ c.cadeteNombre }} · {{ c.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</div>
                    </div>
                  }
                </div>
              }
              <div class="flex gap-2 mt-2.5">
                <input
                  class="input flex-1"
                  placeholder="Agregar un comentario…"
                  [(ngModel)]="nuevoComentarioTexto"
                  name="nuevoComentarioTexto"
                  (keydown.enter)="agregarComentario(p.id)"
                />
                <button
                  type="button"
                  class="btn-mini bg-indigo-600 hover:bg-indigo-700"
                  [disabled]="!nuevoComentarioTexto.trim()"
                  (click)="agregarComentario(p.id)"
                >
                  Agregar
                </button>
              </div>
            </section>

            <section class="bg-white rounded-lg border border-gray-200 p-3">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400">Incidencias</h3>
                <button type="button" class="btn-mini bg-amber-600 hover:bg-amber-700" (click)="abrirNuevaIncidenciaDePedido(p.id)">
                  🎫 Crear incidencia
                </button>
              </div>
              @if (incidenciasDelPedido().length === 0) {
                <div class="text-xs text-gray-400">Sin incidencias cargadas para este pedido.</div>
              } @else {
                <div class="flex flex-col gap-2">
                  @for (inc of incidenciasDelPedido(); track inc.id) {
                    <div class="bg-gray-50 rounded-md px-2.5 py-1.5">
                      <div class="flex items-center gap-2">
                        <span
                          class="px-1.5 py-0.5 rounded text-xs font-medium"
                          [class]="inc.estado === 'ABIERTA' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'"
                        >
                          {{ inc.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada' }}
                        </span>
                        <span class="text-gray-700 font-medium">{{ inc.titulo }}</span>
                      </div>
                      @if (inc.descripcion) {
                        <div class="text-gray-600 mt-1">{{ inc.descripcion }}</div>
                      }
                      <div class="text-xs text-gray-400 mt-0.5">{{ inc.creadaEn | date: 'dd/MM/yyyy HH:mm' }}</div>
                    </div>
                  }
                </div>
              }
            </section>
          </div>

          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white flex-wrap">
            @if (p.estado.id === 'FINALIZADO') {
              <button type="button" class="btn bg-gray-700 hover:bg-gray-800" [disabled]="descargandoComprobante()" (click)="descargarComprobante(p)">
                {{ descargandoComprobante() ? 'Descargando…' : '⬇ Descargar comprobante' }}
              </button>
              <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="compartiendoComprobante()" (click)="compartirComprobantePorWhatsapp(p)">
                {{ compartiendoComprobante() ? 'Preparando…' : '📤 Compartir comprobante' }}
              </button>
            }
            <button
              type="button"
              class="btn bg-sky-600 hover:bg-sky-700"
              [disabled]="smsReenviado()"
              (click)="reenviarSms(p.id)"
            >
              {{ smsReenviado() ? '✓ SMS reenviado' : '✉️ Reenviar SMS de seguimiento' }}
            </button>
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModalDetalle()">Cerrar</button>
          </div>
        </div>
      </div>
    }
    <app-nueva-incidencia-modal
      [pedidoId]="pedidoParaIncidencia()"
      (cerrar)="pedidoParaIncidencia.set(null)"
      (creada)="cargarIncidencias($event)"
    />
  `,
})
export class PedidoDetalleModalComponent {
  private readonly pedidos = inject(PedidoService);
  private readonly incidencias = inject(IncidenciaService);
  private readonly clientes = inject(ClienteService);
  private readonly toast = inject(ToastService);
  readonly lightbox = inject(LightboxService);

  @Input()
  set pedidoId(id: string | null) {
    if (id) {
      this.abrir(id);
    } else {
      this.pedidoDetalle.set(null);
    }
  }

  @Output() cerrar = new EventEmitter<void>();
  /** Cuando algo del pedido cambió acá adentro (por ahora, el precio). */
  @Output() cambiado = new EventEmitter<Pedido>();

  readonly pedidoDetalle = signal<Pedido | null>(null);
  readonly smsReenviado = signal(false);
  readonly comentariosDetalle = signal<Comentario[]>([]);
  nuevoComentarioTexto = '';
  readonly editandoPrecio = signal(false);
  precioEditado: number | null = null;
  readonly historialPrecioAbierto = signal(false);
  readonly historialPrecio = signal<PrecioLog[]>([]);
  readonly incidenciasDelPedido = signal<Incidencia[]>([]);
  readonly reportesDelPedido = signal<ReporteCliente[]>([]);
  readonly pedidoParaIncidencia = signal<string | null>(null);
  readonly compartiendoComprobante = signal(false);
  readonly descargandoComprobante = signal(false);

  private abrir(id: string): void {
    this.pedidoDetalle.set(null);
    this.smsReenviado.set(false);
    this.comentariosDetalle.set([]);
    this.incidenciasDelPedido.set([]);
    this.reportesDelPedido.set([]);
    this.editandoPrecio.set(false);
    this.historialPrecioAbierto.set(false);
    this.historialPrecio.set([]);
    this.pedidos.detalle(id).subscribe((p) => {
      this.pedidoDetalle.set(p);
      if (p.clienteTelefono) {
        this.clientes
          .reportes(p.clienteTelefono)
          .subscribe((r) => this.reportesDelPedido.set(r.filter((x) => x.pedidoId === p.id)));
      }
    });
    this.pedidos.comentarios(id).subscribe((c) => this.comentariosDetalle.set(c));
    this.cargarIncidencias(id);
  }

  cargarIncidencias(pedidoId: string): void {
    this.incidencias.porPedido(pedidoId).subscribe((inc) => this.incidenciasDelPedido.set(inc));
  }

  cerrarModalDetalle(): void {
    this.cerrar.emit();
  }

  reenviarSms(id: string): void {
    this.pedidos.reenviarSms(id, () => this.smsReenviado.set(true));
  }

  /** Mejora 71 — share sheet nativo si el navegador lo soporta; si no, abre el PDF para adjuntarlo a mano. */
  compartirComprobantePorWhatsapp(p: Pedido): void {
    this.compartiendoComprobante.set(true);
    this.pedidos.comprobante(p.id).subscribe({
      next: (blob) => {
        this.compartiendoComprobante.set(false);
        const archivo = new File([blob], `comprobante-pedido-${p.numero}.pdf`, { type: 'application/pdf' });
        const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
        if (nav.canShare?.({ files: [archivo] }) && nav.share) {
          nav.share({ files: [archivo], title: `Comprobante pedido #${p.numero}` }).catch(() => {});
        } else {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          this.toast.info('Tu navegador no soporta compartir archivos directo — se abrió el PDF para que lo adjuntes a mano.');
        }
      },
      error: () => this.compartiendoComprobante.set(false),
    });
  }

  /** Baja el PDF del comprobante para mandarlo a mano (p. ej. cuando al cliente ya se le venció el link de seguimiento). */
  descargarComprobante(p: Pedido): void {
    this.descargandoComprobante.set(true);
    this.pedidos.comprobante(p.id).subscribe({
      next: (blob) => {
        this.descargandoComprobante.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-pedido-${p.numero}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        this.descargandoComprobante.set(false);
        this.toast.error('No se pudo descargar el comprobante.');
      },
    });
  }

  empezarEditarPrecio(precioActual: number): void {
    this.precioEditado = precioActual;
    this.editandoPrecio.set(true);
  }

  guardarPrecio(pedidoId: string): void {
    if (this.precioEditado == null || this.precioEditado < 0) return;
    this.pedidos.editarPrecio(pedidoId, this.precioEditado).subscribe((p) => {
      this.pedidoDetalle.set(p);
      this.editandoPrecio.set(false);
      this.cambiado.emit(p);
      if (this.historialPrecioAbierto()) this.cargarHistorialPrecio(pedidoId);
    });
  }

  verHistorialPrecio(pedidoId: string): void {
    if (this.historialPrecioAbierto()) {
      this.historialPrecioAbierto.set(false);
      return;
    }
    this.historialPrecioAbierto.set(true);
    this.cargarHistorialPrecio(pedidoId);
  }

  private cargarHistorialPrecio(pedidoId: string): void {
    this.pedidos.historialPrecios(pedidoId).subscribe((h) => this.historialPrecio.set(h));
  }

  agregarComentario(pedidoId: string): void {
    const texto = this.nuevoComentarioTexto.trim();
    if (!texto) return;
    this.pedidos.agregarComentario(pedidoId, texto).subscribe((c) => {
      this.comentariosDetalle.update((lista) => [...lista, c]);
      this.nuevoComentarioTexto = '';
    });
  }

  abrirNuevaIncidenciaDePedido(pedidoId: string): void {
    this.pedidoParaIncidencia.set(pedidoId);
  }

  /** En curso ya retirado se muestra "Retirado" (índigo), igual que en la pantalla "Pedidos". */
  claseEstado(p: Pedido): string {
    if (p.estado.id === 'EN_CURSO' && p.retiradoEn) return 'bg-indigo-100 text-indigo-700';
    return claseEstadoPedido(p.estado.id);
  }

  textoEstado(p: Pedido): string {
    return p.estado.id === 'EN_CURSO' && p.retiradoEn ? 'Retirado' : p.estado.nombre;
  }

  distanciaLegible(metros: number): string {
    return metros < 1000 ? `${metros} m` : `${(metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`;
  }

  textoReclamo(p: Pedido): string {
    switch (p.reclamoTipo) {
      case 'DEMORA_RETIRO':
        return 'Demora en el retiro';
      case 'DEMORA_ENTREGA':
        return 'Demora en la entrega';
      default:
        return 'Problema con la entrega';
    }
  }

  textoEstadoReclamo(p: Pedido): string {
    switch (p.reclamoEstado) {
      case 'ABIERTO':
        return 'Abierto, sin ver';
      case 'VISTO':
        return 'Visto';
      case 'CONTACTO':
        return 'Pidió que lo contacten';
      case 'CERRADO':
        return 'Cerrado';
      default:
        return '';
    }
  }

  textoReporte(tipo: string): string {
    return TIPOS_REPORTE[tipo] ?? tipo;
  }
}
