import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CadeteService } from '../../core/services/cadete.service';
import { CadeteFicha } from '../../core/models/cadete.model';
import { TasaAceptacionChartComponent } from './tasa-aceptacion-chart.component';

type RangoFicha = 'hoy' | 'semana' | 'mes' | 'todo';

/** Ambas listas (incidencias, historial de altas/bajas) ya vienen ordenadas desde el más reciente
 * (ver CadeteService.ficha en el backend) — acá solo se paginan del lado del cliente, el volumen
 * por cadete no justifica traerlas paginadas desde el backend. */
const TAMANIO_PAGINA_HISTORIAL = 10;

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inicioDeSemanaIso(): string {
  const d = new Date();
  const dia = d.getDay() === 0 ? 7 : d.getDay(); // lunes = 1 ... domingo = 7
  d.setDate(d.getDate() - (dia - 1));
  return d.toISOString().slice(0, 10);
}

function inicioDeMesIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/**
 * Panorama completo de un cadete (ronda de mejoras 2026-09-16, a pedido del dueño):
 * antes solo existía el form de alta/edición, sin ningún lugar que muestre de un
 * vistazo el desempeño histórico, las incidencias o el historial de altas/bajas.
 */
@Component({
  selector: 'app-cadete-ficha',
  imports: [RouterLink, DecimalPipe, DatePipe, TasaAceptacionChartComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-wrap gap-2">
        <h1 class="font-semibold text-gray-700">
          Ficha de cadete — {{ ficha() ? ficha()!.cadete.nombre + ' ' + ficha()!.cadete.apellido : '…' }}
        </h1>
        <div class="flex gap-2">
          @if (ficha(); as f) {
            <button type="button" class="btn bg-violet-600 hover:bg-violet-700" (click)="reenviarPassword(f.cadete.id)">
              🔑 Reenviar contraseña
            </button>
            <a [routerLink]="['/cadetes', f.cadete.id]" class="btn bg-brand-600 hover:bg-brand-700">✏ Editar</a>
          }
          <a routerLink="/cadetes" class="btn bg-red-500 hover:bg-red-600">↩ Volver</a>
        </div>
      </div>

      @if (passwordGenerada(); as p) {
        <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="passwordGenerada.set(null)">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
            <div class="bg-emerald-600 text-white px-5 py-4">
              <h2 class="font-semibold">✔ Contraseña generada</h2>
            </div>
            <div class="p-5 flex flex-col gap-3 text-sm">
              <p class="text-gray-600">
                Pasásela al cadete por un canal seguro — esta es la única vez que la vas a poder ver.
                <strong>Tiene 10 minutos para entrar con esta contraseña</strong> — si se vence, volvé acá para reenviarle otra.
              </p>
              <div class="bg-gray-50 border border-gray-200 rounded p-3">
                <span class="text-xs text-gray-400">Contraseña temporal</span>
                <div class="font-mono font-medium text-gray-800">{{ p }}</div>
              </div>
            </div>
            <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
              <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="passwordGenerada.set(null)">Cerrar</button>
            </div>
          </div>
        </div>
      }

      @if (!ficha()) {
        <p class="text-gray-400 text-sm py-6 text-center">Cargando…</p>
      } @else {
        @if (ficha(); as f) {
          <div class="p-4 flex flex-col gap-6">
            @if (!f.cadete.activo) {
              <div class="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                ⚠ Este cadete está dado de baja.
                @if (ultimaBaja(); as b) {
                  <span> Motivo: <strong>{{ b.motivo || 'sin motivo cargado' }}</strong> — {{ b.cambiadoEn | date: 'short' }}.</span>
                }
              </div>
            }

            <div class="flex items-center gap-2 flex-wrap text-sm">
              <span class="text-gray-500">Estadísticas de desempeño:</span>
              @for (r of rangos; track r.valor) {
                <button
                  type="button"
                  class="btn-mini"
                  [class]="rango() === r.valor ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'"
                  (click)="cambiarRango(r.valor)"
                >
                  {{ r.etiqueta }}
                </button>
              }
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="tarjeta"><div class="valor text-emerald-600">{{ f.estadisticas.viajesFinalizados }}</div><div class="etiqueta">Viajes finalizados</div></div>
              <div class="tarjeta"><div class="valor text-gray-700">$ {{ f.estadisticas.montoCobradoTotal | number: '1.0-0' }}</div><div class="etiqueta">$ cobrado</div></div>
              <div class="tarjeta"><div class="valor text-gray-700">{{ f.estadisticas.kmTotal | number: '1.0-0' }}</div><div class="etiqueta">Km recorridos</div></div>
              <div class="tarjeta">
                <div class="valor text-gray-700">
                  @if (f.estadisticas.promedioCalificacion != null) {
                    ⭐ {{ f.estadisticas.promedioCalificacion | number: '1.1-1' }}
                  } @else {
                    —
                  }
                </div>
                <div class="etiqueta">Calificación ({{ f.estadisticas.cantidadCalificaciones }})</div>
              </div>
            </div>

            <section class="border border-gray-200 rounded p-3">
              <h2 class="font-semibold text-gray-700 mb-2">Tasa de aceptación de ofertas</h2>
              <app-tasa-aceptacion-chart
                [aceptados]="f.estadisticas.viajesAceptados"
                [rechazados]="f.estadisticas.viajesRechazados"
                [noAceptados]="f.estadisticas.viajesNoAceptados"
              />
              <p class="text-xs text-gray-400 mt-2">
                "Reasignados (no a tiempo)" = se le venció el tiempo para responder y el pedido pasó a otro cadete.
              </p>
              <div class="grid grid-cols-3 gap-3 mt-3">
                <div class="tarjeta"><div class="valor text-gray-700">{{ f.estadisticas.horasOnline | number: '1.1-1' }}</div><div class="etiqueta">Horas conectado</div></div>
                <div class="tarjeta"><div class="valor text-gray-700">{{ f.estadisticas.promedioViajesPorHora | number: '1.2-2' }}</div><div class="etiqueta">Pedidos/hora</div></div>
                <div class="tarjeta"><div class="valor text-gray-700">$ {{ f.estadisticas.promedioPrecioPorHora | number: '1.0-0' }}</div><div class="etiqueta">$/hora</div></div>
              </div>
            </section>

            <div class="border-t border-gray-200 pt-4">
              <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Incidencias
                <span class="text-xs font-normal normal-case text-gray-400">(todo el historial, más recientes primero)</span>
              </h2>
              <div class="max-h-80 overflow-y-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="text-left text-gray-500 border-b border-gray-200">
                    <th class="py-2 pr-3 font-medium">Título</th>
                    <th class="py-2 pr-3 font-medium">Prioridad</th>
                    <th class="py-2 pr-3 font-medium">Estado</th>
                    <th class="py-2 pr-3 font-medium">Fecha</th>
                    <th class="py-2 pr-3 font-medium">Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  @for (i of incidenciasPaginadas(); track i.id) {
                    <tr class="border-b border-gray-100">
                      <td class="py-2 pr-3">{{ i.titulo }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">
                        <span
                          class="px-2 py-0.5 rounded text-xs font-medium"
                          [class.bg-red-100]="i.prioridad === 'GRAVE'"
                          [class.text-red-700]="i.prioridad === 'GRAVE'"
                          [class.bg-gray-100]="i.prioridad === 'BAJA'"
                          [class.text-gray-600]="i.prioridad === 'BAJA'"
                          [class.bg-blue-50]="i.prioridad === 'NORMAL'"
                          [class.text-blue-700]="i.prioridad === 'NORMAL'"
                        >
                          {{ i.prioridad === 'GRAVE' ? '🚨 Grave' : i.prioridad === 'BAJA' ? 'Baja' : 'Normal' }}
                        </span>
                      </td>
                      <td class="py-2 pr-3 whitespace-nowrap">
                        <span
                          class="px-2 py-0.5 rounded text-xs font-medium"
                          [class]="i.estado === 'ABIERTA' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'"
                        >
                          {{ i.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada' }}
                        </span>
                      </td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ i.creadaEn | date: 'short' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">
                        @if (i.pedidoId) {
                          <a
                            [routerLink]="['/']"
                            [queryParams]="{ buscar: i.pedidoNumero }"
                            class="text-brand-600 hover:underline"
                            title="Buscar este pedido en el Dashboard"
                          >
                            Ver pedido #{{ i.pedidoNumero }} →
                          </a>
                        } @else {
                          <span class="text-gray-400">—</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="py-6 text-center text-gray-400">Sin incidencias registradas.</td>
                    </tr>
                  }
                </tbody>
              </table>
              </div>
              @if (totalPaginasIncidencias() > 1) {
                <div class="flex items-center justify-center gap-3 pt-2 text-xs">
                  <button type="button" class="btn-mini bg-gray-300 hover:bg-gray-400 text-gray-700" [disabled]="paginaIncidencias() === 0" (click)="paginaIncidencias.set(paginaIncidencias() - 1)">
                    ← Anterior
                  </button>
                  <span class="text-gray-500">Página {{ paginaIncidencias() + 1 }} de {{ totalPaginasIncidencias() }}</span>
                  <button
                    type="button"
                    class="btn-mini bg-gray-300 hover:bg-gray-400 text-gray-700"
                    [disabled]="paginaIncidencias() + 1 >= totalPaginasIncidencias()"
                    (click)="paginaIncidencias.set(paginaIncidencias() + 1)"
                  >
                    Siguiente →
                  </button>
                </div>
              }
            </div>

            <div class="border-t border-gray-200 pt-4">
              <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Historial de altas/bajas <span class="text-xs font-normal normal-case text-gray-400">(más recientes primero)</span>
              </h2>
              <div class="max-h-80 overflow-y-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="text-left text-gray-500 border-b border-gray-200">
                    <th class="py-2 pr-3 font-medium">Cambio</th>
                    <th class="py-2 pr-3 font-medium">Motivo</th>
                    <th class="py-2 pr-3 font-medium">Cuándo</th>
                    <th class="py-2 pr-3 font-medium">Quién</th>
                  </tr>
                </thead>
                <tbody>
                  @for (h of historialPaginado(); track h.id) {
                    <tr class="border-b border-gray-100">
                      <td class="py-2 pr-3 whitespace-nowrap">
                        <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="h.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
                          {{ h.activo ? 'Alta' : 'Baja' }}
                        </span>
                      </td>
                      <td class="py-2 pr-3">{{ h.motivo || '—' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ h.cambiadoEn | date: 'short' }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ h.cambiadoPorUsername || '—' }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="py-6 text-center text-gray-400">Sin cambios de estado registrados.</td>
                    </tr>
                  }
                </tbody>
              </table>
              </div>
              @if (totalPaginasHistorial() > 1) {
                <div class="flex items-center justify-center gap-3 pt-2 text-xs">
                  <button type="button" class="btn-mini bg-gray-300 hover:bg-gray-400 text-gray-700" [disabled]="paginaHistorial() === 0" (click)="paginaHistorial.set(paginaHistorial() - 1)">
                    ← Anterior
                  </button>
                  <span class="text-gray-500">Página {{ paginaHistorial() + 1 }} de {{ totalPaginasHistorial() }}</span>
                  <button
                    type="button"
                    class="btn-mini bg-gray-300 hover:bg-gray-400 text-gray-700"
                    [disabled]="paginaHistorial() + 1 >= totalPaginasHistorial()"
                    (click)="paginaHistorial.set(paginaHistorial() + 1)"
                  >
                    Siguiente →
                  </button>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
        display: inline-block;
      }
      .btn-mini {
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 0.3rem;
        display: inline-block;
        border: none;
      }
      .btn-mini:disabled {
        opacity: 0.5;
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
    `,
  ],
})
export class CadeteFichaComponent implements OnInit {
  private readonly cadetes = inject(CadeteService);
  private readonly route = inject(ActivatedRoute);

  private id = '';
  readonly ficha = signal<CadeteFicha | null>(null);
  readonly rango = signal<RangoFicha>('todo');
  readonly passwordGenerada = signal<string | null>(null);

  readonly tamanioPagina = TAMANIO_PAGINA_HISTORIAL;
  readonly paginaIncidencias = signal(0);
  readonly paginaHistorial = signal(0);

  readonly incidenciasPaginadas = computed(() => {
    const ini = this.paginaIncidencias() * TAMANIO_PAGINA_HISTORIAL;
    return (this.ficha()?.incidencias ?? []).slice(ini, ini + TAMANIO_PAGINA_HISTORIAL);
  });
  readonly totalPaginasIncidencias = computed(() =>
    Math.max(1, Math.ceil((this.ficha()?.incidencias.length ?? 0) / TAMANIO_PAGINA_HISTORIAL)),
  );

  readonly historialPaginado = computed(() => {
    const ini = this.paginaHistorial() * TAMANIO_PAGINA_HISTORIAL;
    return (this.ficha()?.historialEstado ?? []).slice(ini, ini + TAMANIO_PAGINA_HISTORIAL);
  });
  readonly totalPaginasHistorial = computed(() =>
    Math.max(1, Math.ceil((this.ficha()?.historialEstado.length ?? 0) / TAMANIO_PAGINA_HISTORIAL)),
  );

  readonly rangos: Array<{ valor: RangoFicha; etiqueta: string }> = [
    { valor: 'hoy', etiqueta: 'Hoy' },
    { valor: 'semana', etiqueta: 'Esta semana' },
    { valor: 'mes', etiqueta: 'Este mes' },
    { valor: 'todo', etiqueta: 'Todo' },
  ];

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.cargar();
  }

  cambiarRango(r: RangoFicha): void {
    this.rango.set(r);
    this.cargar();
  }

  /** Para cuando la contraseña temporal venció sin que el cadete llegara a entrar (mejora 2026-09-17). */
  reenviarPassword(cadeteId: string): void {
    this.cadetes.reenviarPassword(cadeteId).subscribe((r) => this.passwordGenerada.set(r.passwordTemporal));
  }

  private cargar(): void {
    const [desde, hasta] = this.rangoFechas();
    this.cadetes.ficha(this.id, desde, hasta).subscribe((f) => {
      this.ficha.set(f);
      this.paginaIncidencias.set(0);
      this.paginaHistorial.set(0);
    });
  }

  private rangoFechas(): [string | undefined, string | undefined] {
    const hoy = hoyIso();
    switch (this.rango()) {
      case 'hoy':
        return [hoy, hoy];
      case 'semana':
        return [inicioDeSemanaIso(), hoy];
      case 'mes':
        return [inicioDeMesIso(), hoy];
      case 'todo':
        return [undefined, undefined];
    }
  }

  /** Último cambio a "baja" del historial (puede no ser el último cambio si después hubo otra alta/baja sin motivo). */
  ultimaBaja() {
    const f = this.ficha();
    if (!f) return null;
    return f.historialEstado.find((h) => !h.activo) ?? null;
  }
}
