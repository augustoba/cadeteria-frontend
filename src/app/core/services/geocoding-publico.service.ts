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
export interface ResultadoLink {
  lat: number | null;
  lng: number | null;
  error: string | null;
  direccion?: string | null;
}

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

  /** Solo la base propia del backend: contesta al instante. */
  async searchPropias(text: string): Promise<GeoAddress[]> {
    return this.buscarEn('/publico/direcciones/buscar-propias', text);
  }

  /**
   * Solo los servicios de afuera (tardan unos segundos). Vacío si la base ya lo resolvió o si la
   * búsqueda externa está apagada en Configuración.
   */
  async searchExternas(text: string): Promise<GeoAddress[]> {
    return this.buscarEn('/publico/direcciones/buscar-externas', text);
  }

  private async buscarEn(ruta: string, text: string): Promise<GeoAddress[]> {
    const q = text.trim();
    if (q.length < 4) return [];
    try {
      return await firstValueFrom(this.http.get<GeoAddress[]>(apiUrl(ruta), { params: { q } }));
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

  /**
   * Calles conocidas para lo que se viene escribiendo sin la altura ("alem" -> "Avenida Alem"): la
   * base propia ubica por calle + altura, así que se ofrecen para completar el nombre.
   */
  async sugerirCalles(text: string): Promise<string[]> {
    const q = text.trim();
    if (q.length < 4) return [];
    try {
      return await firstValueFrom(this.http.get<string[]>(apiUrl('/publico/direcciones/calles'), { params: { q } }));
    } catch {
      return [];
    }
  }

  /**
   * Link de Google Maps pegado en el buscador (largo, o corto de "Compartir" en la app) — el
   * backend saca las coordenadas (ver LinkGoogleMapsService). No gasta cupo de Google.
   * `direccion` es "calle número" cuando el link la trae escrita (una dirección buscada en Google
   * Maps); con un comercio o un punto marcado a mano viene null.
   */
  async resolverLink(url: string): Promise<ResultadoLink> {
    try {
      return await firstValueFrom(
        this.http.get<ResultadoLink>(apiUrl('/publico/direcciones/link'), { params: { url } }),
      );
    } catch {
      return { lat: null, lng: null, error: 'No pudimos leer ese link. Probá de nuevo.', direccion: null };
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
