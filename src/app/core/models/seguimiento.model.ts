export interface CadeteInfoPublico {
  nombre: string;
  fotoUrl: string | null;
  tipoVehiculo: string | null;
  vehiculoColor: string | null;
  vehiculoPatente: string | null;
  cbu: string | null;
  aliasCbu: string | null;
}

export interface Seguimiento {
  estado: string;
  origenDireccion: string;
  destinoDireccion: string;
  precio: number;
  cadete: CadeteInfoPublico | null;
  comprobanteDisponible: boolean;
  entregaReceptorNombre: string | null;
  entregaFotoUrl: string | null;
  puedeCalificar: boolean;
  calificacionEstrellas: number | null;
  calificacionComentario: string | null;
  /** Solo mientras el pedido está "En curso" — tracking en vivo estilo Uber. */
  cadeteLat: number | null;
  cadeteLng: number | null;
  destinoLat: number | null;
  destinoLng: number | null;
  /** Minutos estimados de llegada — null si no se pudo calcular. */
  etaMinutos: number | null;
}
