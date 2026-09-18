import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { Permiso, Rol, RolInput } from '../models/rol.model';

/**
 * Roles con permisos configurables (mejora pedida por el dueño 2026-09-16). Listar roles
 * (para el selector de "Usuarios") lo puede ver cualquier admin logueado; crear/editar/
 * borrar exige el permiso "roles" (el backend lo hace cumplir igual, esto es solo la UI).
 */
@Injectable({ providedIn: 'root' })
export class RolService {
  private readonly http = inject(HttpClient);

  private readonly rolesSignal = signal<Rol[]>([]);
  readonly roles = this.rolesSignal.asReadonly();
  private readonly permisosSignal = signal<Permiso[]>([]);
  readonly permisos = this.permisosSignal.asReadonly();
  private readonly loadingSignal = signal(false);
  readonly loading = this.loadingSignal.asReadonly();
  private cargado = false;

  ensureLoaded(): void {
    if (this.cargado) return;
    this.cargado = true;
    this.reload();
  }

  reload(): void {
    this.loadingSignal.set(true);
    this.http.get<Permiso[]>(apiUrl('/admin/roles/permisos')).subscribe((r) => this.permisosSignal.set(r));
    this.http.get<Rol[]>(apiUrl('/admin/roles')).subscribe({
      next: (r) => {
        this.rolesSignal.set(r);
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }

  crear(input: RolInput) {
    return this.http.post<Rol>(apiUrl('/admin/roles'), input);
  }

  actualizar(id: string, input: RolInput) {
    return this.http.put<Rol>(apiUrl(`/admin/roles/${id}`), input);
  }

  eliminar(id: string) {
    return this.http.delete<void>(apiUrl(`/admin/roles/${id}`));
  }
}
