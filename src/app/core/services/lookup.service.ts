import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Lookup } from '../models/lookup.model';
import { CollectionStore } from '../state/collection-store';

@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly http = inject(HttpClient);
  private readonly tiposVehiculoStore = new CollectionStore<Lookup>(this.http, '/admin/lookups/tipos-vehiculo');

  readonly tiposVehiculo = this.tiposVehiculoStore.items;

  ensureLoaded(): void {
    this.tiposVehiculoStore.ensureLoaded();
  }

  nombreTipoVehiculo(id: string): string {
    return this.tiposVehiculo().find((t) => t.id === id)?.nombre ?? id;
  }
}
