import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { Pedido } from '../../core/models/pedido.model';
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
  | 'prioritario'
  | 'buscar-cliente';

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
            <th class="py-2 pr-3 font-medium">Cliente</th>
            <th class="py-2 pr-3 font-medium">Origen</th>
            <th class="py-2 pr-3 font-medium">Destino</th>
            <th class="py-2 pr-3 font-medium">Valor trámite</th>
            <th class="py-2 pr-3 font-medium">Cadete</th>
            <th class="py-2 pr-3 font-medium">Horarios</th>
            <th class="py-2 pr-3 font-medium text-center" title="El cadete abrió el detalle del viaje">Visto</th>
            <th class="py-2 pr-3 font-medium">Estado</th>
            <th class="py-2 pr-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          @for (p of pedidosPagina; track p.id) {
            <!-- Filas cebra: regla global en styles.css (tbody > tr); el color por estado de abajo le gana. -->
            <tr
              class="border-b border-gray-100"
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
              <td class="py-2 pr-3 whitespace-nowrap">
                <button
                  type="button"
                  class="text-left hover:underline"
                  [title]="'Ver todos los pedidos activos de ' + p.clienteNombre"
                  (click)="accion.emit({ accion: 'buscar-cliente', pedido: p })"
                >
                  {{ p.clienteNombre }}
                </button>
                @if (contarMismoCliente(p); as n) {
                  @if (n > 0) {
                    <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium" [title]="'Tiene ' + n + ' pedido(s) activo(s) más'">
                      +{{ n }}
                    </span>
                  }
                }
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
              <td class="py-2 pr-3 whitespace-nowrap text-xs text-gray-500 leading-tight">
                <div>Creado {{ hora(p.creadoEn) }}</div>
                @if (p.aceptadoEn) {
                  <div>Aceptado {{ hora(p.aceptadoEn) }}</div>
                }
                @if (p.retiradoEn) {
                  <div>Recibido {{ hora(p.retiradoEn) }}</div>
                }
                @if (p.finalizadoEn) {
                  <div>Entregado {{ hora(p.finalizadoEn) }}</div>
                }
              </td>
              <td class="py-2 pr-3 whitespace-nowrap text-center">
                @if (p.estado.id === 'PENDIENTE' && p.vistoEn) {
                  <span class="text-sky-500 text-base" [title]="'Visto ' + hora(p.vistoEn)">✓✓</span>
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
              <td class="py-2 pr-3 whitespace-nowrap">
                <div class="pedido-menu-wrap flex items-center justify-end gap-2">
                  @if (mostrarAcciones && p.estado.id === 'SIN_ASIGNAR') {
                    <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="accion.emit({ accion: 'asignar', pedido: p })">
                      Asignar
                    </button>
                  }
                  @if (mostrarAcciones && p.estado.id === 'EN_CURSO') {
                    <button type="button" class="btn-mini bg-blue-600 hover:bg-blue-700" (click)="accion.emit({ accion: 'finalizar', pedido: p })">
                      Finalizar
                    </button>
                  }
                  @if (mostrarAcciones && p.estado.id === 'NO_ENTREGADO') {
                    <button
                      type="button"
                      class="btn-mini bg-orange-600 hover:bg-orange-700"
                      (click)="accion.emit({ accion: 'reintentar-entrega', pedido: p })"
                    >
                      Reintentar entrega
                    </button>
                  }
                  @if (!tieneAccionPrincipal(p)) {
                    <button type="button" class="btn-mini bg-gray-500 hover:bg-gray-600" (click)="accion.emit({ accion: 'detalle', pedido: p })">
                      Detalle
                    </button>
                  }
                  <button type="button" class="kebab" (click)="toggleMenu(p.id)" [attr.aria-expanded]="abierto() === p.id" aria-label="Más acciones">
                    ⋯
                  </button>
                  @if (abierto() === p.id) {
                    <!-- Cada opción con el color que tenía cuando los botones estaban sueltos en la fila,
                         para reconocerla de un vistazo. -->
                    <div class="menu">
                      @if (tieneAccionPrincipal(p)) {
                        <button type="button" class="bg-gray-500 hover:bg-gray-600" (click)="emitirYCerrar('detalle', p)">Detalle</button>
                      }
                      @if (mostrarAcciones && p.cadeteAsignado) {
                        <button type="button" class="bg-indigo-600 hover:bg-indigo-700" (click)="emitirYCerrar('reasignar', p)">
                          Reasignar
                        </button>
                        <button type="button" class="bg-amber-500 hover:bg-amber-600" (click)="emitirYCerrar('quitar', p)">
                          Quitar cadete
                        </button>
                      }
                      @if (mostrarAcciones) {
                        <button type="button" class="bg-emerald-600 hover:bg-emerald-700" (click)="emitirYCerrar('imprimir', p)">
                          Imprimir
                        </button>
                      }
                      <button type="button" class="bg-amber-600 hover:bg-amber-700" (click)="emitirYCerrar('incidencia', p)">
                        🚨 Crear incidencia
                      </button>
                      @if (mostrarAcciones) {
                        <div class="sep"></div>
                        <button type="button" class="bg-red-600 hover:bg-red-700" (click)="emitirYCerrar('anular', p)">
                          Anular pedido
                        </button>
                      }
                    </div>
                  }
                </div>
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

      @if (!paginadoExterno && pedidos.length > tamanoPagina) {
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
      .pedido-menu-wrap {
        position: relative;
      }
      .kebab {
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 0.4rem;
        color: #6b7280;
        flex-shrink: 0;
        line-height: 1;
      }
      .kebab:hover {
        background: #f1f2f6;
      }
      .menu {
        position: absolute;
        top: 2.1rem;
        right: 0;
        background: white;
        border: 1px solid #e6e8ef;
        border-radius: 0.6rem;
        box-shadow: 0 20px 40px -16px rgba(15, 23, 41, 0.25);
        min-width: 170px;
        z-index: 30;
        padding: 0.35rem;
      }
      .menu {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .menu button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 0.45rem 0.7rem;
        border-radius: 0.35rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: white;
        transition: background-color 0.15s;
      }
      .menu .sep {
        height: 1px;
        background: #e6e8ef;
        margin: 0.25rem 0.1rem;
      }
    `,
  ],
})
export class TablaPedidosComponent implements OnChanges {
  @Input() pedidos: Pedido[] = [];
  @Input() mostrarAcciones = false;
  /**
   * true cuando quien usa este componente ya le manda solo la página actual (ej.
   * "Pedidos finalizados" del dashboard, paginado en el backend desde 2026-09-16) — en
   * ese caso no hay que volver a recortar acá ni mostrar un segundo paginador.
   */
  @Input() paginadoExterno = false;
  @Output() accion = new EventEmitter<{ accion: Accion; pedido: Pedido }>();

  readonly tamanoPagina = TAMANO_PAGINA;
  readonly pagina = signal(1);
  /** Nº de pedido con el menú "⋯" de acciones secundarias abierto (uno solo a la vez). */
  readonly abierto = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pedidos']) this.pagina.set(1);
  }

  toggleMenu(pedidoId: string): void {
    this.abierto.update((actual) => (actual === pedidoId ? null : pedidoId));
  }

  emitirYCerrar(accionId: Accion, pedido: Pedido): void {
    this.abierto.set(null);
    this.accion.emit({ accion: accionId, pedido });
  }

  /** El botón principal visible (Asignar/Finalizar/Reintentar) según el estado — si no hay
   *  ninguno (finalizado, cancelado), "Detalle" pasa a ser el botón visible en vez de ir
   *  adentro del menú. */
  tieneAccionPrincipal(p: Pedido): boolean {
    if (!this.mostrarAcciones) return false;
    return ['SIN_ASIGNAR', 'EN_CURSO', 'NO_ENTREGADO'].includes(p.estado.id);
  }

  @HostListener('document:click', ['$event'])
  cerrarSiClickAfuera(event: MouseEvent): void {
    if (this.abierto() === null) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.pedido-menu-wrap')) this.abierto.set(null);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.pedidos.length / TAMANO_PAGINA));
  }

  get pedidosPagina(): Pedido[] {
    if (this.paginadoExterno) return this.pedidos;
    const inicio = (this.pagina() - 1) * TAMANO_PAGINA;
    return this.pedidos.slice(inicio, inicio + TAMANO_PAGINA);
  }

  irAPagina(n: number): void {
    this.pagina.set(Math.min(Math.max(1, n), this.totalPaginas));
  }

  hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  /** Cuántos OTROS pedidos de esta misma lista (activos) son del mismo cliente — para agruparlos de un vistazo. */
  contarMismoCliente(p: Pedido): number {
    return this.pedidos.filter((x) => x.clienteTelefono === p.clienteTelefono).length - 1;
  }

  claseEstado(p: Pedido): string {
    return claseEstadoPedido(p.estado.id);
  }
}
