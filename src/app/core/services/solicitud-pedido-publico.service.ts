import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { ConfirmacionPublica, SolicitudPedidoInput } from '../models/solicitud-pedido.model';

/** Página pública "/pedir" y "/confirmar-pedido/:token" — sin login. */
@Injectable({ providedIn: 'root' })
export class SolicitudPedidoPublicoService {
  private readonly http = inject(HttpClient);

  crear(input: SolicitudPedidoInput) {
    return this.http.post<{ id: string }>(apiUrl('/publico/solicitudes-pedido'), input);
  }

  /** Si está pausado o fuera de horario, no muestra el formulario (mejora 2026-09-17). */
  estado() {
    return this.http.get<{ disponible: boolean; mensaje: string | null }>(apiUrl('/publico/solicitudes-pedido/estado'));
  }

  verCotizacion(token: string) {
    return this.http.get<ConfirmacionPublica>(apiUrl(`/publico/solicitudes-pedido/confirmar/${token}`));
  }

  confirmar(token: string) {
    return this.http.post<ConfirmacionPublica>(apiUrl(`/publico/solicitudes-pedido/confirmar/${token}`), {});
  }
}
