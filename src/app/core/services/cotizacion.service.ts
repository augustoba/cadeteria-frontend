import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../config/site-config';

export interface Cotizacion {
  precioSugerido: number | null;
  metodo: 'ZONA' | 'DISTANCIA' | null;
  zonaId: string | null;
  zonaNombre: string | null;
  distanciaKm: number | null;
  recargoPorDinero: number | null;
}

export type MetodoCotizacion = 'ZONA' | 'DISTANCIA';

/**
 * Sugerencia de precio por GPS (mejora 2026-09-16) — endpoint público (`/api/publico/cotizar`),
 * lo usan tanto "Nuevo pedido"/"Pedidos web" del panel como la página pública "/pedir".
 * Nunca es vinculante: `precioSugerido` viene en `null` si no hay zona con precio ni
 * "precio por km" configurado, y quien la usa siempre puede sobreescribirla a mano.
 *
 * `montoDeclarado` suma el recargo por dinero transportado configurado en Configuración
 * (mejora: "cada $10.000 transportados, $100 más"). `metodo` fuerza "ZONA" o "DISTANCIA"
 * en vez del automático (zona primero, si no distancia) — lo usa el selector del panel.
 */
@Injectable({ providedIn: 'root' })
export class CotizacionService {
  private readonly http = inject(HttpClient);

  cotizar(
    origenLat: number,
    origenLng: number,
    destinoLat?: number | null,
    destinoLng?: number | null,
    montoDeclarado?: number | null,
    metodo?: MetodoCotizacion | null,
  ) {
    let params = new HttpParams().set('origenLat', origenLat).set('origenLng', origenLng);
    if (destinoLat != null && destinoLng != null) {
      params = params.set('destinoLat', destinoLat).set('destinoLng', destinoLng);
    }
    if (montoDeclarado != null && montoDeclarado > 0) params = params.set('montoDeclarado', montoDeclarado);
    if (metodo) params = params.set('metodo', metodo);
    return this.http.get<Cotizacion>(apiUrl('/publico/cotizar'), { params });
  }
}
