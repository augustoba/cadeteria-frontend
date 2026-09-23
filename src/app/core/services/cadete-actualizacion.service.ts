import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { CampoPendienteAdmin } from '../models/cadete-actualizacion.model';

/** Revisión admin de las actualizaciones de datos que proponen los cadetes (mejora 2026-09-23). */
@Injectable({ providedIn: 'root' })
export class CadeteActualizacionService {
  private readonly http = inject(HttpClient);

  private readonly pendientesSignal = signal<CampoPendienteAdmin[]>([]);
  readonly pendientes = this.pendientesSignal.asReadonly();
  private readonly loadingSignal = signal(false);
  readonly loading = this.loadingSignal.asReadonly();

  listar(): void {
    this.loadingSignal.set(true);
    this.http.get<CampoPendienteAdmin[]>(apiUrl('/admin/cadetes/actualizaciones')).subscribe({
      next: (lista) => {
        this.pendientesSignal.set(lista);
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }

  aprobar(id: string, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/cadetes/actualizaciones/campos/${id}/aprobar`), {}).subscribe(() => onSuccess?.());
  }

  rechazar(id: string, motivo: string | null, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/cadetes/actualizaciones/campos/${id}/rechazar`), { motivo }).subscribe(() => onSuccess?.());
  }
}
