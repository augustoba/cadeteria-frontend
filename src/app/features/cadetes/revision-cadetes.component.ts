import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CadeteActualizacionService } from '../../core/services/cadete-actualizacion.service';
import { CampoPendienteAdmin } from '../../core/models/cadete-actualizacion.model';
import { ToastService } from '../../core/services/toast.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { optimizarImagen } from '../../core/utils/imagen.util';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

const CAMPO_LABEL: Record<string, string> = {
  FOTO_PERFIL: 'Foto de perfil',
  FOTO_VEHICULO: 'Foto del vehículo',
  FOTO_TARJETA_VERDE: 'Tarjeta verde — frente',
  FOTO_TARJETA_VERDE_DORSO: 'Tarjeta verde — dorso',
  VEHICULO_MARCA: 'Marca',
  VEHICULO_MODELO: 'Modelo',
  VEHICULO_COLOR: 'Color',
  VEHICULO_PATENTE: 'Patente',
  VEHICULO_ANIO: 'Año',
};

const CAMPOS_FOTO = new Set(['FOTO_PERFIL', 'FOTO_VEHICULO', 'FOTO_TARJETA_VERDE', 'FOTO_TARJETA_VERDE_DORSO']);

interface LoteAgrupado {
  actualizacionId: string;
  cadeteId: string;
  cadeteNombre: string;
  cadeteApellido: string;
  cadeteFotoUrl: string | null;
  campos: CampoPendienteAdmin[];
}

/** Revisión admin de "Actualizar mis datos" (mejora 2026-09-23) — aprobar/rechazar campo por campo. */
@Component({
  selector: 'app-revision-cadetes',
  imports: [FormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Actualizaciones de cadetes</h1>
        <a routerLink="/cadetes" class="btn-action bg-red-500 hover:bg-red-600">↩ Volver</a>
      </div>

      <div class="p-4 flex flex-col gap-3">
        @if (service.loading()) {
          <app-loading-skeleton [filas]="4" />
        } @else {
          @for (lote of lotes(); track lote.actualizacionId) {
            <div class="border border-gray-200 rounded p-3 flex flex-col gap-2">
              <div class="flex items-center gap-2">
                @if (lote.cadeteFotoUrl) {
                  <img [src]="optimizar(lote.cadeteFotoUrl, 60)" class="w-8 h-8 rounded-full object-cover border" />
                }
                <span class="font-medium text-gray-700">{{ lote.cadeteNombre }} {{ lote.cadeteApellido }}</span>
              </div>

              @for (item of lote.campos; track item.campo.id) {
                <div class="border-t border-gray-100 pt-2 flex items-center justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-3">
                    <span class="text-sm font-medium text-gray-700" style="width: 10rem">{{ CAMPO_LABEL[item.campo.campo] }}</span>
                    @if (esFoto(item.campo.campo)) {
                      <div class="flex items-center gap-2">
                        @if (item.campo.valorAnterior) {
                          <button type="button" (click)="lightbox.abrir(item.campo.valorAnterior!)">
                            <img [src]="optimizar(item.campo.valorAnterior, 100)" class="w-14 h-14 object-cover rounded border" />
                          </button>
                        } @else {
                          <span class="text-xs text-gray-400">(sin foto)</span>
                        }
                        <span class="text-gray-400">→</span>
                        <button type="button" (click)="lightbox.abrir(item.campo.valorPropuesto)">
                          <img [src]="optimizar(item.campo.valorPropuesto, 100)" class="w-14 h-14 object-cover rounded border-2 border-emerald-400" />
                        </button>
                      </div>
                    } @else {
                      <span class="text-sm text-gray-600">{{ item.campo.valorAnterior ?? '—' }} → <strong>{{ item.campo.valorPropuesto }}</strong></span>
                    }
                  </div>
                  <div class="flex gap-2">
                    <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="aprobar(item)">✔ Aprobar</button>
                    <button type="button" class="btn-mini bg-red-600 hover:bg-red-700" (click)="rechazar(item)">✖ Rechazar</button>
                  </div>
                </div>
              }
            </div>
          } @empty {
            <app-empty-state icono="🔄" mensaje="Sin actualizaciones pendientes." hint="Acá van a aparecer los cambios que los cadetes propongan desde la app." />
          }
        }
      </div>
    </div>

    @if (campoARechazar(); as item) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarRechazar()">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-red-600 text-white px-5 py-4">
            <h2 class="font-semibold">Rechazar {{ CAMPO_LABEL[item.campo.campo] }}</h2>
            <p class="text-red-50 text-sm">{{ item.cadeteNombre }} {{ item.cadeteApellido }}</p>
          </div>
          <div class="p-5 flex flex-col gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Motivo (opcional)</span>
              <textarea class="input" rows="3" [(ngModel)]="motivoRechazoModal" name="motivoRechazo"></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarRechazar()">Volver</button>
            <button type="button" class="btn bg-red-600 hover:bg-red-700" (click)="confirmarRechazar()">Rechazar</button>
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
        padding: 0.4rem 0.6rem;
        font-size: 0.8125rem;
      }
      textarea.input {
        font-family: inherit;
        resize: vertical;
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
      }
    `,
  ],
})
export class RevisionCadetesComponent implements OnInit {
  readonly service = inject(CadeteActualizacionService);
  private readonly toast = inject(ToastService);
  readonly lightbox = inject(LightboxService);

  readonly CAMPO_LABEL = CAMPO_LABEL;
  readonly optimizar = optimizarImagen;

  readonly lotes = computed<LoteAgrupado[]>(() => {
    const porLote = new Map<string, LoteAgrupado>();
    for (const item of this.service.pendientes()) {
      let lote = porLote.get(item.actualizacionId);
      if (!lote) {
        lote = {
          actualizacionId: item.actualizacionId,
          cadeteId: item.cadeteId,
          cadeteNombre: item.cadeteNombre,
          cadeteApellido: item.cadeteApellido,
          cadeteFotoUrl: item.cadeteFotoUrl,
          campos: [],
        };
        porLote.set(item.actualizacionId, lote);
      }
      lote.campos.push(item);
    }
    return Array.from(porLote.values());
  });

  readonly campoARechazar = signal<CampoPendienteAdmin | null>(null);
  motivoRechazoModal = '';

  ngOnInit(): void {
    this.service.listar();
  }

  esFoto(campo: string): boolean {
    return CAMPOS_FOTO.has(campo);
  }

  aprobar(item: CampoPendienteAdmin): void {
    this.service.aprobar(item.campo.id, () => {
      this.toast.info('Campo aprobado.');
      this.service.listar();
    });
  }

  rechazar(item: CampoPendienteAdmin): void {
    this.motivoRechazoModal = '';
    this.campoARechazar.set(item);
  }

  cerrarRechazar(): void {
    this.campoARechazar.set(null);
  }

  confirmarRechazar(): void {
    const item = this.campoARechazar();
    if (!item) return;
    const motivo = this.motivoRechazoModal.trim();
    this.service.rechazar(item.campo.id, motivo || null, () => {
      this.toast.info('Campo rechazado.');
      this.service.listar();
    });
    this.campoARechazar.set(null);
  }
}
