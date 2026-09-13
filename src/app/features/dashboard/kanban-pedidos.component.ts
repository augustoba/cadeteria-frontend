import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { Pedido } from '../../core/models/pedido.model';
import { claseEstadoPedido } from './tabla-pedidos.component';

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

interface Columna {
  estadoId: string;
  titulo: string;
}

/** Orden y rótulos de las columnas — coincide con los estados "activos" del dashboard. */
const COLUMNAS: Columna[] = [
  { estadoId: 'SIN_ASIGNAR', titulo: 'Sin asignar' },
  { estadoId: 'PENDIENTE', titulo: 'Ofertado' },
  { estadoId: 'EN_CURSO', titulo: 'En curso' },
  { estadoId: 'NO_ENTREGADO', titulo: 'No se pudo entregar' },
];

/**
 * Vista alternativa del dashboard (ronda 4, punto 41): columnas por estado en vez de
 * tabs + tabla — más rápido de leer de un vistazo con muchos pedidos activos a la vez.
 */
@Component({
  selector: 'app-kanban-pedidos',
  template: `
    <div class="flex gap-3 overflow-x-auto pb-2">
      @for (col of columnas; track col.estadoId) {
        <div class="bg-gray-50 rounded-lg border border-gray-200 w-72 shrink-0 flex flex-col max-h-[70vh]">
          <div class="px-3 py-2 border-b border-gray-200 shrink-0">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">{{ col.titulo }}</span>
              <span class="text-xs font-medium px-1.5 py-0.5 rounded" [class]="claseEstadoPedido(col.estadoId)">
                {{ pedidosDe(col.estadoId).length }}
              </span>
            </div>
            @if (col.estadoId === 'SIN_ASIGNAR' && pedidosDe(col.estadoId).length) {
              <p class="text-[10px] text-gray-400 mt-0.5">Arrastrá una tarjeta a un cadete libre para asignarla</p>
            }
          </div>
          <div class="p-2 flex flex-col gap-2 overflow-y-auto">
            @for (p of pedidosDe(col.estadoId); track p.id) {
              <div
                class="bg-white rounded border border-gray-200 shadow-sm p-2.5 text-xs flex flex-col gap-1.5"
                [class.bg-amber-50]="p.prioritario"
                [class.cursor-grab]="col.estadoId === 'SIN_ASIGNAR'"
                [attr.draggable]="col.estadoId === 'SIN_ASIGNAR' ? 'true' : null"
                (dragstart)="col.estadoId === 'SIN_ASIGNAR' && onDragStart($event, p)"
              >
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-gray-800 flex items-center gap-1">
                    <button
                      type="button"
                      [title]="p.prioritario ? 'Quitar prioridad' : 'Marcar como prioritario/urgente'"
                      (click)="accion.emit({ accion: 'prioritario', pedido: p })"
                    >
                      {{ p.prioritario ? '⭐' : '☆' }}
                    </button>
                    #{{ p.numero }}
                  </span>
                  <span class="text-gray-400">$ {{ p.precio }}</span>
                </div>
                <div class="text-gray-600 truncate" [title]="p.origenDireccion">📍 {{ p.origenDireccion }}</div>
                <div class="text-gray-600 truncate" [title]="p.destinoDireccion">🏁 {{ p.destinoDireccion }}</div>
                @if (p.cadeteAsignado) {
                  <div class="text-gray-500 truncate">🏍 {{ p.cadeteAsignado.nombre }} {{ p.cadeteAsignado.apellido }}</div>
                }
                @if (p.smsFallido) {
                  <div class="text-amber-600">📵 SMS sin enviar</div>
                }
                <div class="flex gap-1 flex-wrap pt-1 border-t border-gray-100 mt-0.5">
                  @if (col.estadoId === 'SIN_ASIGNAR') {
                    <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="accion.emit({ accion: 'asignar', pedido: p })">
                      Asignar
                    </button>
                  }
                  @if (p.cadeteAsignado) {
                    <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="accion.emit({ accion: 'reasignar', pedido: p })">
                      Reasignar
                    </button>
                  }
                  @if (col.estadoId === 'EN_CURSO') {
                    <button type="button" class="btn-mini bg-blue-600 hover:bg-blue-700" (click)="accion.emit({ accion: 'finalizar', pedido: p })">
                      Finalizar
                    </button>
                  }
                  @if (col.estadoId === 'NO_ENTREGADO') {
                    <button
                      type="button"
                      class="btn-mini bg-orange-600 hover:bg-orange-700"
                      (click)="accion.emit({ accion: 'reintentar-entrega', pedido: p })"
                    >
                      Reintentar
                    </button>
                  }
                  <button type="button" class="btn-mini bg-amber-600 hover:bg-amber-700" (click)="accion.emit({ accion: 'incidencia', pedido: p })">
                    🚨 Incidencia
                  </button>
                  <button type="button" class="btn-mini bg-gray-500 hover:bg-gray-600" (click)="accion.emit({ accion: 'detalle', pedido: p })">
                    Detalle
                  </button>
                </div>
              </div>
            } @empty {
              <p class="text-xs text-gray-400 text-center py-6">✅ Sin pedidos acá.</p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .btn-mini {
        color: white;
        font-size: 0.6875rem;
        font-weight: 600;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        white-space: nowrap;
      }
    `,
  ],
})
export class KanbanPedidosComponent implements OnChanges {
  /** Mejora 84 — arrastrar una tarjeta "Sin asignar" a un cadete libre para asignarlo directo, sin abrir el modal. */
  onDragStart(ev: DragEvent, p: Pedido): void {
    ev.dataTransfer?.setData('text/pedido-id', p.id);
    ev.dataTransfer!.effectAllowed = 'move';
  }

  @Input() pedidos: Pedido[] = [];
  @Output() accion = new EventEmitter<{ accion: Accion; pedido: Pedido }>();

  readonly columnas = COLUMNAS;
  readonly claseEstadoPedido = claseEstadoPedido;

  private readonly pedidosSignal = signal<Pedido[]>([]);
  readonly porColumna = computed<Record<string, Pedido[]>>(() => {
    const grupos: Record<string, Pedido[]> = {};
    for (const p of this.pedidosSignal()) {
      (grupos[p.estado.id] ??= []).push(p);
    }
    return grupos;
  });

  ngOnChanges(): void {
    this.pedidosSignal.set(this.pedidos);
  }

  pedidosDe(estadoId: string): Pedido[] {
    return this.porColumna()[estadoId] ?? [];
  }
}
