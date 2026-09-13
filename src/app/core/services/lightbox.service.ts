import { Injectable, signal } from '@angular/core';

/** Visor de fotos tipo lightbox (mejora 83) — antes las miniaturas abrían la foto en una pestaña nueva. */
@Injectable({ providedIn: 'root' })
export class LightboxService {
  readonly urlAbierta = signal<string | null>(null);

  abrir(url: string): void {
    this.urlAbierta.set(url);
  }

  cerrar(): void {
    this.urlAbierta.set(null);
  }
}
