export interface CadeteActualizacionCampo {
  id: string;
  campo: string;
  valorAnterior: string | null;
  valorPropuesto: string;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  motivoRechazo: string | null;
  resueltoEn: string | null;
  resueltoPorUsername: string | null;
}

export interface CampoPendienteAdmin {
  actualizacionId: string;
  campo: CadeteActualizacionCampo;
  cadeteId: string;
  cadeteNombre: string;
  cadeteApellido: string;
  cadeteFotoUrl: string | null;
}
