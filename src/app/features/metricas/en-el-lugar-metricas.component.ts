import { Component, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { apiUrl } from '../../core/config/site-config';
import { ResumenCadeteEnLugar } from '../../core/models/en-el-lugar.model';

/**
 * Métricas → "Marcas en el lugar" (2026-09-28): por cadete, cuántas veces marcó lejos con "Estoy en el
 * lugar", con GPS impreciso o le finalizaron un viaje desde el panel en el rango elegido, y los intentos
 * con GPS falso (de siempre). Solo aparecen los cadetes con algo anotado.
 */
@Component({
  selector: 'app-en-el-lugar-metricas',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section>
      <h2 class="font-semibold text-gray-700 mb-2">
        Marcas en el lugar
        <span class="text-xs font-normal text-gray-400">(Retirado/Entregado lejos del punto, GPS falso, finalizados por el admin)</span>
      </h2>
      @if (filas().length) {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-gray-500 text-left border-b border-gray-200">
              <tr>
                <th class="py-2 pr-3">Cadete</th>
                <th class="py-2 pr-3 text-right">"Estoy en el lugar" lejos</th>
                <th class="py-2 pr-3 text-right">GPS falso (siempre)</th>
                <th class="py-2 pr-3 text-right">GPS impreciso</th>
                <th class="py-2 pr-3 text-right">Finalizados por el admin</th>
              </tr>
            </thead>
            <tbody>
              @for (f of filas(); track f.cadeteId) {
                <tr class="border-b border-gray-100">
                  <td class="py-2 pr-3">
                    <a [routerLink]="['/cadetes', f.cadeteId, 'ficha']" class="text-brand-600 hover:underline">{{ f.cadeteNombre }}</a>
                  </td>
                  <td class="py-2 pr-3 text-right" [class.text-red-600]="f.vecesFueraZona > 0">{{ f.vecesFueraZona }}</td>
                  <td class="py-2 pr-3 text-right" [class.text-red-600]="f.intentosUbicacionSimulada > 0">
                    {{ f.intentosUbicacionSimulada }}
                  </td>
                  <td class="py-2 pr-3 text-right">{{ f.vecesImprecisa }}</td>
                  <td class="py-2 pr-3 text-right">{{ f.vecesFinalizadoPorAdmin }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-sm text-gray-400">Ningún cadete con marcas fuera de lo normal en este período.</p>
      }
    </section>
  `,
})
export class EnElLugarMetricasComponent {
  private readonly http = inject(HttpClient);
  readonly desde = input.required<string>();
  readonly hasta = input.required<string>();
  readonly filas = signal<ResumenCadeteEnLugar[]>([]);

  constructor() {
    effect(() => {
      const params = { desde: this.desde(), hasta: this.hasta() };
      this.http
        .get<ResumenCadeteEnLugar[]>(apiUrl('/admin/metricas/en-el-lugar'), { params })
        .subscribe({ next: (f) => this.filas.set(f), error: () => this.filas.set([]) });
    });
  }
}
