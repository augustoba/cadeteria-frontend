import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OnboardingService } from '../../core/services/onboarding.service';
import { reiniciarGuias } from '../../core/guias';

/** "Primeros pasos": puesta en marcha con avance real contra los datos de la cadetería. */
@Component({
  selector: 'app-primeros-pasos',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t">
        <h1 class="font-semibold">Primeros pasos</h1>
      </div>
      <div class="p-6 flex flex-col gap-6 max-w-2xl">
        <div>
          <p class="text-sm text-gray-500 mb-2">
            {{ ob.esencialesHechas() }} de {{ ob.esenciales().length }} esenciales — preparalo a tu ritmo, siempre podés volver.
          </p>
          <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full bg-emerald-500 transition-all" [style.width.%]="ob.porcentaje()"></div>
          </div>
        </div>

        @for (t of ob.tareas(); track t.id) {
          <div
            class="flex items-center gap-4 border rounded-lg p-4"
            [class.border-emerald-200]="t.hecha"
            [class.bg-emerald-50]="t.hecha"
            [class.border-gray-200]="!t.hecha"
          >
            <span class="text-2xl">{{ t.icon }}</span>
            <div class="flex-1">
              <div class="font-semibold text-gray-700">
                {{ t.titulo }}
                @if (t.esencial) {
                  <span class="ml-1 text-xs font-medium text-brand-600">· esencial</span>
                }
              </div>
              <p class="text-sm text-gray-500">{{ t.desc }}</p>
            </div>
            @if (t.hecha) {
              <span class="text-emerald-600 font-semibold text-sm whitespace-nowrap">✔ Listo</span>
            } @else {
              <a [routerLink]="t.link" class="btn bg-brand-600 hover:bg-brand-700 whitespace-nowrap">{{ t.cta }}</a>
            }
          </div>
        }

        <div class="border-t border-gray-200 pt-5 flex items-center gap-3">
          <button type="button" class="btn bg-gray-500 hover:bg-gray-600" (click)="verGuias()">↻ Ver de nuevo las guías de cada pantalla</button>
          @if (reiniciado) {
            <span class="text-sm text-gray-500">Listo — van a aparecer otra vez al entrar a cada pantalla.</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        text-decoration: none;
        display: inline-block;
      }
    `,
  ],
})
export class PrimerosPasosComponent {
  readonly ob = inject(OnboardingService);
  reiniciado = false;

  verGuias(): void {
    reiniciarGuias();
    this.reiniciado = true;
  }
}
