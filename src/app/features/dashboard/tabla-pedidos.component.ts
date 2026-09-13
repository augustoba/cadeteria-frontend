import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { Pedido, tiempoTranscurrido } from '../../core/models/pedido.model';
import { EmptyStateComponent } from '../../shared/empty-state.component';

type Accion =
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

const TAMANO_PAGINA = 15;

export const ESTADO_CLASES: Record<string, string> = {
  SIN_ASIGNAR: 'bg-gray-200 text-gray-700',
  PENDIENTE: 'bg-amber-100 text-amber-800',
  EN_CURSO: 'bg-brand-100 text-brand-700',
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-red-100 text-red-700',
  PROGRAMADO: 'bg-purple-100 text-purple-700',
  NO_ENTREGADO: 'bg-orange-100 text-orange-700',
};

export function claseEstadoPedido(estadoId: string): string {
  return ESTADO_CLASES[estadoId] ?? 'bg-gray-100 text-gray-600';
}

@Component({
  selector: 'app-tabla-pedidos',
  imports: [EmptyStateComponent],
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="text-left text-gray-500 border-b border-gray-200">
            <th class="py-2 pr-3 font-medium">Nº</th>
            <th class="py-2 pr-3 font-medium">Origen</th>
            <th class="py-2 pr-3 font-medium">Destino</th>
            <th class="py-2 pr-3 font-medium">Dinero</th>
            <th class="py-2 pr-3 font-medium">Cadete</th>
            <th class="py-2 pr-3 font-medium">Tiempo de espera</th>
            <th class="py-2 pr-3 font-medium">Horarios</th>
            <th class="py-2 pr-3 font-medium">Estado</th>
            <th class="py-2 pr-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          @for (p of pedidosPagina; track p.id) {
            <tr
              class="border-b border-gray-100 hover:bg-gray-50"
              [class.bg-red-50]="p.estado.id === 'CANCELADO'"
              [class.bg-emerald-50]="p.estado.id === 'FINALIZADO'"
              [class.bg-amber-50]="p.prioritario && p.estado.id !== 'CANCELADO' && p.estado.id !== 'FINALIZADO'"
            >
              <td class="py-2 pr-3 whitespace-nowrap" [title]="p.id">
                <button
                  type="button"
                  class="mr-1"
                  [title]="p.prioritario ? 'Quitar prioridad' : 'Marcar como prioritario/urgente'"
                  (click)="accion.emit({ accion: 'prioritario', pedido: p })"
                >
                  {{ p.prioritario ? '⭐' : '☆' }}
                </button>
                {{ p.numero }}
              </td>
              <td class="py-2 pr-3">{{ p.origenDireccion }}</td>
              <td class="py-2 pr-3">{{ p.destinoDireccion }}</td>
              <td class="py-2 pr-3 whitespace-nowrap">$ {{ p.precio }}</td>
              <td class="py-2 pr-3 whitespace-nowrap">
                @if (p.cadeteAsignado) {
                  {{ p.cadeteAsignado.nombre }} {{ p.cadeteAsignado.apellido }}
                  <span class="text-xs text-gray-400">({{ p.cadeteAsignado.tipoVehiculo.nombre }})</span>
                } @else {
                  —
                }
              </td>
              <td class="py-2 pr-3 whitespace-nowrap font-mono text-xs">
                {{ tiempo(p) }}
              </td>
              <td class="py-2 pr-3 whitespace-nowrap text-xs text-gray-500 leading-tight">
                @if (p.aceptadoEn) {
                  <div>Aceptado {{ hora(p.aceptadoEn) }}</div>
                }
                @if (p.retiradoEn) {
                  <div>Retirado {{ hora(p.retiradoEn) }}</div>
                }
                @if (p.finalizadoEn) {
                  <div>Entregado {{ hora(p.finalizadoEn) }}</div>
                }
              </td>
              <td class="py-2 pr-3 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="claseEstado(p)">
                  {{ p.estado.nombre }}
                </span>
                @if (p.smsFallido) {
                  <span title="No se pudo avisar por SMS al cliente" class="ml-1">📵</span>
                }
              </td>
              <td class="py-2 pr-3 whitespace-nowrap flex gap-2 flex-wrap">
                @if (mostrarAcciones) {
                  @if (p.estado.id === 'SIN_ASIGNAR') {
                    <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="accion.emit({ accion: 'asignar', pedido: p })">
                      Asignar
                    </button>
                  }
                  <button type="button" class="btn-mini bg-red-600 hover:bg-red-700" (click)="accion.emit({ accion: 'anular', pedido: p })">
                    Anular
                  </button>
                  @if (p.cadeteAsignado) {
                    <button type="button" class="btn-mini bg-amber-500 hover:bg-amber-600" (click)="accion.emit({ accion: 'quitar', pedido: p })">
                      Quitar
                    </button>
                    <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="accion.emit({ accion: 'reasignar', pedido: p })">
                      Reasignar
                    </button>
                  }
                  @if (p.estado.id === 'EN_CURSO') {
                    <button type="button" class="btn-mini bg-blue-600 hover:bg-blue-700" (click)="accion.emit({ accion: 'finalizar', pedido: p })">
                      Finalizar
                    </button>
                  }
                  @if (p.estado.id === 'NO_ENTREGADO') {
                    <button
                      type="button"
                      class="btn-mini bg-orange-600 hover:bg-orange-700"
                      (click)="accion.emit({ accion: 'reintentar-entrega', pedido: p })"
                    >
                      Reintentar entrega
                    </button>
                  }
                  <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="accion.emit({ accion: 'imprimir', pedido: p })">
                    Imprimir
                  </button>
                }
                <button type="button" class="btn-mini bg-amber-600 hover:bg-amber-700" (click)="accion.emit({ accion: 'incidencia', pedido: p })">
                  🚨 Incidencia
                </button>
                <button type="button" class="btn-mini bg-gray-500 hover:bg-gray-600" (click)="accion.emit({ accion: 'detalle', pedido: p })">
                  Detalle
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="9">
                <app-empty-state icono="📦" mensaje="No hay pedidos en esta lista." hint="Cargá uno nuevo desde el botón de arriba." />
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (pedidos.length > tamanoPagina) {
        <div class="flex items-center justify-between px-1 py-2 text-xs text-gray-500">
          <span>Página {{ pagina() }} de {{ totalPaginas }} ({{ pedidos.length }} pedidos)</span>
          <div class="flex gap-1">
            <button
              type="button"
              class="btn-mini bg-gray-400 hover:bg-gray-500"
              [disabled]="pagina() === 1"
              (click)="irAPagina(pagina() - 1)"
            >
              ‹ Anterior
            </button>
            <button
              type="button"
              class="btn-mini bg-gray-400 hover:bg-gray-500"
              [disabled]="pagina() === totalPaginas"
              (click)="irAPagina(pagina() + 1)"
            >
              Siguiente ›
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .btn-mini {
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 0.3rem;
        transition: background-color 0.15s;
        white-space: nowrap;
      }
      .btn-mini:disabled {
        opacity: 0.5;
      }
    `,
  ],
})
export class TablaPedidosComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pedidos: Pedido[] = [];
  @Input() mostrarAcciones = false;
  @Output() accion = new EventEmitter<{ accion: Accion; pedido: Pedido }>();

  readonly tamanoPagina = TAMANO_PAGINA;
  readonly pagina = signal(1);

  private intervalId?: ReturnType<typeof setInterval>;
  /** "Tiempo de espera" se recalcula contra este signal en vez de contra Date.now()
   * directamente — así el valor queda fijo dentro de un mismo ciclo de change detection
   * (evita el NG0100 que tirábamos antes con un simple contador, el cual además podía
   * abortar la actualización de vista de un click que cayera en el mismo instante). */
  private readonly ahora = signal(Date.now());

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.ahora.set(Date.now());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pedidos']) this.pagina.set(1);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.pedidos.length / TAMANO_PAGINA));
  }

  get pedidosPagina(): Pedido[] {
    const inicio = (this.pagina() - 1) * TAMANO_PAGINA;
    return this.pedidos.slice(inicio, inicio + TAMANO_PAGINA);
  }

  irAPagina(n: number): void {
    this.pagina.set(Math.min(Math.max(1, n), this.totalPaginas));
  }

  tiempo(p: Pedido): string {
    return tiempoTranscurrido(p.creadoEn, p.finalizadoEn ?? p.canceladoEn ?? undefined, this.ahora());
  }

  hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  claseEstado(p: Pedido): string {
    return claseEstadoPedido(p.estado.id);
  }
}
