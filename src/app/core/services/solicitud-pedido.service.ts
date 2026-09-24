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

  /** Marca el teléfono como cliente problemático y rechaza la solicitud si seguía abierta (spec-antiabuso Fase 4). */
  marcarFraudulenta(id: string, nota: string | null, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/solicitudes-pedido/${id}/fraudulento`), { nota }).subscribe(() => onSuccess?.());
  }

  /** Le manda al cliente los datos del pedido por WhatsApp para que confirme. */
  pedirConfirmacionWhatsapp(id: string, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/solicitudes-pedido/${id}/whatsapp-confirmacion`), {}).subscribe(() => onSuccess?.());
  }

  /** El admin confirmó el teléfono a mano (ej. llamó) — saca la marca "sin verificar". */
  validarTelefono(id: string, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/solicitudes-pedido/${id}/validar-telefono`), {}).subscribe(() => onSuccess?.());
  }

  rechazar(id: string, motivo: string | null, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/solicitudes-pedido/${id}/rechazar`), { motivo }).subscribe(() => onSuccess?.());
  }
}
