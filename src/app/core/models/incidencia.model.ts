export type PrioridadIncidencia = 'BAJA' | 'NORMAL' | 'GRAVE';

export interface Incidencia {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: 'ABIERTA' | 'CERRADA';
  prioridad: PrioridadIncidencia;
  creadaEn: string;
  creadaPorUsername: string | null;
  cerradaEn: string | null;
  cerradaPorUsername: string | null;
  /** Si se creó desde el detalle de un pedido puntual — null si es una incidencia general. */
  pedidoId: string | null;
  pedidoNumero: number | null;
  /** Si es sobre un cadete puntual (ronda 10, punto 108) — GRAVE + ABIERTA bloquea la asignación automática. */
  cadeteId: string | null;
  cadeteNombre: string | null;
}

export interface IncidenciaInput {
  titulo: string;
  descripcion: string | null;
  pedidoId?: string | null;
  cadeteId?: string | null;
  prioridad?: PrioridadIncidencia;
}
