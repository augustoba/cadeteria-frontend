import { Injectable } from '@angular/core';
import type { Client, IMessage } from '@stomp/stompjs';
import { wsUrl } from '../config/site-config';

/**
 * Cliente STOMP único compartido por toda la app (chat, mapa en vivo, etc.) — evita abrir
 * una conexión SockJS por feature. Las suscripciones pedidas antes de conectar quedan en
 * cola y se activan solas apenas conecta (o reconecta).
 *
 * STOMP y SockJS se cargan recién la primera vez que alguien se suscribe (2026-09-29): son ~73 kB
 * que antes iban en el bundle inicial (el login no los necesita) y lo pasaban del presupuesto de 500 kB.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private client: Client | null = null;
  private iniciando = false;
  private conectado = false;
  private activaciones: Array<() => void> = [];

  subscribe(destino: string, onMensaje: (body: unknown) => void): () => void {
    this.asegurarConexion();
    let sub: { unsubscribe(): void } | null = null;
    let cancelada = false;
    const activar = () => {
      if (cancelada) return;
      sub = this.client!.subscribe(destino, (frame: IMessage) => {
        onMensaje(frame.body ? JSON.parse(frame.body) : null);
      });
    };
    if (this.conectado) activar();
    else this.activaciones.push(activar);

    return () => {
      cancelada = true;
      sub?.unsubscribe();
    };
  }

  private asegurarConexion(): void {
    if (this.client || this.iniciando) return;
    this.iniciando = true;
    Promise.all([import('@stomp/stompjs'), import('sockjs-client')]).then(([stomp, sockjs]) => {
      const SockJS = sockjs.default;
      this.client = new stomp.Client({
        webSocketFactory: () => new SockJS(wsUrl()) as unknown as WebSocket,
        reconnectDelay: 3000,
        onConnect: () => {
          this.conectado = true;
          this.activaciones.forEach((fn) => fn());
          this.activaciones = [];
        },
        onDisconnect: () => {
          this.conectado = false;
        },
      });
      this.client.activate();
    });
  }
}
