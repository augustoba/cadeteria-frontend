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
