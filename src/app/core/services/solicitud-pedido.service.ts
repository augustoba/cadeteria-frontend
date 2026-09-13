import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { Pedido } from '../models/pedido.model';
import { RevisarSolicitudInput, SolicitudPedido } from '../models/solicitud-pedido.model';

/** Revisión admin de los pedidos que el cliente carga solo desde "/pedir". */
@Injectable({ providedIn: 'root' })
export class SolicitudPedidoService {
  private readonly http = inject(HttpClient);

  private readonly solicitudesSignal = signal<SolicitudPedido[]>([]);
  private readonly loadingSignal = signal(false);

  readonly solicitudes = this.solicitudesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  listar(estado?: string): void {
    this.loadingSignal.set(true);
    this.http.get<SolicitudPedido[]>(apiUrl('/admin/solicitudes-pedido'), { params: estado ? { estado } : {} }).subscribe({
      next: (r) => {
        this.solicitudesSignal.set(r);
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }

  confirmarDirecto(id: string, input: RevisarSolicitudInput, onSuccess?: (p: Pedido) => void): void {
    this.http.post<Pedido>(apiUrl(`/admin/solicitudes-pedido/${id}/confirmar-directo`), input).subscribe((p) => onSuccess?.(p));
  }

  cotizar(id: string, input: RevisarSolicitudInput, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/solicitudes-pedido/${id}/cotizar`), input).subscribe(() => onSuccess?.());
  }

  rechazar(id: string, motivo: string | null, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/solicitudes-pedido/${id}/rechazar`), { motivo }).subscribe(() => onSuccess?.());
  }
}
