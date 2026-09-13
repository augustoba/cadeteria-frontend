import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import * as L from 'leaflet';

const CADETE_ICON = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#16a34a;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const DESTINO_ICON = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;background:#dc2626;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 16],
});

/** Mapa de solo lectura para la página pública de seguimiento — cadete en vivo + destino (ronda 4, punto 12). */
@Component({
  selector: 'app-seguimiento-mapa',
  template: `<div #mapEl class="w-full h-full"></div>`,
})
export class SeguimientoMapaComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() cadeteLat: number | null = null;
  @Input() cadeteLng: number | null = null;
  @Input() destinoLat: number | null = null;
  @Input() destinoLng: number | null = null;

  @ViewChild('mapEl', { static: true }) private readonly mapEl!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private marcadorCadete: L.Marker | null = null;
  private marcadorDestino: L.Marker | null = null;

  ngAfterViewInit(): void {
    const centro: [number, number] =
      this.cadeteLat != null && this.cadeteLng != null ? [this.cadeteLat, this.cadeteLng] : [-26.8306, -65.2038];
    this.map = L.map(this.mapEl.nativeElement, { zoomControl: false, attributionControl: false }).setView(centro, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);
    this.dibujar();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    this.dibujar();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private dibujar(): void {
    if (!this.map) return;
    const puntos: L.LatLngExpression[] = [];

    if (this.cadeteLat != null && this.cadeteLng != null) {
      const pos: [number, number] = [this.cadeteLat, this.cadeteLng];
      if (this.marcadorCadete) {
        this.marcadorCadete.setLatLng(pos);
      } else {
        this.marcadorCadete = L.marker(pos, { icon: CADETE_ICON }).addTo(this.map);
      }
      puntos.push(pos);
    }

    if (this.destinoLat != null && this.destinoLng != null) {
      const pos: [number, number] = [this.destinoLat, this.destinoLng];
      if (this.marcadorDestino) {
        this.marcadorDestino.setLatLng(pos);
      } else {
        this.marcadorDestino = L.marker(pos, { icon: DESTINO_ICON }).addTo(this.map);
      }
      puntos.push(pos);
    }

    if (puntos.length === 2) {
      this.map.fitBounds(L.latLngBounds(puntos), { padding: [30, 30], maxZoom: 16 });
    } else if (puntos.length === 1) {
      this.map.setView(puntos[0], 15);
    }
  }
}
