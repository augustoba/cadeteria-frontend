import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { Zona, ZonaInput } from '../models/zona.model';
import { CollectionStore } from '../state/collection-store';

@Injectable({ providedIn: 'root' })
export class ZonaService {
  private readonly http = inject(HttpClient);
  private readonly store = new CollectionStore<Zona>(this.http, '/admin/zonas');

  readonly zonas = this.store.items;
  readonly loading = this.store.loading;
  readonly errored = this.store.errored;
  readonly saving = this.store.saving;

  ensureLoaded(): void {
    this.store.ensureLoaded();
  }

  reload(): void {
    this.store.reload();
  }

  get(id: string) {
    return this.http.get<Zona>(apiUrl(`/admin/zonas/${id}`));
  }

  crear(input: ZonaInput, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl('/admin/zonas'), input), onSuccess);
  }

  actualizar(id: string, input: ZonaInput, onSuccess?: () => void): void {
    this.store.mutate(this.http.put(apiUrl(`/admin/zonas/${id}`), input), onSuccess);
  }

  eliminar(id: string): void {
    this.store.mutate(this.http.delete(apiUrl(`/admin/zonas/${id}`)));
  }

  /** Desactivar/reactivar sin borrar (ronda 10, punto 99). */
  setActivo(id: string, activo: boolean): void {
    this.store.mutate(this.http.patch(apiUrl(`/admin/zonas/${id}/activo`), { activo }));
  }

  agregarAdyacente(id: string, zonaVecinaId: string, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/zonas/${id}/adyacentes`), { zonaVecinaId }), onSuccess);
  }

  quitarAdyacente(id: string, zonaVecinaId: string, onSuccess?: () => void): void {
    this.store.mutate(this.http.delete(apiUrl(`/admin/zonas/${id}/adyacentes/${zonaVecinaId}`)), onSuccess);
  }

  nombreDe(id: string): string {
    return this.zonas().find((z) => z.id === id)?.nombre ?? id;
  }
}
