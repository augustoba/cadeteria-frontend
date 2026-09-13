import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CloudinaryUploadService } from '../core/services/cloudinary-upload.service';
import { ToastService } from '../core/services/toast.service';

/** Widget de subida de una imagen a Cloudinary, para usar con `[(value)]="algo.fotoUrl"`. */
@Component({
  selector: 'app-image-upload',
  template: `
    <div class="flex items-center gap-3">
      @if (value) {
        <img [src]="value" class="w-16 h-16 object-cover rounded border border-gray-200" />
      } @else {
        <div class="w-16 h-16 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-[0.65rem] text-center px-1">
          Sin foto
        </div>
      }
      <div class="flex flex-col gap-1">
        <input type="file" accept="image/*" class="text-xs" [disabled]="subiendo()" (change)="onFile($event)" />
        @if (subiendo()) {
          <span class="text-xs text-gray-400">Subiendo…</span>
        } @else if (value) {
          <button type="button" class="text-xs text-red-600 text-left" (click)="quitar()">Quitar foto</button>
        }
      </div>
    </div>
  `,
})
export class ImageUploadComponent {
  @Input() value: string | null = null;
  /** Para pantallas públicas que no pueden leer /admin/configuracion (ver CloudinaryUploadService). */
  @Input() credenciales?: { cloudName: string; uploadPreset: string };
  @Output() valueChange = new EventEmitter<string | null>();

  private readonly cloudinary = inject(CloudinaryUploadService);
  private readonly toast = inject(ToastService);

  readonly subiendo = signal(false);

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    this.subiendo.set(true);
    this.cloudinary.subir(file, this.credenciales).subscribe({
      next: (url) => {
        this.subiendo.set(false);
        this.valueChange.emit(url);
      },
      error: (err) => {
        this.subiendo.set(false);
        this.toast.error(err?.message ?? 'No se pudo subir la imagen.');
      },
    });
  }

  quitar(): void {
    this.valueChange.emit(null);
  }
}
