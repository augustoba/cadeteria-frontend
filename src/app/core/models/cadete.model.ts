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

/** Fecha de nacimiento como se carga en el formulario: día, mes y año por separado (2026-10-05). */
export interface FechaPartes {
  dia: string;
  mes: string;
  anio: string;
}

export function fechaPartesVacia(): FechaPartes {
  return { dia: '', mes: '', anio: '' };
}

/** De "1995-05-17" (como viene del backend) a los tres campos; vacía si no hay fecha. */
export function fechaPartesDe(iso: string | null | undefined): FechaPartes {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? { dia: String(+m[3]), mes: String(+m[2]), anio: m[1] } : fechaPartesVacia();
}

export function fechaPartesEnBlanco(f: FechaPartes): boolean {
  return !String(f.dia ?? '').trim() && !String(f.mes ?? '').trim() && !String(f.anio ?? '').trim();
}

/** "1995-05-17" para mandar al backend; null si falta algo o la fecha no existe (31 de febrero). */
export function fechaIso(f: FechaPartes): string | null {
  const dia = Number(String(f.dia ?? '').trim());
  const mes = Number(String(f.mes ?? '').trim());
  const anio = Number(String(f.anio ?? '').trim());
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(anio) || anio < 1900 || mes < 1 || mes > 12 || dia < 1) return null;
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;
  return String(anio).padStart(4, '0') + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}

/** Años cumplidos hoy; null si no hay fecha. */
export function edadDe(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - +m[1];
  if (hoy.getMonth() + 1 < +m[2] || (hoy.getMonth() + 1 === +m[2] && hoy.getDate() < +m[3])) edad--;
  return edad;
}

/** "17/05/1995 (31 años)"; '' si no hay fecha. */
export function fechaNacimientoTexto(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] + ' (' + edadDe(iso) + ' años)' : '';
}

/**
 * Qué le falta a la fecha de nacimiento cargada; null si está bien. Mismas reglas que el backend
 * (Edad.java): que exista, que no sea futura ni de hace más de 100 años, y 18 años cumplidos.
 */
export function problemaFechaNacimiento(f: FechaPartes): string | null {
  if (fechaPartesEnBlanco(f)) return 'Falta la fecha de nacimiento.';
  const iso = fechaIso(f);
  const edad = edadDe(iso);
  if (iso == null || edad == null || edad < 0 || edad > 100) return 'La fecha de nacimiento no es válida: revisá el día, el mes y el año (4 cifras).';
  return edad < 18 ? 'Con esa fecha de nacimiento tiene menos de 18 años: no se puede dar de alta a un menor.' : null;
}

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
  /** "1995-05-17"; null = todavía no se cargó (cadetes anteriores al 2026-10-05). */
  fechaNacimiento?: string | null;
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
  /** "1995-05-17". Obligatoria al crear; al editar, null = no se toca. */
  fechaNacimiento?: string | null;
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
