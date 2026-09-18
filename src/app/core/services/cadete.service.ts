import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { AvisoGeneral, Cadete, CadeteEstadoLog, CadeteFicha, CadeteInput, HabilitarPagoSemanalInput, MovimientoCredito } from '../models/cadete.model';
import { CollectionStore } from '../state/collection-store';

@Injectable({ providedIn: 'root' })
export class CadeteService {
  private readonly http = inject(HttpClient);
  private readonly store = new CollectionStore<Cadete>(this.http, '/admin/cadetes');

  readonly cadetes = this.store.items;
  readonly loading = this.store.loading;
  readonly errored = this.store.errored;
  readonly saving = this.store.saving;

  ensureLoaded(): void {
    this.store.ensureLoaded();
  }

  reload(): void {
    this.store.reload();
  }

  get(id: string) {
    return this.http.get<Cadete>(apiUrl(`/admin/cadetes/${id}`));
  }

  /**
   * Panorama completo del cadete: estadísticas del rango [desde, hasta] (yyyy-MM-dd,
   * ambos opcionales — sin ninguno trae todo el historial), incidencias e historial de
   * altas/bajas (estos dos últimos siempre son de todo el historial).
   */
  ficha(id: string, desde?: string, hasta?: string) {
    let params: Record<string, string> = {};
    if (desde) params['desde'] = desde;
    if (hasta) params['hasta'] = hasta;
    return this.http.get<CadeteFicha>(apiUrl(`/admin/cadetes/${id}/ficha`), { params });
  }

  crear(input: CadeteInput, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl('/admin/cadetes'), input), onSuccess);
  }

  actualizar(id: string, input: CadeteInput, onSuccess?: () => void): void {
    this.store.mutate(this.http.put(apiUrl(`/admin/cadetes/${id}`), input), onSuccess);
  }

  /** motivo opcional (ronda 10, punto 96) — queda en el historial de altas/bajas. */
  setActivo(id: string, activo: boolean, motivo: string | null, onSuccess?: () => void): void {
    this.store.mutate(this.http.patch(apiUrl(`/admin/cadetes/${id}/activo`), { activo, motivo }), onSuccess);
  }

  /** Historial de altas/bajas (ronda 10, punto 96). */
  historialEstado(id: string) {
    return this.http.get<CadeteEstadoLog[]>(apiUrl(`/admin/cadetes/${id}/historial-estado`));
  }

  /** Historial de movimientos de crédito de un cadete PORCENTAJE (ronda 10, punto 94). */
  historialCredito(id: string) {
    return this.http.get<MovimientoCredito[]>(apiUrl(`/admin/cadetes/${id}/movimientos-credito`));
  }

  /** Marca al cadete como Libre a mano (todavía no existe la app que lo haga sola). */
  marcarLibre(id: string): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/cadetes/${id}/libre`), {}));
  }

  /** Aviso operativo a todos los cadetes conectados ahora (ej. "cerramos temprano"). */
  avisoGeneral(mensaje: string, onSuccess?: () => void) {
    return this.http.post(apiUrl('/admin/cadetes/aviso'), { mensaje }).subscribe(() => onSuccess?.());
  }

  /** Últimos avisos generales enviados, con cuántos cadetes ya confirmaron haberlos visto. */
  listarAvisos() {
    return this.http.get<AvisoGeneral[]>(apiUrl('/admin/cadetes/avisos'));
  }

  /** Aplica una actualización que llegó por WebSocket (ubicación en vivo) sin pegarle al backend. */
  aplicarActualizacion(c: Cadete): void {
    const actual = this.store.items();
    if (!actual.some((x) => x.id === c.id)) return;
    this.store.setItems(actual.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
  }

  /** Habilita a un cadete SEMANAL para trabajar esta semana, con pago completo o parcial (ronda 7). */
  habilitarPagoSemanal(id: string, input: HabilitarPagoSemanalInput, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/cadetes/${id}/pago-semanal/habilitar`), input), onSuccess);
  }

  /** Carga crédito a un cadete PORCENTAJE tras recibir su transferencia (ronda 7). */
  acreditar(id: string, monto: number, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/cadetes/${id}/credito`), { monto }), onSuccess);
  }

  /** Cambiar el modelo de cobro desde la pantalla "Pagos" unificada. */
  cambiarModalidadPago(id: string, modalidadPago: 'SEMANAL' | 'PORCENTAJE', onSuccess?: () => void): void {
    this.store.mutate(this.http.patch(apiUrl(`/admin/cadetes/${id}/modalidad-pago`), { modalidadPago }), onSuccess);
  }

  /** El admin le reenvía una contraseña temporal nueva — para cuando la original venció sin que entrara (10 min). */
  reenviarPassword(id: string) {
    return this.http.post<{ passwordTemporal: string }>(apiUrl(`/admin/cadetes/${id}/reenviar-password`), {});
  }

  nombreDe(id: string): string {
    const c = this.cadetes().find((x) => x.id === id);
    return c ? `${c.nombre} ${c.apellido}` : 'un cadete';
  }
}
