import { Component, ElementRef, OnDestroy, OnInit, ViewChild, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';
import { CadeteService } from '../../core/services/cadete.service';
import { ZonaService } from '../../core/services/zona.service';
import { PedidoService } from '../../core/services/pedido.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { Cadete } from '../../core/models/cadete.model';
import { Pedido } from '../../core/models/pedido.model';

/** Centro de San Miguel de Tucumán (zona Centro) — mismo punto que usa el buscador de direcciones. */
const CENTRO_DEFAULT: [number, number] = [-26.8306, -65.2038];

const COLOR_ESTADO_CADETE: Record<string, string> = {
  LIBRE: '#16a34a',
  OCUPADO: '#f59e0b',
  DESCONECTADO: '#6b7280',
};

function cadeteIcon(estadoId: string): L.DivIcon {
  const color = COLOR_ESTADO_CADETE[estadoId] ?? '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.5)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

@Component({
  selector: 'app-mapa',
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Mapa en vivo</h1>
        <div class="flex items-center gap-4 text-xs">
          <span class="flex items-center gap-1"><span class="dot" style="background:#16a34a"></span> Libre</span>
          <span class="flex items-center gap-1"><span class="dot" style="background:#f59e0b"></span> Ocupado</span>
          <span class="flex items-center gap-1"><span class="dot" style="background:#6b7280"></span> Desconectado</span>
          <span class="flex items-center gap-1"><span class="dot" style="background:#7c3aed"></span> Pedido en curso</span>
        </div>
      </div>
      <div class="px-4 py-2 border-b border-gray-200 flex items-center gap-3 text-xs">
        <label class="flex items-center gap-1.5">
          <input type="checkbox" [(ngModel)]="heatmapActivo" (ngModelChange)="onToggleHeatmap($event)" />
          <span class="text-gray-600">🔥 Heatmap de demanda (últimos 30 días)</span>
        </label>
      </div>
      <div #mapEl class="h-[36rem] w-full"></div>
    </div>
  `,
  styles: [
    `
      .dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
    `,
  ],
})
export class MapaComponent implements OnInit, OnDestroy {
  readonly cadetes = inject(CadeteService);
  readonly zonas = inject(ZonaService);
  readonly pedidos = inject(PedidoService);
  private readonly realtime = inject(RealtimeService);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('mapEl', { static: true }) private readonly mapEl!: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);

  private map: L.Map | null = null;
  private readonly capaZonas = L.layerGroup();
  /** Mejora 80 — agrupa marcadores cercanos (útil con muchos cadetes a la vez, evita amontonarlos sin poder distinguirlos). */
  private readonly capaCadetes = L.markerClusterGroup();
  private readonly capaPedidos = L.layerGroup();

  /** Mejora 92 — heatmap de demanda (origen de pedidos de los últimos 30 días), toggle aparte del resto de las capas. */
  heatmapActivo = false;
  private capaHeatmap: L.Layer | null = null;

  /** Cadete al que hay que centrar/abrir apenas aparezca en el mapa (viene de "Encontrar" en Cadetes). */
  private cadeteObjetivoId: string | null = null;
  private centradoEnObjetivo = false;

  /** Punto suelto a marcar (viene de "Ver ubicación" en el detalle de un pedido, para
   * verificar que el retiro/entrega del cadete coincide con la dirección declarada). */
  private readonly capaVerificacion = L.layerGroup();

  /** Recorrido GPS real de un pedido puntual (viene de "Ver recorrido real" en el detalle). */
  private readonly capaTrayecto = L.layerGroup();

  private desuscribirUbicaciones: (() => void) | null = null;
  private desuscribirPedidos: (() => void) | null = null;

  constructor() {
    effect(() => {
      const zonas = this.zonas.zonas();
      this.dibujarZonas(
        zonas.map((z) => ({
          centroLat: z.centroLat,
          centroLng: z.centroLng,
          radioM: z.radioM,
          nombre: z.nombre,
          poligono: z.poligono,
          activo: z.activo,
        })),
      );
    });
    effect(() => {
      const cadetes = this.cadetes.cadetes();
      this.dibujarCadetes(cadetes);
    });
    effect(() => {
      const pedidos = this.pedidos.pedidos();
      this.dibujarPedidos(pedidos);
    });
  }

  ngOnInit(): void {
    this.cadeteObjetivoId = this.route.snapshot.queryParamMap.get('cadeteId');

    this.map = L.map(this.mapEl.nativeElement).setView(CENTRO_DEFAULT, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    this.capaZonas.addTo(this.map);
    this.capaPedidos.addTo(this.map);
    this.capaCadetes.addTo(this.map);
    this.capaVerificacion.addTo(this.map);
    this.capaTrayecto.addTo(this.map);

    this.dibujarVerificacion();
    this.dibujarTrayecto();

    this.zonas.ensureLoaded();
    this.cadetes.ensureLoaded();
    this.pedidos.cargar('activos');

    this.desuscribirUbicaciones = this.realtime.subscribe('/topic/admin/ubicaciones', (body) => {
      this.cadetes.aplicarActualizacion(body as Cadete);
    });
    this.desuscribirPedidos = this.realtime.subscribe('/topic/admin/pedidos', () => {
      this.pedidos.reload();
    });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnDestroy(): void {
    this.desuscribirUbicaciones?.();
    this.desuscribirPedidos?.();
    this.map?.remove();
  }

  /** Dibuja el pin suelto de "Ver ubicación" (query params lat/lng/label) y centra el mapa ahí. */
  private dibujarVerificacion(): void {
    const params = this.route.snapshot.queryParamMap;
    const latStr = params.get('lat');
    const lngStr = params.get('lng');
    // Ojo: Number(null) da 0, no NaN — sin este chequeo, entrar a /mapa sin query params
    // terminaba centrando el mapa en (0, 0) ("Null Island", en medio del océano).
    if (!latStr || !lngStr) return;
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const label = params.get('label') ?? 'Ubicación';
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#dc2626;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.5);transform:rotate(-45deg)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 18],
    });
    L.marker([lat, lng], { icon }).bindPopup(`📍 ${label}<br>${lat.toFixed(6)}, ${lng.toFixed(6)}`).addTo(this.capaVerificacion).openPopup();
    this.map?.setView([lat, lng], 17);
  }

  /** Dibuja el recorrido GPS real de un pedido (query param pedidoId, viene de "Ver recorrido real"). */
  private dibujarTrayecto(): void {
    const pedidoId = this.route.snapshot.queryParamMap.get('pedidoId');
    if (!pedidoId) return;

    this.pedidos.trayecto(pedidoId).subscribe((puntos) => {
      if (puntos.length === 0) return;
      const linea: L.LatLngTuple[] = puntos.map((p) => [p.lat, p.lng]);
      L.polyline(linea, { color: '#dc2626', weight: 4 }).addTo(this.capaTrayecto);
      L.circleMarker(linea[0], { radius: 6, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 })
        .bindTooltip('Inicio del recorrido')
        .addTo(this.capaTrayecto);
      L.circleMarker(linea[linea.length - 1], { radius: 6, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 1 })
        .bindTooltip('Último punto registrado')
        .addTo(this.capaTrayecto);
      this.map?.fitBounds(L.latLngBounds(linea), { padding: [30, 30] });
    });
  }

  private dibujarZonas(
    zonas: Array<{
      centroLat: number;
      centroLng: number;
      radioM: number;
      nombre: string;
      poligono: Array<{ lat: number; lng: number }>;
      activo: boolean;
    }>,
  ): void {
    this.capaZonas.clearLayers();
    for (const z of zonas) {
      // Zona con forma real dibujada a mano (ronda 3, punto 27) — antes acá siempre se
      // pintaba el círculo aproximado aunque la zona ya tuviera un polígono guardado.
      const color = z.activo ? '#1e88e5' : '#9ca3af';
      const capa =
        z.poligono && z.poligono.length >= 3
          ? L.polygon(
              z.poligono.map((p) => [p.lat, p.lng] as [number, number]),
              { color, weight: 1, fillOpacity: 0.05 },
            )
          : L.circle([z.centroLat, z.centroLng], { radius: z.radioM, color, weight: 1, fillOpacity: 0.05 });
      capa.bindTooltip(z.activo ? z.nombre : `${z.nombre} (inactiva)`).addTo(this.capaZonas);
    }
  }

  private dibujarCadetes(cadetes: Cadete[]): void {
    this.capaCadetes.clearLayers();
    let marcadorObjetivo: L.Marker | null = null;
    for (const c of cadetes) {
      if (c.lat == null || c.lng == null) continue;
      const popup = `
        <strong>${c.nombre} ${c.apellido}</strong><br>
        ${c.tipoVehiculo.nombre} · ${c.estado.nombre}<br>
        ${c.ubicacionActualizadaEn ? 'Actualizado: ' + new Date(c.ubicacionActualizadaEn).toLocaleTimeString() : ''}
      `;
      const marker = L.marker([c.lat, c.lng], { icon: cadeteIcon(c.estado.id) }).bindPopup(popup).addTo(this.capaCadetes);
      if (c.id === this.cadeteObjetivoId) marcadorObjetivo = marker;
    }

    if (marcadorObjetivo && !this.centradoEnObjetivo) {
      this.centradoEnObjetivo = true;
      this.map?.setView(marcadorObjetivo.getLatLng(), 16);
      marcadorObjetivo.openPopup();
    }
  }

  private dibujarPedidos(pedidos: Pedido[]): void {
    this.capaPedidos.clearLayers();
    for (const p of pedidos) {
      if (p.estado.id !== 'EN_CURSO') continue;
      const origen: L.LatLngTuple = [p.origenLat, p.origenLng];
      const destino: L.LatLngTuple = [p.destinoLat, p.destinoLng];
      const popup = `Pedido ${p.id.slice(0, 8)}<br>${p.clienteNombre}<br>${p.cadeteAsignado ? p.cadeteAsignado.nombre + ' ' + p.cadeteAsignado.apellido : ''}`;

      L.polyline([origen, destino], { color: '#7c3aed', weight: 2, dashArray: '6 6' }).addTo(this.capaPedidos);
      L.circleMarker(origen, { radius: 6, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.9 })
        .bindPopup(popup)
        .addTo(this.capaPedidos);
      L.circleMarker(destino, { radius: 6, color: '#7c3aed', fillColor: 'white', fillOpacity: 0.9, weight: 2 })
        .bindPopup(popup)
        .addTo(this.capaPedidos);
    }
  }

  onToggleHeatmap(activo: boolean): void {
    if (!activo) {
      if (this.capaHeatmap) {
        this.map?.removeLayer(this.capaHeatmap);
        this.capaHeatmap = null;
      }
      return;
    }
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    this.http
      .get<[number, number][]>(apiUrl('/admin/metricas/heatmap'), { params: { desde: fmt(desde), hasta: fmt(hasta) } })
      .subscribe((puntos) => {
        if (!this.heatmapActivo || !this.map) return;
        this.capaHeatmap = (L as unknown as { heatLayer: (p: unknown, o: unknown) => L.Layer }).heatLayer(puntos, {
          radius: 25,
          blur: 20,
        });
        this.capaHeatmap.addTo(this.map);
      });
  }
}
