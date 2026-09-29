import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { Pedido } from '../../core/models/pedido.model';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { claseEstadoPedido } from './tabla-pedidos.component';

type Accion =
  | 'asignar'
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
  | 'reclamo-visto'
  | 'reclamo-cerrar';

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
                [class.reclamo-retiro]="reclamoActivo(p) && p.reclamoTipo === 'DEMORA_RETIRO'"
                [class.reclamo-entrega]="reclamoActivo(p) && p.reclamoTipo === 'DEMORA_ENTREGA'"
                [class.reclamo-problema]="reclamoActivo(p) && p.reclamoTipo === 'PROBLEMA_ENTREGA'"
                [class.reclamo-parpadea]="p.reclamoEstado === 'ABIERTO'"
                [class.sin-asignar-urgente]="sinAsignarHaceRato(p)"
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
                @if (sinAsignarHaceRato(p)) {
                  <div class="text-[11px] font-semibold text-violet-700">⏰ Sin asignar hace {{ minutosDesde(p.creadoEn) }} min</div>
                }
                <!-- Reclamo del cliente: lo mismo que en la tabla (2026-09-29, antes el Kanban no lo mostraba). -->
                @if (reclamoActivo(p)) {
                  <div class="flex items-center gap-1 flex-wrap" [title]="p.reclamoDetalle || ''">
                    <span class="text-[11px] font-semibold" [class]="claseTextoReclamo(p)">📣 {{ textoReclamo(p) }}</span>
                    @if (p.reclamoEstado === 'ABIERTO') {
                      <button type="button" class="btn-reclamo" (click)="accion.emit({ accion: 'reclamo-visto', pedido: p })">Visto</button>
                    }
                    <button type="button" class="btn-reclamo" (click)="accion.emit({ accion: 'reclamo-cerrar', pedido: p })">Cerrar</button>
                  </div>
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
                    <button
                      type="button"
                      class="btn-mini"
                      [class]="p.clienteAvisadoEn ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-emerald-600 hover:bg-emerald-700'"
                      [title]="p.clienteAvisadoEn ? 'Ya se avisó — tocá para reenviar' : 'Abre la app de WhatsApp con el aviso escrito: solo apretá Enter'"
                      (click)="accion.emit({ accion: 'avisar-cliente', pedido: p })"
                    >
                      {{ p.clienteAvisadoEn ? '✓ Avisado' : '📲 Avisar' }}
                    </button>
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
      /* Mismos colores que la tabla (tabla-pedidos.component.ts): reclamo por tipo, parpadea hasta
         "Visto"; sin asignar hace rato en violeta, parpadea hasta que se asigna. */
      .reclamo-retiro {
        background-color: rgba(245, 158, 11, 0.18);
      }
      .reclamo-entrega {
        background-color: rgba(249, 115, 22, 0.22);
      }
      .reclamo-problema {
        background-color: rgba(220, 38, 38, 0.2);
      }
      .sin-asignar-urgente {
        background-color: rgba(139, 92, 246, 0.2);
        animation: parpadeo-reclamo 1s ease-in-out infinite;
      }
      .reclamo-parpadea {
        animation: parpadeo-reclamo 1s ease-in-out infinite;
      }
      @keyframes parpadeo-reclamo {
        50% {
          background-color: white;
        }
      }
      .btn-reclamo {
        font-size: 10px;
        font-weight: 600;
        padding: 0 0.4rem;
        border-radius: 0.25rem;
        border: 1px solid currentColor;
        color: #374151;
        background: white;
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

  private readonly config = inject(ConfiguracionService);
  /** Reloj para "sin asignar hace N min", igual que en la tabla. */
  readonly ahora = signal(Date.now());

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  minutosDesde(iso: string | null | undefined): number {
    return iso ? Math.floor((this.ahora() - new Date(iso).getTime()) / 60_000) : 0;
  }

  /** Mismo criterio que la tabla: sin asignar hace más de "minutos_pedido_urgente_reintentar" (default 30). */
  sinAsignarHaceRato(p: Pedido): boolean {
    if (p.estado.id !== 'SIN_ASIGNAR' || !p.creadoEn) return false;
    const limite = Number(this.config.valores()['minutos_pedido_urgente_reintentar']) || 30;
    return this.minutosDesde(p.creadoEn) >= limite;
  }

  reclamoActivo(p: Pedido): boolean {
    return !!p.reclamoEstado && p.reclamoEstado !== 'CERRADO';
  }

  textoReclamo(p: Pedido): string {
    const tipo =
      p.reclamoTipo === 'DEMORA_RETIRO'
        ? 'Demora en el retiro'
        : p.reclamoTipo === 'DEMORA_ENTREGA'
          ? 'Demora en la entrega'
          : 'Problema con la entrega';
    return p.reclamoEstado === 'CONTACTO' ? `${tipo} — pidió que lo contacten` : tipo;
  }

  claseTextoReclamo(p: Pedido): string {
    return p.reclamoTipo === 'PROBLEMA_ENTREGA' ? 'text-red-700' : p.reclamoTipo === 'DEMORA_ENTREGA' ? 'text-orange-700' : 'text-amber-700';
  }
}
