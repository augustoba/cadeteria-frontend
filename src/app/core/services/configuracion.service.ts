import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';

interface ConfiguracionResponse {
  valores: Record<string, string>;
}

/**
 * Parametros globales editables desde el panel (tiempo limite de aceptacion,
 * frecuencia de ubicacion, credenciales de Cloudinary) — diseno-tecnico.md
 * sección 3/7/8. Se cargan una vez al arrancar el panel.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly http = inject(HttpClient);
  private readonly valoresSignal = signal<Record<string, string>>({});
  private cargado = false;

  readonly valores = this.valoresSignal.asReadonly();

  readonly cloudinaryConfigured = computed(() => {
    const v = this.valoresSignal();
    return !!v['cloudinary_cloud_name'] && !!v['cloudinary_upload_preset'];
  });

  cloudName(): string {
    return this.valoresSignal()['cloudinary_cloud_name'] ?? '';
  }

  uploadPreset(): string {
    return this.valoresSignal()['cloudinary_upload_preset'] ?? '';
  }

  ensureLoaded(): void {
    if (this.cargado) return;
    this.cargado = true;
    this.reload();
  }

  reload(): void {
    this.http.get<ConfiguracionResponse>(apiUrl('/admin/configuracion')).subscribe({
      next: (res) => this.valoresSignal.set(res.valores),
      error: () => (this.cargado = false),
    });
  }

  guardar(clave: string, valor: string, onSuccess?: () => void, onError?: () => void): void {
    this.http.put<ConfiguracionResponse>(apiUrl('/admin/configuracion'), { clave, valor }).subscribe({
      next: (res) => {
        this.valoresSignal.set(res.valores);
        onSuccess?.();
      },
      error: () => onError?.(),
    });
  }
}
