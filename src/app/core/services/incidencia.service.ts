import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { Incidencia, IncidenciaInput } from '../models/incidencia.model';

@Injectable({ providedIn: 'root' })
export class IncidenciaService {
  private readonly http = inject(HttpClient);

  private readonly incidenciasSignal = signal<Incidencia[]>([]);
  readonly incidencias = this.incidenciasSignal.asReadonly();
  private readonly loadingSignal = signal(false);
  readonly loading = this.loadingSignal.asReadonly();
  private readonly savingSignal = signal(false);
  readonly saving = this.savingSignal.asReadonly();

  listar(estado?: string): void {
    this.loadingSignal.set(true);
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    this.http.get<Incidencia[]>(apiUrl('/admin/incidencias'), { params }).subscribe({
      next: (incidencias) => {
        this.incidenciasSignal.set(incidencias);
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }

  /** Incidencias ligadas a un pedido puntual — para mostrarlas en su detalle. */
  porPedido(pedidoId: string) {
    return this.http.get<Incidencia[]>(apiUrl('/admin/incidencias'), { params: { pedidoId } });
  }

  /** Incidencias ligadas a un cadete puntual (ronda 10, punto 108) — para mostrarlas en su ficha. */
  porCadete(cadeteId: string) {
    return this.http.get<Incidencia[]>(apiUrl('/admin/incidencias'), { params: { cadeteId } });
  }

  crear(input: IncidenciaInput, onSuccess?: () => void): void {
    this.savingSignal.set(true);
    this.http.post(apiUrl('/admin/incidencias'), input).subscribe({
      next: () => {
        this.savingSignal.set(false);
        onSuccess?.();
      },
      error: () => this.savingSignal.set(false),
    });
  }

  cerrar(id: string, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/incidencias/${id}/cerrar`), {}).subscribe({ next: () => onSuccess?.() });
  }

  reabrir(id: string, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/incidencias/${id}/reabrir`), {}).subscribe({ next: () => onSuccess?.() });
  }
}
