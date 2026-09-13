import { Lookup } from './lookup.model';

export interface GenerarLinkResponse {
  token: string;
  url: string;
}

export interface TokenEstado {
  valido: boolean;
  motivo: string | null;
}

export interface SolicitudCadeteForm {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  tipoVehiculoId: string;
  vehiculoColor: string | null;
  vehiculoPatente: string | null;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  fotoUrl: string | null;
  fotoVehiculoUrl: string | null;
  fotoCarnetUrl: string | null;
  fotoTarjetaVerdeUrl: string | null;
  usernamePropuesto: string;
}

export interface SolicitudCadete {
  id: string;
  token: string;
  estado: 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA';
  creadoEn: string;
  expiraEn: string;
  enviadaEn: string | null;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  tipoVehiculo: Lookup | null;
  vehiculoColor: string | null;
  vehiculoPatente: string | null;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  fotoUrl: string | null;
  fotoVehiculoUrl: string | null;
  fotoCarnetUrl: string | null;
  fotoTarjetaVerdeUrl: string | null;
  usernamePropuesto: string | null;
  motivoRechazo: string | null;
  cadeteCreadoId: string | null;
}
