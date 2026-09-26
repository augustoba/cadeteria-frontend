import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { Seguimiento } from '../models/seguimiento.model';

/** Página pública de seguimiento (sin login) — el token del pedido hace de "contraseña". */
@Injectable({ providedIn: 'root' })
export class SeguimientoService {
  private readonly http = inject(HttpClient);

  obtener(token: string) {
    return this.http.get<Seguimiento>(apiUrl(`/publico/pedidos/${token}`));
  }

  comprobante(token: string) {
    return this.http.get(apiUrl(`/publico/pedidos/${token}/comprobante`), { responseType: 'blob' });
  }

  calificar(token: string, estrellas: number, comentario: string | null) {
    return this.http.post<Seguimiento>(apiUrl(`/publico/pedidos/${token}/calificacion`), { estrellas, comentario });
  }

  /** Mejora 119 — nombre de la cadetería configurable, mostrado en el header de esta misma página. */
  marca() {
    return this.http.get<{ nombreCadeteria: string }>(apiUrl('/publico/configuracion/marca'));
  }

  /** Mejora 87 — repetir el pedido sin llamar; devuelve el token del pedido nuevo. */
  repetir(token: string) {
    return this.http.post<{ nuevoToken: string }>(apiUrl(`/publico/pedidos/${token}/repetir`), {});
  }

  /** Mejora 89 — Web Push, complemento del SMS. */
  vapidPublicKey() {
    return this.http.get<{ habilitado: boolean; publicKey: string | null }>(apiUrl('/publico/configuracion/vapid-public-key'));
  }

  pushSubscribe(token: string, sub: { endpoint: string; p256dh: string; auth: string }) {
    return this.http.post(apiUrl(`/publico/pedidos/${token}/push-subscribe`), sub);
  }

  /** Reclamo del cliente (2026-09-25): el backend decide el tipo según el estado y avisa al cadete. */
  reclamo(token: string, texto: string | null = null) {
    return this.http.post<{ avisado: boolean; mensaje: string }>(apiUrl(`/publico/pedidos/${token}/reclamo`), { texto });
  }

  /** El problema con la entrega ya se solucionó: se cierra el reclamo. */
  reclamoSolucionado(token: string) {
    return this.http.post(apiUrl(`/publico/pedidos/${token}/reclamo/solucionado`), {});
  }

  /** Sigue el problema: queda esperando contacto; devuelve el WhatsApp de atención. */
  reclamoSigue(token: string) {
    return this.http.post<{ whatsappAtencion: string }>(apiUrl(`/publico/pedidos/${token}/reclamo/sigue`), {});
  }
}
