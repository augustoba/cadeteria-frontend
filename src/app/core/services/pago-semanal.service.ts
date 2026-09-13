import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { PagoPendiente, PagoSemanal, PagoSemanalInput } from '../models/pago-semanal.model';

@Injectable({ providedIn: 'root' })
export class PagoSemanalService {
  private readonly http = inject(HttpClient);

  private readonly pagosSignal = signal<PagoSemanal[]>([]);
  readonly pagos = this.pagosSignal.asReadonly();
  private readonly loadingSignal = signal(false);
  readonly loading = this.loadingSignal.asReadonly();
  private readonly savingSignal = signal(false);
  readonly saving = this.savingSignal.asReadonly();

  cargar(cadeteId: string): void {
    this.loadingSignal.set(true);
    this.http.get<PagoSemanal[]>(apiUrl(`/admin/cadetes/${cadeteId}/pagos`)).subscribe({
      next: (pagos) => {
        this.pagosSignal.set(pagos);
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }

  limpiar(): void {
    this.pagosSignal.set([]);
  }

  registrar(cadeteId: string, input: PagoSemanalInput, onSuccess?: () => void): void {
    this.savingSignal.set(true);
    this.http.post(apiUrl(`/admin/cadetes/${cadeteId}/pagos`), input).subscribe({
      next: () => {
        this.savingSignal.set(false);
        this.cargar(cadeteId);
        onSuccess?.();
      },
      error: () => this.savingSignal.set(false),
    });
  }

  /** Cadetes activos sin pago registrado para la última semana ya cerrada — recordatorio. */
  pendientes() {
    return this.http.get<PagoPendiente[]>(apiUrl('/admin/pagos/pendientes'));
  }
}
