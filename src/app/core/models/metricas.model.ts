import { Lookup } from './lookup.model';

export interface ResumenDia {
  totalPedidos: number;
  finalizados: number;
  cancelados: number;
  canceladosCliente: number;
  canceladosOtro: number;
  sinAsignar: number;
  pendientes: number;
  enCurso: number;
}

export interface CadeteMetrica {
  cadeteId: string;
  nombre: string;
  apellido: string;
  tipoVehiculo: Lookup;
  horasOnline: number;
  viajesAceptados: number;
  viajesRechazados: number;
  viajesNoAceptados: number;
  viajesFinalizados: number;
  montoTransportadoTotal: number;
  montoCobradoTotal: number;
  kmTotal: number;
  promedioViajesPorHora: number;
  promedioPrecioPorHora: number;
  promedioCalificacion: number | null;
  cantidadCalificaciones: number;
}

export interface Rechazo {
  pedidoNumero: number;
  cadeteNombre: string;
  motivo: string | null;
  ofrecidoEn: string;
}

/** Pedidos creados por hora del día (0-23, hora local) — para el gráfico de Métricas. */
export interface PorHora {
  hora: number;
  cantidad: number;
}

/** Una fila por zona: volumen e ingresos en el rango. */
export interface ZonaMetrica {
  zonaId: string;
  zonaNombre: string;
  cantidadPedidos: number;
  finalizados: number;
  montoCobradoTotal: number;
}
