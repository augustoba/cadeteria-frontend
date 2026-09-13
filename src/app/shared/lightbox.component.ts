import { Component, inject } from '@angular/core';
import { LightboxService } from '../core/services/lightbox.service';

@Component({
  selector: 'app-lightbox',
  template: `
    @if (lightbox.urlAbierta(); as url) {
      <div
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
        (click)="lightbox.cerrar()"
      >
        <button type="button" class="absolute top-4 right-4 text-white text-2xl leading-none hover:opacity-80" (click)="lightbox.cerrar()">
          ✕
        </button>
        <img [src]="url" class="max-w-full max-h-full rounded shadow-2xl" (click)="$event.stopPropagation()" />
      </div>
    }
  `,
})
export class LightboxComponent {
  readonly lightbox = inject(LightboxService);
}
