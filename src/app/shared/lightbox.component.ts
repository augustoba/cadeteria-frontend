import { Component, inject } from '@angular/core';
import { LightboxService } from '../core/services/lightbox.service';
import { optimizarImagen } from '../core/utils/imagen.util';

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
        <!-- Estirada a la pantalla (2026-09-29): con max-w/max-h una foto chica quedaba del mismo tamaño que la miniatura. -->
        <img [src]="optimizar(url, 1600)" class="w-full h-full object-contain" (click)="$event.stopPropagation()" />
      </div>
    }
  `,
})
export class LightboxComponent {
  readonly lightbox = inject(LightboxService);
  /** Una función no es visible desde el template: se expone como propiedad (acá sí se quiere grande). */
  readonly optimizar = optimizarImagen;
}
