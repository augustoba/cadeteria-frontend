import { Lookup } from './lookup.model';
import { CadeteMetrica } from './metricas.model';
import { Incidencia } from './incidencia.model';

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
  fotoTarjetaVerdeUrl: string | null;
  username: string;
  activo: boolean;
  estado: Lookup;
  lat: number | null;
  lng: number | null;
  ubicacionActualizadaEn: string | null;
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
  fotoTarjetaVerdeUrl: string | null;
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
