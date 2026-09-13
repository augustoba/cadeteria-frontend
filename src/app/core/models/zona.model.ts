import { Lookup } from './lookup.model';

export interface PuntoZona {
  lat: number;
  lng: number;
}

export interface Zona {
  id: string;
  nombre: string;
  centroLat: number;
  centroLng: number;
  radioM: number;
  /** Precio sugerido al cargar un pedido en esta zona — null = sin sugerencia. */
  tarifaSugerida: number | null;
  zonasAledanas: Lookup[];
  /** Polígono libre (ronda 3, punto 27) — vacío = la zona sigue siendo el círculo. */
  poligono: PuntoZona[];
  /** Desactivada temporalmente sin borrarla (ronda 10, punto 99). */
  activo: boolean;
}

export interface ZonaInput {
  nombre: string;
  centroLat: number;
  centroLng: number;
  radioM: number;
  tarifaSugerida: number | null;
  poligono: PuntoZona[];
}
