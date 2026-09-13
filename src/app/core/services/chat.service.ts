import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { ChatMensaje } from '../models/chat.model';
import { RealtimeService } from './realtime.service';

/**
 * Chat interno admin-cadete (diseno-tecnico.md sección 5.5). El broadcast de
 * `/queue/admin/chat` no incluye el cadeteId del mensaje (ver ChatDtos.MensajeResponse
 * en el backend), así que ante cualquier evento recargamos el historial de la
 * conversación abierta en vez de intentar adivinar a quién pertenece.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly realtime = inject(RealtimeService);

  private suscrito = false;
  private cadeteAbiertoId: string | null = null;

  private readonly mensajesSignal = signal<ChatMensaje[]>([]);
  readonly mensajes = this.mensajesSignal.asReadonly();
  private readonly cargandoSignal = signal(false);
  readonly cargando = this.cargandoSignal.asReadonly();
  private readonly enviandoSignal = signal(false);
  readonly enviando = this.enviandoSignal.asReadonly();

  /** Badge de "mensajes sin leer" en la navegación del panel (ronda 4, punto 25). */
  private readonly noLeidosSignal = signal(0);
  readonly noLeidos = this.noLeidosSignal.asReadonly();

  /** Por cadete, no solo el total — para marcar en la lista cuál escribió (auditoría UX 2026-09-13). */
  private readonly noLeidosPorCadeteSignal = signal<Record<string, number>>({});
  readonly noLeidosPorCadete = this.noLeidosPorCadeteSignal.asReadonly();

  /** Llamado una vez al iniciar sesión (shell) para que el badge funcione sin tener que abrir el Chat. */
  iniciar(): void {
    this.cargarNoLeidos();
    this.asegurarConexion();
  }

  abrir(cadeteId: string): void {
    this.cadeteAbiertoId = cadeteId;
    this.mensajesSignal.set([]);
    this.recargar();
    this.http.patch(apiUrl(`/chat/${cadeteId}/leido`), {}).subscribe(() => this.cargarNoLeidos());
    this.asegurarConexion();
  }

  private cargarNoLeidos(): void {
    this.http.get<{ cantidad: number }>(apiUrl('/admin/chat/no-leidos')).subscribe((r) => this.noLeidosSignal.set(r.cantidad));
    this.http
      .get<Record<string, number>>(apiUrl('/admin/chat/no-leidos-por-cadete'))
      .subscribe((r) => this.noLeidosPorCadeteSignal.set(r));
  }

  cerrar(): void {
    this.cadeteAbiertoId = null;
    this.mensajesSignal.set([]);
  }

  enviar(texto: string): void {
    const cadeteId = this.cadeteAbiertoId;
    const limpio = texto.trim();
    if (!cadeteId || !limpio) return;
    this.enviandoSignal.set(true);
    this.http.post<ChatMensaje>(apiUrl(`/chat/${cadeteId}/mensajes`), { texto: limpio }).subscribe({
      next: (m) => {
        this.enviandoSignal.set(false);
        if (this.cadeteAbiertoId === cadeteId) {
          this.mensajesSignal.update((lista) => (lista.some((x) => x.id === m.id) ? lista : [...lista, m]));
        }
      },
      error: () => this.enviandoSignal.set(false),
    });
  }

  /** Mejora 88 — adjuntar foto en el chat interno (ya subida a Cloudinary por CloudinaryUploadService). */
  enviarImagen(imagenUrl: string): void {
    const cadeteId = this.cadeteAbiertoId;
    if (!cadeteId) return;
    this.enviandoSignal.set(true);
    this.http.post<ChatMensaje>(apiUrl(`/chat/${cadeteId}/mensajes`), { imagenUrl }).subscribe({
      next: (m) => {
        this.enviandoSignal.set(false);
        if (this.cadeteAbiertoId === cadeteId) {
          this.mensajesSignal.update((lista) => (lista.some((x) => x.id === m.id) ? lista : [...lista, m]));
        }
      },
      error: () => this.enviandoSignal.set(false),
    });
  }

  private recargar(): void {
    const id = this.cadeteAbiertoId;
    if (!id) return;
    this.cargandoSignal.set(true);
    this.http.get<ChatMensaje[]>(apiUrl(`/chat/${id}`)).subscribe({
      next: (msjs) => {
        this.mensajesSignal.set(msjs);
        this.cargandoSignal.set(false);
      },
      error: () => this.cargandoSignal.set(false),
    });
  }

  private asegurarConexion(): void {
    if (this.suscrito) return;
    this.suscrito = true;
    this.realtime.subscribe('/queue/admin/chat', () => {
      if (this.cadeteAbiertoId) this.recargar();
      this.cargarNoLeidos();
    });
  }
}
