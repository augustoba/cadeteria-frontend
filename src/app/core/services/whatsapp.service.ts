import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import {
  WhatsappChip,
  WhatsappEstadoGateway,
  WhatsappFiltro,
  WhatsappMensajesPagina,
  WhatsappRespuestasPagina,
} from '../models/whatsapp.model';
import { RealtimeService } from './realtime.service';

const TAMANO_PAGINA = 25;
const FILTRO_VACIO: WhatsappFiltro = { telefono: '', desde: '', hasta: '', pagina: 0 };

/** yyyy-MM-dd de hoy en el huso horario del navegador (no UTC, para que coincida con lo que ve el usuario). */
export function hoyLocalISO(): string {
  const d = new Date();
  const sinHuso = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return sinHuso.toISOString().slice(0, 10);
}

/**
 * Panel del gateway propio de WhatsApp (Baileys + chips descartables, ver memoria del
 * proyecto). Mensajes y respuestas están paginados y filtrables por teléfono/fecha
 * (mejora: con 200+ mensajes/día "todos juntos" no escala) — Chips no, porque son pocos
 * físicamente. Cualquier evento por /topic/whatsapp/panel recarga la pestaña Chips
 * siempre, y la pestaña de mensajes/respuestas solo si hay una búsqueda activa cargada
 * (mismo patrón de "recargar en vez de mergear" que ChatService).
 */
@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private readonly http = inject(HttpClient);
  private readonly realtime = inject(RealtimeService);

  private suscrito = false;

  private readonly estadoGatewaySignal = signal<WhatsappEstadoGateway | null>(null);
  readonly estadoGateway = this.estadoGatewaySignal.asReadonly();
  private readonly chipsSignal = signal<WhatsappChip[]>([]);
  readonly chips = this.chipsSignal.asReadonly();
  private readonly cargandoChipsSignal = signal(false);
  readonly cargandoChips = this.cargandoChipsSignal.asReadonly();

  private readonly filtroMensajesSignal = signal<WhatsappFiltro>({ ...FILTRO_VACIO });
  readonly filtroMensajes = this.filtroMensajesSignal.asReadonly();
  private readonly mensajesSignal = signal<WhatsappMensajesPagina>({ items: [], total: 0, pagina: 0, totalPaginas: 1 });
  readonly mensajesPagina = this.mensajesSignal.asReadonly();
  private readonly cargandoMensajesSignal = signal(false);
  readonly cargandoMensajes = this.cargandoMensajesSignal.asReadonly();

  private readonly filtroRespuestasSignal = signal<WhatsappFiltro>({ ...FILTRO_VACIO });
  readonly filtroRespuestas = this.filtroRespuestasSignal.asReadonly();
  private readonly respuestasSignal = signal<WhatsappRespuestasPagina>({ items: [], total: 0, pagina: 0, totalPaginas: 1 });
  readonly respuestasPagina = this.respuestasSignal.asReadonly();
  private readonly cargandoRespuestasSignal = signal(false);
  readonly cargandoRespuestas = this.cargandoRespuestasSignal.asReadonly();

  readonly tamanoPagina = TAMANO_PAGINA;

  /** Arranca filtrado al día de hoy — con 200+ mensajes/día, traer "todo" por default no tiene sentido. */
  iniciar(): void {
    const hoy = hoyLocalISO();
    this.cargarEstadoYChips();
    this.buscarMensajes({ telefono: '', desde: hoy, hasta: hoy });
    this.buscarRespuestas({ telefono: '', desde: hoy, hasta: hoy });
    this.asegurarConexion();
  }

  cargarEstadoYChips(): void {
    this.http.get<WhatsappEstadoGateway>(apiUrl('/admin/whatsapp/estado')).subscribe((r) => this.estadoGatewaySignal.set(r));
    this.cargandoChipsSignal.set(true);
    this.http.get<WhatsappChip[]>(apiUrl('/admin/whatsapp/chips')).subscribe({
      next: (r) => {
        this.chipsSignal.set(r);
        this.cargandoChipsSignal.set(false);
      },
      error: () => this.cargandoChipsSignal.set(false),
    });
  }

  buscarMensajes(filtro: Partial<WhatsappFiltro> = {}): void {
    const actual = { ...this.filtroMensajesSignal(), ...filtro };
    if (filtro.telefono !== undefined || filtro.desde !== undefined || filtro.hasta !== undefined) actual.pagina = 0;
    this.filtroMensajesSignal.set(actual);
    this.cargandoMensajesSignal.set(true);
    this.http.get<WhatsappMensajesPagina>(apiUrl('/admin/whatsapp/mensajes'), { params: this.armarParams(actual) }).subscribe({
      next: (r) => {
        this.mensajesSignal.set(r);
        this.cargandoMensajesSignal.set(false);
      },
      error: () => this.cargandoMensajesSignal.set(false),
    });
  }

  buscarRespuestas(filtro: Partial<WhatsappFiltro> = {}): void {
    const actual = { ...this.filtroRespuestasSignal(), ...filtro };
    if (filtro.telefono !== undefined || filtro.desde !== undefined || filtro.hasta !== undefined) actual.pagina = 0;
    this.filtroRespuestasSignal.set(actual);
    this.cargandoRespuestasSignal.set(true);
    this.http.get<WhatsappRespuestasPagina>(apiUrl('/admin/whatsapp/respuestas'), { params: this.armarParams(actual) }).subscribe({
      next: (r) => {
        this.respuestasSignal.set(r);
        this.cargandoRespuestasSignal.set(false);
      },
      error: () => this.cargandoRespuestasSignal.set(false),
    });
  }

  /** Da de alta el chip y pide el pairing code — el código en sí llega después por el evento de panel (el gateway tarda en pedirlo). */
  vincularChip(chipId: string, numero: string) {
    return this.http.post<WhatsappChip>(apiUrl('/admin/whatsapp/chips'), { chipId, numero });
  }

  darDeBajaChip(chipId: string) {
    return this.http.delete<void>(apiUrl(`/admin/whatsapp/chips/${chipId}`));
  }

  /** Borra el registro para siempre — solo funciona si el chip ya está BAJA. */
  eliminarChip(chipId: string) {
    return this.http.delete<void>(apiUrl(`/admin/whatsapp/chips/${chipId}/registro`));
  }

  mandarPrueba(telefono: string, mensaje: string) {
    return this.http.post<void>(apiUrl('/admin/whatsapp/test'), { telefono, mensaje });
  }

  /** yyyy-MM-dd (input type=date) -> instante ISO en el huso horario del navegador, cubriendo el día completo. */
  private armarParams(f: WhatsappFiltro): HttpParams {
    let params = new HttpParams().set('pagina', f.pagina).set('tamano', TAMANO_PAGINA);
    if (f.telefono.trim()) params = params.set('telefono', f.telefono.trim());
    if (f.desde) params = params.set('desde', new Date(`${f.desde}T00:00:00`).toISOString());
    if (f.hasta) params = params.set('hasta', new Date(`${f.hasta}T23:59:59.999`).toISOString());
    return params;
  }

  private asegurarConexion(): void {
    if (this.suscrito) return;
    this.suscrito = true;
    this.realtime.subscribe('/topic/whatsapp/panel', (body) => {
      const evento = (body as { evento?: string })?.evento;
      if (evento === 'CHIP' || !evento) this.cargarEstadoYChips();
      if (evento === 'MENSAJE' || !evento) this.buscarMensajes();
      if (evento === 'RESPUESTA' || !evento) this.buscarRespuestas();
    });
  }
}
