export interface PagoSemanal {
  id: string;
  semanaInicio: string;
  pagado: boolean;
  registradoEn: string;
  registradoPorUsername: string | null;
}

export interface PagoSemanalInput {
  semanaInicio: string;
  pagado: boolean;
}

/** Cadete sin pago registrado para la última semana ya cerrada. */
export interface PagoPendiente {
  cadeteId: string;
  nombre: string;
  apellido: string;
}
