import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { apiUrl } from '../config/site-config';
import { Comentario, PaginaPedidos, Pedido, PedidoInput, PrecioLog, PuntoTrayecto } from '../models/pedido.model';
import { Cadete } from '../models/cadete.model';
import { CollectionStore } from '../state/collection-store';

/** "finalizados" ya no pasa por acá — tiene su propio endpoint paginado, ver `finalizadosPagina()`. */
export type TipoListaPedidos = 'activos' | 'programados';

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly store = new CollectionStore<Pedido>(this.http, '/admin/pedidos');

  readonly pedidos = this.store.items;
  readonly loading = this.store.loading;
  readonly errored = this.store.errored;
  readonly saving = this.store.saving;

  crear(input: PedidoInput, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl('/admin/pedidos'), input), onSuccess);
  }

  cargar(tipo: TipoListaPedidos): void {
    this.store.setQuery({ tipo });
  }

  /**
   * "Pedidos finalizados" paginado en la base (mejora 2026-09-16) — antes se traía TODO
   * el historial finalizado/cancelado de la cadetería de una y se recortaba de a 15 en el
   * navegador; con volumen real (100+ viajes/día) eso iba a envejecer mal. `desde`/`hasta`
   * en ISO-8601 — sin ninguno de los dos, el backend no acota por fecha (rango "Todo").
   */
  finalizadosPagina(opciones: {
    desde?: string | null;
    hasta?: string | null;
    cadeteId?: string | null;
    tipoEstado?: string | null;
    pagina: number;
    tamano: number;
  }) {
    let params = new HttpParams().set('pagina', opciones.pagina).set('tamano', opciones.tamano);
    if (opciones.desde) params = params.set('desde', opciones.desde);
    if (opciones.hasta) params = params.set('hasta', opciones.hasta);
    if (opciones.cadeteId) params = params.set('cadeteId', opciones.cadeteId);
    if (opciones.tipoEstado) params = params.set('tipoEstado', opciones.tipoEstado);
    return this.http.get<PaginaPedidos>(apiUrl('/admin/pedidos/finalizados-pagina'), { params });
  }

  reload(): void {
    this.store.reload();
  }

  quitar(id: string): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/pedidos/${id}/quitar`), {}));
  }

  /** motivo: 'CLIENTE' | 'OTRO' | null — solo para métricas, no cambia el flujo. */
  cancelar(id: string, motivo: string | null, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/pedidos/${id}/cancelar`), { motivo }), onSuccess);
  }

  /** Detalle completo de un pedido (timeline incluido) — para el modal de detalle. */
  detalle(id: string) {
    return this.http.get<Pedido>(apiUrl(`/admin/pedidos/${id}`));
  }

  /** Trayecto GPS real guardado mientras el pedido estaba EN_CURSO — para "ver el recorrido" en el mapa. */
  trayecto(id: string) {
    return this.http.get<PuntoTrayecto[]>(apiUrl(`/admin/pedidos/${id}/trayecto`));
  }

  /** Comentarios que fue dejando el cadete sobre el pedido — para la pestaña "Comentarios" del detalle. */
  comentarios(id: string) {
    return this.http.get<Comentario[]>(apiUrl(`/admin/pedidos/${id}/comentarios`));
  }

  /** Mejora 101 — el admin también puede dejar comentarios propios, no solo leer los del cadete. */
  agregarComentario(id: string, texto: string) {
    return this.http.post<Comentario>(apiUrl(`/admin/pedidos/${id}/comentarios`), { texto });
  }

  /** Mejora 75 — editar el precio de un pedido ya cargado. */
  editarPrecio(id: string, precio: number) {
    return this.http.put<Pedido>(apiUrl(`/admin/pedidos/${id}/precio`), { precio });
  }

  historialPrecios(id: string) {
    return this.http.get<PrecioLog[]>(apiUrl(`/admin/pedidos/${id}/precio-historial`));
  }

  /** Mejora 93 — marcar/desmarcar un pedido como prioritario/urgente. */
  setPrioritario(id: string, prioritario: boolean, onSuccess?: (p: Pedido) => void): void {
    this.http.put<Pedido>(apiUrl(`/admin/pedidos/${id}/prioritario`), { prioritario }).subscribe((p) => {
      this.store.reload();
      onSuccess?.(p);
    });
  }

  /** Autocompletar nombre por teléfono al cargar un pedido (spec 5.6) — null si nunca se vio ese número. */
  buscarCliente(telefono: string) {
    return this.http
      .get<{ nombre: string }>(apiUrl('/admin/pedidos/cliente'), { params: { telefono }, observe: 'response' })
      .pipe(
        map((res) => (res.status === 204 ? null : res.body?.nombre ?? null)),
        catchError(() => of(null)),
      );
  }

  /** Cierre manual: para cuando el cadete no puede finalizar el viaje el mismo (sin internet). */
  finalizar(id: string, req: { receptorNombre: string | null; fotoUrl: string | null }): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/pedidos/${id}/finalizar`), req));
  }

  /** Vuelve a SIN_ASIGNAR un pedido "No se pudo entregar", sin anularlo ni cargarlo de cero. */
  reintentarEntrega(id: string, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/pedidos/${id}/reintentar-entrega`), {}), onSuccess);
  }

  asignar(id: string, cadeteId: string, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/pedidos/${id}/asignar`), { cadeteId }), onSuccess);
  }

  /** Agrupar pedidos de la misma zona en una sola oferta a un cadete (ronda 4, punto 61). */
  asignarLote(pedidoIds: string[], cadeteId: string, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl('/admin/pedidos/asignar-lote'), { cadeteId, pedidoIds }), onSuccess);
  }

  /** Reasignar a otro cadete con un clic (ronda 4, punto 40) — sin pasar por "Quitar" primero. */
  reasignar(id: string, cadeteId: string, onSuccess?: () => void): void {
    this.store.mutate(this.http.post(apiUrl(`/admin/pedidos/${id}/reasignar`), { cadeteId }), onSuccess);
  }

  /** Candidato sugerido por el sistema (zona + vehículo + FIFO) — el admin confirma o elige otro. */
  sugerencia(id: string) {
    return this.http.get<Cadete>(apiUrl(`/admin/pedidos/${id}/sugerencia`), { observe: 'response' }).pipe(
      map((res) => (res.status === 204 ? null : res.body)),
      catchError(() => of(null)),
    );
  }

  /** Solo los cadetes que hoy pasarían los chequeos de "Asignar" — para no ofrecer opciones que van a fallar seguro. */
  candidatosValidos(id: string) {
    return this.http.get<Cadete[]>(apiUrl(`/admin/pedidos/${id}/candidatos-validos`));
  }

  /** Para el ícono de alertas centralizado del panel (ronda 4, punto 18). */
  smsFallidos() {
    return this.http.get<{ cantidad: number }>(apiUrl('/admin/pedidos/alertas/sms-fallidos'));
  }

  /** Reenvía a mano el SMS con el link de seguimiento (ronda 3, punto 21). */
  reenviarSms(id: string, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/pedidos/${id}/reenviar-sms`), {}).subscribe(() => onSuccess?.());
  }

  imprimir(id: string): void {
    this.http.get(apiUrl(`/admin/pedidos/${id}/comprobante`), { responseType: 'blob' }).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  /** Mejora 71 — compartir el comprobante PDF por WhatsApp con el share sheet nativo (si el navegador lo soporta). */
  comprobante(id: string) {
    return this.http.get(apiUrl(`/admin/pedidos/${id}/comprobante`), { responseType: 'blob' });
  }
}
