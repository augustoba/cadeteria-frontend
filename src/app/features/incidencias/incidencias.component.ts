import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncidenciaService } from '../../core/services/incidencia.service';
import { PrioridadIncidencia } from '../../core/models/incidencia.model';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

@Component({
  selector: 'app-incidencias',
  imports: [FormsModule, DatePipe, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Incidencias</h1>
        <button type="button" class="btn-action bg-emerald-600 hover:bg-emerald-700" (click)="abrirNueva()">
          + Nueva incidencia
        </button>
      </div>

      <div class="px-4 py-2 border-b border-gray-200 flex gap-2">
        <button type="button" class="btn-mini" [class]="filtroClase('')" (click)="filtrar(null)">Todas</button>
        <button type="button" class="btn-mini" [class]="filtroClase('ABIERTA')" (click)="filtrar('ABIERTA')">Abiertas</button>
        <button type="button" class="btn-mini" [class]="filtroClase('CERRADA')" (click)="filtrar('CERRADA')">Cerradas</button>
      </div>

      <div class="p-4 flex flex-col gap-3">
        @if (incidencias.loading()) {
          <app-loading-skeleton [filas]="4" />
        } @else {
          @for (i of incidencias.incidencias(); track i.id) {
            <div class="border border-gray-200 rounded p-3 flex flex-col gap-1">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span
                    class="px-2 py-0.5 rounded text-xs font-medium mr-2"
                    [class]="i.estado === 'ABIERTA' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'"
                  >
                    {{ i.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada' }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded text-xs font-medium mr-2"
                    [class]="{
                      'bg-red-100 text-red-700': i.prioridad === 'GRAVE',
                      'bg-gray-100 text-gray-600': i.prioridad === 'BAJA',
                      'bg-blue-50 text-blue-700': i.prioridad === 'NORMAL',
                    }"
                  >
                    {{ i.prioridad === 'GRAVE' ? '🚨 Grave' : i.prioridad === 'BAJA' ? 'Baja' : 'Normal' }}
                  </span>
                  <span class="font-medium text-gray-700">{{ i.titulo }}</span>
                  @if (i.cadeteNombre) {
                    <span class="text-xs text-gray-400"> — cadete: {{ i.cadeteNombre }}</span>
                  }
                </div>
                @if (i.estado === 'ABIERTA') {
                  <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="cerrar(i.id)">
                    ✓ Cerrar
                  </button>
                } @else {
                  <button type="button" class="btn-mini bg-gray-400 hover:bg-gray-500" (click)="reabrir(i.id)">
                    ↺ Reabrir
                  </button>
                }
              </div>
              @if (i.descripcion) {
                <p class="text-sm text-gray-600 whitespace-pre-line">{{ i.descripcion }}</p>
              }
              <p class="text-xs text-gray-400">
                Creada {{ i.creadaEn | date: 'short' }}{{ i.creadaPorUsername ? ' por ' + i.creadaPorUsername : '' }}
                @if (i.cerradaEn) {
                  · cerrada {{ i.cerradaEn | date: 'short' }}{{ i.cerradaPorUsername ? ' por ' + i.cerradaPorUsername : '' }}
                }
              </p>
            </div>
          } @empty {
            <app-empty-state icono="🎫" mensaje="Sin incidencias." hint="Buen síntoma — significa que no hay reclamos ni problemas abiertos." />
          }
        }
      </div>
    </div>

    @if (mostrarNueva()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModal()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">Nueva incidencia</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarModal()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Título</span>
              <input class="input" [(ngModel)]="titulo" name="titulo" placeholder="Ej: Reclamo de un vecino por ruido" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Prioridad</span>
              <select class="input" [(ngModel)]="prioridad" name="prioridad">
                <option value="BAJA">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="GRAVE">Grave</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Descripción (opcional)</span>
              <textarea class="input" rows="4" [(ngModel)]="descripcion" name="descripcion"></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModal()">Cancelar</button>
            <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="!titulo.trim() || incidencias.saving()" (click)="crear()">
              Crear
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
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.35rem 0.75rem;
        border-radius: 0.3rem;
        display: inline-block;
        color: white;
      }
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
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
export class IncidenciasComponent implements OnInit {
  readonly incidencias = inject(IncidenciaService);

  readonly filtroActual = signal<string | null>(null);
  readonly mostrarNueva = signal(false);
  titulo = '';
  descripcion = '';
  prioridad: PrioridadIncidencia = 'NORMAL';

  ngOnInit(): void {
    this.incidencias.listar();
  }

  filtrar(estado: string | null): void {
    this.filtroActual.set(estado);
    this.incidencias.listar(estado ?? undefined);
  }

  filtroClase(estado: string): string {
    const activo = (this.filtroActual() ?? '') === estado;
    return activo ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-300 hover:bg-gray-400 text-gray-700';
  }

  abrirNueva(): void {
    this.titulo = '';
    this.descripcion = '';
    this.prioridad = 'NORMAL';
    this.mostrarNueva.set(true);
  }

  cerrarModal(): void {
    this.mostrarNueva.set(false);
  }

  crear(): void {
    if (!this.titulo.trim()) return;
    this.incidencias.crear({ titulo: this.titulo.trim(), descripcion: this.descripcion.trim() || null, prioridad: this.prioridad }, () => {
      this.mostrarNueva.set(false);
      this.filtrar(this.filtroActual());
    });
  }

  cerrar(id: string): void {
    this.incidencias.cerrar(id, () => this.filtrar(this.filtroActual()));
  }

  reabrir(id: string): void {
    this.incidencias.reabrir(id, () => this.filtrar(this.filtroActual()));
  }
}
