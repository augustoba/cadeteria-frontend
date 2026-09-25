import { ClienteAviso } from './cliente.model';

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
  montoValores: number | null;
  retornaAlOrigen: boolean;
  clienteNombre: string;
  clienteTelefono: string;
  detalle: string | null;
  /** Piso, depto y observaciones de cada dirección (mejora 2026-09-24), opcionales. */
  origenPiso: string | null;
  origenDepto: string | null;
  origenObservaciones: string | null;
  destinoPiso: string | null;
  destinoDepto: string | null;
  destinoObservaciones: string | null;
  estado: EstadoSolicitudPedido;
  requiereMoto: boolean;
  precio: number | null;
  pedidoCreadoId: string | null;
  motivoRechazo: string | null;
  creadoEn: string;
  /** No se pudo mandar el código por ningún medio — hay que validar el teléfono a mano (spec-antiabuso §6). */
  sinVerificar: boolean;
  /** Problemático / reportes de cadetes del teléfono, null si no hay nada (spec-antiabuso Fase 1). */
  avisoCliente: ClienteAviso | null;
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
  montoValores: number | null;
  /** Lo pide el cliente — el admin lo puede cambiar al revisar. */
  requiereMoto: boolean;
  retornaAlOrigen: boolean;
  clienteNombre: string;
  clienteTelefono: string;
  detalle: string | null;
  /** Piso, depto y observaciones de cada dirección (mejora 2026-09-24), opcionales. */
  origenPiso: string | null;
  origenDepto: string | null;
  origenObservaciones: string | null;
  destinoPiso: string | null;
  destinoDepto: string | null;
  destinoObservaciones: string | null;
  /** Token de VerificacionTelefonoService.verificarCodigo (mejora 2026-09-17) — confirma que el teléfono es real. */
  verificacionToken: string | null;
  /**
   * De dónde salió el pin (2026-09-25): "manual" o "google_link" se aprenden en la cache de
   * direcciones del backend al confirmar el pedido; el nombre de un buscador o null, no.
   */
  origenFuente: string | null;
  destinoFuente: string | null;
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
