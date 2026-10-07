import { Component } from '@angular/core';
import { CallesARevisarComponent } from './calles-a-revisar.component';
import { UnionCallesComponent } from './union-calles.component';

/**
 * Pantalla "Calles" (2026-10-07): el mantenimiento de la base propia de calles, que antes estaba
 * mezclado dentro de Configuración. Toca datos con los que se ubican los pedidos, por eso va aparte.
 */
@Component({
  selector: 'app-calles',
  imports: [CallesARevisarComponent, UnionCallesComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="bg-white rounded shadow-sm px-4 py-3">
        <h1 class="font-semibold text-gray-800">Calles</h1>
        <p class="text-xs text-gray-500">
          La base propia de calles con la que se ubican los pedidos. Acá se revisan las cuadras y los nombres que el
          sistema no puede dar por buenos solo. Lo que se cambia acá cambia dónde cae una dirección en el mapa.
        </p>
      </div>

      <section class="bg-white rounded shadow-sm px-4 py-3">
        <app-calles-a-revisar />
      </section>

      <section class="bg-white rounded shadow-sm px-4 py-3">
        <app-union-calles />
      </section>
    </div>
  `,
})
export class CallesComponent {}
