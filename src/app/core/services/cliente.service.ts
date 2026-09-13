import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { Cliente, ClienteAviso, ClienteFicha, ClienteInput } from '../models/cliente.model';

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private readonly http = inject(HttpClient);

  private readonly clientesSignal = signal<Cliente[]>([]);
  readonly clientes = this.clientesSignal.asReadonly();
  private readonly loadingSignal = signal(false);
  readonly loading = this.loadingSignal.asReadonly();
  private readonly savingSignal = signal(false);
  readonly saving = this.savingSignal.asReadonly();

  buscar(q?: string): void {
    this.loadingSignal.set(true);
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    this.http.get<Cliente[]>(apiUrl('/admin/clientes'), { params }).subscribe({
      next: (clientes) => {
        this.clientesSignal.set(clientes);
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }

  ficha(telefono: string) {
    return this.http.get<ClienteFicha>(apiUrl(`/admin/clientes/${telefono}`));
  }

  /** Para el aviso al cargar un pedido nuevo — 200 siempre, problematico=false si nunca se cargó. */
  aviso(telefono: string) {
    return this.http.get<ClienteAviso>(apiUrl('/admin/clientes/aviso'), { params: { telefono } });
  }

  guardar(telefono: string, input: ClienteInput, onSuccess?: (c: Cliente) => void): void {
    this.savingSignal.set(true);
    this.http.put<Cliente>(apiUrl(`/admin/clientes/${telefono}`), input).subscribe({
      next: (c) => {
        this.savingSignal.set(false);
        onSuccess?.(c);
      },
      error: () => this.savingSignal.set(false),
    });
  }

  /** Cierra el período de cuenta corriente (ronda 10, punto 100). */
  liquidarCuentaCorriente(telefono: string, onSuccess?: (r: { montoLiquidado: number; liquidadaHasta: string }) => void): void {
    this.http
      .post<{ montoLiquidado: number; liquidadaHasta: string }>(apiUrl(`/admin/clientes/${telefono}/liquidar-cuenta-corriente`), {})
      .subscribe((r) => onSuccess?.(r));
  }
}
