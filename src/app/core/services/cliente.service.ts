import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { Cliente, ClienteAviso, ClienteFicha, ClienteInput, ClientesPagina } from '../models/cliente.model';

const TAMANO_PAGINA = 20;

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private readonly http = inject(HttpClient);

  private readonly clientesSignal = signal<Cliente[]>([]);
  readonly clientes = this.clientesSignal.asReadonly();
  private readonly loadingSignal = signal(false);
  readonly loading = this.loadingSignal.asReadonly();
  private readonly savingSignal = signal(false);
  readonly saving = this.savingSignal.asReadonly();

  private readonly totalSignal = signal(0);
  readonly total = this.totalSignal.asReadonly();
  private readonly paginaSignal = signal(0);
  readonly pagina = this.paginaSignal.asReadonly();
  private readonly totalPaginasSignal = signal(1);
  readonly totalPaginas = this.totalPaginasSignal.asReadonly();

  private ultimaBusqueda = '';

  /**
   * Paginado de verdad (mejora 2026-09-16) — antes traía todo el listado de una. `pagina`
   * es 0-based, igual que el `Pageable` del backend. Una búsqueda nueva siempre vuelve a
   * la página 0; cambiar de página mantiene la última búsqueda.
   */
  buscar(q?: string, pagina = 0): void {
    if (q !== undefined) this.ultimaBusqueda = q;
    this.loadingSignal.set(true);
    let params = new HttpParams().set('pagina', pagina).set('tamano', TAMANO_PAGINA);
    if (this.ultimaBusqueda) params = params.set('q', this.ultimaBusqueda);
    this.http.get<ClientesPagina>(apiUrl('/admin/clientes'), { params }).subscribe({
      next: (r) => {
        this.clientesSignal.set(r.items);
        this.totalSignal.set(r.total);
        this.paginaSignal.set(r.pagina);
        this.totalPaginasSignal.set(r.totalPaginas);
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }

  irAPagina(pagina: number): void {
    this.buscar(undefined, pagina);
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
