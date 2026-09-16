import { Component, Input, OnChanges } from '@angular/core';

interface Segmento {
  etiqueta: string;
  valor: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

const RADIO = 60;
const GROSOR = 26;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/**
 * Torta (donut): tasa de aceptación de ofertas del cadete — verde los aceptados, rojo
 * los rechazados, ámbar los que se le vencieron y se reasignaron a otro cadete.
 */
@Component({
  selector: 'app-tasa-aceptacion-chart',
  template: `
    @if (total > 0) {
      <div class="flex items-center gap-6 flex-wrap">
        <svg viewBox="0 0 160 160" class="w-40 h-40 -rotate-90 shrink-0" role="img" aria-label="Tasa de aceptación de ofertas">
          <circle cx="80" cy="80" [attr.r]="radio" fill="none" stroke="#f3f4f6" [attr.stroke-width]="grosor" />
          @for (s of segmentos; track s.etiqueta) {
            <circle
              cx="80"
              cy="80"
              [attr.r]="radio"
              fill="none"
              [attr.stroke]="s.color"
              [attr.stroke-width]="grosor"
              [attr.stroke-dasharray]="s.dashArray"
              [attr.stroke-dashoffset]="s.dashOffset"
            >
              <title>{{ s.etiqueta }}: {{ s.valor }} ({{ porcentaje(s.valor) }}%)</title>
            </circle>
          }
          <text x="80" y="80" text-anchor="middle" dominant-baseline="middle" [attr.transform]="'rotate(90 80 80)'" font-size="22" font-weight="600" fill="#374151">
            {{ porcentaje(aceptados) }}%
          </text>
        </svg>
        <ul class="flex flex-col gap-1.5 text-sm">
          @for (s of segmentos; track s.etiqueta) {
            <li class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" [style.background]="s.color"></span>
              <span class="text-gray-600">{{ s.etiqueta }}</span>
              <span class="font-medium text-gray-700">{{ s.valor }}</span>
              <span class="text-xs text-gray-400">({{ porcentaje(s.valor) }}%)</span>
            </li>
          }
        </ul>
      </div>
    } @else {
      <p class="text-xs text-gray-400 text-center py-8">Sin ofertas en este rango.</p>
    }
  `,
})
export class TasaAceptacionChartComponent implements OnChanges {
  @Input() aceptados = 0;
  @Input() rechazados = 0;
  @Input() noAceptados = 0;

  readonly radio = RADIO;
  readonly grosor = GROSOR;
  total = 0;
  segmentos: Segmento[] = [];

  ngOnChanges(): void {
    const base = [
      { etiqueta: 'Aceptados', valor: this.aceptados, color: '#059669' },
      { etiqueta: 'Rechazados', valor: this.rechazados, color: '#dc2626' },
      { etiqueta: 'Reasignados (no a tiempo)', valor: this.noAceptados, color: '#d97706' },
    ];
    this.total = base.reduce((acc, s) => acc + s.valor, 0);
    if (this.total === 0) {
      this.segmentos = [];
      return;
    }

    let acumulado = 0;
    this.segmentos = base
      .filter((s) => s.valor > 0)
      .map((s) => {
        const largo = (s.valor / this.total) * CIRCUNFERENCIA;
        const seg: Segmento = {
          etiqueta: s.etiqueta,
          valor: s.valor,
          color: s.color,
          dashArray: `${largo} ${CIRCUNFERENCIA - largo}`,
          dashOffset: -acumulado,
        };
        acumulado += largo;
        return seg;
      });
  }

  porcentaje(valor: number): number {
    return this.total > 0 ? Math.round((valor / this.total) * 100) : 0;
  }
}
