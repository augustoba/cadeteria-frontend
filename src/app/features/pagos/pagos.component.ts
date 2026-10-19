import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CadeteService } from '../../core/services/cadete.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { MetricasService } from '../../core/services/metricas.service';
import { Cadete, MOVIMIENTO_CREDITO, MovimientoCredito } from '../../core/models/cadete.model';
import { CadeteMetrica } from '../../core/models/metricas.model';

function lunesDeEstaSemana(): string {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = (dia === 0 ? -6 : 1) - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

function domingoDe(lunesIso: string): string {
  const domingo = new Date(lunesIso + 'T00:00:00');
  domingo.setDate(domingo.getDate() + 6);
  return domingo.toISOString().slice(0, 10);
}

/** Cómo está cada cadete con el cobro, para la lista y la cabecera del detalle. */
type EstadoCobro = 'AL_DIA' | 'PARCIAL' | 'DEBE' | 'CON_CREDITO' | 'SIN_CREDITO';

function estadoCobro(c: Cadete): EstadoCobro {
  if (c.modalidadPago === 'PORCENTAJE') return c.creditoDisponible > 0 ? 'CON_CREDITO' : 'SIN_CREDITO';
  if (!c.habilitadoPago) return 'DEBE';
  return c.pagoSemanalVenceEn ? 'PARCIAL' : 'AL_DIA';
}

const PUEDE_TRABAJAR: Record<EstadoCobro, boolean> = {
  AL_DIA: true,
  PARCIAL: true,
  CON_CREDITO: true,
  DEBE: false,
  SIN_CREDITO: false,
};

/**
 * Pantalla "Pagos" unificada — antes esto y la lista de Cadetes tenían DOS mecanismos de
 * pago semanal totalmente separados: un log simple "Pagado sí/no" acá (PagoSemanalService,
 * no tocaba nada más) y el habilitadoPago real del cadete (el único que de verdad lo
 * habilita a recibir viajes), editable solo desde un botón en la lista de Cadetes. Un admin
 * podía marcar "Pagado" acá creyendo que ya estaba resuelto y el cadete seguía bloqueado
 * para que le asignen pedidos. Ahora todo el flujo de pago real vive acá, en un solo lugar:
 * habilitar (registrando el pago), deshabilitar por falta de pago (sin darlo de baja) y
 * cargar crédito.
 */
@Component({
  selector: 'app-pagos',
  imports: [FormsModule, DecimalPipe, DatePipe],
  template: `
    <div class="flex flex-col gap-4">
      @if (sinPoderTrabajar().length > 0) {
        <div class="bg-amber-50 border border-amber-200 rounded px-4 py-3 text-sm text-amber-800">
          {{ sinPoderTrabajar().length }} cadete(s) no pueden trabajar por falta de pago: {{ nombresSinPoderTrabajar() }}
        </div>
      }

      <div class="bg-white rounded shadow-sm flex flex-col md:flex-row min-h-[24rem]">
        <aside class="md:w-72 border-b md:border-b-0 md:border-r border-gray-200 shrink-0">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t md:rounded-tr-none font-semibold">Cadetes</div>
          <div class="overflow-y-auto max-h-[32rem]">
            @for (c of listado(); track c.id) {
              <button
                type="button"
                class="w-full text-left px-4 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 flex items-center gap-2"
                [class.bg-brand-50]="c.id === seleccionado()?.id"
                (click)="elegir(c)"
              >
                <span class="min-w-0 truncate">{{ c.nombre }} {{ c.apellido }}</span>
                <span class="ml-auto shrink-0 px-2 py-0.5 rounded text-xs font-medium" [class]="claseChip(c)">
                  {{ textoChip(c) }}
                </span>
              </button>
            } @empty {
              <p class="text-sm text-gray-400 p-4">Sin cadetes activos.</p>
            }
          </div>
        </aside>

        <div class="flex-1 p-4 min-w-0">
          @if (seleccionado(); as c) {
            @if (mensaje(); as m) {
              <div class="rounded bg-emerald-50 text-emerald-700 text-sm px-3 py-2 mb-3">{{ m }}</div>
            }

            <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h1 class="font-semibold text-gray-800 text-lg">{{ c.nombre }} {{ c.apellido }}</h1>
                <p class="text-sm text-gray-500">
                  {{ c.modalidadPago === 'SEMANAL' ? 'Paga una cuota fija por semana' : 'Paga con crédito: se le descuenta un % de cada viaje' }}
                </p>
              </div>
              <span class="px-3 py-1 rounded text-sm font-medium" [class]="claseChip(c)">
                {{ puedeTrabajar(c) ? 'Puede trabajar' : 'No puede trabajar' }}
              </span>
            </div>

            @if (c.modalidadPago === 'SEMANAL') {
              <section class="border border-gray-200 rounded p-4 mb-4 max-w-xl">
                <h2 class="text-sm font-semibold text-gray-700 mb-2">Esta semana</h2>
                @switch (estado(c)) {
                  @case ('AL_DIA') {
                    <p class="text-sm text-gray-700">
                      Pagó la cuota
                      @if (c.pagoSemanalMontoPagado != null) {
                        ($ {{ c.pagoSemanalMontoPagado | number: '1.0-0' }})
                      }
                      — está habilitado hasta el lunes.
                    </p>
                  }
                  @case ('PARCIAL') {
                    <p class="text-sm text-gray-700">
                      Pagó $ {{ c.pagoSemanalMontoPagado | number: '1.0-0' }} de $ {{ cuotaDe(c) | number: '1.0-0' }}. Tiene hasta
                      el {{ c.pagoSemanalVenceEn | date: 'dd/MM HH:mm' }} para completar; si no, se deshabilita solo.
                    </p>
                  }
                  @case ('DEBE') {
                    <p class="text-sm text-gray-700">
                      No pagó la semana: no puede entrar a la app ni recibir viajes hasta que registres el pago.
                    </p>
                  }
                }
                @if (puedeTrabajar(c)) {
                  @if (confirmandoDeshabilitar()) {
                    <div class="mt-3 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex flex-col gap-2">
                      <p>
                        Deja de recibir viajes y no puede volver a entrar a la app hasta que registres el pago. Si tiene
                        viajes sin terminar, los termina. No es una baja: la cuenta sigue activa.
                      </p>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="btn bg-red-600 hover:bg-red-700"
                          [disabled]="cadetes.saving()"
                          (click)="deshabilitar()"
                        >
                          Sí, deshabilitar
                        </button>
                        <button type="button" class="btn-sec" (click)="confirmandoDeshabilitar.set(false)">Cancelar</button>
                      </div>
                    </div>
                  } @else {
                    <button
                      type="button"
                      class="btn bg-red-600 hover:bg-red-700 mt-3"
                      (click)="confirmandoDeshabilitar.set(true)"
                    >
                      Deshabilitar por falta de pago
                    </button>
                  }
                }
              </section>

              <section class="border border-gray-200 rounded p-4 mb-4 max-w-xl flex flex-col gap-3">
                <h2 class="text-sm font-semibold text-gray-700">
                  {{ puedeTrabajar(c) ? 'Registrar otro pago' : 'Registrar pago y habilitar' }}
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1">
                    <span class="text-sm text-gray-700">Cuota de la semana</span>
                    <input type="number" min="0" step="1" class="input" [(ngModel)]="montoSemanalModal" name="montoSemanalModal" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-sm text-gray-700">Pagó ahora</span>
                    <input type="number" min="0" step="1" class="input" [(ngModel)]="montoPagadoModal" name="montoPagadoModal" />
                  </label>
                </div>
                <p class="text-xs text-gray-400 -mt-1">La cuota se recuerda para las próximas semanas.</p>
                @if (faltaCalculado() > 0) {
                  <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
                    Falta $ {{ faltaCalculado() | number: '1.0-0' }}. Poné hasta cuándo tiene para completarlo; pasada esa fecha
                    se deshabilita solo.
                  </div>
                  <label class="flex flex-col gap-1 sm:max-w-xs">
                    <span class="text-sm text-gray-700">Vence</span>
                    <input type="datetime-local" class="input" [(ngModel)]="venceEnModal" name="venceEnModal" />
                  </label>
                }
                <button
                  type="button"
                  class="btn bg-emerald-600 hover:bg-emerald-700 self-start"
                  [disabled]="cadetes.saving() || montoPagadoModal == null"
                  (click)="confirmarPagoSemanal()"
                >
                  {{ puedeTrabajar(c) ? 'Guardar pago' : 'Guardar pago y habilitar' }}
                </button>
              </section>
            } @else {
              <section class="border border-gray-200 rounded p-4 mb-4 max-w-xl flex flex-col gap-3">
                <h2 class="text-sm font-semibold text-gray-700">Crédito</h2>
                <p class="text-2xl font-semibold" [class]="c.creditoDisponible > 0 ? 'text-gray-800' : 'text-red-600'">
                  $ {{ c.creditoDisponible | number: '1.0-0' }}
                </p>
                @if (c.creditoDisponible <= 0) {
                  <p class="text-sm text-gray-700">
                    Sin crédito no puede entrar a la app ni recibir viajes. Cargale lo que transfirió para habilitarlo.
                  </p>
                } @else {
                  <p class="text-sm text-gray-500">Recibe viajes mientras le alcance para la comisión de cada uno.</p>
                }
                <label class="flex flex-col gap-1 sm:max-w-xs">
                  <span class="text-sm text-gray-700">Agregar crédito (lo que transfirió)</span>
                  <input type="number" min="0" step="1" class="input" [(ngModel)]="montoCreditoModal" name="montoCreditoModal" />
                </label>
                <button
                  type="button"
                  class="btn bg-emerald-600 hover:bg-emerald-700 self-start"
                  [disabled]="cadetes.saving() || !montoCreditoModal"
                  (click)="confirmarCredito()"
                >
                  Agregar crédito
                </button>
              </section>

              <section class="border border-gray-200 rounded p-4 mb-4 max-w-xl flex flex-col gap-3">
                <h2 class="text-sm font-semibold text-gray-700">Últimos movimientos</h2>
                <p class="text-xs text-gray-400 -mt-2">
                  Si cargaste un crédito por error, anulalo: se resta con un movimiento nuevo y la carga queda tachada.
                  Puede dejarlo en negativo; así no entra a la app hasta que cargue.
                </p>
                <div class="overflow-x-auto border border-gray-200 rounded">
                  <table class="w-full text-sm border-collapse">
                    <thead class="bg-gray-50">
                      <tr class="text-left text-gray-500 border-b border-gray-200">
                        <th class="py-2 px-3 font-medium">Tipo</th>
                        <th class="py-2 px-3 font-medium">Monto</th>
                        <th class="py-2 px-3 font-medium">Saldo</th>
                        <th class="py-2 px-3 font-medium">Cuándo</th>
                        <th class="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of movimientos(); track m.id) {
                        <tr class="border-b border-gray-100 align-top">
                          <td class="py-1.5 px-3">
                            <span [class.line-through]="m.anuladoPorId">{{ tipoMovimiento[m.tipo].texto }}</span>
                            @if (m.pedidoNumero) {
                              <span class="text-gray-400"> #{{ m.pedidoNumero }}</span>
                            }
                            @if (m.motivo) {
                              <p class="text-xs text-gray-500">{{ m.motivo }}</p>
                            }
                          </td>
                          <td class="py-1.5 px-3 whitespace-nowrap">
                            {{ tipoMovimiento[m.tipo].resta ? '−' : '' }}$ {{ m.monto | number: '1.0-0' }}
                          </td>
                          <td class="py-1.5 px-3 whitespace-nowrap">$ {{ m.saldoResultante | number: '1.0-0' }}</td>
                          <td class="py-1.5 px-3 whitespace-nowrap text-gray-500">{{ m.creadoEn | date: 'dd/MM HH:mm' }}</td>
                          <td class="py-1.5 px-3 text-right">
                            @if (m.tipo === 'ACREDITACION' && !m.anuladoPorId && anulandoId() !== m.id) {
                              <button type="button" class="text-xs text-red-600 hover:underline" (click)="empezarAnular(m.id)">
                                Anular
                              </button>
                            }
                          </td>
                        </tr>
                        @if (anulandoId() === m.id) {
                          <tr class="border-b border-gray-100">
                            <td colspan="5" class="px-3 py-2 bg-red-50">
                              <div class="flex flex-col gap-2 text-sm text-red-800">
                                <span>Se le restan $ {{ m.monto | number: '1.0-0' }} del crédito.</span>
                                <input class="input" maxlength="255" placeholder="Motivo (ej. cargué 5000 en vez de 500)"
                                  [(ngModel)]="motivoAnular" name="motivoAnular" />
                                <div class="flex gap-2">
                                  <button type="button" class="btn bg-red-600 hover:bg-red-700"
                                    [disabled]="cadetes.saving() || !motivoAnular.trim()" (click)="anular(m.id)">
                                    Sí, anular
                                  </button>
                                  <button type="button" class="btn-sec" (click)="anulandoId.set(null)">Cancelar</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        }
                      } @empty {
                        <tr>
                          <td colspan="5" class="py-4 text-center text-gray-400">Todavía no hay movimientos.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <details class="text-sm">
                  <summary class="cursor-pointer text-gray-500 select-none">Ajustar el crédito a mano</summary>
                  <div class="mt-2 flex flex-col gap-2">
                    <p class="text-xs text-gray-400">
                      Para lo que no es una carga, por ejemplo cobrarle la diferencia de una comisión. Queda en el
                      historial con el motivo y tu usuario.
                    </p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select class="input" [(ngModel)]="ajusteOperacion" name="ajusteOperacion">
                        <option value="RESTAR">Restar</option>
                        <option value="SUMAR">Sumar</option>
                      </select>
                      <input type="number" min="0" step="1" class="input" placeholder="Monto"
                        [(ngModel)]="ajusteMonto" name="ajusteMonto" />
                    </div>
                    <input class="input" maxlength="255" placeholder="Motivo (ej. diferencia de comisión pedido 1500108)"
                      [(ngModel)]="ajusteMotivo" name="ajusteMotivo" />
                    <button type="button" class="btn bg-brand-600 hover:bg-brand-700 self-start"
                      [disabled]="cadetes.saving() || !ajusteMonto || ajusteMonto <= 0 || !ajusteMotivo.trim()"
                      (click)="ajustar()">
                      Guardar ajuste
                    </button>
                  </div>
                </details>
              </section>
            }

            <details class="max-w-xl text-sm">
              <summary class="cursor-pointer text-gray-500 select-none">Cambiar cómo paga</summary>
              <div class="mt-2 flex flex-col gap-2">
                <select class="input sm:max-w-xs" [ngModel]="c.modalidadPago" (ngModelChange)="cambiarModalidad($event)">
                  <option value="SEMANAL">Semanal (cuota fija)</option>
                  <option value="PORCENTAJE">Porcentaje (crédito)</option>
                </select>
                <p class="text-xs text-gray-400">
                  Si pasa a semanal, queda sin habilitar hasta que registres el pago de la semana.
                </p>
              </div>
            </details>
          } @else {
            <p class="text-gray-400 text-sm py-6 text-center">Elegí un cadete para ver o cargar sus pagos.</p>
          }
        </div>
      </div>

      <div class="bg-white rounded shadow-sm">
        <div
          class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between cursor-pointer select-none"
          (click)="arqueoAbierto.set(!arqueoAbierto())"
        >
          <h2 class="font-semibold">Monto cobrado por semana</h2>
          <span class="text-xs text-white/80">{{ arqueoAbierto() ? '▲ Ocultar' : '▼ Mostrar' }}</span>
        </div>
        @if (arqueoAbierto()) {
          <div class="p-4 overflow-x-auto">
            <label class="flex flex-col gap-1 max-w-xs mb-3">
              <span class="text-sm font-medium text-gray-700">Semana (lunes)</span>
              <input type="date" class="input" [ngModel]="semanaArqueo()" (ngModelChange)="cambiarSemanaArqueo($event)" />
            </label>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="text-left text-gray-500 border-b border-gray-200">
                  <th class="py-2 pr-3 font-medium">Cadete</th>
                  <th class="py-2 pr-3 font-medium">Viajes finalizados</th>
                  <th class="py-2 pr-3 font-medium">Monto total cobrado</th>
                </tr>
              </thead>
              <tbody>
                @for (c of arqueoCadetes(); track c.cadeteId) {
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-3 whitespace-nowrap">{{ c.nombre }} {{ c.apellido }}</td>
                    <td class="py-2 pr-3 whitespace-nowrap">{{ c.viajesFinalizados }}</td>
                    <td class="py-2 pr-3 whitespace-nowrap font-medium">$ {{ c.montoCobradoTotal | number: '1.0-0' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" class="py-6 text-center text-gray-400">Nadie finalizó pedidos esa semana.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.875rem;
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
      }
      .btn-sec {
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
        border: 1px solid #d1d5db;
        background: white;
        color: #374151;
      }
      .btn:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class PagosComponent implements OnInit {
  readonly cadetes = inject(CadeteService);
  private readonly config = inject(ConfiguracionService);
  private readonly metricasSvc = inject(MetricasService);

  private readonly seleccionadoId = signal<string | null>(null);
  /** Siempre la versión fresca de la lista: así el detalle se actualiza solo después de cada acción. */
  readonly seleccionado = computed(() => this.cadetes.cadetes().find((c) => c.id === this.seleccionadoId()) ?? null);
  readonly mensaje = signal<string | null>(null);
  readonly confirmandoDeshabilitar = signal(false);

  readonly arqueoAbierto = signal(false);
  readonly arqueoCadetes = signal<CadeteMetrica[]>([]);
  readonly semanaArqueo = signal(lunesDeEstaSemana());

  /** Solo los activos (los dados de baja no pagan), con los que no pueden trabajar primero. */
  readonly listado = computed(() =>
    this.cadetes
      .cadetes()
      .filter((c) => c.activo)
      .sort((a, b) => Number(this.puedeTrabajar(a)) - Number(this.puedeTrabajar(b)) || a.nombre.localeCompare(b.nombre)),
  );

  readonly sinPoderTrabajar = computed(() => this.listado().filter((c) => !this.puedeTrabajar(c)));

  montoSemanalModal: number | null = null;
  montoPagadoModal: number | null = null;
  venceEnModal = '';
  montoCreditoModal: number | null = null;

  /** Corregir el crédito (2026-10-19): historial con "Anular" y ajuste a mano. */
  readonly movimientos = signal<MovimientoCredito[]>([]);
  readonly tipoMovimiento = MOVIMIENTO_CREDITO;
  readonly anulandoId = signal<string | null>(null);
  motivoAnular = '';
  ajusteOperacion: 'SUMAR' | 'RESTAR' = 'RESTAR';
  ajusteMonto: number | null = null;
  ajusteMotivo = '';

  ngOnInit(): void {
    this.cadetes.ensureLoaded();
    this.config.ensureLoaded();
    this.cargarArqueoSemana();
  }

  estado(c: Cadete): EstadoCobro {
    return estadoCobro(c);
  }

  puedeTrabajar(c: Cadete): boolean {
    return PUEDE_TRABAJAR[estadoCobro(c)];
  }

  textoChip(c: Cadete): string {
    switch (estadoCobro(c)) {
      case 'AL_DIA':
        return 'Al día';
      case 'PARCIAL':
        return 'Pago parcial';
      case 'DEBE':
        return 'Debe la semana';
      case 'CON_CREDITO':
        return `$ ${Math.round(c.creditoDisponible).toLocaleString('es-AR')}`;
      case 'SIN_CREDITO':
        return 'Sin crédito';
    }
  }

  claseChip(c: Cadete): string {
    switch (estadoCobro(c)) {
      case 'AL_DIA':
      case 'CON_CREDITO':
        return 'bg-emerald-100 text-emerald-700';
      case 'PARCIAL':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-red-100 text-red-700';
    }
  }

  nombresSinPoderTrabajar(): string {
    return this.sinPoderTrabajar()
      .map((c) => `${c.nombre} ${c.apellido}`)
      .join(', ');
  }

  cambiarSemanaArqueo(lunesIso: string): void {
    this.semanaArqueo.set(lunesIso);
    this.cargarArqueoSemana();
  }

  private cargarArqueoSemana(): void {
    const lunes = this.semanaArqueo();
    this.metricasSvc.cadetes(lunes, domingoDe(lunes)).subscribe((c) => this.arqueoCadetes.set(c));
  }

  private montoSemanalPorDefecto(): number {
    return Number(this.config.valores()['pago_semanal_monto'] ?? 5000);
  }

  cuotaDe(c: Cadete): number {
    return c.montoSemanalActual ?? this.montoSemanalPorDefecto();
  }

  elegir(c: Cadete): void {
    this.mensaje.set(null);
    this.confirmandoDeshabilitar.set(false);
    this.seleccionadoId.set(c.id);
    this.montoSemanalModal = this.cuotaDe(c);
    this.montoPagadoModal = null;
    this.venceEnModal = '';
    this.montoCreditoModal = null;
    this.anulandoId.set(null);
    this.ajusteMonto = null;
    this.ajusteMotivo = '';
    this.movimientos.set([]);
    if (c.modalidadPago === 'PORCENTAJE') this.cargarMovimientos(c.id);
  }

  private cargarMovimientos(id: string): void {
    this.cadetes.historialCredito(id).subscribe((m) => {
      if (this.seleccionadoId() === id) this.movimientos.set(m.slice(0, 15));
    });
  }

  empezarAnular(movimientoId: string): void {
    this.motivoAnular = '';
    this.anulandoId.set(movimientoId);
  }

  anular(movimientoId: string): void {
    const c = this.seleccionado();
    if (!c || !this.motivoAnular.trim()) return;
    this.cadetes.anularAcreditacion(c.id, movimientoId, this.motivoAnular.trim(), () => {
      this.anulandoId.set(null);
      this.mensaje.set('Carga anulada.');
      this.cargarMovimientos(c.id);
    });
  }

  ajustar(): void {
    const c = this.seleccionado();
    if (!c || !this.ajusteMonto || this.ajusteMonto <= 0 || !this.ajusteMotivo.trim()) return;
    this.cadetes.ajustarCredito(c.id, this.ajusteMonto, this.ajusteOperacion, this.ajusteMotivo.trim(), () => {
      this.mensaje.set('Ajuste guardado.');
      this.ajusteMonto = null;
      this.ajusteMotivo = '';
      this.cargarMovimientos(c.id);
    });
  }

  faltaCalculado(): number {
    if (this.montoSemanalModal == null || this.montoPagadoModal == null) return 0;
    return Math.max(0, this.montoSemanalModal - this.montoPagadoModal);
  }

  cambiarModalidad(modalidadPago: 'SEMANAL' | 'PORCENTAJE'): void {
    const c = this.seleccionado();
    if (!c || c.modalidadPago === modalidadPago) return;
    this.cadetes.cambiarModalidadPago(c.id, modalidadPago, () => {
      this.mensaje.set('Modelo de cobro actualizado.');
    });
  }

  confirmarPagoSemanal(): void {
    const c = this.seleccionado();
    if (!c || this.montoPagadoModal == null) return;
    const venceEn = this.faltaCalculado() > 0 && this.venceEnModal ? new Date(this.venceEnModal).toISOString() : null;
    this.cadetes.habilitarPagoSemanal(
      c.id,
      { montoPagado: this.montoPagadoModal, venceEn, montoSemanal: this.montoSemanalModal },
      () => {
        this.mensaje.set('Pago guardado: ya puede entrar a la app y recibir viajes.');
        this.montoPagadoModal = null;
        this.venceEnModal = '';
      },
    );
  }

  deshabilitar(): void {
    const c = this.seleccionado();
    if (!c) return;
    this.cadetes.deshabilitarPagoSemanal(c.id, () => {
      this.confirmandoDeshabilitar.set(false);
      this.mensaje.set('Deshabilitado por falta de pago. Se vuelve a habilitar cuando registres el pago.');
    });
  }

  confirmarCredito(): void {
    const c = this.seleccionado();
    if (!c || !this.montoCreditoModal) return;
    this.cadetes.acreditar(c.id, this.montoCreditoModal, () => {
      this.mensaje.set('Crédito agregado.');
      this.montoCreditoModal = null;
      this.cargarMovimientos(c.id);
    });
  }
}
