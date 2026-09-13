import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { GenerarLinkResponse, SolicitudCadete, SolicitudCadeteForm, TokenEstado } from '../models/solicitud-cadete.model';
import { Lookup } from '../models/lookup.model';

/** Alta de cadete por link propio de un solo uso (ronda 7) — lado admin. */
@Injectable({ providedIn: 'root' })
export class SolicitudCadeteService {
  private readonly http = inject(HttpClient);

  private readonly solicitudesSignal = signal<SolicitudCadete[]>([]);
  readonly solicitudes = this.solicitudesSignal.asReadonly();
  private readonly loadingSignal = signal(false);
  readonly loading = this.loadingSignal.asReadonly();

  generarLink(onSuccess?: (r: GenerarLinkResponse) => void): void {
    this.http.post<GenerarLinkResponse>(apiUrl('/admin/solicitudes-cadete'), {}).subscribe((r) => onSuccess?.(r));
  }

  listar(estado?: string): void {
    this.loadingSignal.set(true);
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    this.http.get<SolicitudCadete[]>(apiUrl('/admin/solicitudes-cadete'), { params }).subscribe({
      next: (lista) => {
        this.solicitudesSignal.set(lista);
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }

  aprobar(
    id: string,
    username: string,
    modalidadPago: 'SEMANAL' | 'PORCENTAJE',
    onSuccess?: (r: { username: string; passwordTemporal: string }) => void,
  ): void {
    this.http
      .post<{ username: string; passwordTemporal: string }>(apiUrl(`/admin/solicitudes-cadete/${id}/aprobar`), {
        username,
        modalidadPago,
      })
      .subscribe((r) => onSuccess?.(r));
  }

  rechazar(id: string, motivo: string | null, onSuccess?: () => void): void {
    this.http.post(apiUrl(`/admin/solicitudes-cadete/${id}/rechazar`), { motivo }).subscribe(() => onSuccess?.());
  }
}

/** Lado público: la página de registro no tiene sesión de admin. */
@Injectable({ providedIn: 'root' })
export class SolicitudCadetePublicaService {
  private readonly http = inject(HttpClient);

  tiposVehiculo() {
    return this.http.get<Lookup[]>(apiUrl('/publico/solicitudes-cadete/tipos-vehiculo'));
  }

  validarToken(token: string) {
    return this.http.get<TokenEstado>(apiUrl(`/publico/solicitudes-cadete/${token}`));
  }

  enviar(token: string, form: SolicitudCadeteForm) {
    return this.http.post(apiUrl(`/publico/solicitudes-cadete/${token}`), form);
  }

  cloudinaryConfig() {
    return this.http.get<{ cloudName: string; uploadPreset: string }>(apiUrl('/publico/configuracion/cloudinary'));
  }
}
