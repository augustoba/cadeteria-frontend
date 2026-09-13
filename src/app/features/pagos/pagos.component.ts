import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CadeteService } from '../../core/services/cadete.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { MetricasService } from '../../core/services/metricas.service';
import { Cadete } from '../../core/models/cadete.model';
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

/**
 * Pantalla "Pagos" unificada — antes esto y la lista de Cadetes tenían DOS mecanismos de
 * pago semanal totalmente separados: un log simple "Pagado sí/no" acá (PagoSemanalService,
 * no tocaba nada más) y el habilitadoPago real del cadete (el único que de verdad lo
 * habilita a recibir viajes), editable solo desde un botón en la lista de Cadetes. Un admin
 * podía marcar "Pagado" acá creyendo que ya estaba resuelto y el cadete seguía bloqueado
 * para que le asignen pedidos. Ahora todo el flujo de pago real vive acá, en un solo lugar.
 */
@Component({
  selector: 'app-pagos',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="flex flex-col gap-4">
      @if (pendientesSemanal().length > 0) {
        <div class="bg-amber-50 border border-amber-200 rounded px-4 py-3 text-sm text-amber-800">
          ⚠️ {{ pendientesSemanal().length }} cadete(s) semanal(es) sin habilitar para trabajar esta semana:
          {{ nombresPendientes() }}
        </div>
      }

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

      <div class="bg-white rounded shadow-sm flex min-h-[24rem]">
        <aside class="w-64 border-r border-gray-200 shrink-0">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-tl font-semibold">Cadetes</div>
          <div class="overflow-y-auto max-h-[32rem]">
            @for (c of cadetes.cadetes(); track c.id) {
              <button
                type="button"
                class="w-full text-left px-4 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 flex items-center gap-2"
                [class.bg-brand-50]="c.id === seleccionado()?.id"
                (click)="elegir(c)"
              >
                @if (c.modalidadPago === 'SEMANAL' && !c.habilitadoPago) {
                  <span title="No habilitado para trabajar esta semana">⚠️</span>
                }
                {{ c.nombre }} {{ c.apellido }}
                <span class="text-xs text-gray-400 ml-auto">{{ c.modalidadPago === 'SEMANAL' ? '💵' : '%' }}</span>
              </button>
            } @empty {
              <p class="text-sm text-gray-400 p-4">Sin cadetes cargados.</p>
            }
          </div>
        </aside>

        <div class="flex-1 p-4">
          @if (!seleccionado()) {
            <p class="text-gray-400 text-sm py-6 text-center">Elegí un cadete para ver o cargar sus pagos.</p>
          } @else {
            @if (mensaje(); as m) {
              <div class="rounded bg-emerald-50 text-emerald-700 text-sm px-3 py-2 mb-3">{{ m }}</div>
            }
            <h1 class="font-semibold text-gray-700 mb-3">
              Pagos de {{ seleccionado()!.nombre }} {{ seleccionado()!.apellido }}
            </h1>

            <label class="flex flex-col gap-1 max-w-xs mb-4">
              <span class="text-sm font-medium text-gray-700">Modelo de cobro</span>
              <select class="input" [ngModel]="seleccionado()!.modalidadPago" (ngModelChange)="cambiarModalidad($event)">
                <option value="SEMANAL">Semanal (cuota fija)</option>
                <option value="PORCENTAJE">Porcentaje (crédito)</option>
              </select>
            </label>

            @if (seleccionado()!.modalidadPago === 'SEMANAL') {
              <div class="border border-gray-200 rounded p-4 flex flex-col gap-3 max-w-sm">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">Estado esta semana</span>
                  <span
                    class="px-2 py-0.5 rounded text-xs font-medium"
                    [class]="seleccionado()!.habilitadoPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                  >
                    {{ seleccionado()!.habilitadoPago ? 'Habilitado para trabajar' : 'No habilitado — debe la semana' }}
                  </span>
                </div>
                <label class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Monto de la semana (precio de la cuota)</span>
                  <input type="number" min="0" step="1" class="input" [(ngModel)]="montoSemanalModal" name="montoSemanalModal" />
                </label>
                <p class="text-xs text-gray-400 -mt-2">Se recuerda para las próximas semanas — cambialo cuando quieras.</p>
                <label class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Monto pagado ahora</span>
                  <input type="number" min="0" step="1" class="input" [(ngModel)]="montoPagadoModal" name="montoPagadoModal" />
                </label>
                @if (faltaCalculado() > 0) {
                  <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
                    Falta $ {{ faltaCalculado() | number: '1.0-0' }} — poné hasta cuándo tiene para completarlo, si no se
                    lo vuelve a deshabilitar solo pasada esa fecha.
                  </div>
                  <label class="flex flex-col gap-1">
                    <span class="text-sm font-medium text-gray-700">Vence (para completar el resto)</span>
                    <input type="datetime-local" class="input" [(ngModel)]="venceEnModal" name="venceEnModal" />
                  </label>
                }
                <button
                  type="button"
                  class="btn bg-emerald-600 hover:bg-emerald-700 self-start"
                  [disabled]="cadetes.saving() || montoPagadoModal == null"
                  (click)="confirmarPagoSemanal()"
                >
                  ✔ Guardar pago
                </button>
              </div>
            } @else {
              <div class="border border-gray-200 rounded p-4 flex flex-col gap-3 max-w-sm">
                <p class="text-sm text-gray-600">Crédito actual: $ {{ seleccionado()!.creditoDisponible | number: '1.0-0' }}</p>
                <label class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Agregar crédito (lo que transfirió)</span>
                  <input type="number" min="0" step="1" class="input" [(ngModel)]="montoCreditoModal" name="montoCreditoModal" />
                </label>
                <button
                  type="button"
                  class="btn bg-emerald-600 hover:bg-emerald-700 self-start"
                  [disabled]="cadetes.saving() || !montoCreditoModal"
                  (click)="confirmarCredito()"
                >
                  ✔ Agregar crédito
                </button>
              </div>
            }
          }
        </div>
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

  readonly seleccionado = signal<Cadete | null>(null);
  readonly mensaje = signal<string | null>(null);

  readonly arqueoAbierto = signal(true);
  readonly arqueoCadetes = signal<CadeteMetrica[]>([]);
  readonly semanaArqueo = signal(lunesDeEstaSemana());

  readonly pendientesSemanal = computed(() =>
    this.cadetes.cadetes().filter((c) => c.modalidadPago === 'SEMANAL' && !c.habilitadoPago),
  );

  montoSemanalModal: number | null = null;
  montoPagadoModal: number | null = null;
  venceEnModal = '';
  montoCreditoModal: number | null = null;

  ngOnInit(): void {
    this.cadetes.ensureLoaded();
    this.config.ensureLoaded();
    this.cargarArqueoSemana();
  }

  nombresPendientes(): string {
    return this.pendientesSemanal()
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

  elegir(c: Cadete): void {
    this.mensaje.set(null);
    this.seleccionado.set(c);
    this.montoSemanalModal = c.montoSemanalActual ?? this.montoSemanalPorDefecto();
    this.montoPagadoModal = null;
    this.venceEnModal = '';
    this.montoCreditoModal = null;
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
      const actualizado = this.cadetes.cadetes().find((x) => x.id === c.id);
      if (actualizado) this.elegir(actualizado);
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
        this.mensaje.set('Pago guardado — el cadete ya puede recibir viajes.');
        const actualizado = this.cadetes.cadetes().find((x) => x.id === c.id);
        if (actualizado) this.seleccionado.set(actualizado);
      },
    );
  }

  confirmarCredito(): void {
    const c = this.seleccionado();
    if (!c || !this.montoCreditoModal) return;
    this.cadetes.acreditar(c.id, this.montoCreditoModal, () => {
      this.mensaje.set('Crédito agregado.');
      this.montoCreditoModal = null;
      const actualizado = this.cadetes.cadetes().find((x) => x.id === c.id);
      if (actualizado) this.seleccionado.set(actualizado);
    });
  }
}
