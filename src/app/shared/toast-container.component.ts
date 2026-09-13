import { Component, inject } from '@angular/core';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto rounded shadow-lg px-4 py-3 text-sm text-white flex items-start justify-between gap-3"
          [class.bg-emerald-600]="t.kind === 'success'"
          [class.bg-red-600]="t.kind === 'error'"
          [class.bg-brand-600]="t.kind === 'info'"
        >
          <span class="flex-1">{{ t.message }}</span>
          @if (t.accionLabel) {
            <button type="button" class="font-semibold underline underline-offset-2 whitespace-nowrap" (click)="toast.dismiss(t.id)">
              {{ t.accionLabel }} ({{ t.segundosRestantes }})
            </button>
          } @else {
            <button type="button" class="opacity-80 hover:opacity-100" (click)="toast.dismiss(t.id)">✕</button>
          }
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toast = inject(ToastService);
}
