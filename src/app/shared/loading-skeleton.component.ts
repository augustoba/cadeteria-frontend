import { Component, Input } from '@angular/core';

/**
 * Loading skeleton reutilizable (mejora 82) — antes todas las pantallas mostraban el
 * mismo texto plano "Cargando…" sin ninguna forma de la pantalla final.
 */
@Component({
  selector: 'app-loading-skeleton',
  template: `
    <div class="flex flex-col gap-2 py-1">
      @for (i of indices(); track i) {
        <div class="h-4 rounded animate-pulse bg-gray-200" [style.width.%]="anchoDeFila(i)"></div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class LoadingSkeletonComponent {
  @Input() filas = 4;

  indices(): number[] {
    return Array.from({ length: this.filas }, (_, i) => i);
  }

  anchoDeFila(i: number): number {
    return i % 3 === 2 ? 55 : 90;
  }
}
