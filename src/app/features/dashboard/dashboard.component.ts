import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Pedido } from '../../core/models/pedido.model';
import { Cadete } from '../../core/models/cadete.model';
import { PedidoService, TipoListaPedidos } from '../../core/services/pedido.service';
import { CadeteService } from '../../core/services/cadete.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { TablaPedidosComponent } from './tabla-pedidos.component';
import { CadetesLibresComponent } from './cadetes-libres.component';
import { KanbanPedidosComponent } from './kanban-pedidos.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';
import { PedidoDetalleModalComponent } from '../../shared/pedido-detalle-modal.component';
import { NuevaIncidenciaModalComponent } from '../../shared/nueva-incidencia-modal.component';

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
/** Mismo criterio que ESTADOS_ACTIVOS del backend (PedidoService) — para decidir, al aplicar un
 * patch en memoria por WebSocket, si un pedido pertenece a la pestaña "Pedidos" (activos). */
const ESTADOS_ACTIVOS = ['SIN_ASIGNAR', 'PENDIENTE', 'EN_CURSO', 'NO_ENTREGADO'];

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
  imports: [TablaPedidosComponent, KanbanPedidosComponent, CadetesLibresComponent, RouterLink, FormsModule, LoadingSkeletonComponent, PedidoDetalleModalComponent, NuevaIncidenciaModalComponent],
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
          <!-- Ordenar (2026-09-26): lo urgente arriba. -->
          <label class="flex items-center gap-1 text-xs text-gray-500">
            Ordenar:
            <select class="border border-gray-300 rounded px-1.5 py-1 text-xs" [ngModel]="orden()" (ngModelChange)="orden.set($event)" name="orden">
              <option value="normal">Normal</option>
              <option value="reclamos">Reclamos primero</option>
              <option value="retiro">Demorados en retirar</option>
              <option value="sin-asignar">Sin asignar hace más tiempo</option>
            </select>
          </label>
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
        <!-- Reclamos abiertos (2026-09-26): pedidos YA ENTREGADOS con un problema reportado por el
             cliente — no aparecen en "en curso", así que van acá arriba hasta que el reclamo se cierre. -->
        @if (activeTab() === 'activos' && reclamosAbiertos().length) {
          <div class="mb-4 rounded border border-red-300">
            <h2 class="font-semibold text-red-700 px-3 py-2 bg-red-50 border-b border-red-200">
              📣 Reclamos abiertos ({{ reclamosAbiertos().length }})
              <span class="text-xs font-normal text-red-600">
                — el cadete no recibe pedidos hasta que se cierren (se cierran solos si el cliente no responde)
              </span>
            </h2>
            <app-tabla-pedidos [pedidos]="reclamosAbiertos()" [mostrarAcciones]="false" (accion)="onAccion($event)" />
          </div>
        }

        @if (activeTab() === 'activos') {
          <!-- Qué significa cada color (2026-09-26): para que cualquiera lo lea sin preguntar. -->
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 mb-3">
            <span><span class="leyenda" style="background: rgba(139, 92, 246, 0.35)"></span>Sin asignar hace rato</span>
            <span><span class="leyenda" style="background: rgba(245, 158, 11, 0.35)"></span>Reclamo: demora en el retiro</span>
            <span><span class="leyenda" style="background: rgba(249, 115, 22, 0.4)"></span>Reclamo: demora en la entrega</span>
            <span><span class="leyenda" style="background: rgba(220, 38, 38, 0.35)"></span>Reclamo: problema con la entrega</span>
            <span>Parpadea = nadie lo miró todavía</span>
          </div>
        }

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
              {{ p.origenDireccion }} → {{ p.destinoDireccion }} ·
              {{ p.requiereMoto ? 'Requiere moto' : 'Cualquier vehículo' }}
            </p>
            @if (buscandoSugerencia()) {
              <p class="text-xs text-gray-400">Buscando un candidato sugerido…</p>
            } @else if (sugerido()) {
              <p class="text-xs text-emerald-700">
                Sugerido por el sistema: {{ sugerido()!.nombre }} {{ sugerido()!.apellido }} (el más cercano libre que
                cumple los topes de distancia). Podés confirmarlo o elegir otro cadete abajo.
              </p>
            } @else {
              <p class="text-xs text-amber-700">
                El sistema no encontró ningún cadete libre cerca — elegí uno a mano.
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
                Marcá uno o más pedidos con orígenes cercanos entre sí para agruparlos en una sola tanda de ofertas
                a este cadete (necesita "Máx. viajes simultáneos" configurado en 2 o más para que le entren varios a
                la vez).
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
                      <span class="text-gray-400">({{ p.requiereMoto ? 'Requiere moto' : 'Cualquier vehículo' }})</span>
                    </span>
                  </label>
                }
              </div>
              @if (loteOrigenesLejos()) {
                <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs px-2.5 py-1.5">
                  Todos los pedidos que agrupes tienen que tener orígenes cercanos entre sí.
                </div>
              }
            }
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModalAsignarDesdeCadete()">Cancelar</button>
            <button
              type="button"
              class="btn bg-indigo-600 hover:bg-indigo-700"
              [disabled]="pedidoIdsParaCadete.length === 0 || loteOrigenesLejos()"
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

    @if (pedidoAQuitar(); as p) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModalQuitar()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Quitar pedido {{ p.numero }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarModalQuitar()">
              ✕
            </button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <p class="text-sm text-gray-600">
              El cadete cobra por porcentaje: al aceptar este pedido ya se le descontó la comisión de su saldo.
            </p>
            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="devolverComisionModal" />
              <span class="text-sm text-gray-700">Devolver la comisión descontada al cadete</span>
            </label>
            <p class="text-xs text-gray-400">
              Desmarcá esto si el motivo de sacarle el pedido no le corresponde a la cadetería devolvérsela.
            </p>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModalQuitar()">Volver</button>
            <button type="button" class="btn bg-amber-600 hover:bg-amber-700" (click)="confirmarQuitar()">✔ Quitar pedido</button>
          </div>
        </div>
      </div>
    }

    <app-pedido-detalle-modal [pedidoId]="pedidoDetalleId()" (cerrar)="pedidoDetalleId.set(null)" />
    <app-nueva-incidencia-modal [pedidoId]="pedidoParaIncidencia()" (cerrar)="pedidoParaIncidencia.set(null)" />

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
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">¿Por qué lo finalizás vos? (obligatorio)</span>
              <textarea
                class="input"
                rows="2"
                maxlength="500"
                [(ngModel)]="motivoFinalizarModal"
                name="motivoFinalizarModal"
                placeholder="Ej: el cadete se quedó sin batería y confirmó por teléfono que lo entregó"
              ></textarea>
              <span class="text-xs text-gray-400">
                Queda guardado quién lo finalizó, cuándo y por qué, y el pedido figura "Finalizado por el admin".
              </span>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModalFinalizar()">Cancelar</button>
            <button
              type="button"
              class="btn bg-blue-600 hover:bg-blue-700"
              [disabled]="!motivoFinalizarModal.trim()"
              (click)="confirmarFinalizar()"
            >
              ✔ Confirmar finalización
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .leyenda {
        display: inline-block;
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 0.2rem;
        margin-right: 0.3rem;
        vertical-align: -0.1rem;
      }
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
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly config = inject(ConfiguracionService);
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

  /** Orden de las tablas de activos (2026-09-26). */
  readonly orden = signal<'normal' | 'reclamos' | 'retiro' | 'sin-asignar'>('normal');

  readonly pendientes = computed(() =>
    this.ordenar(this.pedidos.pedidos().filter((p) => !ESTADOS_EN_CURSO.has(p.estado.id) && this.coincideBusqueda(p)))
  );
  readonly enCurso = computed(() =>
    this.ordenar(this.pedidos.pedidos().filter((p) => ESTADOS_EN_CURSO.has(p.estado.id) && this.coincideBusqueda(p)))
  );

  /**
   * Reclamos: problema con la entrega > demora en el retiro > demora en la entrega, el más viejo
   * primero. Demorados en retirar: aceptados sin "Retirado", el que aceptó hace más primero. Sin
   * asignar: el más viejo primero. El resto queda en el orden de siempre, abajo.
   */
  private ordenar(lista: Pedido[]): Pedido[] {
    const orden = this.orden();
    if (orden === 'normal') return lista;
    const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER);
    const clave = (p: Pedido): [number, number] => {
      if (orden === 'reclamos') {
        const activo = !!p.reclamoEstado && p.reclamoEstado !== 'CERRADO';
        const peso = !activo ? 9 : p.reclamoTipo === 'PROBLEMA_ENTREGA' ? 0 : p.reclamoTipo === 'DEMORA_RETIRO' ? 1 : 2;
        return [peso, ms(p.reclamoEn)];
      }
      if (orden === 'retiro') {
        const demorado = p.estado.id === 'EN_CURSO' && !!p.aceptadoEn && !p.retiradoEn;
        return [demorado ? 0 : 9, ms(p.aceptadoEn)];
      }
      return [p.estado.id === 'SIN_ASIGNAR' ? 0 : 9, ms(p.creadoEn)];
    };
    return [...lista].sort((a, b) => {
      const [pa, ta] = clave(a);
      const [pb, tb] = clave(b);
      return pa - pb || (pa === 9 ? 0 : ta - tb);
    });
  }
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
  motivoFinalizarModal = '';

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
  loteOrigenesLejos(): boolean {
    // Ancla en el orden de click (`pedidoIdsParaCadete`), no en el orden de la lista mostrada —
    // el backend (`PedidoService.asignarLote`) ancla su chequeo de distancia en `pedidoIds.get(0)`,
    // que es el primer elemento del array que el front manda en el body (este mismo orden de click).
    const seleccionados = this.pedidoIdsParaCadete
      .map((id) => this.pedidosSinAsignar().find((p) => p.id === id))
      .filter((p): p is Pedido => p != null);
    if (seleccionados.length < 2) return false;
    const topeKm = Number(this.config.valores()['distancia_maxima_lote_km']) || 3;
    const [primero, ...resto] = seleccionados;
    return resto.some((p) => this.distanciaKm(primero.origenLat, primero.origenLng, p.origenLat, p.origenLng) > topeKm);
  }

  private distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  readonly pedidoACancelar = signal<Pedido | null>(null);
  motivoCancelacionModal: string | null = null;

  /** Solo se abre para un cadete PORCENTAJE — a un SEMANAL se lo sigue quitando al toque. */
  readonly pedidoAQuitar = signal<Pedido | null>(null);
  devolverComisionModal = true;

  /** Detalle del pedido abierto (componente compartido con la pantalla "Pedidos", 2026-11-11). */
  readonly pedidoDetalleId = signal<string | null>(null);
  readonly pedidoParaIncidencia = signal<string | null>(null);

  /** Pedidos entregados con un reclamo sin cerrar (2026-09-26). */
  readonly reclamosAbiertos = signal<Pedido[]>([]);

  cargarReclamosAbiertos(): void {
    this.pedidos.reclamosAbiertos().subscribe((lista) => this.reclamosAbiertos.set(lista));
  }

  ngOnInit(): void {
    this.cargarReclamosAbiertos();
    this.cadetesSvc.ensureLoaded();
    this.config.ensureLoaded();
    const tabInicial = this.activeTab();
    if (tabInicial === 'finalizados') {
      this.cargarFinalizadosPagina();
    } else {
      this.pedidos.cargar(tabInicial);
    }
    this.desuscribirPedidos = this.realtime.subscribe('/topic/admin/pedidos', (body) => {
      // Cualquier cambio de un pedido puede abrir o cerrar un reclamo.
      this.cargarReclamosAbiertos();
      const tab = this.activeTab();
      if (tab === 'finalizados') {
        // Paginado/filtrado en el backend, no es la lista "activos" cara — se deja como reload.
        this.cargarFinalizadosPagina();
        return;
      }
      const pedido = body as Pedido | null;
      if (!pedido?.id || !pedido.estado?.id) {
        // Payload inesperado (no debería pasar, publicarPedido siempre manda el pedido completo) — fallback seguro.
        this.pedidos.reload();
        return;
      }
      // Evita el refetch completo de `GET /admin/pedidos?tipo=...` ante cada evento (pedido
      // nuevo, asignación, entrega, cancelación): se aplica un patch incremental con el dato
      // que ya trae el propio evento — el backend siempre publica el `PedidoResponse` completo.
      this.pedidos.patch(pedido, (p) =>
        tab === 'programados' ? p.estado.id === 'PROGRAMADO' : ESTADOS_ACTIVOS.includes(p.estado.id),
      );
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
      | 'editar'
      | 'reasignar'
      | 'anular'
      | 'quitar'
      | 'finalizar'
      | 'avisar-cliente'
      | 'reintentar-entrega'
      | 'imprimir'
      | 'detalle'
      | 'incidencia'
      | 'prioritario'
      | 'buscar-cliente'
      | 'reclamo-visto'
      | 'reclamo-cerrar';
    pedido: Pedido;
  }): void {
    const { accion, pedido } = ev;
    if (accion === 'avisar-cliente') {
      this.avisarClientePorWhatsapp(pedido);
      return;
    }
    if (accion === 'reclamo-visto') {
      this.pedidos.reclamoVisto(pedido.id, () => this.cargarReclamosAbiertos());
      return;
    }
    if (accion === 'reclamo-cerrar') {
      this.pedidos.reclamoCerrar(pedido.id, () => this.cargarReclamosAbiertos());
      return;
    }
    if (accion === 'incidencia') {
      this.abrirNuevaIncidenciaDePedido(pedido.id);
      return;
    }
    if (accion === 'prioritario') {
      this.pedidos.setPrioritario(pedido.id, !pedido.prioritario);
      return;
    }
    if (accion === 'buscar-cliente') {
      this.busqueda.set(pedido.clienteTelefono);
      return;
    }
    if (accion === 'asignar') {
      this.abrirModalAsignar(pedido, false);
    } else if (accion === 'editar') {
      this.router.navigate(['/pedidos', pedido.id, 'editar']);
    } else if (accion === 'reasignar') {
      this.abrirModalAsignar(pedido, true);
    } else if (accion === 'anular') {
      this.motivoCancelacionModal = 'CLIENTE';
      this.pedidoACancelar.set(pedido);
    } else if (accion === 'quitar') {
      const cadete = pedido.cadeteAsignado && this.cadetesSvc.cadetes().find((c) => c.id === pedido.cadeteAsignado!.id);
      if (cadete?.modalidadPago === 'PORCENTAJE') {
        this.devolverComisionModal = true;
        this.pedidoAQuitar.set(pedido);
      } else {
        this.toast.conDeshacer(`Se le va a quitar el pedido #${pedido.numero} al cadete…`, () => this.pedidos.quitar(pedido.id));
      }
    } else if (accion === 'finalizar') {
      this.receptorNombreModal = '';
      this.motivoFinalizarModal = '';
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

  cerrarModalQuitar(): void {
    this.pedidoAQuitar.set(null);
  }

  confirmarQuitar(): void {
    const p = this.pedidoAQuitar();
    if (!p) return;
    const devolverComision = this.devolverComisionModal;
    this.pedidoAQuitar.set(null);
    const aviso = devolverComision
      ? `Se le va a quitar el pedido #${p.numero} al cadete (se le devuelve la comisión)…`
      : `Se le va a quitar el pedido #${p.numero} al cadete (sin devolverle la comisión)…`;
    this.toast.conDeshacer(aviso, () => this.pedidos.quitar(p.id, devolverComision));
  }

  /** Mejora 71 — share sheet nativo si el navegador lo soporta (Chrome/Edge en Android y desktops recientes); si no, descarga el PDF para adjuntarlo a mano. */
  /**
   * "Avisar al cliente" (2026-09-26): abre la app de escritorio de WhatsApp (la cuenta de la
   * cadetería) en el chat del cliente con el aviso "en camino" ya escrito; el admin solo aprieta
   * Enter. No se usa WhatsApp Web a propósito: no deja abrir un chat sin recargar la pestaña y
   * desconecta la otra pestaña donde el admin chatea con los clientes. La app y WhatsApp Web son
   * dispositivos vinculados distintos, así que conviven con la misma cuenta. Tocarlo cuenta como avisado.
   */
  avisarClientePorWhatsapp(p: Pedido): void {
    this.pedidos.avisoWhatsapp(p.id).subscribe({
      next: (aviso) => {
        window.location.href = `whatsapp://send?phone=${aviso.telefono}&text=${encodeURIComponent(aviso.texto)}`;
        this.pedidos.reload();
      },
      error: () => this.toast.error('No se pudo armar el aviso (¿el pedido tiene teléfono del cliente?).'),
    });
  }

  private abrirModalDetalle(id: string): void {
    this.pedidoDetalleId.set(id);
  }

  abrirNuevaIncidenciaDePedido(pedidoId: string): void {
    this.pedidoParaIncidencia.set(pedidoId);
  }

  cerrarModalFinalizar(): void {
    this.pedidoAFinalizar.set(null);
  }

  confirmarFinalizar(): void {
    const p = this.pedidoAFinalizar();
    if (!p) return;
    const motivo = this.motivoFinalizarModal.trim();
    if (!motivo) return;
    this.pedidos.finalizar(p.id, { receptorNombre: this.receptorNombreModal.trim() || null, fotoUrl: null, motivo });
    this.pedidoAFinalizar.set(null);
  }

  /** Botón "Asignar"/"Reasignar": el sistema sugiere un candidato (distancia + FIFO), el admin confirma o elige otro. */
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
    if (!c || this.pedidoIdsParaCadete.length === 0 || this.loteOrigenesLejos()) return;
    if (this.pedidoIdsParaCadete.length === 1) {
      this.pedidos.asignar(this.pedidoIdsParaCadete[0], c.id, () => this.cadeteParaAsignar.set(null));
    } else {
      this.pedidos.asignarLote(this.pedidoIdsParaCadete, c.id, () => this.cadeteParaAsignar.set(null));
    }
  }
}
