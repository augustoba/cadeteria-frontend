import { Component, Input, OnChanges } from '@angular/core';
import { PorHora } from '../../core/models/metricas.model';

const ANCHO = 720;
const ALTO = 160;
const MARGEN_INF = 20;
const MARGEN_IZQ = 4;

/**
 * Gráfico de barras: pedidos creados por hora del día (ronda 5, punto 31). Una sola
 * serie — sin leyenda, con el color de marca de la app y una escala lineal simple.
 */
@Component({
  selector: 'app-pedidos-por-hora-chart',
  template: `
    @if (maxCantidad > 0) {
      <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" class="w-full h-40" role="img" [attr.aria-label]="'Pedidos por hora del día'">
        <!-- línea base -->
        <line [attr.x1]="margenIzq" [attr.x2]="ancho" [attr.y1]="alto - margenInf" [attr.y2]="alto - margenInf" stroke="#e5e7eb" stroke-width="1" />
        @for (b of barras; track b.hora) {
          <rect
            [attr.x]="b.x"
            [attr.y]="b.y"
            [attr.width]="anchoBarra"
            [attr.height]="b.height"
            rx="2"
            fill="var(--color-brand-500)"
          >
            <title>{{ b.hora }}:00 — {{ b.cantidad }} pedido(s)</title>
          </rect>
          @if (b.hora % 3 === 0) {
            <text [attr.x]="b.x + anchoBarra / 2" [attr.y]="alto - 5" text-anchor="middle" font-size="9" fill="#9ca3af">
              {{ b.hora }}
            </text>
          }
        }
      </svg>
    } @else {
      <p class="text-xs text-gray-400 text-center py-8">Sin pedidos en este rango.</p>
    }
  `,
})
export class PedidosPorHoraChartComponent implements OnChanges {
  @Input() datos: PorHora[] = [];

  readonly ancho = ANCHO;
  readonly alto = ALTO;
  readonly margenIzq = MARGEN_IZQ;
  readonly margenInf = MARGEN_INF;
  readonly anchoBarra = (ANCHO - MARGEN_IZQ) / 24 - 2;

  maxCantidad = 0;
  barras: Array<{ hora: number; cantidad: number; x: number; y: number; height: number }> = [];

  ngOnChanges(): void {
    const datosPorHora = new Array(24).fill(0);
    for (const d of this.datos) datosPorHora[d.hora] = d.cantidad;
    this.maxCantidad = Math.max(...datosPorHora, 0);
    const alturaDisponible = this.alto - this.margenInf - 8;

    this.barras = datosPorHora.map((cantidad, hora) => {
      const height = this.maxCantidad > 0 ? (cantidad / this.maxCantidad) * alturaDisponible : 0;
      return {
        hora,
        cantidad,
        x: this.margenIzq + hora * ((this.ancho - this.margenIzq) / 24) + 1,
        y: this.alto - this.margenInf - height,
        height,
      };
    });
  }
}
