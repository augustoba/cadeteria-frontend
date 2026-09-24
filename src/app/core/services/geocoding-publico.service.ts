import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../config/site-config';
import { GeoAddress } from '../models/geo-address.model';

/**
 * Único punto de geocoding del front — pasa siempre por el backend (`GeocodingProxyService`),
 * que a su vez consulta la cache de direcciones antes de gastar cupo de ningún proveedor
 * (spec-geocoding-cache.md). Hasta 2026-09-21 el panel admin (nuevo pedido) llamaba directo a
 * Nominatim/Geoapify/LocationIQ/Photon desde el navegador, con las keys de Geoapify y LocationIQ
 * hardcodeadas y expuestas en el bundle — ese servicio (`geocoding.service.ts`) se eliminó al
 * migrar acá, así que ya no hay ninguna key de geocoding en el front.
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

  /**
   * "No está mi dirección — buscar de nuevo": saltea la cache del backend y prueba Google si hay
   * key cargada (si no, vuelve a consultar los gratuitos).
   */
  async searchAmpliado(text: string): Promise<GeoAddress[]> {
    const q = text.trim();
    if (q.length < 4) return [];
    try {
      return await firstValueFrom(this.http.get<GeoAddress[]>(apiUrl('/publico/direcciones/buscar-ampliado'), { params: { q } }));
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
