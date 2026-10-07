import { Component, signal } from '@angular/core';
import { CallesABuscarComponent } from './calles-a-buscar.component';
import { CallesARevisarComponent } from './calles-a-revisar.component';
import { UnionCallesComponent } from './union-calles.component';

type Solapa = 'revisar' | 'buscar' | 'nombres';

/**
 * Pantalla "Calles" (2026-10-07): el mantenimiento de la base propia de calles, que antes estaba
 * mezclado dentro de Configuración. Toca datos con los que se ubican los pedidos, por eso va aparte.
 * Tres solapas: lo que está en duda, lo que falta y los nombres repetidos.
 */
@Component({
  selector: 'app-calles',
  imports: [CallesARevisarComponent, CallesABuscarComponent, UnionCallesComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="bg-white rounded shadow-sm px-4 pt-3">
        <h1 class="font-semibold text-gray-800">Calles</h1>
        <p class="text-xs text-gray-500">
          La base propia de calles con la que se ubican los pedidos. Acá se revisan las cuadras y los nombres que el
          sistema no puede dar por buenos solo, y se cargan las que faltan. Lo que se cambia acá cambia dónde cae una
          dirección en el mapa.
        </p>
        <div class="flex gap-1 mt-3 -mb-px">
          @for (s of solapas; track s.id) {
            <button
              type="button"
              class="px-3 py-2 text-sm border-b-2"
              [class]="solapa() === s.id ? 'border-brand-600 text-brand-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'"
              (click)="solapa.set(s.id)"
            >
              {{ s.nombre }}
            </button>
          }
        </div>
      </div>

      <section class="bg-white rounded shadow-sm px-4 py-3">
        @switch (solapa()) {
          @case ('revisar') {
            <app-calles-a-revisar />
          }
          @case ('buscar') {
            <app-calles-a-buscar />
          }
          @case ('nombres') {
            <app-union-calles />
          }
        }
      </section>
    </div>
  `,
})
export class CallesComponent {
  readonly solapas: { id: Solapa; nombre: string }[] = [
    { id: 'revisar', nombre: 'A revisar' },
    { id: 'buscar', nombre: 'A buscar' },
    { id: 'nombres', nombre: 'Dos nombres' },
  ];
  readonly solapa = signal<Solapa>('revisar');
}
