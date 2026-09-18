import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CadeteService } from '../../core/services/cadete.service';
import { IncidenciaService } from '../../core/services/incidencia.service';
import { ToastService } from '../../core/services/toast.service';
import { AvisoGeneral, Cadete, CadeteEstadoLog } from '../../core/models/cadete.model';
import { PrioridadIncidencia } from '../../core/models/incidencia.model';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

const ESTADO_CLASES: Record<string, string> = {
  LIBRE: 'bg-emerald-100 text-emerald-700',
  OCUPADO: 'bg-amber-100 text-amber-800',
  DESCONECTADO: 'bg-gray-200 text-gray-600',
};

type TabCadetes = 'activos' | 'baja';
const TABS: Array<{ tipo: TabCadetes; label: string }> = [
  { tipo: 'activos', label: 'Activos' },
  { tipo: 'baja', label: 'Dados de baja' },
];

@Component({
  selector: 'app-cadetes',
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Cadetes</h1>
        <div class="flex gap-2">
          <button type="button" class="btn-action bg-amber-500 hover:bg-amber-600" (click)="abrirAviso()">
            📢 Aviso general
          </button>
          <a routerLink="/cadetes/solicitudes" class="btn-action bg-indigo-600 hover:bg-indigo-700">📝 Solicitudes de alta</a>
          <a routerLink="/cadetes/nuevo" class="btn-action bg-emerald-600 hover:bg-emerald-700">+ Nuevo cadete</a>
        </div>
      </div>

      <div class="border-b border-gray-200 px-4 flex items-center gap-4 text-sm">
        @for (tab of tabs; track tab.tipo) {
          <button
            type="button"
            class="py-3 border-b-2 -mb-px transition-colors"
            [class.border-brand-600]="tab.tipo === activeTab()"
            [class.text-brand-600]="tab.tipo === activeTab()"
            [class.border-transparent]="tab.tipo !== activeTab()"
            [class.text-gray-500]="tab.tipo !== activeTab()"
            (click)="activeTab.set(tab.tipo)"
          >
            {{ tab.label }} ({{ contarPorTab(tab.tipo) }})
          </button>
        }
      </div>

      <div class="px-4 py-2 border-b border-gray-200 flex flex-wrap items-center gap-2">
        <input
          type="search"
          class="input w-full sm:w-80"
          placeholder="Buscar por nombre, DNI, teléfono o usuario…"
          [ngModel]="busqueda()"
          (ngModelChange)="busqueda.set($event)"
          name="busqueda"
        />
        @if (activeTab() === 'activos') {
          <div class="flex gap-1.5 flex-wrap">
            <button type="button" class="btn-mini" [class]="claseFiltroEstado('')" (click)="filtroEstado.set('')">Todos</button>
            <button type="button" class="btn-mini" [class]="claseFiltroEstado('LIBRE')" (click)="filtroEstado.set('LIBRE')">Libre</button>
            <button type="button" class="btn-mini" [class]="claseFiltroEstado('OCUPADO')" (click)="filtroEstado.set('OCUPADO')">Ocupado</button>
            <button type="button" class="btn-mini" [class]="claseFiltroEstado('DESCONECTADO')" (click)="filtroEstado.set('DESCONECTADO')">
              Desconectado
            </button>
          </div>
        }
      </div>

      <div class="p-4 overflow-x-auto">
        @if (cadetes.loading()) {
          <app-loading-skeleton [filas]="6" />
        } @else if (cadetes.errored()) {
          <p class="text-red-600 text-sm py-6 text-center">No se pudieron cargar los cadetes.</p>
        } @else {
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-200">
                <th class="py-2 pr-3 font-medium">Nombre</th>
                <th class="py-2 pr-3 font-medium">DNI</th>
                <th class="py-2 pr-3 font-medium">Teléfono</th>
                <th class="py-2 pr-3 font-medium">Usuario</th>
                <th class="py-2 pr-3 font-medium" title="Versión de APK con la que se logueó la última vez">App</th>
                <th class="py-2 pr-3 font-medium">Vehículo</th>
                <th class="py-2 pr-3 font-medium">Calificación</th>
                <th class="py-2 pr-3 font-medium">Estado</th>
                <th class="py-2 pr-3 font-medium">Pago</th>
                <th class="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              @for (c of cadetesFiltrados(); track c.id) {
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.nombre }} {{ c.apellido }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.dni }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.telefono }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.username }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    @if (c.ultimaVersionApp != null) {
                      <span [title]="'Último login: ' + (c.ultimaVersionAppEn | date: 'short')">v{{ c.ultimaVersionApp }}</span>
                    } @else {
                      <span class="text-xs text-gray-400">—</span>
                    }
                  </td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.tipoVehiculo.nombre }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    @if (c.calificacionPromedio != null) {
                      <span title="{{ c.calificacionCantidad }} calificación(es)">
                        ⭐ {{ c.calificacionPromedio | number: '1.1-1' }}
                        <span class="text-xs text-gray-400">({{ c.calificacionCantidad }})</span>
                      </span>
                    } @else {
                      <span class="text-xs text-gray-400">Sin calificar</span>
                    }
                  </td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    <div class="flex items-center gap-1">
                      <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="claseEstado(c)">
                        {{ c.estado.nombre }}
                      </span>
                      @if (c.estado.id !== 'LIBRE') {
                        <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="marcarLibre(c)">
                          Libre
                        </button>
                      }
                    </div>
                  </td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    @if (c.modalidadPago === 'SEMANAL') {
                      <div class="flex items-center gap-1">
                        <span
                          class="px-2 py-0.5 rounded text-xs font-medium"
                          [class]="c.habilitadoPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                        >
                          {{ c.habilitadoPago ? 'Al día' : 'Debe la semana' }}
                        </span>
                        <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="abrirPagoSemanal(c)">
                          💵
                        </button>
                      </div>
                      @if (c.pagoSemanalVenceEn) {
                        <span class="text-xs text-amber-600">vence {{ c.pagoSemanalVenceEn | date: 'short' }}</span>
                      }
                    } @else {
                      <div class="flex items-center gap-1">
                        <span
                          class="px-2 py-0.5 rounded text-xs font-medium"
                          [class]="c.creditoDisponible > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                        >
                          $ {{ c.creditoDisponible | number: '1.0-0' }}
                        </span>
                        <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="abrirCredito(c)">
                          💵
                        </button>
                      </div>
                    }
                  </td>
                  <td class="py-2 pr-3 whitespace-nowrap flex gap-1">
                    @if (c.lat != null && c.lng != null) {
                      <a [routerLink]="['/mapa']" [queryParams]="{ cadeteId: c.id }" class="btn-mini bg-purple-600 hover:bg-purple-700">
                        📍 Encontrar
                      </a>
                    }
                    <a [routerLink]="['/hoja-ruta', c.id]" target="_blank" class="btn-mini bg-indigo-600 hover:bg-indigo-700">
                      🖨️ Hoja de ruta
                    </a>
                    <button
                      type="button"
                      class="btn-mini"
                      [class]="c.activo ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'"
                      (click)="toggleActivo(c)"
                    >
                      {{ c.activo ? 'Dar de baja' : 'Reactivar' }}
                    </button>
                    <button type="button" class="btn-mini bg-amber-600 hover:bg-amber-700" (click)="abrirIncidenciaCadete(c)">
                      🚨 Incidencia
                    </button>
                    <a [routerLink]="['/cadetes', c.id, 'ficha']" class="btn-mini bg-gray-600 hover:bg-gray-700">📊 Ficha</a>
                    <a [routerLink]="['/cadetes', c.id]" class="btn-mini bg-brand-600 hover:bg-brand-700">Editar</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9">
                    <app-empty-state
                      icono="🏍️"
                      [mensaje]="activeTab() === 'baja' ? 'No hay cadetes dados de baja.' : 'No hay cadetes que coincidan con el filtro.'"
                      [hint]="activeTab() === 'baja' ? '' : 'Dalos de alta con el botón de arriba.'"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>

    @if (mostrarAviso()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarAviso()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Aviso general</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarAviso()">
              ✕
            </button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <p class="text-sm text-gray-600">
              Se manda a todos los cadetes conectados ahora mismo (Libres u Ocupados, no Desconectados) — por
              WebSocket si tienen la app abierta, y por notificación push si no.
            </p>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Mensaje</span>
              <textarea class="input" rows="3" [(ngModel)]="mensajeAviso" name="mensajeAviso" placeholder="Ej: cerramos temprano hoy"></textarea>
            </label>

            @if (avisosRecientes().length > 0) {
              <div class="border-t border-gray-200 pt-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Avisos recientes</h3>
                <div class="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  @for (a of avisosRecientes(); track a.id) {
                    <div class="bg-gray-50 rounded px-2.5 py-1.5 text-sm">
                      <div class="text-gray-700">{{ a.mensaje }}</div>
                      <div class="text-xs text-gray-400 mt-0.5">
                        {{ a.enviadoEn | date: 'short' }} · confirmado por {{ a.totalLeido }}/{{ a.totalDestinatarios }}
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarAviso()">Cancelar</button>
            <button type="button" class="btn bg-amber-600 hover:bg-amber-700" [disabled]="!mensajeAviso.trim()" (click)="enviarAviso()">
              📢 Enviar aviso
            </button>
          </div>
        </div>
      </div>
    }

    @if (cadeteParaPago(); as c) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarPagoSemanal()">
        <div class="bg-white rounded shadow-lg w-full max-w-sm" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Pago semanal — {{ c.nombre }} {{ c.apellido }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarPagoSemanal()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Monto pagado</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="montoPagadoModal" name="montoPagadoModal" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Vence el resto (si el pago es parcial)</span>
              <input type="datetime-local" class="input" [(ngModel)]="venceEnModal" name="venceEnModal" />
            </label>
            <p class="text-xs text-gray-400">
              Si paga el total de la cuota configurada, se lo habilita sin vencimiento. Si paga menos, hace falta
              poner hasta cuándo tiene para completar el resto — si no lo hace, se lo deshabilita solo.
            </p>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarPagoSemanal()">Cancelar</button>
            <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" (click)="confirmarPagoSemanal()">✔ Habilitar</button>
          </div>
        </div>
      </div>
    }

    @if (cadeteParaCredito(); as c) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarCredito()">
        <div class="bg-white rounded shadow-lg w-full max-w-sm" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Cargar crédito — {{ c.nombre }} {{ c.apellido }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarCredito()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <p class="text-sm text-gray-600">Crédito actual: $ {{ c.creditoDisponible | number: '1.0-0' }}</p>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Monto a acreditar (lo que transfirió)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="montoCreditoModal" name="montoCreditoModal" />
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarCredito()">Cancelar</button>
            <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="!montoCreditoModal" (click)="confirmarCredito()">
              ✔ Acreditar
            </button>
          </div>
        </div>
      </div>
    }

    @if (cadeteParaBaja(); as c) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarBaja()">
        <div class="bg-white rounded shadow-lg w-full max-w-sm" (click)="$event.stopPropagation()">
          <div class="bg-red-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Dar de baja — {{ c.nombre }} {{ c.apellido }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarBaja()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <p class="text-sm text-gray-600">No va a poder ingresar a la app ni recibir pedidos.</p>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Motivo (opcional, queda en el historial)</span>
              <textarea class="input" rows="2" [(ngModel)]="motivoBajaModal" name="motivoBajaModal"></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarBaja()">Cancelar</button>
            <button type="button" class="btn bg-red-600 hover:bg-red-700" (click)="confirmarBaja()">Dar de baja</button>
          </div>
        </div>
      </div>
    }

    @if (cadeteParaAlta(); as c) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarAlta()">
        <div class="bg-white rounded shadow-lg w-full max-w-sm" (click)="$event.stopPropagation()">
          <div class="bg-emerald-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Reactivar — {{ c.nombre }} {{ c.apellido }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarAlta()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            @if (ultimaBajaModal(); as b) {
              <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">
                ⚠ Atención: este cadete fue dado de baja
                @if (b.cambiadoEn) {
                  el {{ b.cambiadoEn | date: 'short' }}
                }
                por: <strong>{{ b.motivo || 'sin motivo cargado' }}</strong>.
              </div>
            } @else {
              <p class="text-sm text-gray-600">No hay un motivo de baja registrado para este cadete.</p>
            }
            <p class="text-sm text-gray-600">Va a poder volver a ingresar a la app y recibir pedidos.</p>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarAlta()">Cancelar</button>
            <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" (click)="confirmarAlta()">✔ Reactivar</button>
          </div>
        </div>
      </div>
    }

    @if (cadeteParaIncidencia(); as c) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarIncidenciaCadete()">
        <div class="bg-white rounded shadow-lg w-full max-w-sm" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Incidencia — {{ c.nombre }} {{ c.apellido }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarIncidenciaCadete()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Título</span>
              <input class="input" [(ngModel)]="tituloIncidenciaCadeteModal" name="tituloIncidenciaCadeteModal" placeholder="Ej: Llegó tarde varias veces" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Prioridad</span>
              <select class="input" [(ngModel)]="prioridadIncidenciaCadeteModal" name="prioridadIncidenciaCadeteModal">
                <option value="BAJA">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="GRAVE">Grave (no le van a ofrecer pedidos automáticamente mientras siga abierta)</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Descripción (opcional)</span>
              <textarea class="input" rows="3" [(ngModel)]="descripcionIncidenciaCadeteModal" name="descripcionIncidenciaCadeteModal"></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarIncidenciaCadete()">Cancelar</button>
            <button
              type="button"
              class="btn bg-emerald-600 hover:bg-emerald-700"
              [disabled]="!tituloIncidenciaCadeteModal.trim()"
              (click)="confirmarIncidenciaCadete()"
            >
              ✔ Crear
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
      }
      .btn-mini {
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 0.3rem;
        display: inline-block;
      }
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        width: 100%;
      }
      textarea.input {
        font-family: inherit;
        resize: vertical;
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
      }
      .btn:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class CadetesComponent implements OnInit {
  readonly cadetes = inject(CadeteService);
  readonly incidencias = inject(IncidenciaService);
  private readonly toast = inject(ToastService);

  readonly cadeteParaBaja = signal<Cadete | null>(null);
  motivoBajaModal = '';

  readonly cadeteParaAlta = signal<Cadete | null>(null);
  readonly ultimaBajaModal = signal<CadeteEstadoLog | null>(null);

  readonly cadeteParaIncidencia = signal<Cadete | null>(null);
  tituloIncidenciaCadeteModal = '';
  descripcionIncidenciaCadeteModal = '';
  prioridadIncidenciaCadeteModal: PrioridadIncidencia = 'NORMAL';

  readonly mostrarAviso = signal(false);
  readonly avisosRecientes = signal<AvisoGeneral[]>([]);
  mensajeAviso = '';

  readonly tabs = TABS;
  readonly activeTab = signal<TabCadetes>('activos');
  readonly filtroEstado = signal<'' | 'LIBRE' | 'OCUPADO' | 'DESCONECTADO'>('');

  readonly busqueda = signal('');
  readonly cadetesFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const tab = this.activeTab();
    const estado = this.filtroEstado();
    return this.cadetes.cadetes().filter((c) => {
      if (c.activo !== (tab === 'activos')) return false;
      if (tab === 'activos' && estado && c.estado.id !== estado) return false;
      if (!q) return true;
      return (
        `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
        c.dni.toLowerCase().includes(q) ||
        c.telefono.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q)
      );
    });
  });

  /** Cuenta por solapa sin aplicar el filtro de estado/búsqueda — para el número al lado de cada solapa. */
  contarPorTab(tab: TabCadetes): number {
    return this.cadetes.cadetes().filter((c) => c.activo === (tab === 'activos')).length;
  }

  claseFiltroEstado(estado: string): string {
    return this.filtroEstado() === estado ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-300 hover:bg-gray-400 text-gray-700';
  }

  ngOnInit(): void {
    this.cadetes.ensureLoaded();
  }

  abrirAviso(): void {
    this.mensajeAviso = '';
    this.mostrarAviso.set(true);
    this.cadetes.listarAvisos().subscribe((avisos) => this.avisosRecientes.set(avisos));
  }

  cerrarAviso(): void {
    this.mostrarAviso.set(false);
  }

  enviarAviso(): void {
    const mensaje = this.mensajeAviso.trim();
    if (!mensaje) return;
    this.cadetes.avisoGeneral(mensaje, () => {
      this.mensajeAviso = '';
      this.cadetes.listarAvisos().subscribe((avisos) => this.avisosRecientes.set(avisos));
    });
  }

  claseEstado(c: Cadete): string {
    return ESTADO_CLASES[c.estado.id] ?? 'bg-gray-100 text-gray-600';
  }

  readonly cadeteParaPago = signal<Cadete | null>(null);
  montoPagadoModal: number | null = null;
  venceEnModal = '';

  abrirPagoSemanal(c: Cadete): void {
    this.montoPagadoModal = c.pagoSemanalMontoPagado;
    this.venceEnModal = '';
    this.cadeteParaPago.set(c);
  }

  cerrarPagoSemanal(): void {
    this.cadeteParaPago.set(null);
  }

  confirmarPagoSemanal(): void {
    const c = this.cadeteParaPago();
    if (!c || this.montoPagadoModal == null) return;
    const venceEn = this.venceEnModal ? new Date(this.venceEnModal).toISOString() : null;
    this.cadetes.habilitarPagoSemanal(c.id, { montoPagado: this.montoPagadoModal, venceEn }, () => this.cadeteParaPago.set(null));
  }

  readonly cadeteParaCredito = signal<Cadete | null>(null);
  montoCreditoModal: number | null = null;

  abrirCredito(c: Cadete): void {
    this.montoCreditoModal = null;
    this.cadeteParaCredito.set(c);
  }

  cerrarCredito(): void {
    this.cadeteParaCredito.set(null);
  }

  confirmarCredito(): void {
    const c = this.cadeteParaCredito();
    if (!c || !this.montoCreditoModal) return;
    this.cadetes.acreditar(c.id, this.montoCreditoModal, () => this.cadeteParaCredito.set(null));
  }

  toggleActivo(c: Cadete): void {
    if (!c.activo) {
      this.ultimaBajaModal.set(null);
      this.cadeteParaAlta.set(c);
      this.cadetes.historialEstado(c.id).subscribe((historial) => {
        this.ultimaBajaModal.set(historial.find((h) => !h.activo) ?? null);
      });
      return;
    }
    this.motivoBajaModal = '';
    this.cadeteParaBaja.set(c);
  }

  cerrarBaja(): void {
    this.cadeteParaBaja.set(null);
  }

  cerrarAlta(): void {
    this.cadeteParaAlta.set(null);
  }

  confirmarAlta(): void {
    const c = this.cadeteParaAlta();
    if (!c) return;
    this.cadeteParaAlta.set(null);
    this.cadetes.setActivo(c.id, true, null);
  }

  confirmarBaja(): void {
    const c = this.cadeteParaBaja();
    if (!c) return;
    const motivo = this.motivoBajaModal.trim() || null;
    this.cadeteParaBaja.set(null);
    this.toast.conDeshacer(`Se va a dar de baja a ${c.nombre} ${c.apellido}…`, () => this.cadetes.setActivo(c.id, false, motivo));
  }

  abrirIncidenciaCadete(c: Cadete): void {
    this.tituloIncidenciaCadeteModal = '';
    this.descripcionIncidenciaCadeteModal = '';
    this.prioridadIncidenciaCadeteModal = 'NORMAL';
    this.cadeteParaIncidencia.set(c);
  }

  cerrarIncidenciaCadete(): void {
    this.cadeteParaIncidencia.set(null);
  }

  confirmarIncidenciaCadete(): void {
    const c = this.cadeteParaIncidencia();
    const titulo = this.tituloIncidenciaCadeteModal.trim();
    if (!c || !titulo) return;
    this.incidencias.crear(
      {
        titulo,
        descripcion: this.descripcionIncidenciaCadeteModal.trim() || null,
        cadeteId: c.id,
        prioridad: this.prioridadIncidenciaCadeteModal,
      },
      () => this.cadeteParaIncidencia.set(null),
    );
  }

  marcarLibre(c: Cadete): void {
    this.cadetes.marcarLibre(c.id);
  }
}
