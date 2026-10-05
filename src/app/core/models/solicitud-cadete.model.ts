import { Domicilio } from './cadete.model';
import { Lookup } from './lookup.model';

export interface GenerarLinkResponse {
  token: string;
  url: string;
}

export interface TokenEstado {
  valido: boolean;
  motivo: string | null;
  /** Si el admin pidió corregir: lo ya cargado (las fotos marcadas vienen en null) y qué corregir. */
  correccion: CorreccionSolicitud | null;
}

/** Un dato o foto que el admin marcó mal (campo = clave, ej. "fotoCarnetUrl"). */
export interface ObservacionSolicitud {
  campo: string;
  etiqueta: string;
  motivo: string;
}

export interface CorreccionSolicitud {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  tipoVehiculoId: string | null;
  vehiculoColor: string | null;
  vehiculoPatente: string | null;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  fotoUrl: string | null;
  fotoVehiculoUrl: string | null;
  fotoCarnetUrl: string | null;
  fotoCarnetDorsoUrl: string | null;
  fotoTarjetaVerdeUrl: string | null;
  fotoTarjetaVerdeDorsoUrl: string | null;
  observaciones: ObservacionSolicitud[];
  /** Lo que ya había cargado (null en las solicitudes anteriores al 2026-10-05). */
  domicilio?: Domicilio | null;
  fechaNacimiento?: string | null;
}

/** Ya hay (o hubo) un cadete con ese DNI — con su última baja para saber por qué se fue. */
export interface CadeteExistente {
  id: string;
  nombre: string;
  apellido: string;
  username: string;
  activo: boolean;
  motivoUltimaBaja: string | null;
  fechaUltimaBaja: string | null;
}

export interface ReenviarLinkResponse {
  url: string;
  expiraEn: string;
  mailEnviado: boolean;
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
  fotoCarnetDorsoUrl: string | null;
  fotoTarjetaVerdeUrl: string | null;
  fotoTarjetaVerdeDorsoUrl: string | null;
  /** Tildó "Soy mayor de 18 años" (2026-09-26) — el backend no acepta el formulario sin esto. */
  mayorDeEdad: boolean;
  /** Dónde vive (2026-10-05): calle, altura y localidad obligatorias. */
  domicilio: Domicilio;
  /** "1995-05-17" (2026-10-05): obligatoria y de alguien con 18 años cumplidos. */
  fechaNacimiento: string;
}

export interface SolicitudCadete {
  id: string;
  token: string;
  estado: 'PENDIENTE' | 'EN_REVISION' | 'A_CORREGIR' | 'APROBADA' | 'RECHAZADA';
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
  fotoCarnetDorsoUrl: string | null;
  fotoTarjetaVerdeUrl: string | null;
  fotoTarjetaVerdeDorsoUrl: string | null;
  usernamePropuesto: string | null;
  motivoRechazo: string | null;
  cadeteCreadoId: string | null;
  /** Lo que se le pidió corregir (estado A_CORREGIR). */
  observaciones: ObservacionSolicitud[];
  correcciones: number;
  /** null = ese DNI nunca estuvo registrado. */
  cadeteExistente: CadeteExistente | null;
  /** Cuándo declaró ser mayor de 18 (null en solicitudes anteriores a la casilla). */
  mayorEdadDeclaradaEn: string | null;
  /** null en las solicitudes anteriores al 2026-10-05. */
  domicilio?: Domicilio | null;
  fechaNacimiento?: string | null;
}
