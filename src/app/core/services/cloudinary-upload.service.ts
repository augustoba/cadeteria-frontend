import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { ConfiguracionService } from './configuracion.service';

interface CloudinaryUploadResponse {
  secure_url: string;
}

/**
 * Sube imagenes directo a Cloudinary desde el navegador (unsigned upload preset), igual
 * que en el ecommerce — no pasa por el backend. Cloud name / preset vienen de Configuración.
 */
@Injectable({ providedIn: 'root' })
export class CloudinaryUploadService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfiguracionService);

  /** `override`: para pantallas públicas que no pueden leer /admin/configuracion (ver ConfiguracionPublicaService). */
  subir(file: File, override?: { cloudName: string; uploadPreset: string }): Observable<string> {
    const cloudName = override?.cloudName || this.config.cloudName();
    const preset = override?.uploadPreset || this.config.uploadPreset();
    if (!cloudName || !preset) {
      return throwError(() => new Error('Falta configurar Cloudinary (pantalla Configuración) antes de subir imágenes.'));
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);

    return this.http
      .post<CloudinaryUploadResponse>(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, formData)
      .pipe(map((res) => res.secure_url));
  }
}
