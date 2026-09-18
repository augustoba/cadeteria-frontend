import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../config/site-config';
import { GeoAddress } from './geocoding.service';

/**
 * Igual que GeocodingService pero pasando por el backend (mejora 2026-09-17) — solo para
 * la página pública "/pedir": ahí no hay login, así que sin esto cualquiera podía
 * martillar Nominatim/Geoapify directo desde el navegador con la key expuesta en el
 * bundle. El panel admin (nuevo pedido, zonas) sigue usando GeocodingService tal cual,
 * sin cambios — no hace falta ese proxy ahí, es una pantalla logueada.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingPublicoService {
  private readonly http = inject(HttpClient);

  async search(text: string): Promise<GeoAddress[]> {
    const q = text.trim();
    if (q.length < 4) return [];
    try {
      return await firstValueFrom(this.http.get<GeoAddress[]>(apiUrl('/publico/direcciones/buscar'), { params: { q } }));
    } catch {
      return [];
    }
  }

  async reverse(lat: number, lng: number): Promise<GeoAddress | null> {
    try {
      return await firstValueFrom(
        this.http.get<GeoAddress | null>(apiUrl('/publico/direcciones/reverse'), { params: { lat, lng } }),
      );
    } catch {
      return null;
    }
  }
}
