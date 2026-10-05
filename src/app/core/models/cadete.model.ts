import { Lookup } from './lookup.model';
import { CadeteMetrica } from './metricas.model';
import { Incidencia } from './incidencia.model';

/** Dónde vive el cadete (2026-10-05): solo texto. Piso y departamento, solo si corresponde. */
export interface Domicilio {
  calle: string | null;
  altura: string | null;
  piso: string | null;
  depto: string | null;
  localidad: string | null;
}

export function domicilioVacio(): Domicilio {
  return { calle: '', altura: '', piso: '', depto: '', localidad: '' };
}

/** Copia editable de lo que vino del backend (null = todavía no se cargó). */
export function domicilioEditable(d: Domicilio | null | undefined): Domicilio {
  return { calle: d?.calle ?? '', altura: d?.altura ?? '', piso: d?.piso ?? '', depto: d?.depto ?? '', localidad: d?.localidad ?? '' };
}

/** No tiene nada escrito. */
export function domicilioEnBlanco(d: Domicilio): boolean {
  return ![d.calle, d.altura, d.piso, d.depto, d.localidad].some((x) => !!x?.trim());
}

/** Tiene lo obligatorio: calle, altura y localidad. */
export function domicilioCompleto(d: Domicilio): boolean {
  return !!d.calle?.trim() && !!d.altura?.trim() && !!d.localidad?.trim();
}

/** "Lamadrid 450, piso 2, depto B — San Miguel de Tucumán"; '' si no hay domicilio. */
export function domicilioTexto(d: Domicilio | null | undefined): string {
  if (!d?.calle) return '';
  const partes = [(d.calle + ' ' + (d.altura ?? '')).trim(), d.piso ? 'piso ' + d.piso : '', d.depto ? 'depto ' + d.depto : ''];
  return partes.filter((x) => !!x).join(', ') + (d.localidad ? ' — ' + d.localidad : '');
}

export const MSJ_DOMICILIO = 'Falta el domicilio: calle, altura y localidad.';

export interface Cadete {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  fotoUrl: string | null;
  tipoVehiculo: Lookup;
  vehiculoColor: string | null;
  vehiculoPatente: string | null;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  vehiculoAnio: number | null;
  fotoVehiculoUrl: string | null;
  fotoCarnetUrl: string | null;
  fotoCarnetDorsoUrl: string | null;
  fotoTarjetaVerdeUrl: string | null;
  fotoTarjetaVerdeDorsoUrl: string | null;
  username: string;
  activo: boolean;
  estado: Lookup;
  lat: number | null;
  lng: number | null;
  ubicacionActualizadaEn: string | null;
  /** Última calle que resolvió el teléfono del cadete ("Colombia 4695, San Miguel de Tucumán"), y cuándo — null si nunca mandó. */
  calleTelefono?: string | null;
  calleTelefonoEn?: string | null;
  zonaActual: Lookup | null;
  montoMaximoTransportado: number | null;
  maxViajesSimultaneos: number | null;
  maxViajesDiarios: number | null;
  maxViajesSemanales: number | null;
  ordenColaEspera: string;
  /** Datos de cobro por transferencia — los carga el propio cadete desde la app. */
  cbu: string | null;
  aliasCbu: string | null;
  /** "HH:mm:ss" — ambos null = sin turno fijo (disponible siempre para la sugerencia automática). */
  turnoInicio: string | null;
  turnoFin: string | null;
  /** Calificación histórica (todo el registro) — null si todavía no lo calificó nadie. */
  calificacionPromedio: number | null;
  calificacionCantidad: number;
  /** Modelo de cobro del cadete: "SEMANAL" o "PORCENTAJE". */
  modalidadPago: 'SEMANAL' | 'PORCENTAJE';
  /** Solo aplica con modalidadPago="SEMANAL". */
  habilitadoPago: boolean;
  pagoSemanalMontoPagado: number | null;
  pagoSemanalVenceEn: string | null;
  /** Precio de la cuota semanal de este cadete — null si nunca se cargó (se usa el monto global de Configuración). */
  montoSemanalActual: number | null;
  /** Solo aplica con modalidadPago="PORCENTAJE". */
  creditoDisponible: number;
  /** Notas libres del admin sobre este cadete (ronda 10, punto 103). */
  notasInternas: string | null;
  /** Última versión de APK con la que se logueó — null si nunca lo reportó (mejora 2026-09-17). */
  ultimaVersionApp: number | null;
  ultimaVersionAppEn: string | null;
  /** Constancia de mayor de edad: cuándo y quién ("postulante" o el admin que lo cargó). null en los viejos. */
  mayorEdadDeclaradaEn?: string | null;
  mayorEdadDeclaradaPor?: string | null;
  /** null = todavía no se cargó (cadetes anteriores al 2026-10-05). */
  domicilio?: Domicilio | null;
}

export interface CadeteEstadoLog {
  id: string;
  activo: boolean;
  motivo: string | null;
  cambiadoEn: string;
  cambiadoPorUsername: string | null;
}

export interface MovimientoCredito {
  id: string;
  tipo: 'ACREDITACION' | 'COMISION' | 'REEMBOLSO';
  monto: number;
  saldoResultante: number;
  pedidoNumero: number | null;
  creadoEn: string;
  creadoPorUsername: string | null;
}

export interface AvisoGeneral {
  id: string;
  mensaje: string;
  enviadoEn: string;
  totalDestinatarios: number;
  totalLeido: number;
}

export interface CadeteInput {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  fotoUrl: string | null;
  tipoVehiculoId: string;
  vehiculoColor: string | null;
  vehiculoPatente: string | null;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  vehiculoAnio: number | null;
  fotoVehiculoUrl: string | null;
  fotoCarnetUrl: string | null;
  fotoCarnetDorsoUrl: string | null;
  fotoTarjetaVerdeUrl: string | null;
  fotoTarjetaVerdeDorsoUrl: string | null;
  username: string;
  password: string | null;
  montoMaximoTransportado: number | null;
  maxViajesSimultaneos: number | null;
  maxViajesDiarios: number | null;
  maxViajesSemanales: number | null;
  /** "HH:mm" — ambos null = sin turno fijo. */
  turnoInicio: string | null;
  turnoFin: string | null;
  modalidadPago: 'SEMANAL' | 'PORCENTAJE';
  notasInternas: string | null;
  /** El admin confirma que verificó que es mayor de 18 — obligatorio al crear (2026-09-26). */
  mayorDeEdad?: boolean;
  /** Obligatorio al crear; al editar, en blanco = no se toca. */
  domicilio?: Domicilio | null;
}

/** Panorama completo de un cadete (estadísticas de todo su historial, no de un rango). */
export interface CadeteFicha {
  cadete: Cadete;
  estadisticas: CadeteMetrica;
  incidencias: Incidencia[];
  historialEstado: CadeteEstadoLog[];
}

export interface HabilitarPagoSemanalInput {
  montoPagado: number;
  /** ISO — requerido si montoPagado es menor a la cuota configurada. */
  venceEn: string | null;
  /** Si viene, se guarda como el nuevo precio de la cuota semanal de este cadete (pantalla "Pagos"). */
  montoSemanal?: number | null;
}
