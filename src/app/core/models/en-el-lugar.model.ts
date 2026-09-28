/** Registros de "Retirado / Entregado solo en el lugar" (2026-09-28) — espejo de EnElLugarDtos del backend. */

export type TipoRegistroEnLugar =
  | 'RETIRO_FUERA_ZONA'
  | 'PARADA_FUERA_ZONA'
  | 'ENTREGA_FUERA_ZONA'
  | 'UBICACION_SIMULADA'
  | 'UBICACION_IMPRECISA'
  | 'FINALIZADO_POR_ADMIN';

export const TEXTO_REGISTRO_EN_LUGAR: Record<TipoRegistroEnLugar, string> = {
  RETIRO_FUERA_ZONA: 'Retiro fuera de zona',
  PARADA_FUERA_ZONA: 'Parada fuera de zona',
  ENTREGA_FUERA_ZONA: 'Entrega fuera de zona',
  UBICACION_SIMULADA: 'GPS falso',
  UBICACION_IMPRECISA: 'GPS impreciso',
  FINALIZADO_POR_ADMIN: 'Finalizado por el admin',
};

export interface RegistroPedidoEnLugar {
  pedidoId: string;
  numero: number;
  creadoEn: string;
  cadeteId: string | null;
  cadeteNombre: string | null;
  tipos: TipoRegistroEnLugar[];
  retiroDistanciaM: number | null;
  entregaDistanciaM: number | null;
  finalizadoPorAdmin: string | null;
  finalizadoAdminMotivo: string | null;
}

export interface ResumenCadeteEnLugar {
  cadeteId: string;
  cadeteNombre: string;
  /** Veces que usó "Estoy en el lugar" lejos del punto (cada retiro, parada o entrega cuenta una). */
  vecesFueraZona: number;
  vecesImprecisa: number;
  vecesFinalizadoPorAdmin: number;
  /** De siempre (no depende del rango): los intentos con GPS falso se cuentan en el cadete. */
  intentosUbicacionSimulada: number;
  ultimoIntentoUbicacionSimuladaEn: string | null;
}

export interface FichaCadeteEnLugar {
  resumen: ResumenCadeteEnLugar;
  ultimos: RegistroPedidoEnLugar[];
}
