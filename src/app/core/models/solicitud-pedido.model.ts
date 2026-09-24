export type EstadoSolicitudPedido = 'PENDIENTE' | 'COTIZADO' | 'CONFIRMADA' | 'RECHAZADA';

export interface SolicitudPedido {
  id: string;
  origenDireccion: string;
  origenLat: number;
  origenLng: number;
  destinoDireccion: string;
  destinoLat: number;
  destinoLng: number;
  llevaDinero: boolean;
  montoDeclarado: number | null;
  llevaValores: boolean;
  retornaAlOrigen: boolean;
  clienteNombre: string;
  clienteTelefono: string;
  detalle: string | null;
  /** Piso/depto y observaciones de cada dirección (mejora 2026-09-24), opcionales. */
  origenPisoDepto: string | null;
  origenObservaciones: string | null;
  destinoPisoDepto: string | null;
  destinoObservaciones: string | null;
  estado: EstadoSolicitudPedido;
  requiereMoto: boolean;
  precio: number | null;
  pedidoCreadoId: string | null;
  motivoRechazo: string | null;
  creadoEn: string;
}

export interface SolicitudPedidoInput {
  origenDireccion: string;
  origenLat: number;
  origenLng: number;
  destinoDireccion: string;
  destinoLat: number;
  destinoLng: number;
  llevaDinero: boolean;
  montoDeclarado: number | null;
  llevaValores: boolean;
  /** Lo pide el cliente — el admin lo puede cambiar al revisar. */
  requiereMoto: boolean;
  retornaAlOrigen: boolean;
  clienteNombre: string;
  clienteTelefono: string;
  detalle: string | null;
  /** Piso/depto y observaciones de cada dirección (mejora 2026-09-24), opcionales. */
  origenPisoDepto: string | null;
  origenObservaciones: string | null;
  destinoPisoDepto: string | null;
  destinoObservaciones: string | null;
  /** Token de VerificacionTelefonoService.verificarCodigo (mejora 2026-09-17) — confirma que el teléfono es real. */
  verificacionToken: string;
}

export interface RevisarSolicitudInput {
  requiereMoto: boolean;
  precio: number;
  montoDeclarado: number | null;
}

export interface ConfirmacionPublica {
  estado: EstadoSolicitudPedido;
  origenDireccion: string;
  destinoDireccion: string;
  precio: number | null;
  tokenSeguimiento: string | null;
}
