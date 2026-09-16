import { Lookup } from './lookup.model';

export interface CadeteResumen {
  id: string;
  nombre: string;
  apellido: string;
  fotoUrl: string | null;
  tipoVehiculo: Lookup;
}

export interface Pedido {
  id: string;
  numero: number;
  clienteTelefono: string;
  clienteNombre: string;
  origenDireccion: string;
  origenLat: number;
  origenLng: number;
  destinoDireccion: string;
  destinoLat: number;
  destinoLng: number;
  precio: number;
  montoDeclarado: number;
  detalle: string | null;
  zona: Lookup;
  tipoVehiculoRequerido: Lookup;
  estado: Lookup;
  cadeteAsignado: CadeteResumen | null;
  programado: boolean;
  fechaProgramada: string | null;
  creadoEn: string;
  asignadoEn: string | null;
  /** Cuándo el cadete abrió la pantalla del viaje por primera vez estando la oferta PENDIENTE — null si todavía no la abrió. */
  vistoEn: string | null;
  aceptadoEn: string | null;
  retiradoEn: string | null;
  finalizadoEn: string | null;
  canceladoEn: string | null;
  fotoRecepcionUrl: string | null;
  entregaReceptorNombre: string | null;
  entregaFotoUrl: string | null;
  firmaReceptorUrl: string | null;
  retiroLat: number | null;
  retiroLng: number | null;
  entregaLat: number | null;
  entregaLng: number | null;
  motivoCancelacion: string | null;
  tokenSeguimiento: string;
  smsFallido: boolean;
  /** Marca manual del admin para destacarlo en el dashboard (mejora 93). */
  prioritario: boolean;
  calificacionEstrellas: number | null;
  calificacionComentario: string | null;
  /** "No se pudo entregar" (ej. el cliente no atendió) — distinto de motivoCancelacion, el pedido sigue vivo. */
  motivoNoEntrega: string | null;
  noEntregadoEn: string | null;
  /** Paradas intermedias, en orden (repartos con varias entregas en la misma vuelta) — vacío si el pedido es simple. */
  paradas: Parada[];
  /** Auditoría: qué admin asignó/canceló el pedido — null si fue automático o no aplica. */
  asignadoPorUsername: string | null;
  canceladoPorUsername: string | null;
}

export interface Parada {
  id: string;
  orden: number;
  direccion: string;
  lat: number;
  lng: number;
  entregadoEn: string | null;
}

export interface PuntoTrayecto {
  lat: number;
  lng: number;
  capturadoEn: string;
}

export interface Comentario {
  id: string;
  texto: string;
  cadeteNombre: string;
  esAdmin: boolean;
  creadoEn: string;
}

export interface PrecioLog {
  id: string;
  precioAnterior: number;
  precioNuevo: number;
  cambiadoPorUsername: string;
  cambiadoEn: string;
}

/** "Pedidos finalizados" paginado (mejora 2026-09-16) — antes `?tipo=finalizados` traía el historial completo sin paginar. */
export interface PaginaPedidos {
  items: Pedido[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface PedidoInput {
  clienteTelefono: string;
  clienteNombre: string;
  origenDireccion: string;
  origenLat: number;
  origenLng: number;
  destinoDireccion: string;
  destinoLat: number;
  destinoLng: number;
  precio: number;
  montoDeclarado: number | null;
  detalle: string | null;
  zonaId: string;
  tipoVehiculoRequeridoId: string;
  programado: boolean;
  fechaProgramada: string | null;
  /** Paradas intermedias, en orden — null o vacío si el pedido es simple. */
  paradasAdicionales: ParadaInput[] | null;
}

export interface ParadaInput {
  direccion: string;
  lat: number;
  lng: number;
}

/**
 * Tiempo transcurrido desde `desde` (o hasta `hasta`, default `ahora`), tipo "00:14:26".
 * `ahora` se recibe como parámetro (en vez de llamar a Date.now() acá adentro) para que,
 * usado desde un binding de template, el valor sea estable dentro de un mismo ciclo de
 * change detection — si no, la doble pasada de verificación de Angular en modo dev
 * (checkNoChanges) puede ver un valor distinto entre pasada y pasada y tirar NG0100,
 * lo que aborta ese ciclo de CD (y con eso, cualquier otra actualización de vista que
 * dependiera del mismo evento, como abrir un modal al hacer click).
 */
export function tiempoTranscurrido(desde: string, hasta?: string, ahora: number = Date.now()): string {
  const inicio = new Date(desde).getTime();
  const fin = hasta ? new Date(hasta).getTime() : ahora;
  const segundos = Math.max(0, Math.floor((fin - inicio) / 1000));
  const hh = Math.floor(segundos / 3600);
  const mm = Math.floor((segundos % 3600) / 60);
  const ss = segundos % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}
