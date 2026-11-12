import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncidenciaService } from '../core/services/incidencia.service';
import { PrioridadIncidencia } from '../core/models/incidencia.model';
import { ESTILOS_BOTONES } from './estilos-botones';

/**
 * "Nueva incidencia" de un pedido (sacado del dashboard el 2026-11-11 para usarlo también en el
 * detalle del pedido de la pantalla "Pedidos"). Se muestra mientras `pedidoId` no sea null.
 */
@Component({
  selector: 'app-nueva-incidencia-modal',
  styles: [ESTILOS_BOTONES],
  imports: [FormsModule],
  template: `
    @if (pedidoId) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" (click)="cerrar.emit()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Nueva incidencia</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrar.emit()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Título</span>
              <input class="input" [(ngModel)]="titulo" name="tituloIncidenciaModal" placeholder="Ej: Reclamo del cliente" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Prioridad</span>
              <select class="input" [(ngModel)]="prioridad" name="prioridadIncidenciaModal">
                <option value="BAJA">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="GRAVE">Grave</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Observación</span>
              <textarea class="input" rows="3" [(ngModel)]="descripcion" name="descripcionIncidenciaModal"></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrar.emit()">Cancelar</button>
            <button type="button" class="btn bg-amber-600 hover:bg-amber-700" [disabled]="!titulo.trim()" (click)="confirmar()">
              Crear
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class NuevaIncidenciaModalComponent {
  private readonly incidencias = inject(IncidenciaService);

  private pedidoIdActual: string | null = null;

  /** Al abrir para otro pedido se limpia el formulario. */
  @Input()
  set pedidoId(id: string | null) {
    if (id && id !== this.pedidoIdActual) {
      this.titulo = '';
      this.descripcion = '';
      this.prioridad = 'NORMAL';
    }
    this.pedidoIdActual = id;
  }
  get pedidoId(): string | null {
    return this.pedidoIdActual;
  }

  @Output() cerrar = new EventEmitter<void>();
  /** Después de crearla, con el id del pedido. */
  @Output() creada = new EventEmitter<string>();

  titulo = '';
  descripcion = '';
  prioridad: PrioridadIncidencia = 'NORMAL';

  confirmar(): void {
    const pedidoId = this.pedidoIdActual;
    const titulo = this.titulo.trim();
    if (!pedidoId || !titulo) return;
    this.incidencias.crear({ titulo, descripcion: this.descripcion.trim() || null, pedidoId, prioridad: this.prioridad }, () => {
      this.creada.emit(pedidoId);
      this.cerrar.emit();
    });
  }
}
