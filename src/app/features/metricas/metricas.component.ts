import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MetricasService } from '../../core/services/metricas.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { CadeteMetrica, PorHora, Rechazo, ResumenDia, ZonaMetrica } from '../../core/models/metricas.model';
import { PedidosPorHoraChartComponent } from './pedidos-por-hora-chart.component';
import { EstadosPieChartComponent } from './estados-pie-chart.component';
import { ZonasBarChartComponent } from './zonas-bar-chart.component';

type CriterioRanking = 'calificacion' | 'finalizados' | 'km' | 'facturacion';

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inicioDeMesIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/** yyyy-MM-dd + días (puede ser negativo). */
function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diferenciaEnDias(desde: string, hasta: string): number {
  const a = new Date(desde + 'T00:00:00').getTime();
  const b = new Date(hasta + 'T00:00:00').getTime();
  return Math.round((b - a) / 86_400_000);
}

interface Delta {
  texto: string;
  clase: string;
}

@Component({
  selector: 'app-metricas',
  imports: [FormsModule, DecimalPipe, DatePipe, PedidosPorHoraChartComponent, EstadosPieChartComponent, ZonasBarChartComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 class="font-semibold">Métricas</h1>
        <div class="flex items-end gap-2 text-gray-700">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-white">Desde</span>
            <input type="date" class="input" [(ngModel)]="desde" name="desde" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-white">Hasta</span>
            <input type="date" class="input" [(ngModel)]="hasta" name="hasta" />
          </label>
          <button type="button" class="btn-action bg-emerald-600 hover:bg-emerald-700" (click)="cargar()">Buscar</button>
          <button type="button" class="btn-action bg-gray-500 hover:bg-gray-600" (click)="imprimir()">🖨 Imprimir</button>
        </div>
      </div>

      <div class="p-4 flex flex-col gap-6">
        @if (cargando()) {
          <p class="text-gray-500 text-sm py-6 text-center">Cargando…</p>
        } @else {
          @if (metaMensual() > 0) {
            <section class="border border-gray-200 rounded p-3">
              <div class="flex items-center justify-between mb-1">
                <h2 class="font-semibold text-gray-700 text-sm">Meta mensual de facturación</h2>
                <span class="text-xs text-gray-500">
                  $ {{ facturacionDelMes() | number: '1.0-0' }} / $ {{ metaMensual() | number: '1.0-0' }}
                  ({{ porcentajeMeta() | number: '1.0-0' }}%)
                </span>
              </div>
              <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-emerald-500 transition-all"
                  [class.bg-amber-500]="porcentajeMeta() < 50"
                  [style.width.%]="Math.min(porcentajeMeta(), 100)"
                ></div>
              </div>
            </section>
          }

          @if (resumen(); as r) {
            <section>
              <h2 class="font-semibold text-gray-700 mb-2">
                Pedidos en el rango
                <span class="text-xs font-normal text-gray-400">
                  (comparado contra el período anterior de igual duración: {{ desdeAnterior }} a {{ hastaAnterior }})
                </span>
              </h2>
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div class="tarjeta">
                  <div class="valor">{{ r.totalPedidos }}</div>
                  <div class="etiqueta">Total</div>
                  @if (deltaTotal(); as d) {
                    <div class="text-xs font-medium mt-1" [class]="d.clase">{{ d.texto }}</div>
                  }
                </div>
                <div class="tarjeta">
                  <div class="valor text-emerald-600">{{ r.finalizados }}</div>
                  <div class="etiqueta">Finalizados</div>
                  @if (deltaFinalizados(); as d) {
                    <div class="text-xs font-medium mt-1" [class]="d.clase">{{ d.texto }}</div>
                  }
                </div>
                <div class="tarjeta"><div class="valor text-red-600">{{ r.cancelados }}</div><div class="etiqueta">Cancelados</div></div>
                <div class="tarjeta"><div class="valor text-amber-600">{{ r.canceladosCliente }}</div><div class="etiqueta">Canceló el cliente</div></div>
                <div class="tarjeta"><div class="valor text-gray-600">{{ r.canceladosOtro }}</div><div class="etiqueta">Cancelado (otro motivo)</div></div>
                <div class="tarjeta"><div class="valor text-gray-500">{{ r.sinAsignar }}</div><div class="etiqueta">Sin asignar</div></div>
                <div class="tarjeta"><div class="valor text-amber-500">{{ r.pendientes }}</div><div class="etiqueta">Pendientes</div></div>
                <div class="tarjeta"><div class="valor text-brand-600">{{ r.enCurso }}</div><div class="etiqueta">En curso</div></div>
                <div class="tarjeta"><div class="valor text-emerald-700">$ {{ dineroCobrado() | number: '1.0-0' }}</div><div class="etiqueta">Dinero de trámites</div></div>
                <div class="tarjeta"><div class="valor text-gray-700">$ {{ dineroTransportado() | number: '1.0-0' }}</div><div class="etiqueta">Costos de viaje</div></div>
              </div>
            </section>
          }

          @if (resumen(); as r) {
            <section class="border border-gray-200 rounded p-3">
              <h2 class="font-semibold text-gray-700 mb-2">Distribución de pedidos por estado</h2>
              <app-estados-pie-chart [resumen]="r" />
            </section>
          }

          <section>
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h2 class="font-semibold text-gray-700">Pedidos por hora del día</h2>
              @if (horaPico(); as hp) {
                <span class="text-xs text-gray-500">🕐 Hora pico: <strong class="text-gray-700">{{ hp.hora }}:00</strong> ({{ hp.cantidad }} pedidos)</span>
              }
            </div>
            <app-pedidos-por-hora-chart [datos]="porHora()" />
          </section>

          <section>
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h2 class="font-semibold text-gray-700">Por cadete</h2>
              <div class="flex items-center gap-3 flex-wrap text-sm">
                <label class="flex items-center gap-2">
                  <span class="text-gray-600">Filtrar:</span>
                  <select class="input" [ngModel]="cadeteIdFiltro()" (ngModelChange)="cadeteIdFiltro.set($event)" name="cadeteIdFiltro">
                    <option [ngValue]="null">Todos</option>
                    @for (c of cadetes(); track c.cadeteId) {
                      <option [ngValue]="c.cadeteId">{{ c.nombre }} {{ c.apellido }}</option>
                    }
                  </select>
                </label>
                <label class="flex items-center gap-2">
                  <span class="text-gray-600">Ordenar por:</span>
                  <select class="input" [ngModel]="ordenRanking()" (ngModelChange)="ordenRanking.set($event)" name="ordenRanking">
                    <option value="calificacion">Calificación</option>
                    <option value="finalizados">Viajes finalizados</option>
                    <option value="km">Km recorridos</option>
                    <option value="facturacion">$ cobrado</option>
                  </select>
                </label>
                <label class="flex items-center gap-2">
                  <span class="text-gray-600">⚠️ Alertar si rechazos + no-aceptados ≥</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    class="input w-16"
                    [ngModel]="umbralBajoDesempeno()"
                    (ngModelChange)="umbralBajoDesempeno.set($event)"
                    name="umbralBajoDesempeno"
                  />
                </label>
              </div>
            </div>

            @if (topCadetes().length > 0) {
              <div class="flex gap-2 mb-3 flex-wrap">
                @for (c of topCadetes(); track c.cadeteId; let i = $index) {
                  <div class="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    {{ i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉' }} {{ c.nombre }} {{ c.apellido }} — {{ valorRanking(c) }}
                  </div>
                }
              </div>
            }

            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="text-left text-gray-500 border-b border-gray-200">
                    <th class="py-2 pr-3 font-medium">Cadete</th>
                    <th class="py-2 pr-3 font-medium">Vehículo</th>
                    <th class="py-2 pr-3 font-medium">Horas online</th>
                    <th class="py-2 pr-3 font-medium">Aceptados</th>
                    <th class="py-2 pr-3 font-medium">Rechazados</th>
                    <th class="py-2 pr-3 font-medium" title="Promedio entre que se le ofertó y que aceptó/rechazó">Resp. (seg)</th>
                    <th class="py-2 pr-3 font-medium">No aceptó a tiempo</th>
                    <th class="py-2 pr-3 font-medium">Finalizados</th>
                    <th class="py-2 pr-3 font-medium">$ transportado</th>
                    <th class="py-2 pr-3 font-medium">$ cobrado</th>
                    <th class="py-2 pr-3 font-medium">Km</th>
                    <th class="py-2 pr-3 font-medium">Viajes/hora</th>
                    <th class="py-2 pr-3 font-medium">$/hora</th>
                    <th class="py-2 pr-3 font-medium">Calificación</th>
                    <th class="py-2 pr-3 font-medium">Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of cadetesOrdenados(); track c.cadeteId) {
                    <tr class="border-b border-gray-100" [class.bg-red-50]="enRiesgo(c)">
                      <td class="py-2 pr-3 whitespace-nowrap">
                        {{ c.nombre }} {{ c.apellido }}
                      </td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ c.tipoVehiculo.nombre }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ c.horasOnline | number: '1.1-1' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ c.viajesAceptados }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ c.viajesRechazados }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">
                        {{ c.promedioSegundosRespuesta != null ? (c.promedioSegundosRespuesta | number: '1.0-0') : '—' }}
                      </td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ c.viajesNoAceptados }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ c.viajesFinalizados }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">$ {{ c.montoTransportadoTotal | number: '1.0-0' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">$ {{ c.montoCobradoTotal | number: '1.0-0' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ c.kmTotal | number: '1.1-1' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ c.promedioViajesPorHora | number: '1.2-2' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">$ {{ c.promedioPrecioPorHora | number: '1.0-0' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">
                        @if (c.promedioCalificacion != null) {
                          ⭐ {{ c.promedioCalificacion | number: '1.1-1' }}
                          <span class="text-xs text-gray-400">({{ c.cantidadCalificaciones }})</span>
                        } @else {
                          <span class="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td class="py-2 pr-3 whitespace-nowrap">
                        @if (enRiesgo(c)) {
                          <span class="text-red-600" [title]="motivoRiesgo(c)">⚠️ {{ motivoRiesgo(c) }}</span>
                        } @else {
                          <span class="text-xs text-gray-400">—</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="15" class="py-6 text-center text-gray-400">Sin datos en este rango.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="text-xs text-gray-400 mt-2">
              Los km suman el trayecto GPS real guardado durante el viaje; si un viaje no tiene trayecto guardado
              (por ejemplo, viajes viejos) se usa una aproximación en línea recta origen → destino.
            </p>
          </section>

          <section>
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h2 class="font-semibold text-gray-700">Por zona</h2>
              @if (zonaTop(); as zt) {
                <span class="text-xs text-gray-500">📍 Zona con más pedidos: <strong class="text-gray-700">{{ zt.zonaNombre }}</strong> ({{ zt.cantidadPedidos }})</span>
              }
            </div>
            <div class="mb-4">
              <app-zonas-bar-chart [datos]="zonas()" />
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="text-left text-gray-500 border-b border-gray-200">
                    <th class="py-2 pr-3 font-medium">Zona</th>
                    <th class="py-2 pr-3 font-medium">Pedidos</th>
                    <th class="py-2 pr-3 font-medium">Finalizados</th>
                    <th class="py-2 pr-3 font-medium">$ cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (z of zonas(); track z.zonaId) {
                    <tr class="border-b border-gray-100">
                      <td class="py-2 pr-3 whitespace-nowrap">{{ z.zonaNombre }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ z.cantidadPedidos }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ z.finalizados }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">$ {{ z.montoCobradoTotal | number: '1.0-0' }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="py-6 text-center text-gray-400">Sin datos en este rango.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div class="flex items-center justify-between mb-2 cursor-pointer select-none" (click)="rechazosAbierto.set(!rechazosAbierto())">
              <h2 class="font-semibold text-gray-700">Motivos de rechazo ({{ rechazos().length }})</h2>
              <span class="text-xs text-gray-400">{{ rechazosAbierto() ? '▲ Ocultar' : '▼ Mostrar' }}</span>
            </div>
            @if (rechazosAbierto()) {
              <div class="overflow-x-auto">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr class="text-left text-gray-500 border-b border-gray-200">
                      <th class="py-2 pr-3 font-medium">Pedido</th>
                      <th class="py-2 pr-3 font-medium">Cadete</th>
                      <th class="py-2 pr-3 font-medium">Motivo</th>
                      <th class="py-2 pr-3 font-medium">Cuándo</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of rechazos(); track $index) {
                      <tr class="border-b border-gray-100">
                        <td class="py-2 pr-3 whitespace-nowrap">{{ r.pedidoNumero }}</td>
                        <td class="py-2 pr-3 whitespace-nowrap">{{ r.cadeteNombre }}</td>
                        <td class="py-2 pr-3">{{ r.motivo || '—' }}</td>
                        <td class="py-2 pr-3 whitespace-nowrap">{{ r.ofrecidoEn | date: 'short' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4" class="py-6 text-center text-gray-400">Sin rechazos en este rango.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }
      </div>
    </div>
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
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.8125rem;
        background: white;
        color: #374151;
      }
      .tarjeta {
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.75rem;
        text-align: center;
      }
      .valor {
        font-size: 1.5rem;
        font-weight: 600;
        color: #374151;
      }
      .etiqueta {
        font-size: 0.75rem;
        color: #6b7280;
      }
      @media print {
        .print\\:hidden {
          display: none;
        }
      }
    `,
  ],
})
export class MetricasComponent implements OnInit {
  private readonly metricasSvc = inject(MetricasService);
  private readonly configuracion = inject(ConfiguracionService);

  readonly Math = Math;

  desde = hoyIso();
  hasta = hoyIso();
  readonly cadeteIdFiltro = signal<string | null>(null);
  readonly ordenRanking = signal<CriterioRanking>('calificacion');
  readonly umbralBajoDesempeno = signal(3);

  readonly cargando = signal(false);
  readonly resumen = signal<ResumenDia | null>(null);
  readonly cadetes = signal<CadeteMetrica[]>([]);
  readonly rechazos = signal<Rechazo[]>([]);
  readonly rechazosAbierto = signal(false);
  readonly porHora = signal<PorHora[]>([]);
  readonly zonas = signal<ZonaMetrica[]>([]);

  /** Período anterior de igual duración — para comparar (ronda 5, punto 45). */
  readonly resumenAnterior = signal<ResumenDia | null>(null);
  desdeAnterior = '';
  hastaAnterior = '';

  /** Facturación del mes en curso — para la barra de meta (ronda 5, punto 46), independiente del filtro de fechas de arriba. */
  readonly facturacionDelMes = signal(0);

  readonly cadetesFiltrados = computed(() => {
    const id = this.cadeteIdFiltro();
    const lista = this.cadetes();
    return id ? lista.filter((c) => c.cadeteId === id) : lista;
  });

  readonly cadetesOrdenados = computed(() => {
    const lista = [...this.cadetesFiltrados()];
    const criterio = this.ordenRanking();
    return lista.sort((a, b) => this.valorRankingNumerico(b, criterio) - this.valorRankingNumerico(a, criterio));
  });

  readonly topCadetes = computed(() =>
    this.cadetesOrdenados()
      .filter((c) => this.valorRankingNumerico(c, this.ordenRanking()) > 0)
      .slice(0, 3)
  );

  readonly dineroCobrado = computed(() => this.cadetes().reduce((acc, c) => acc + c.montoCobradoTotal, 0));
  readonly dineroTransportado = computed(() => this.cadetes().reduce((acc, c) => acc + c.montoTransportadoTotal, 0));

  readonly metaMensual = computed(() => Number(this.configuracion.valores()['meta_mensual_facturacion'] ?? 0));
  readonly porcentajeMeta = computed(() => {
    const meta = this.metaMensual();
    return meta > 0 ? (this.facturacionDelMes() / meta) * 100 : 0;
  });

  ngOnInit(): void {
    this.configuracion.ensureLoaded();
    this.cargarFacturacionDelMes();
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.metricasSvc.resumen(this.desde, this.hasta).subscribe((r) => this.resumen.set(r));
    this.metricasSvc.cadetes(this.desde, this.hasta).subscribe((c) => {
      this.cadetes.set(c);
      this.cargando.set(false);
    });
    this.metricasSvc.rechazos(this.desde, this.hasta).subscribe((r) => this.rechazos.set(r));
    this.metricasSvc.porHora(this.desde, this.hasta).subscribe((p) => this.porHora.set(p));
    this.metricasSvc.zonas(this.desde, this.hasta).subscribe((z) => this.zonas.set(z));

    const dias = diferenciaEnDias(this.desde, this.hasta) + 1;
    this.hastaAnterior = sumarDias(this.desde, -1);
    this.desdeAnterior = sumarDias(this.hastaAnterior, -(dias - 1));
    this.metricasSvc.resumen(this.desdeAnterior, this.hastaAnterior).subscribe((r) => this.resumenAnterior.set(r));
  }

  private cargarFacturacionDelMes(): void {
    this.metricasSvc.cadetes(inicioDeMesIso(), hoyIso()).subscribe((c) => {
      this.facturacionDelMes.set(c.reduce((acc, x) => acc + x.montoCobradoTotal, 0));
    });
  }

  imprimir(): void {
    window.print();
  }

  bajoDesempeno(c: CadeteMetrica): boolean {
    return c.viajesRechazados + c.viajesNoAceptados >= this.umbralBajoDesempeno();
  }

  /** Score de riesgo (mejora 2026-09-17): bajo desempeño en el rango, o incidencias abiertas ahora mismo. */
  enRiesgo(c: CadeteMetrica): boolean {
    return this.bajoDesempeno(c) || c.incidenciasAbiertas > 0;
  }

  motivoRiesgo(c: CadeteMetrica): string {
    const motivos: string[] = [];
    if (this.bajoDesempeno(c)) motivos.push('muchos rechazos/no-aceptados en el rango');
    if (c.incidenciasAbiertas > 0) motivos.push(`${c.incidenciasAbiertas} incidencia(s) abierta(s)`);
    return motivos.join(' · ');
  }

  valorRankingNumerico(c: CadeteMetrica, criterio: CriterioRanking): number {
    switch (criterio) {
      case 'calificacion':
        return c.promedioCalificacion ?? -1;
      case 'finalizados':
        return c.viajesFinalizados;
      case 'km':
        return c.kmTotal;
      case 'facturacion':
        return c.montoCobradoTotal;
    }
  }

  valorRanking(c: CadeteMetrica): string {
    switch (this.ordenRanking()) {
      case 'calificacion':
        return c.promedioCalificacion != null ? `⭐ ${c.promedioCalificacion.toFixed(1)}` : '—';
      case 'finalizados':
        return `${c.viajesFinalizados} viajes`;
      case 'km':
        return `${c.kmTotal.toFixed(1)} km`;
      case 'facturacion':
        return `$ ${c.montoCobradoTotal.toFixed(0)}`;
    }
  }

  private delta(actual: number, anterior: number): Delta | null {
    if (anterior === 0) {
      return actual === 0 ? null : { texto: '▲ nuevo', clase: 'text-emerald-600' };
    }
    const pct = ((actual - anterior) / anterior) * 100;
    if (Math.abs(pct) < 1) return { texto: '= sin cambios', clase: 'text-gray-400' };
    const flecha = pct > 0 ? '▲' : '▼';
    const clase = pct > 0 ? 'text-emerald-600' : 'text-red-600';
    return { texto: `${flecha} ${Math.abs(pct).toFixed(0)}%`, clase };
  }

  deltaTotal(): Delta | null {
    const r = this.resumen();
    const a = this.resumenAnterior();
    return r && a ? this.delta(r.totalPedidos, a.totalPedidos) : null;
  }

  deltaFinalizados(): Delta | null {
    const r = this.resumen();
    const a = this.resumenAnterior();
    return r && a ? this.delta(r.finalizados, a.finalizados) : null;
  }

  horaPico(): { hora: number; cantidad: number } | null {
    const datos = this.porHora();
    if (datos.length === 0) return null;
    const top = datos.reduce((max, d) => (d.cantidad > max.cantidad ? d : max), datos[0]);
    return top.cantidad > 0 ? top : null;
  }

  zonaTop(): ZonaMetrica | null {
    const datos = this.zonas();
    if (datos.length === 0) return null;
    const top = datos.reduce((max, z) => (z.cantidadPedidos > max.cantidadPedidos ? z : max), datos[0]);
    return top.cantidadPedidos > 0 ? top : null;
  }
}
