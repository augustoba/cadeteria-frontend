import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';

interface ConfiguracionResponse {
  valores: Record<string, string>;
}

/** Simulador del factor de línea recta contra lo cobrado antes (Configuración → Tarifas). */
export interface SimulacionTarifa {
  factor: number;
  dias: number;
  pedidosAnalizados: number;
  formulaMasCara: number;
  formulaMasBarata: number;
  parecidos: number;
  totalCobrado: number;
  totalConFormula: number;
  diferenciaPromedio: number;
  diferenciaPromedioPct: number;
  factorSugerido: number | null;
  pedidosParaSugerencia: number;
  mayoresDiferencias: {
    numero: number;
    creadoEn: string;
    origen: string;
    destino: string;
    lineaRectaKm: number;
    cobrado: number;
    conFormula: number;
  }[];
}

export interface EstadoApiKey {
  proveedor: string;
  claveEnmascarada: string;
  estado: 'OK' | 'AGOTADA' | 'INVALIDA';
  /** true = la cargó el superadmin (el admin la ve como "(del sistema)"). */
  delSistema?: boolean;
  restante: number | null;
  restanteEstimado: boolean;
  actualizadoEn: string;
}

/**
 * Parametros globales editables desde el panel (tiempo limite de aceptacion,
 * frecuencia de ubicacion, credenciales de Cloudinary) — diseno-tecnico.md
 * sección 3/7/8. Se cargan una vez al arrancar el panel.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly http = inject(HttpClient);
  private readonly valoresSignal = signal<Record<string, string>>({});
  private cargado = false;

  readonly valores = this.valoresSignal.asReadonly();

  readonly cloudinaryConfigured = computed(() => {
    const v = this.valoresSignal();
    return !!v['cloudinary_cloud_name'] && !!v['cloudinary_upload_preset'];
  });

  cloudName(): string {
    return this.valoresSignal()['cloudinary_cloud_name'] ?? '';
  }

  uploadPreset(): string {
    return this.valoresSignal()['cloudinary_upload_preset'] ?? '';
  }

  ensureLoaded(): void {
    if (this.cargado) return;
    this.cargado = true;
    this.reload();
  }

  reload(): void {
    this.http.get<ConfiguracionResponse>(apiUrl('/admin/configuracion')).subscribe({
      next: (res) => this.valoresSignal.set(res.valores),
      error: () => (this.cargado = false),
    });
  }

  guardar(clave: string, valor: string, onSuccess?: () => void, onError?: () => void): void {
    this.http.put<ConfiguracionResponse>(apiUrl('/admin/configuracion'), { clave, valor }).subscribe({
      next: (res) => {
        this.valoresSignal.set(res.valores);
        onSuccess?.();
      },
      error: () => onError?.(),
    });
  }

  /** Semáforo de las API keys de geocoding/rutas (verde/rojo, y cupo restante si el proveedor lo informa). */
  simularTarifa(factor: number | null, dias: number) {
    const params: Record<string, string> = { dias: String(dias) };
    if (factor != null) params['factor'] = String(factor);
    return this.http.get<SimulacionTarifa>(apiUrl('/admin/tarifas/simular'), { params });
  }

  estadoApiKeys() {
    return this.http.get<EstadoApiKey[]>(apiUrl('/admin/configuracion/api-keys/estado'));
  }
}
