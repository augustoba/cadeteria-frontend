import { Injectable } from '@angular/core';

/** Una dirección resuelta por el geocoder. */
export interface GeoAddress {
  /** Texto normalizado para mostrar y guardar, ej: "San Juan 354, San Miguel de Tucumán". */
  label: string;
  street: string;
  number: number | null;
  locality: string;
  lat: number;
  lng: number;
  /** true cuando no se ubicó la altura exacta y el pin quedó en la cuadra. */
  approximate: boolean;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
/** Bounding box de la provincia de Tucumán: left,top,right,bottom (para sesgar la búsqueda). */
const TUCUMAN_VIEWBOX = '-66.2,-26.0,-64.4,-28.1';

/**
 * Autocompletado de direcciones usando **Nominatim (OpenStreetMap)** — gratis y sin
 * API key. Misma solución que se usa en el proyecto de ecommerce para direcciones
 * de Tucumán: georef-ar no sirve porque no trae coordenadas ni alturas de calle.
 *
 * Hace dos búsquedas y las junta:
 *  1. con la altura → dirección exacta (casi siempre San Miguel de Tucumán), pin en la puerta;
 *  2. sólo la calle → la misma calle en otras localidades (Yerba Buena, Tafí Viejo,
 *     Concepción…), pin en la cuadra (se ajusta a mano en el mapa).
 *
 * Uso responsable: Nominatim pide ≤ 1 request/segundo (de ahí el debounce de 600ms
 * del address-picker). Para volumen alto: auto-hospedar o LocationIQ/Geoapify.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  async search(text: string): Promise<GeoAddress[]> {
    const q = text.trim().replace(/\s+/g, ' ');
    if (q.length < 4) return [];

    const m = q.match(/^(.+?)[\s,]*(\d{1,6})\s*$/);
    const streetPart = m ? m[1].trim() : q;
    const number = m ? parseInt(m[2], 10) : null;

    const queries: Promise<GeoAddress[]>[] = [this.query(q, number)];
    if (number != null && streetPart.length >= 3) {
      queries.push(this.query(streetPart, null).then((rs) => rs.map((r) => withNumber(r, number))));
    }

    const merged = (await Promise.all(queries)).flat();
    return dedupe(merged);
  }

  /**
   * Reverse geocoding: qué dirección hay en un punto (para cuando el admin arrastra
   * el pin). Devuelve el texto normalizado; las coordenadas las decide el pin, no este resultado.
   */
  async reverse(lat: number, lng: number): Promise<GeoAddress | null> {
    const url =
      `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lng}` +
      `&addressdetails=1&accept-language=es&zoom=18`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const p = (await res.json()) as RawPlace & { error?: unknown };
      if (p.error || !p.address?.road) return null;
      const g = toGeoAddress(p, null);
      // el pin manda: mantenemos las coordenadas que eligió el admin
      return { ...g, lat, lng };
    } catch {
      return null;
    }
  }

  private async query(text: string, expectedNumber: number | null): Promise<GeoAddress[]> {
    const url =
      `${NOMINATIM_URL}?format=jsonv2&limit=12&countrycodes=ar&addressdetails=1` +
      `&accept-language=es&viewbox=${TUCUMAN_VIEWBOX}&q=${encodeURIComponent(text + ', Tucumán')}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = (await res.json()) as RawPlace[];
      return data
        .filter((p) => p.address?.state === 'Tucumán' && p.address?.road && p.lat && p.lon)
        .map((p) => toGeoAddress(p, expectedNumber));
    } catch {
      return [];
    }
  }
}

interface RawPlace {
  lat?: string;
  lon?: string;
  type?: string;
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}

function toGeoAddress(p: RawPlace, expectedNumber: number | null): GeoAddress {
  const a = p.address ?? {};
  const street = a.road ?? '';
  const rawNum = a.house_number ? parseInt(a.house_number, 10) : NaN;
  const number = Number.isFinite(rawNum) ? rawNum : expectedNumber;
  const locality = cleanLocality(
    a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? a.neighbourhood ?? a.county ?? ''
  );

  const base = street ? `${street}${number != null ? ` ${number}` : ''}` : (p.display_name ?? '');
  const label = street && locality ? `${base}, ${locality}` : base;

  return {
    label: label || (p.display_name ?? 'Dirección'),
    street,
    number,
    locality,
    lat: parseFloat(p.lat!),
    lng: parseFloat(p.lon!),
    approximate: !a.house_number,
  };
}

/** Recalcula el label de un resultado sólo-calle agregándole la altura tipeada. */
function withNumber(r: GeoAddress, number: number): GeoAddress {
  const base = `${r.street} ${number}`;
  return {
    ...r,
    number,
    approximate: true,
    label: r.locality ? `${base}, ${r.locality}` : base,
  };
}

function cleanLocality(s: string): string {
  return s.replace(/^Municipio de\s+/i, '').trim();
}

function dedupe(list: GeoAddress[]): GeoAddress[] {
  const seen = new Set<string>();
  const out: GeoAddress[] = [];
  // primero las exactas (no aproximadas), después las de cuadra
  for (const a of [...list].sort((x, y) => Number(x.approximate) - Number(y.approximate))) {
    const key = `${a.street.toLowerCase()}|${a.locality.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(a);
    }
  }
  return out.slice(0, 7);
}
