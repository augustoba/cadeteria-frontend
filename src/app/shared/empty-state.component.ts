import { Component, Input } from '@angular/core';

/**
 * Estado vacío reutilizable (mejora 81) — antes cada pantalla tenía su propio texto gris
 * plano ("Sin pedidos", "Sin solicitudes todavía", etc.) sin ninguna acción sugerida.
 */
@Component({
  selector: 'app-empty-state',
  template: `
    <div class="flex flex-col items-center justify-center text-center py-10 px-4 gap-2">
      <span class="text-4xl">{{ icono }}</span>
      <p class="text-gray-500 text-sm">{{ mensaje }}</p>
      @if (hint) {
        <p class="text-xs text-gray-400 max-w-xs">{{ hint }}</p>
      }
      <div class="mt-1">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icono = '📭';
  @Input() mensaje = 'No hay nada para mostrar.';
  @Input() hint = '';
}
