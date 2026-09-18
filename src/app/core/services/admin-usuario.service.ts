import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { AdminUsuario, CrearAdminInput, CrearAdminResponse } from '../models/admin-usuario.model';
import { CollectionStore } from '../state/collection-store';

/** ABM de usuarios del panel (roles configurables, mejora 2026-09-16) — solo llega a usarse con permiso "usuarios", el backend igual lo exige (`hasAuthority("PERM_usuarios")`). */
@Injectable({ providedIn: 'root' })
export class AdminUsuarioService {
  private readonly http = inject(HttpClient);
  private readonly store = new CollectionStore<AdminUsuario>(this.http, '/admin/usuarios');

  readonly usuarios = this.store.items;
  readonly loading = this.store.loading;
  readonly errored = this.store.errored;

  ensureLoaded(): void {
    this.store.ensureLoaded();
  }

  reload(): void {
    this.store.reload();
  }

  crear(input: CrearAdminInput) {
    return this.http.post<CrearAdminResponse>(apiUrl('/admin/usuarios'), input);
  }

  cambiarRol(id: string, rol: string) {
    return this.http.patch<AdminUsuario>(apiUrl(`/admin/usuarios/${id}/rol`), { rol });
  }

  habilitar(id: string, enabled: boolean) {
    return this.http.patch<AdminUsuario>(apiUrl(`/admin/usuarios/${id}/habilitado`), { enabled });
  }

  resetearPassword(id: string) {
    return this.http.post<{ passwordTemporal: string }>(apiUrl(`/admin/usuarios/${id}/resetear-password`), {});
  }
}
