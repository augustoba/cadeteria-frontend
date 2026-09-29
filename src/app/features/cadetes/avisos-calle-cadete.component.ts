import { Component, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';

interface ResumenAvisosCadete {
  avisados: number;
  marcadosYaNoEsta: number;
  bajados: number;
}

/**
 * Ficha del cadete → Desempeño: sus "avisos de la calle" (2026-09-29, segunda etapa). Cuántos mandó,
 * a cuántos otro cadete que pasó por ahí contestó "ya no está" y cuántos se bajaron (dos "ya no está"
 * de cadetes distintos). Sirve para ver quién avisa cosas que no son; nadie aprueba nada.
 */
@Component({
  selector: 'app-avisos-calle-cadete',
  standalone: true,
  template: `
    @if (datos(); as d) {
      <section class="border border-gray-200 rounded p-3">
        <h2 class="font-semibold text-gray-700 mb-2">
          Avisos de la calle
          <span class="text-xs font-normal text-gray-400">(todo el historial)</span>
        </h2>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div>
            <div class="text-xl font-semibold text-gray-700">{{ d.avisados }}</div>
            <div class="text-xs text-gray-500">Avisos que mandó</div>
          </div>
          <div>
            <div class="text-xl font-semibold" [class]="d.marcadosYaNoEsta ? 'text-amber-600' : 'text-gray-700'">
              {{ d.marcadosYaNoEsta }}
            </div>
            <div class="text-xs text-gray-500">Otro cadete contestó "ya no está"</div>
          </div>
          <div>
            <div class="text-xl font-semibold" [class]="d.bajados ? 'text-red-600' : 'text-gray-700'">{{ d.bajados }}</div>
            <div class="text-xs text-gray-500">Se bajaron (2 "ya no está")</div>
          </div>
        </div>
        @if (d.avisados > 0 && d.bajados / d.avisados >= 0.5) {
          <p class="text-xs text-red-600 mt-2">⚠️ La mitad o más de sus avisos los bajaron otros cadetes.</p>
        }
      </section>
    }
  `,
})
export class AvisosCalleCadeteComponent {
  private readonly http = inject(HttpClient);
  readonly cadeteId = input.required<string>();
  readonly datos = signal<ResumenAvisosCadete | null>(null);

  constructor() {
    effect(() => {
      const id = this.cadeteId();
      if (!id) return;
      this.http
        .get<ResumenAvisosCadete>(apiUrl(`/admin/cadetes/${id}/avisos-calle`))
        .subscribe({ next: (d) => this.datos.set(d), error: () => this.datos.set(null) });
    });
  }
}
