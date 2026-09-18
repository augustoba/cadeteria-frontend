import { Lookup } from './lookup.model';

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
  retornaAlOrigen: boolean;
  clienteNombre: string;
  clienteTelefono: string;
  detalle: string | null;
  estado: EstadoSolicitudPedido;
  zona: Lookup | null;
  tipoVehiculoRequerido: Lookup | null;
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
  retornaAlOrigen: boolean;
  clienteNombre: string;
  clienteTelefono: string;
  detalle: string | null;
  /** Token de VerificacionTelefonoService.verificarCodigo (mejora 2026-09-17) — confirma que el teléfono es real. */
  verificacionToken: string;
}

export interface RevisarSolicitudInput {
  zonaId: string;
  tipoVehiculoRequeridoId: string;
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
