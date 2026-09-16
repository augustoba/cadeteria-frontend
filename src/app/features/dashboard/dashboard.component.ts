import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Comentario, Pedido, PrecioLog } from '../../core/models/pedido.model';
import { Cadete } from '../../core/models/cadete.model';
import { PedidoService, TipoListaPedidos } from '../../core/services/pedido.service';
import { CadeteService } from '../../core/services/cadete.service';
import { IncidenciaService } from '../../core/services/incidencia.service';
import { Incidencia, PrioridadIncidencia } from '../../core/models/incidencia.model';
import { RealtimeService } from '../../core/services/realtime.service';
import { ToastService } from '../../core/services/toast.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { TablaPedidosComponent, claseEstadoPedido } from './tabla-pedidos.component';
import { CadetesLibresComponent } from './cadetes-libres.component';
import { KanbanPedidosComponent } from './kanban-pedidos.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

/** "finalizados" ya no pasa por `PedidoService.cargar()`/`TipoListaPedidos` — tiene su propio estado paginado, ver `cargarFinalizadosPagina()`. */
type TipoTab = TipoListaPedidos | 'finalizados';

interface Tab {
  tipo: TipoTab;
  label: string;
}

const TABS: Tab[] = [
  { tipo: 'activos', label: 'Pedidos' },
  { tipo: 'programados', label: 'Pedidos programados' },
  { tipo: 'finalizados', label: 'Pedidos finalizados' },
];

const ESTADOS_EN_CURSO = new Set(['EN_CURSO']);
/** Estados que "ocupan" a un cadete aunque siga LIBRE (ya se puso libre, pero le queda algo sin
 * entregar) — mismo criterio que ESTADOS_OCUPAN_CADETE del backend (PedidoService). */
const ESTADOS_OCUPAN_CADETE = new Set(['PENDIENTE', 'EN_CURSO']);

/** Mejora 105 — recordar pestaña/vista del dashboard entre sesiones (no sobrevive a un cambio de usuario, es solo del navegador). */
const STORAGE_TAB = 'dashboard.activeTab';
const STORAGE_VISTA = 'dashboard.vista';

function leerGuardado<T extends string>(key: string, valoresValidos: readonly T[], porDefecto: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (valoresValidos as readonly string[]).includes(v)) return v as T;
  } catch {
    // localStorage puede fallar en navegación privada — se usa el valor por defecto.
  }
  return porDefecto;
}

@Component({
  selector: 'app-dashboard',
  imports: [TablaPedidosComponent, KanbanPedidosComponent, CadetesLibresComponent, RouterLink, FormsModule, DatePipe, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Dashboard</h1>
        <div class="flex gap-2">
          <button type="button" class="btn-action bg-emerald-600 hover:bg-emerald-700" (click)="pedidos.reload()">
            ↻ Actualizar
          </button>
          <a routerLink="/pedidos/nuevo" class="btn-action bg-emerald-600 hover:bg-emerald-700"> + Nuevo pedido </a>
          <a routerLink="/mapa" class="btn-action bg-brand-500 hover:bg-brand-400"> 📍 Ver mapa </a>
        </div>
      </div>

      <div class="px-4 py-2 border-b border-gray-200">
        <input
          type="search"
          class="input w-full sm:w-80"
          placeholder="Buscar por número, cliente o teléfono…"
          [ngModel]="busqueda()"
          (ngModelChange)="busqueda.set($event)"
          name="busqueda"
        />
      </div>

      <div class="border-b border-gray-200 px-4 flex items-center justify-between">
        <div class="flex gap-4 text-sm">
          @for (tab of tabs; track tab.tipo) {
            <button
              type="button"
              class="py-3 border-b-2 -mb-px transition-colors"
              [class.border-brand-600]="tab.tipo === activeTab()"
              [class.text-brand-600]="tab.tipo === activeTab()"
              [class.border-transparent]="tab.tipo !== activeTab()"
              [class.text-gray-500]="tab.tipo !== activeTab()"
              (click)="selectTab(tab.tipo)"
            >
              {{ tab.label }}
            </button>
          }
        </div>
        @if (activeTab() === 'activos') {
          <div class="flex gap-1 text-xs">
            <button
              type="button"
              class="px-2 py-1 rounded"
              [class.bg-brand-100]="vista() === 'lista'"
              [class.text-brand-700]="vista() === 'lista'"
              [class.text-gray-400]="vista() !== 'lista'"
              (click)="setVista('lista')"
            >
              ☰ Lista
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded"
              [class.bg-brand-100]="vista() === 'kanban'"
              [class.text-brand-700]="vista() === 'kanban'"
              [class.text-gray-400]="vista() !== 'kanban'"
              (click)="setVista('kanban')"
            >
              ▦ Kanban
            </button>
          </div>
        }
      </div>

      <div class="p-4">
        @if (pedidos.loading()) {
          <app-loading-skeleton [filas]="6" />
        } @else if (pedidos.errored()) {
          <p class="text-red-600 text-sm py-6 text-center">No se pudieron cargar los pedidos.</p>
        } @else if (activeTab() === 'activos' && vista() === 'kanban') {
          <app-kanban-pedidos [pedidos]="pedidosFiltrados()" (accion)="onAccion($event)" />
          <div class="mt-4">
            <app-cadetes-libres (asignarClick)="abrirModalAsignarDesdeCadete($event)" (pedidoSoltado)="asignarPorDrop($event)" />
          </div>
        } @else if (activeTab() === 'activos') {
          <div class="flex items-center justify-between mb-2 cursor-pointer select-none" (click)="pendientesAbierto.set(!pendientesAbierto())">
            <h2 class="font-semibold text-gray-700">Pedidos pendientes ({{ pendientes().length }})</h2>
            <span class="text-xs text-gray-400">{{ pendientesAbierto() ? '▲ Ocultar' : '▼ Mostrar' }}</span>
          </div>
          @if (pendientesAbierto()) {
            <app-tabla-pedidos [pedidos]="pendientes()" [mostrarAcciones]="true" (accion)="onAccion($event)" />
          }

          <div
            class="flex items-center justify-between mb-2 mt-6 cursor-pointer select-none"
            (click)="enCursoAbierto.set(!enCursoAbierto())"
          >
            <h2 class="font-semibold text-gray-700">Pedidos en curso ({{ enCurso().length }})</h2>
            <span class="text-xs text-gray-400">{{ enCursoAbierto() ? '▲ Ocultar' : '▼ Mostrar' }}</span>
          </div>
          @if (enCursoAbierto()) {
            <app-tabla-pedidos [pedidos]="enCurso()" [mostrarAcciones]="true" (accion)="onAccion($event)" />
          }

          <app-cadetes-libres (asignarClick)="abrirModalAsignarDesdeCadete($event)" (pedidoSoltado)="asignarPorDrop($event)" />
        } @else if (activeTab() === 'finalizados') {
          <div class="flex items-center gap-3 mb-3 flex-wrap text-sm">
            <label class="flex items-center gap-2 relative">
              <span class="text-gray-600">Cadete:</span>
              <input
                type="text"
                class="input w-48"
                placeholder="Todos"
                [ngModel]="finalizadosCadeteTexto()"
                (ngModelChange)="finalizadosCadeteTexto.set($event); finalizadosBuscandoCadete.set(true)"
                (focus)="finalizadosCadeteTexto.set(''); finalizadosBuscandoCadete.set(true)"
                name="finalizadosCadeteTexto"
              />
              @if (finalizadosCadeteFiltro() && !finalizadosBuscandoCadete()) {
                <button type="button" class="btn-mini bg-gray-400 hover:bg-gray-500" (click)="limpiarFiltroCadeteFinalizados()">
                  ✕
                </button>
              }
              @if (finalizadosBuscandoCadete() && finalizadosCadeteTexto().trim().length > 0) {
                <div class="absolute left-0 top-full mt-1 w-56 bg-white rounded shadow-lg border border-gray-200 overflow-hidden z-20 max-h-56 overflow-y-auto">
                  @for (c of finalizadosCadeteSugeridos(); track c.id) {
                    <button
                      type="button"
                      class="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      (click)="elegirCadeteFinalizados(c.id, c.nombre + ' ' + c.apellido)"
                    >
                      {{ c.nombre }} {{ c.apellido }}
                    </button>
                  } @empty {
                    <p class="px-3 py-2 text-xs text-gray-400">Sin resultados.</p>
                  }
                </div>
              }
            </label>
            <label class="flex items-center gap-2">
              <span class="text-gray-600">Tipo:</span>
              <select
                class="input"
                [ngModel]="finalizadosTipoFiltro()"
                (ngModelChange)="onCambiarFiltroFinalizados('tipo', $event)"
                name="finalizadosTipoFiltro"
              >
                <option value="todos">Todos</option>
                <option value="FINALIZADO">Finalizado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </label>
            <div class="flex gap-1 ml-auto">
              @for (r of ['hoy', 'semana', 'todo']; track r) {
                <button
                  type="button"
                  class="btn-mini"
                  [class]="finalizadosRango() === r ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-400 hover:bg-gray-500'"
                  (click)="onCambiarRangoFinalizados(r)"
                >
                  {{ r === 'hoy' ? 'Hoy' : r === 'semana' ? 'Esta semana' : 'Todo' }}
                </button>
              }
            </div>
          </div>
          @if (finalizadosCargando()) {
            <p class="text-xs text-gray-400 py-4 text-center">Cargando…</p>
          } @else {
            <app-tabla-pedidos [pedidos]="finalizadosData().items" [paginadoExterno]="true" [mostrarAcciones]="false" (accion)="onAccion($event)" />
            @if (finalizadosData().total > 0) {
              <div class="flex items-center justify-between px-1 py-2 text-xs text-gray-500">
                <span>
                  {{ finalizadosData().total }} pedido(s) — página {{ finalizadosPaginaActual() + 1 }} de {{ finalizadosData().totalPaginas }}
                </span>
                <div class="flex gap-1">
                  <button
                    type="button"
                    class="btn-mini bg-gray-400 hover:bg-gray-500"
                    [disabled]="finalizadosPaginaActual() <= 0"
                    (click)="irAPaginaFinalizados(finalizadosPaginaActual() - 1)"
                  >
                    ‹ Anterior
                  </button>
                  <button
                    type="button"
                    class="btn-mini bg-gray-400 hover:bg-gray-500"
                    [disabled]="finalizadosPaginaActual() + 1 >= finalizadosData().totalPaginas"
                    (click)="irAPaginaFinalizados(finalizadosPaginaActual() + 1)"
                  >
                    Siguiente ›
                  </button>
                </div>
              </div>
            }
          }
        } @else {
          <app-tabla-pedidos [pedidos]="pedidosFiltrados()" [mostrarAcciones]="false" (accion)="onAccion($event)" />
        }
      </div>
    </div>

    @if (pedidoAAsignar(); as p) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModalAsignar()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">{{ modoReasignar() ? 'Reasignar' : 'Asignar' }} pedido {{ p.numero }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarModalAsignar()">
              ✕
            </button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            @if (modoReasignar() && p.cadeteAsignado) {
              <p class="text-sm text-gray-600">
                Actualmente: {{ p.cadeteAsignado.nombre }} {{ p.cadeteAsignado.apellido }}. Elegí a quién se lo pasás.
              </p>
            }
            <p class="text-sm text-gray-600">
              {{ p.origenDireccion }} → {{ p.destinoDireccion }} · Zona {{ p.zona.nombre }} ·
              {{ p.tipoVehiculoRequerido.nombre }}
            </p>
            @if (buscandoSugerencia()) {
              <p class="text-xs text-gray-400">Buscando un candidato sugerido…</p>
            } @else if (sugerido()) {
              <p class="text-xs text-emerald-700">
                Sugerido por el sistema: {{ sugerido()!.nombre }} {{ sugerido()!.apellido }} (el primero libre de esa
                zona/vehículo). Podés confirmarlo o elegir otro cadete abajo.
              </p>
            } @else {
              <p class="text-xs text-amber-700">
                El sistema no encontró ningún cadete libre que matchee zona y vehículo — elegí uno a mano.
              </p>
            }
            <div class="flex items-center gap-3 text-sm">
              <span class="text-gray-600">Ordenar por:</span>
              <label class="flex items-center gap-1">
                <input
                  type="radio"
                  name="ordenCadetes"
                  [ngModel]="ordenCadetes()"
                  (ngModelChange)="ordenCadetes.set($event)"
                  value="turno"
                />
                <span>Orden de turno</span>
              </label>
              <label class="flex items-center gap-1">
                <input
                  type="radio"
                  name="ordenCadetes"
                  [ngModel]="ordenCadetes()"
                  (ngModelChange)="ordenCadetes.set($event)"
                  value="alfabetico"
                />
                <span>Alfabético</span>
              </label>
              <span class="text-gray-600 ml-2">Cobro:</span>
              <select class="input !py-1 !text-sm" [ngModel]="filtroModalidadPago()" (ngModelChange)="filtroModalidadPago.set($event)" name="filtroModalidadPago">
                <option [ngValue]="null">Todos</option>
                <option value="SEMANAL">💵 Semanal</option>
                <option value="PORCENTAJE">% Porcentaje</option>
              </select>
            </div>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Cadete</span>
              @if (cargandoCandidatos()) {
                <p class="text-xs text-gray-400">Buscando cadetes disponibles…</p>
              } @else if (cadetesOrdenados().length === 0) {
                <p class="text-xs text-amber-700">Ningún cadete puede recibir este pedido ahora mismo (ocupados, sin pago al día o al tope).</p>
              } @else {
                <select class="input" [(ngModel)]="cadeteIdSeleccionado" name="cadeteIdSeleccionado">
                  <option [ngValue]="null" disabled>Elegir…</option>
                  @for (c of cadetesOrdenados(); track c.id) {
                    <option [ngValue]="c.id">
                      {{ c.modalidadPago === 'SEMANAL' ? '💵' : '%' }} {{ c.nombre }} {{ c.apellido }}
                      {{ c.id === sugerido()?.id ? '(sugerido)' : '' }}
                    </option>
                  }
                </select>
              }
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModalAsignar()">Cancelar</button>
            <button
              type="button"
              class="btn bg-indigo-600 hover:bg-indigo-700"
              [disabled]="!cadeteIdSeleccionado"
              (click)="confirmarAsignar()"
            >
              ✔ {{ modoReasignar() ? 'Confirmar reasignación' : 'Confirmar asignación' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (cadeteParaAsignar(); as c) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModalAsignarDesdeCadete()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Asignar viaje a {{ c.nombre }} {{ c.apellido }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarModalAsignarDesdeCadete()">
              ✕
            </button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            @if (pedidosSinAsignar().length === 0) {
              <p class="text-sm text-gray-500">No hay pedidos sin asignar ahora mismo.</p>
            } @else {
              <p class="text-xs text-gray-400 -mb-1">
                Marcá uno o más pedidos de la misma zona para agruparlos en una sola tanda de ofertas a este cadete
                (necesita "Máx. viajes simultáneos" configurado en 2 o más para que le entren varios a la vez).
              </p>
              <div class="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                @for (p of pedidosSinAsignar(); track p.id) {
                  <label class="flex items-start gap-2 text-sm border border-gray-200 rounded px-2.5 py-1.5 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      class="mt-0.5"
                      [checked]="pedidoIdsParaCadete.includes(p.id)"
                      (change)="toggleSeleccionLote(p.id)"
                    />
                    <span>
                      #{{ p.numero }} — {{ p.origenDireccion }} → {{ p.destinoDireccion }}
                      <span class="text-gray-400">(Zona {{ p.zona.nombre }}, {{ p.tipoVehiculoRequerido.nombre }})</span>
                    </span>
                  </label>
                }
              </div>
              @if (loteZonaMezclada()) {
                <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs px-2.5 py-1.5">
                  Todos los pedidos que agrupes tienen que ser de la misma zona (o zonas aledañas).
                </div>
              }
            }
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModalAsignarDesdeCadete()">Cancelar</button>
            <button
              type="button"
              class="btn bg-indigo-600 hover:bg-indigo-700"
              [disabled]="pedidoIdsParaCadete.length === 0 || loteZonaMezclada()"
              (click)="confirmarAsignarDesdeCadete()"
            >
              ✔ Confirmar asignación{{ pedidoIdsParaCadete.length > 1 ? ' (' + pedidoIdsParaCadete.length + ')' : '' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (pedidoACancelar(); as p) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModalCancelar()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Anular pedido {{ p.numero }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarModalCancelar()">
              ✕
            </button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <p class="text-sm text-gray-600">¿Por qué se anula? (para las métricas del panel)</p>
            <label class="flex items-center gap-2">
              <input type="radio" name="motivoCancelacion" [(ngModel)]="motivoCancelacionModal" value="CLIENTE" />
              <span class="text-sm text-gray-700">El cliente canceló</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="radio" name="motivoCancelacion" [(ngModel)]="motivoCancelacionModal" value="OTRO" />
              <span class="text-sm text-gray-700">Otro motivo</span>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModalCancelar()">Volver</button>
            <button type="button" class="btn bg-red-600 hover:bg-red-700" (click)="confirmarCancelar()">✔ Anular pedido</button>
          </div>
        </div>
      </div>
    }

    @if (pedidoDetalle(); as p) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModalDetalle()">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-5 py-4 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <h2 class="font-semibold text-base">Pedido #{{ p.numero }}</h2>
              <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="claseEstado(p)">{{ p.estado.nombre }}</span>
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
                </div>
                @for (parada of p.paradas; track parada.id) {
                  <div>
                    <div class="text-xs text-gray-400">Parada {{ parada.orden }}</div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-medium text-gray-800">{{ parada.direccion }}</span>
                      @if (parada.entregadoEn) {
                        <span class="text-emerald-600 text-xs" [title]="'Entregada ' + (parada.entregadoEn | date: 'short')">✓</span>
                      } @else {
                        <span class="text-amber-600 text-xs">pendiente</span>
                      }
                    </div>
                  </div>
                }
                <div>
                  <div class="text-xs text-gray-400">Destino</div>
                  <div class="font-medium text-gray-800">{{ p.destinoDireccion }}</div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-2.5 pt-2.5 border-t border-gray-100">
                <div>
                  <div class="text-xs text-gray-400">Zona</div>
                  <div class="font-medium text-gray-800">{{ p.zona.nombre }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-400">Vehículo</div>
                  <div class="font-medium text-gray-800">{{ p.tipoVehiculoRequerido.nombre }}</div>
                </div>
                @if (p.detalle) {
                  <div class="col-span-2">
                    <div class="text-xs text-gray-400">Detalle</div>
                    <div class="font-medium text-gray-800">{{ p.detalle }}</div>
                  </div>
                }
              </div>
            </section>

            <section class="bg-white rounded-lg border border-gray-200 p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Dinero</h3>
              <div class="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <div class="text-xs text-gray-400">Precio</div>
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
                  <div class="text-xs text-gray-400">Valor trámite</div>
                  <div class="font-medium text-gray-800">$ {{ p.montoDeclarado }}</div>
                </div>
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
                        $ {{ h.precioAnterior }} → $ {{ h.precioNuevo }} — {{ h.cambiadoPorUsername }} ({{ h.cambiadoEn | date: 'short' }})
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
              <div class="flex flex-col">
                <div class="flex gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                  <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-brand-500"></span>
                  <span class="text-gray-500">Creado</span>
                  <span class="ml-auto text-gray-800">{{ p.creadoEn | date: 'short' }}</span>
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
                    <span class="ml-auto text-gray-800">{{ p.asignadoEn | date: 'short' }}</span>
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
                    <span class="ml-auto text-gray-800">{{ p.vistoEn | date: 'short' }}</span>
                  </div>
                }
                @if (p.aceptadoEn) {
                  <div class="flex gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-brand-500"></span>
                    <span class="text-gray-500">Aceptado</span>
                    <span class="ml-auto text-gray-800">{{ p.aceptadoEn | date: 'short' }}</span>
                  </div>
                }
                @if (p.retiradoEn) {
                  <div class="flex items-center gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-brand-500"></span>
                    <span class="text-gray-500">Retirado</span>
                    <span class="ml-auto text-gray-800">{{ p.retiradoEn | date: 'short' }}</span>
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
                }
                @if (p.finalizadoEn) {
                  <div class="flex items-center gap-2.5 pb-3 border-l-2 border-gray-200 pl-3 -ml-px relative">
                    <span class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="text-gray-500">Entregado</span>
                    <span class="ml-auto text-gray-800">{{ p.finalizadoEn | date: 'short' }}</span>
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
                    <span class="ml-auto text-gray-800">{{ p.canceladoEn | date: 'short' }}</span>
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

            @if (p.estado.id === 'FINALIZADO') {
              <section class="bg-white rounded-lg border border-gray-200 p-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Entrega</h3>
                <div>
                  <div class="text-xs text-gray-400">Recibió</div>
                  <div class="font-medium text-gray-800">{{ p.entregaReceptorNombre || '—' }}</div>
                </div>
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
                  <div class="text-xs text-gray-400 mt-2">Sin fotos.</div>
                }
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
                  <div class="text-xs text-gray-500 mt-1">{{ p.noEntregadoEn | date: 'short' }}</div>
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
                      <div class="text-xs text-gray-400 mt-0.5">{{ c.cadeteNombre }} · {{ c.creadoEn | date: 'short' }}</div>
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
                      <div class="text-xs text-gray-400 mt-0.5">{{ inc.creadaEn | date: 'short' }}</div>
                    </div>
                  }
                </div>
              }
            </section>
          </div>

          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white flex-wrap">
            @if (p.estado.id === 'FINALIZADO') {
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

    @if (pedidoParaIncidencia(); as pedidoId) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" (click)="cerrarNuevaIncidencia()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Nueva incidencia</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarNuevaIncidencia()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Título</span>
              <input class="input" [(ngModel)]="tituloIncidenciaModal" name="tituloIncidenciaModal" placeholder="Ej: Reclamo del cliente" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Prioridad</span>
              <select class="input" [(ngModel)]="prioridadIncidenciaModal" name="prioridadIncidenciaModal">
                <option value="BAJA">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="GRAVE">Grave</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Observación</span>
              <textarea class="input" rows="3" [(ngModel)]="descripcionIncidenciaModal" name="descripcionIncidenciaModal"></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarNuevaIncidencia()">Cancelar</button>
            <button
              type="button"
              class="btn bg-amber-600 hover:bg-amber-700"
              [disabled]="!tituloIncidenciaModal.trim()"
              (click)="confirmarNuevaIncidencia()"
            >
              Crear
            </button>
          </div>
        </div>
      </div>
    }

    @if (pedidoAFinalizar(); as p) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModalFinalizar()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Finalizar pedido {{ p.numero }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarModalFinalizar()">
              ✕
            </button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <p class="text-sm text-gray-600">
              {{ p.origenDireccion }} → {{ p.destinoDireccion }}<br />
              Usalo cuando el cadete no puede finalizarlo el mismo (por ejemplo, se quedó sin internet).
            </p>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">¿Quién lo recibió? (opcional)</span>
              <input class="input" [(ngModel)]="receptorNombreModal" name="receptorNombreModal" placeholder="Nombre de quien recibió" />
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModalFinalizar()">Cancelar</button>
            <button type="button" class="btn bg-blue-600 hover:bg-blue-700" (click)="confirmarFinalizar()">
              ✔ Confirmar finalización
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .btn-action {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.375rem 0.75rem;
        border-radius: 0.25rem;
        transition: background-color 0.15s;
      }
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
      }
      .input:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-brand-400);
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
      }
      .btn-mini {
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 0.3rem;
        display: inline-block;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly pedidos = inject(PedidoService);
  readonly cadetesSvc = inject(CadeteService);
  private readonly incidencias = inject(IncidenciaService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  readonly lightbox = inject(LightboxService);
  private readonly route = inject(ActivatedRoute);
  private desuscribirPedidos: (() => void) | null = null;

  readonly tabs = TABS;
  readonly activeTab = signal<TipoTab>(
    leerGuardado(STORAGE_TAB, ['activos', 'programados', 'finalizados'], 'activos'),
  );
  readonly pendientesAbierto = signal(true);
  readonly enCursoAbierto = signal(true);
  /** Vista alternativa del dashboard (ronda 4, punto 41) — solo aplica a la pestaña "activos". */
  readonly vista = signal<'lista' | 'kanban'>(leerGuardado(STORAGE_VISTA, ['lista', 'kanban'], 'lista'));

  readonly busqueda = signal('');

  private coincideBusqueda(p: Pedido): boolean {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.numero).includes(q) ||
      p.clienteNombre.toLowerCase().includes(q) ||
      p.clienteTelefono.toLowerCase().includes(q)
    );
  }

  readonly pendientes = computed(() =>
    this.pedidos.pedidos().filter((p) => !ESTADOS_EN_CURSO.has(p.estado.id) && this.coincideBusqueda(p))
  );
  readonly enCurso = computed(() =>
    this.pedidos.pedidos().filter((p) => ESTADOS_EN_CURSO.has(p.estado.id) && this.coincideBusqueda(p))
  );
  readonly pedidosFiltrados = computed(() => this.pedidos.pedidos().filter((p) => this.coincideBusqueda(p)));

  /** Filtros propios de la pestaña "Pedidos finalizados" — además de la búsqueda general de arriba. */
  readonly finalizadosCadeteFiltro = signal<string | null>(null);
  /** Buscador con autocompletado en vez de un <select> plano — pensado para cuando la lista de cadetes crezca. */
  readonly finalizadosCadeteTexto = signal('');
  readonly finalizadosBuscandoCadete = signal(false);
  readonly finalizadosCadeteSugeridos = computed(() => {
    const q = this.finalizadosCadeteTexto().trim().toLowerCase();
    if (!q) return [];
    return this.cadetesSvc.cadetes().filter((c) => `${c.nombre} ${c.apellido}`.toLowerCase().includes(q)).slice(0, 8);
  });
  readonly finalizadosTipoFiltro = signal<'todos' | 'FINALIZADO' | 'CANCELADO'>('todos');

  /**
   * "Pedidos finalizados" paginado en el backend (mejora 2026-09-16) — antes filtraba
   * en el navegador sobre TODO el historial ya cargado (`pedidosFiltrados()`, que a su vez
   * dependía de `PedidoService.pedidos`, la lista completa sin acotar). Ahora vive en su
   * propio estado, independiente del store compartido de activos/programados.
   */
  readonly finalizadosRango = signal<'hoy' | 'semana' | 'todo'>('hoy');
  readonly finalizadosPaginaActual = signal(0);
  readonly finalizadosCargando = signal(false);
  readonly finalizadosData = signal<{ items: Pedido[]; total: number; totalPaginas: number }>({
    items: [],
    total: 0,
    totalPaginas: 1,
  });

  private rangoFechasFinalizados(): { desde: string | null; hasta: string | null } {
    const rango = this.finalizadosRango();
    if (rango === 'todo') return { desde: null, hasta: null };
    const desde = new Date();
    if (rango === 'hoy') {
      desde.setHours(0, 0, 0, 0);
    } else {
      desde.setDate(desde.getDate() - 7);
    }
    return { desde: desde.toISOString(), hasta: null };
  }

  cargarFinalizadosPagina(): void {
    this.finalizadosCargando.set(true);
    const { desde, hasta } = this.rangoFechasFinalizados();
    this.pedidos
      .finalizadosPagina({
        desde,
        hasta,
        cadeteId: this.finalizadosCadeteFiltro(),
        tipoEstado: this.finalizadosTipoFiltro() === 'todos' ? null : this.finalizadosTipoFiltro(),
        pagina: this.finalizadosPaginaActual(),
        tamano: 15,
      })
      .subscribe({
        next: (r) => {
          this.finalizadosData.set(r);
          this.finalizadosCargando.set(false);
        },
        error: () => this.finalizadosCargando.set(false),
      });
  }

  irAPaginaFinalizados(pagina: number): void {
    this.finalizadosPaginaActual.set(pagina);
    this.cargarFinalizadosPagina();
  }

  onCambiarRangoFinalizados(rango: string): void {
    this.finalizadosRango.set(rango as 'hoy' | 'semana' | 'todo');
    this.finalizadosPaginaActual.set(0);
    this.cargarFinalizadosPagina();
  }

  onCambiarFiltroFinalizados(_tipo: 'tipo', valor: 'todos' | 'FINALIZADO' | 'CANCELADO'): void {
    this.finalizadosTipoFiltro.set(valor);
    this.finalizadosPaginaActual.set(0);
    this.cargarFinalizadosPagina();
  }

  readonly pedidoAFinalizar = signal<Pedido | null>(null);
  receptorNombreModal = '';

  readonly pedidoAAsignar = signal<Pedido | null>(null);
  readonly sugerido = signal<Cadete | null>(null);
  readonly buscandoSugerencia = signal(false);
  /** Mejora: solo los cadetes que hoy pasarían "Asignar" (activo, LIBRE, pago/crédito al día, dentro de sus topes)
   * — antes aparecían todos y recién al confirmar tirabа el error de ocupado/tope/crédito. */
  readonly cadetesElegibles = signal<Cadete[]>([]);
  readonly cargandoCandidatos = signal(false);
  readonly ordenCadetes = signal<'turno' | 'alfabetico'>('turno');
  /** Filtro por modelo de cobro en el modal de asignar (pedido del dueño, para balancear carga). */
  readonly filtroModalidadPago = signal<'SEMANAL' | 'PORCENTAJE' | null>(null);
  readonly modoReasignar = signal(false);
  readonly cadetesOrdenados = computed(() => {
    const cadeteActualId = this.modoReasignar() ? this.pedidoAAsignar()?.cadeteAsignado?.id : null;
    const filtroModalidad = this.filtroModalidadPago();
    let lista = this.cadetesElegibles().filter((c) => c.id !== cadeteActualId);
    if (filtroModalidad) lista = lista.filter((c) => c.modalidadPago === filtroModalidad);
    if (this.ordenCadetes() === 'alfabetico') {
      return lista.sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));
    }
    // "Orden de turno": primero los libres sin nada pendiente, después los libres que ya tienen
    // uno o más viajes sin entregar encima — dentro de cada grupo, el que quedó libre primero,
    // primero. Mismo criterio FIFO que usa el sistema para sugerir (PedidoService.buscarCandidato).
    const conPendientes = new Set(
      this.pedidos
        .pedidos()
        .filter((p) => ESTADOS_OCUPAN_CADETE.has(p.estado.id) && p.cadeteAsignado)
        .map((p) => p.cadeteAsignado!.id)
    );
    return lista.sort((a, b) => {
      const aOcupado = conPendientes.has(a.id) ? 1 : 0;
      const bOcupado = conPendientes.has(b.id) ? 1 : 0;
      if (aOcupado !== bOcupado) return aOcupado - bOcupado;
      return new Date(a.ordenColaEspera).getTime() - new Date(b.ordenColaEspera).getTime();
    });
  });
  cadeteIdSeleccionado: string | null = null;

  /** Asignar un viaje eligiendo primero el cadete (desde "Cadetes libres"), en vez de al revés. */
  readonly cadeteParaAsignar = signal<Cadete | null>(null);
  pedidoIdsParaCadete: string[] = [];
  readonly pedidosSinAsignar = computed(() => this.pedidos.pedidos().filter((p) => p.estado.id === 'SIN_ASIGNAR'));

  /** Método (no computed) porque depende de `pedidoIdsParaCadete`, un array plano que se muta con checkboxes. */
  loteZonaMezclada(): boolean {
    const seleccionados = this.pedidosSinAsignar().filter((p) => this.pedidoIdsParaCadete.includes(p.id));
    const zonas = new Set(seleccionados.map((p) => p.zona.id));
    return zonas.size > 1;
  }

  readonly pedidoACancelar = signal<Pedido | null>(null);
  motivoCancelacionModal: string | null = null;

  readonly pedidoDetalle = signal<Pedido | null>(null);
  readonly smsReenviado = signal(false);
  readonly comentariosDetalle = signal<Comentario[]>([]);
  nuevoComentarioTexto = '';
  readonly editandoPrecio = signal(false);
  precioEditado: number | null = null;
  readonly historialPrecioAbierto = signal(false);
  readonly historialPrecio = signal<PrecioLog[]>([]);
  readonly incidenciasDelPedido = signal<Incidencia[]>([]);
  readonly pedidoParaIncidencia = signal<string | null>(null);
  tituloIncidenciaModal = '';
  descripcionIncidenciaModal = '';
  prioridadIncidenciaModal: PrioridadIncidencia = 'NORMAL';

  ngOnInit(): void {
    this.cadetesSvc.ensureLoaded();
    const tabInicial = this.activeTab();
    if (tabInicial === 'finalizados') {
      this.cargarFinalizadosPagina();
    } else {
      this.pedidos.cargar(tabInicial);
    }
    this.desuscribirPedidos = this.realtime.subscribe('/topic/admin/pedidos', () => {
      if (this.activeTab() === 'finalizados') {
        this.cargarFinalizadosPagina();
      } else {
        this.pedidos.reload();
      }
    });
    /** Búsqueda global desde el header (ronda 10, punto 107) — llega como ?buscar=. */
    const q = this.route.snapshot.queryParamMap.get('buscar');
    if (q) this.busqueda.set(q);
  }

  ngOnDestroy(): void {
    this.desuscribirPedidos?.();
  }

  elegirCadeteFinalizados(id: string, nombreCompleto: string): void {
    this.finalizadosCadeteFiltro.set(id);
    this.finalizadosCadeteTexto.set(nombreCompleto);
    this.finalizadosBuscandoCadete.set(false);
    this.finalizadosPaginaActual.set(0);
    this.cargarFinalizadosPagina();
  }

  limpiarFiltroCadeteFinalizados(): void {
    this.finalizadosCadeteFiltro.set(null);
    this.finalizadosCadeteTexto.set('');
    this.finalizadosBuscandoCadete.set(false);
    this.finalizadosPaginaActual.set(0);
    this.cargarFinalizadosPagina();
  }

  selectTab(tipo: TipoTab): void {
    if (tipo === this.activeTab()) return;
    this.activeTab.set(tipo);
    try {
      localStorage.setItem(STORAGE_TAB, tipo);
    } catch {
      // no crítico
    }
    if (tipo === 'finalizados') {
      this.finalizadosPaginaActual.set(0);
      this.cargarFinalizadosPagina();
    } else {
      this.pedidos.cargar(tipo);
    }
  }

  setVista(v: 'lista' | 'kanban'): void {
    this.vista.set(v);
    try {
      localStorage.setItem(STORAGE_VISTA, v);
    } catch {
      // no crítico
    }
  }

  onAccion(ev: {
    accion:
      | 'asignar'
      | 'reasignar'
      | 'anular'
      | 'quitar'
      | 'finalizar'
      | 'reintentar-entrega'
      | 'imprimir'
      | 'detalle'
      | 'incidencia'
      | 'prioritario';
    pedido: Pedido;
  }): void {
    const { accion, pedido } = ev;
    if (accion === 'incidencia') {
      this.abrirNuevaIncidenciaDePedido(pedido.id);
      return;
    }
    if (accion === 'prioritario') {
      this.pedidos.setPrioritario(pedido.id, !pedido.prioritario);
      return;
    }
    if (accion === 'asignar') {
      this.abrirModalAsignar(pedido, false);
    } else if (accion === 'reasignar') {
      this.abrirModalAsignar(pedido, true);
    } else if (accion === 'anular') {
      this.motivoCancelacionModal = 'CLIENTE';
      this.pedidoACancelar.set(pedido);
    } else if (accion === 'quitar') {
      this.toast.conDeshacer(`Se le va a quitar el pedido #${pedido.numero} al cadete…`, () => this.pedidos.quitar(pedido.id));
    } else if (accion === 'finalizar') {
      this.receptorNombreModal = '';
      this.pedidoAFinalizar.set(pedido);
    } else if (accion === 'reintentar-entrega') {
      this.pedidos.reintentarEntrega(pedido.id);
    } else if (accion === 'imprimir') {
      this.pedidos.imprimir(pedido.id);
    } else if (accion === 'detalle') {
      this.abrirModalDetalle(pedido.id);
    }
  }

  cerrarModalCancelar(): void {
    this.pedidoACancelar.set(null);
  }

  confirmarCancelar(): void {
    const p = this.pedidoACancelar();
    if (!p) return;
    const motivo = this.motivoCancelacionModal;
    this.pedidoACancelar.set(null);
    this.toast.conDeshacer(`Se va a anular el pedido #${p.numero}…`, () => this.pedidos.cancelar(p.id, motivo));
  }

  reenviarSms(id: string): void {
    this.pedidos.reenviarSms(id, () => this.smsReenviado.set(true));
  }

  readonly compartiendoComprobante = signal(false);

  /** Mejora 71 — share sheet nativo si el navegador lo soporta (Chrome/Edge en Android y desktops recientes); si no, descarga el PDF para adjuntarlo a mano. */
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

  private abrirModalDetalle(id: string): void {
    this.smsReenviado.set(false);
    this.pedidos.detalle(id).subscribe((p) => this.pedidoDetalle.set(p));
    this.comentariosDetalle.set([]);
    this.pedidos.comentarios(id).subscribe((c) => this.comentariosDetalle.set(c));
    this.incidenciasDelPedido.set([]);
    this.incidencias.porPedido(id).subscribe((inc) => this.incidenciasDelPedido.set(inc));
    this.editandoPrecio.set(false);
    this.historialPrecioAbierto.set(false);
    this.historialPrecio.set([]);
  }

  cerrarModalDetalle(): void {
    this.pedidoDetalle.set(null);
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
    this.tituloIncidenciaModal = '';
    this.descripcionIncidenciaModal = '';
    this.prioridadIncidenciaModal = 'NORMAL';
    this.pedidoParaIncidencia.set(pedidoId);
  }

  cerrarNuevaIncidencia(): void {
    this.pedidoParaIncidencia.set(null);
  }

  confirmarNuevaIncidencia(): void {
    const pedidoId = this.pedidoParaIncidencia();
    const titulo = this.tituloIncidenciaModal.trim();
    if (!pedidoId || !titulo) return;
    this.incidencias.crear(
      { titulo, descripcion: this.descripcionIncidenciaModal.trim() || null, pedidoId, prioridad: this.prioridadIncidenciaModal },
      () => {
      this.pedidoParaIncidencia.set(null);
      this.incidencias.porPedido(pedidoId).subscribe((inc) => this.incidenciasDelPedido.set(inc));
    });
  }

  claseEstado(p: Pedido): string {
    return claseEstadoPedido(p.estado.id);
  }

  cerrarModalFinalizar(): void {
    this.pedidoAFinalizar.set(null);
  }

  confirmarFinalizar(): void {
    const p = this.pedidoAFinalizar();
    if (!p) return;
    this.pedidos.finalizar(p.id, { receptorNombre: this.receptorNombreModal.trim() || null, fotoUrl: null });
    this.pedidoAFinalizar.set(null);
  }

  /** Botón "Asignar"/"Reasignar": el sistema sugiere un candidato (zona + vehículo + FIFO), el admin confirma o elige otro. */
  private abrirModalAsignar(pedido: Pedido, reasignar: boolean): void {
    this.cadetesSvc.ensureLoaded();
    this.cadeteIdSeleccionado = null;
    this.sugerido.set(null);
    this.ordenCadetes.set('turno');
    this.filtroModalidadPago.set(null);
    this.modoReasignar.set(reasignar);
    this.pedidoAAsignar.set(pedido);
    this.cadetesElegibles.set([]);

    this.cargandoCandidatos.set(true);
    this.pedidos.candidatosValidos(pedido.id).subscribe((lista) => {
      this.cargandoCandidatos.set(false);
      this.cadetesElegibles.set(lista);
    });

    this.buscandoSugerencia.set(true);
    this.pedidos.sugerencia(pedido.id).subscribe((candidato) => {
      this.buscandoSugerencia.set(false);
      this.sugerido.set(candidato);
      if (candidato) this.cadeteIdSeleccionado = candidato.id;
    });
  }

  cerrarModalAsignar(): void {
    this.pedidoAAsignar.set(null);
  }

  confirmarAsignar(): void {
    const p = this.pedidoAAsignar();
    if (!p || !this.cadeteIdSeleccionado) return;
    if (this.modoReasignar()) {
      this.pedidos.reasignar(p.id, this.cadeteIdSeleccionado, () => this.pedidoAAsignar.set(null));
    } else {
      this.pedidos.asignar(p.id, this.cadeteIdSeleccionado, () => this.pedidoAAsignar.set(null));
    }
  }

  /** Mejora 84 — arrastrar una tarjeta "Sin asignar" del Kanban hasta un cadete libre, sin pasar por el modal. */
  asignarPorDrop(ev: { cadete: Cadete; pedidoId: string }): void {
    this.pedidos.asignar(ev.pedidoId, ev.cadete.id, () =>
      this.toast.success(`Pedido asignado a ${ev.cadete.nombre} ${ev.cadete.apellido}.`),
    );
  }

  /** Botón "Asignar viaje" desde la lista de "Cadetes libres": se elige el cadete primero y el pedido después. */
  abrirModalAsignarDesdeCadete(c: Cadete): void {
    this.pedidoIdsParaCadete = [];
    this.cadeteParaAsignar.set(c);
  }

  cerrarModalAsignarDesdeCadete(): void {
    this.cadeteParaAsignar.set(null);
  }

  toggleSeleccionLote(pedidoId: string): void {
    this.pedidoIdsParaCadete = this.pedidoIdsParaCadete.includes(pedidoId)
      ? this.pedidoIdsParaCadete.filter((id) => id !== pedidoId)
      : [...this.pedidoIdsParaCadete, pedidoId];
  }

  confirmarAsignarDesdeCadete(): void {
    const c = this.cadeteParaAsignar();
    if (!c || this.pedidoIdsParaCadete.length === 0 || this.loteZonaMezclada()) return;
    if (this.pedidoIdsParaCadete.length === 1) {
      this.pedidos.asignar(this.pedidoIdsParaCadete[0], c.id, () => this.cadeteParaAsignar.set(null));
    } else {
      this.pedidos.asignarLote(this.pedidoIdsParaCadete, c.id, () => this.cadeteParaAsignar.set(null));
    }
  }
}
