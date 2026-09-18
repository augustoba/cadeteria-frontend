import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';

const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;background:#1e88e5;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 16],
});

const HANDLE_ICON = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:ew-resize"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const VERTICE_ICON = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#7c3aed;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.5);cursor:move"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Distancia entre dos puntos en metros (fórmula de haversine). */
function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Punto a `distanciaM` metros de (lat, lng) en la dirección `bearingDeg` (0 = norte, 90 = este). */
function destinoPunto(lat: number, lng: number, distanciaM: number, bearingDeg: number): { lat: number; lng: number } {
  const R = 6371000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanciaM / R) + Math.cos(lat1) * Math.sin(distanciaM / R) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(distanciaM / R) * Math.cos(lat1),
      Math.cos(distanciaM / R) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

/**
 * Selector de punto sobre un mapa Leaflet: un click fija/mueve el marcador y emite lat/lng.
 * Si se pasa `radioM`, además dibuja el círculo de cobertura de la zona con una manija
 * arrastrable para ajustar el radio a ojo (ronda 4, punto 27) en vez de tipear los metros.
 *
 * Modo polígono (ronda 3, punto 27): con `modoPoligono` en true, cada click agrega un
 * vértice en vez de mover el círculo — permite dibujar la forma real de la zona en vez
 * de aproximarla con un círculo. El círculo se sigue guardando como fallback/centro.
 */
@Component({
  selector: 'app-mapa-picker',
  template: `<div #mapEl class="w-full h-full rounded border border-gray-300"></div>`,
})
export class MapaPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() lat: number | null = null;
  @Input() lng: number | null = null;
  /** Centro por default: Plaza Independencia, San Miguel de Tucumán — la ciudad donde opera la cadetería. */
  @Input() centro: { lat: number; lng: number } = { lat: -26.8083, lng: -65.2176 };
  @Input() radioM: number | null = null;
  @Input() modoPoligono = false;
  /** Rectángulo: primer click marca una esquina, segundo click la esquina opuesta (ronda 10, punto 95). */
  @Input() modoRectangulo = false;
  @Input() poligono: Array<{ lat: number; lng: number }> = [];
  @Output() picked = new EventEmitter<{ lat: number; lng: number }>();
  @Output() radioChange = new EventEmitter<number>();
  @Output() poligonoChange = new EventEmitter<Array<{ lat: number; lng: number }>>();

  @ViewChild('mapEl', { static: true }) private readonly mapEl!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private circulo: L.Circle | null = null;
  private manijaRadio: L.Marker | null = null;
  private arrastrandoManija = false;
  private vertices: Array<{ lat: number; lng: number }> = [];
  private capaPoligono: L.Polygon | L.Polyline | null = null;
  private marcadoresVertices: L.Marker[] = [];
  private esquinaRectangulo: { lat: number; lng: number } | null = null;

  ngAfterViewInit(): void {
    const centroInicial = this.lat != null && this.lng != null ? { lat: this.lat, lng: this.lng } : this.centro;
    this.map = L.map(this.mapEl.nativeElement).setView([centroInicial.lat, centroInicial.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    if (this.lat != null && this.lng != null) {
      this.marker = L.marker([this.lat, this.lng], { icon: PIN_ICON }).addTo(this.map);
      this.dibujarCobertura();
    }
    this.vertices = [...this.poligono];
    this.dibujarPoligono();

    this.map.on('click', (ev: L.LeafletMouseEvent) => {
      if (this.modoRectangulo) {
        this.clickRectangulo(ev.latlng.lat, ev.latlng.lng);
        return;
      }
      if (this.modoPoligono) {
        this.vertices.push({ lat: ev.latlng.lat, lng: ev.latlng.lng });
        this.dibujarPoligono();
        this.poligonoChange.emit([...this.vertices]);
        return;
      }
      this.setMarker(ev.latlng.lat, ev.latlng.lng);
      this.picked.emit({ lat: ev.latlng.lat, lng: ev.latlng.lng });
    });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['centro'] && !this.marker) {
      this.map.setView([this.centro.lat, this.centro.lng], 14);
    }
    if ((changes['lat'] || changes['lng']) && this.lat != null && this.lng != null) {
      this.setMarker(this.lat, this.lng);
      this.map.setView([this.lat, this.lng], this.map.getZoom());
    }
    if (changes['radioM'] && !changes['radioM'].firstChange) {
      this.dibujarCobertura();
    }
    if (changes['poligono'] && !changes['poligono'].firstChange) {
      this.vertices = [...this.poligono];
      this.dibujarPoligono();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  /** Primer click = una esquina; segundo click = la opuesta, arma un rectángulo axis-aligned de 4 puntos. */
  private clickRectangulo(lat: number, lng: number): void {
    if (!this.esquinaRectangulo) {
      this.esquinaRectangulo = { lat, lng };
      return;
    }
    const a = this.esquinaRectangulo;
    const b = { lat, lng };
    this.vertices = [
      { lat: a.lat, lng: a.lng },
      { lat: a.lat, lng: b.lng },
      { lat: b.lat, lng: b.lng },
      { lat: b.lat, lng: a.lng },
    ];
    this.esquinaRectangulo = null;
    this.dibujarPoligono();
    this.poligonoChange.emit([...this.vertices]);
  }

  /** Saca el último vértice cargado (botón "Deshacer" del form). */
  deshacerUltimoPunto(): void {
    this.vertices.pop();
    this.dibujarPoligono();
    this.poligonoChange.emit([...this.vertices]);
  }

  /** Borra todo el polígono y vuelve a depender solo del círculo (botón "Borrar polígono"). */
  limpiarPoligono(): void {
    this.vertices = [];
    this.esquinaRectangulo = null;
    this.dibujarPoligono();
    this.poligonoChange.emit([]);
  }

  /**
   * Dibuja el polígono/rectángulo desde cero, con un marcador **arrastrable** por
   * vértice — antes quedaban fijos apenas se trazaba la forma (rectángulo de 2 clicks o
   * polígono libre) y la única forma de corregirla era "Deshacer" (solo mientras se
   * dibuja) o borrar todo. Ahora cada esquina se puede arrastrar para agrandar/achicar
   * después de trazada, y doble-click sobre un vértice lo saca.
   */
  private dibujarPoligono(): void {
    if (!this.map) return;
    this.capaPoligono?.remove();
    this.capaPoligono = null;
    this.marcadoresVertices.forEach((m) => m.remove());
    this.marcadoresVertices = [];

    if (this.vertices.length === 0) return;

    const latLngs = this.vertices.map((v) => [v.lat, v.lng] as [number, number]);
    this.capaPoligono =
      this.vertices.length >= 3
        ? L.polygon(latLngs, { color: '#7c3aed', weight: 2, fillColor: '#7c3aed', fillOpacity: 0.15 }).addTo(this.map)
        : L.polyline(latLngs, { color: '#7c3aed', weight: 2, dashArray: '6 4' }).addTo(this.map);

    this.marcadoresVertices = this.vertices.map((v, i) => {
      const m = L.marker([v.lat, v.lng], { icon: VERTICE_ICON, draggable: true }).addTo(this.map!);
      m.on('drag', () => {
        const p = m.getLatLng();
        this.vertices[i] = { lat: p.lat, lng: p.lng };
        this.actualizarCapaPoligono();
      });
      m.on('dragend', () => {
        this.poligonoChange.emit([...this.vertices]);
        this.actualizarCentroDesdeVertices();
      });
      m.on('dblclick', (ev: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(ev);
        this.vertices.splice(i, 1);
        this.dibujarPoligono();
        this.poligonoChange.emit([...this.vertices]);
      });
      return m;
    });

    // Con la figura ya cerrada (rectángulo o polígono ≥3 vértices), el centro se calcula
    // solo — en modoRectangulo/modoPoligono el mapa nunca deja pasar un click "en blanco"
    // para marcarlo a mano (siempre lo toma como un vértice/esquina nuevo), así que pedirle
    // ese paso aparte era un callejón sin salida (bug reportado: "no puedo marcar encima").
    this.actualizarCentroDesdeVertices();
  }

  /** Actualiza solo la forma (polígono/línea) mientras se arrastra un vértice, sin recrear los marcadores. */
  private actualizarCapaPoligono(): void {
    if (!this.map || !this.capaPoligono) return;
    const latLngs = this.vertices.map((v) => [v.lat, v.lng] as [number, number]);
    this.capaPoligono.setLatLngs(latLngs);
  }

  /** Centro = promedio de los vértices (centroide exacto para un rectángulo, buena aproximación para un polígono libre). */
  private actualizarCentroDesdeVertices(): void {
    if (this.vertices.length < 3) return;
    const suma = this.vertices.reduce((acc, v) => ({ lat: acc.lat + v.lat, lng: acc.lng + v.lng }), { lat: 0, lng: 0 });
    const centro = { lat: suma.lat / this.vertices.length, lng: suma.lng / this.vertices.length };
    this.setMarker(centro.lat, centro.lng);
    this.picked.emit(centro);
  }

  private setMarker(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { icon: PIN_ICON }).addTo(this.map);
    }
    this.dibujarCobertura();
  }

  /** Dibuja/actualiza el círculo de cobertura y su manija arrastrable en base al radio actual. */
  private dibujarCobertura(): void {
    if (!this.map || !this.marker || this.radioM == null || this.arrastrandoManija) return;
    const centro = this.marker.getLatLng();
    const radio = this.radioM;

    if (this.circulo) {
      this.circulo.setLatLng(centro);
      this.circulo.setRadius(radio);
    } else {
      this.circulo = L.circle(centro, {
        radius: radio,
        color: '#1e88e5',
        weight: 2,
        fillColor: '#1e88e5',
        fillOpacity: 0.12,
      }).addTo(this.map);
    }

    const puntoManija = destinoPunto(centro.lat, centro.lng, radio, 90);
    if (this.manijaRadio) {
      this.manijaRadio.setLatLng([puntoManija.lat, puntoManija.lng]);
    } else {
      this.manijaRadio = L.marker([puntoManija.lat, puntoManija.lng], { icon: HANDLE_ICON, draggable: true }).addTo(this.map);
      this.manijaRadio.on('dragstart', () => {
        this.arrastrandoManija = true;
      });
      this.manijaRadio.on('drag', () => {
        if (!this.marker || !this.manijaRadio) return;
        const c = this.marker.getLatLng();
        const h = this.manijaRadio.getLatLng();
        const nuevoRadio = Math.max(10, Math.round(distanciaMetros(c.lat, c.lng, h.lat, h.lng)));
        this.circulo?.setRadius(nuevoRadio);
        this.radioChange.emit(nuevoRadio);
      });
      this.manijaRadio.on('dragend', () => {
        this.arrastrandoManija = false;
      });
    }
  }
}
