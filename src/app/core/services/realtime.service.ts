import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { wsUrl } from '../config/site-config';

/**
 * Cliente STOMP único compartido por toda la app (chat, mapa en vivo, etc.) — evita abrir
 * una conexión SockJS por feature. Las suscripciones pedidas antes de conectar quedan en
 * cola y se activan solas apenas conecta (o reconecta).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private client: Client | null = null;
  private conectado = false;
  private activaciones: Array<() => void> = [];

  subscribe(destino: string, onMensaje: (body: unknown) => void): () => void {
    this.asegurarConexion();
    let sub: { unsubscribe(): void } | null = null;
    const activar = () => {
      sub = this.client!.subscribe(destino, (frame: IMessage) => {
        onMensaje(frame.body ? JSON.parse(frame.body) : null);
      });
    };
    if (this.conectado) activar();
    else this.activaciones.push(activar);

    return () => sub?.unsubscribe();
  }

  private asegurarConexion(): void {
    if (this.client) return;
    this.client = new Client({
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
  }
}
