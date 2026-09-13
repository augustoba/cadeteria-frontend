import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ZonaService } from '../../core/services/zona.service';
import { Zona } from '../../core/models/zona.model';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

@Component({
  selector: 'app-zonas',
  imports: [RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Zonas</h1>
        <a routerLink="/zonas/nueva" class="btn-action bg-emerald-600 hover:bg-emerald-700">+ Nueva zona</a>
      </div>

      <div class="p-4 overflow-x-auto">
        @if (zonas.loading()) {
          <app-loading-skeleton [filas]="5" />
        } @else if (zonas.errored()) {
          <p class="text-red-600 text-sm py-6 text-center">No se pudieron cargar las zonas.</p>
        } @else {
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-200">
                <th class="py-2 pr-3 font-medium">Nombre</th>
                <th class="py-2 pr-3 font-medium">Centro</th>
                <th class="py-2 pr-3 font-medium">Radio (m)</th>
                <th class="py-2 pr-3 font-medium">Zonas aledañas</th>
                <th class="py-2 pr-3 font-medium">Estado</th>
                <th class="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              @for (z of zonas.zonas(); track z.id) {
                <tr class="border-b border-gray-100 hover:bg-gray-50" [class.opacity-50]="!z.activo">
                  <td class="py-2 pr-3 whitespace-nowrap">{{ z.nombre }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap font-mono text-xs">{{ z.centroLat }}, {{ z.centroLng }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ z.radioM }}</td>
                  <td class="py-2 pr-3">{{ nombresAledanas(z) }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    <span
                      class="px-2 py-0.5 rounded text-xs font-medium"
                      [class]="z.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'"
                    >
                      {{ z.activo ? 'Activa' : 'Inactiva' }}
                    </span>
                  </td>
                  <td class="py-2 pr-3 whitespace-nowrap flex gap-2">
                    <a [routerLink]="['/zonas', z.id]" class="btn-mini bg-brand-600 hover:bg-brand-700">Editar</a>
                    <button
                      type="button"
                      class="btn-mini"
                      [class]="z.activo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'"
                      (click)="toggleActivo(z)"
                    >
                      {{ z.activo ? 'Desactivar' : 'Reactivar' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <app-empty-state icono="📍" mensaje="Todavía no hay zonas cargadas." hint="Sin al menos una zona no se puede cargar un pedido." />
                  </td>
                </tr>
              }
            </tbody>
          </table>
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
      .btn-mini {
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 0.3rem;
        display: inline-block;
      }
    `,
  ],
})
export class ZonasComponent implements OnInit {
  readonly zonas = inject(ZonaService);

  ngOnInit(): void {
    this.zonas.ensureLoaded();
  }

  nombresAledanas(z: Zona): string {
    return z.zonasAledanas.length ? z.zonasAledanas.map((a) => a.nombre).join(', ') : '—';
  }

  toggleActivo(z: Zona): void {
    this.zonas.setActivo(z.id, !z.activo);
  }
}
