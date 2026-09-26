export interface CadeteInfoPublico {
  nombre: string;
  apellido: string | null;
  dni: string | null;
  fotoUrl: string | null;
  tipoVehiculo: string | null;
  vehiculoColor: string | null;
  vehiculoPatente: string | null;
  fotoVehiculoUrl: string | null;
  cbu: string | null;
  aliasCbu: string | null;
}

export interface Seguimiento {
  estado: string;
  origenDireccion: string;
  destinoDireccion: string;
  precio: number;
  llevaDinero: boolean;
  montoDeclarado: number | null;
  llevaValores: boolean;
  montoValores: number | null;
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
  /** El cadete ya retiró el pedido en el origen. */
  retirado: boolean;
  /** Foto que sacó el cadete al retirar (desde que retiró). */
  retiroFotoUrl: string | null;
  /** Firma de quien recibió (solo entregado). */
  firmaUrl: string | null;
}
