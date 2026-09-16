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
const GEOAPIFY_URL = 'https://api.geoapify.com/v1/geocode/search';
const LOCATIONIQ_URL = 'https://us1.locationiq.com/v1/search';
const PHOTON_URL = 'https://photon.komoot.io/api/';
/** Bounding box de la provincia de Tucumán: left,top,right,bottom (para sesgar la búsqueda). */
const TUCUMAN_VIEWBOX = '-66.2,-26.0,-64.4,-28.1';
/** Mismo bounding box que TUCUMAN_VIEWBOX pero en el orden que pide Photon: minLon,minLat,maxLon,maxLat. */
const TUCUMAN_BBOX_PHOTON = '-66.2,-28.1,-64.4,-26.0';

/**
 * Sacar gratis (sin tarjeta) en https://myprojects.geoapify.com/ — 3.000 búsquedas/día.
 * Tiene base de datos propia además de OSM, así que puede encontrar alturas que a
 * Nominatim le faltan. Vacío = no se usa (se sigue funcionando solo con Nominatim).
 */
const GEOAPIFY_API_KEY = '273798db51844ff6b761f6d09f7358e3';

/**
 * Sacar gratis (sin tarjeta) en https://locationiq.com/ — 5.000 búsquedas/día. Ojo:
 * corre sobre los mismos datos de OSM que Nominatim, así que rara vez suma cobertura
 * nueva — sirve igual como respaldo si Nominatim está caído o rate-limiteado.
 * Vacío = no se usa.
 */
const LOCATIONIQ_API_KEY = 'pk.117f16f1d630ef90773656ffa29db89f';

/**
 * Autocompletado de direcciones combinando varias fuentes gratuitas — **Nominatim**
 * (OpenStreetMap) y **Photon** (Komoot, también sobre datos de OSM pero corriendo en
 * otro servidor — sirve como contingencia si Nominatim está caído/rate-limiteado, sin
 * key ni registro) siempre activos, y opcionalmente **Geoapify** y **LocationIQ** si se
 * cargan sus API keys arriba. Cuantas más fuentes, menos chances de que una calle real no
 * aparezca solo porque a una de las bases de datos le falta esa altura cargada
 * (georef-ar no sirve para esto: no trae coordenadas ni alturas de calle).
 *
 * Cada fuente hace dos búsquedas y se juntan todas:
 *  1. con la altura → dirección exacta (casi siempre San Miguel de Tucumán), pin en la puerta;
 *  2. sólo la calle → la misma calle en otras localidades (Yerba Buena, Tafí Viejo,
 *     Concepción…), pin en la cuadra (se ajusta a mano en el mapa).
 *
 * Uso responsable: Nominatim y Photon piden ≤ 1 request/segundo cada uno (de ahí el
 * debounce de 600ms del address-picker) — Geoapify/LocationIQ toleran más volumen.
 * Photon es la demo pública de Komoot, sin garantía de uptime — por eso va como cuarta
 * fuente de contingencia, no reemplaza a ninguna de las otras tres.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  async search(text: string): Promise<GeoAddress[]> {
    const q = text.trim().replace(/\s+/g, ' ');
    if (q.length < 4) return [];

    const m = q.match(/^(.+?)[\s,]*(\d{1,6})\s*$/);
    const streetPart = m ? m[1].trim() : q;
    const number = m ? parseInt(m[2], 10) : null;

    const proveedores = this.proveedoresActivos();
    const queries: Promise<GeoAddress[]>[] = proveedores.map((buscar) => buscar(q, number));
    if (number != null && streetPart.length >= 3) {
      for (const buscar of proveedores) {
        queries.push(buscar(streetPart, null).then((rs) => rs.map((r) => withNumber(r, number))));
      }
    }

    const merged = (await Promise.all(queries)).flat();
    return dedupe(merged);
  }

  private proveedoresActivos(): Array<(text: string, expectedNumber: number | null) => Promise<GeoAddress[]>> {
    const proveedores: Array<(text: string, expectedNumber: number | null) => Promise<GeoAddress[]>> = [
      (text, n) => this.queryNominatim(text, n),
      (text, n) => this.queryPhoton(text, n),
    ];
    if (GEOAPIFY_API_KEY) proveedores.push((text, n) => this.queryGeoapify(text, n));
    if (LOCATIONIQ_API_KEY) proveedores.push((text, n) => this.queryLocationIq(text, n));
    return proveedores;
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

  private async queryNominatim(text: string, expectedNumber: number | null): Promise<GeoAddress[]> {
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

  /** LocationIQ replica el formato de respuesta de Nominatim, así que se reutiliza el mismo parseo. */
  private async queryLocationIq(text: string, expectedNumber: number | null): Promise<GeoAddress[]> {
    const url =
      `${LOCATIONIQ_URL}?key=${LOCATIONIQ_API_KEY}&format=json&limit=12&countrycodes=ar&addressdetails=1` +
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

  private async queryGeoapify(text: string, expectedNumber: number | null): Promise<GeoAddress[]> {
    const url =
      `${GEOAPIFY_URL}?apiKey=${GEOAPIFY_API_KEY}&format=json&limit=12&lang=es` +
      `&filter=countrycode:ar&bias=rect:${TUCUMAN_VIEWBOX}&text=${encodeURIComponent(text + ', Tucumán')}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: GeoapifyResult[] };
      return (data.results ?? [])
        .filter((r) => (r.state ?? '').toLowerCase().includes('tucum') && r.street && r.lat != null && r.lon != null)
        .map((r) => toGeoAddressFromGeoapify(r, expectedNumber));
    } catch {
      return [];
    }
  }

  /**
   * Sin API key ni registro — demo pública de Komoot sobre datos de OSM (contingencia si
   * Nominatim falla). Ojo: Photon solo soporta `lang=default|de|en|fr` (probado en vivo,
   * "es" tira 400) — se omite el parámetro y listo, los nombres de calle ya vienen en
   * español porque así están cargados en OSM para Argentina.
   */
  private async queryPhoton(text: string, expectedNumber: number | null): Promise<GeoAddress[]> {
    const url = `${PHOTON_URL}?q=${encodeURIComponent(text + ', Tucumán')}&limit=12&bbox=${TUCUMAN_BBOX_PHOTON}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as { features?: PhotonFeature[] };
      return (data.features ?? [])
        .filter(
          (f) =>
            (f.properties.state ?? '').toLowerCase().includes('tucum') &&
            f.properties.street &&
            f.geometry?.coordinates?.length === 2
        )
        .map((f) => toGeoAddressFromPhoton(f, expectedNumber));
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

interface GeoapifyResult {
  housenumber?: string;
  street?: string;
  suburb?: string;
  city?: string;
  county?: string;
  state?: string;
  lat?: number;
  lon?: number;
}

function toGeoAddressFromGeoapify(r: GeoapifyResult, expectedNumber: number | null): GeoAddress {
  const street = r.street ?? '';
  const rawNum = r.housenumber ? parseInt(r.housenumber, 10) : NaN;
  const number = Number.isFinite(rawNum) ? rawNum : expectedNumber;
  const locality = cleanLocality(r.city ?? r.suburb ?? r.county ?? '');

  const base = street ? `${street}${number != null ? ` ${number}` : ''}` : '';
  const label = street && locality ? `${base}, ${locality}` : base || 'Dirección';

  return {
    label,
    street,
    number,
    locality,
    lat: r.lat!,
    lng: r.lon!,
    approximate: !r.housenumber,
  };
}

interface PhotonFeature {
  properties: {
    housenumber?: string;
    street?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

function toGeoAddressFromPhoton(f: PhotonFeature, expectedNumber: number | null): GeoAddress {
  const p = f.properties;
  const street = p.street ?? '';
  const rawNum = p.housenumber ? parseInt(p.housenumber, 10) : NaN;
  const number = Number.isFinite(rawNum) ? rawNum : expectedNumber;
  const locality = cleanLocality(p.city ?? p.county ?? p.locality ?? '');

  const base = street ? `${street}${number != null ? ` ${number}` : ''}` : '';
  const label = street && locality ? `${base}, ${locality}` : base || 'Dirección';
  const [lng, lat] = f.geometry!.coordinates!;

  return {
    label,
    street,
    number,
    locality,
    lat,
    lng,
    approximate: !p.housenumber,
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
