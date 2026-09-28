import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';
import { RealtimeService } from '../../core/services/realtime.service';

/** Espejo de AvisoCalleDtos.AvisoCalleResponse (backend, carril C 2026-09-28). */
export interface AvisoCalle {
  id: string;
  tipo: 'CONTROL' | 'CALLE_CORTADA' | 'ACCIDENTE' | 'PIQUETE';
  tipoTexto: string;
  lat: number;
  lng: number;
  calle: string | null;
  cadeteId: string | null;
  cadeteNombre: string | null;
  creadoEn: string;
  venceEn: string;
}

export const ICONO_AVISO_CALLE: Record<AvisoCalle['tipo'], string> = {
  CONTROL: '🚓',
  CALLE_CORTADA: '🚧',
  ACCIDENTE: '💥',
  PIQUETE: '✊',
};

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function haceCuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return min < 1 ? 'recién' : min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h ${min % 60} min`;
}

/**
 * "Avisos de la calle" en el Mapa del panel (carril C, 2026-09-28): un ícono por aviso activo con la
 * calle, la hora, "hace X min" y quién avisó. Llegan en vivo por /topic/admin/avisos-calle y se sacan
 * solos al vencer (se repasa cada minuto, que además actualiza el "hace X min").
 */
export class AvisosCalleCapa {
  readonly capa = L.layerGroup();
  private readonly avisos = new Map<string, AvisoCalle>();
  private desuscribir: (() => void) | null = null;
  private reloj: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly realtime: RealtimeService,
  ) {}

  iniciar(map: L.Map): void {
    this.capa.addTo(map);
    this.http.get<AvisoCalle[]>(apiUrl('/admin/avisos-calle')).subscribe((lista) => {
      lista.forEach((a) => this.avisos.set(a.id, a));
      this.dibujar();
    });
    this.desuscribir = this.realtime.subscribe('/topic/admin/avisos-calle', (body) => {
      const a = body as AvisoCalle;
      this.avisos.set(a.id, a);
      this.dibujar();
    });
    this.reloj = setInterval(() => this.dibujar(), 60_000);
  }

  destruir(): void {
    this.desuscribir?.();
    if (this.reloj) clearInterval(this.reloj);
  }

  private dibujar(): void {
    const ahora = Date.now();
    for (const [id, a] of this.avisos) {
      if (new Date(a.venceEn).getTime() <= ahora) this.avisos.delete(id);
    }
    this.capa.clearLayers();
    for (const a of this.avisos.values()) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="font-size:22px;line-height:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">${ICONO_AVISO_CALLE[a.tipo] ?? '🚨'}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const hora = new Date(a.creadoEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const popup =
        `<b>🚨 ${escapar(a.tipoTexto)}</b><br>` +
        `${escapar(a.calle ?? 'Sin calle (ver el punto en el mapa)')}<br>` +
        `${hora} · ${haceCuanto(a.creadoEn)}<br>` +
        `<span style="color:#6b7280">Avisó: ${escapar(a.cadeteNombre ?? '—')}</span>`;
      L.marker([a.lat, a.lng], { icon, zIndexOffset: 1000 }).bindPopup(popup).addTo(this.capa);
    }
  }
}
