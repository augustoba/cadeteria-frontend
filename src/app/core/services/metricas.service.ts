import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { CadeteMetrica, PorHora, Rechazo, ResumenDia, ZonaMetrica } from '../models/metricas.model';

@Injectable({ providedIn: 'root' })
export class MetricasService {
  private readonly http = inject(HttpClient);

  /** desde/hasta en formato yyyy-MM-dd; sin parámetros, el backend usa hoy. */
  resumen(desde?: string, hasta?: string) {
    return this.http.get<ResumenDia>(apiUrl('/admin/metricas/resumen'), { params: this.params(desde, hasta) });
  }

  cadetes(desde?: string, hasta?: string) {
    return this.http.get<CadeteMetrica[]>(apiUrl('/admin/metricas/cadetes'), { params: this.params(desde, hasta) });
  }

  /** Motivos de rechazo cargados por los cadetes en el rango — para detectar patrones. */
  rechazos(desde?: string, hasta?: string) {
    return this.http.get<Rechazo[]>(apiUrl('/admin/metricas/rechazos'), { params: this.params(desde, hasta) });
  }

  /** Para el gráfico de pedidos por hora del día. */
  porHora(desde?: string, hasta?: string) {
    return this.http.get<PorHora[]>(apiUrl('/admin/metricas/por-hora'), { params: this.params(desde, hasta) });
  }

  /** Volumen e ingresos por zona. */
  zonas(desde?: string, hasta?: string) {
    return this.http.get<ZonaMetrica[]>(apiUrl('/admin/metricas/zonas'), { params: this.params(desde, hasta) });
  }

  private params(desde?: string, hasta?: string): HttpParams {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return params;
  }
}
