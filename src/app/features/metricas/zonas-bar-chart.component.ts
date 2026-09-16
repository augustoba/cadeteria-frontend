import { Component, Input, OnChanges } from '@angular/core';
import { ZonaMetrica } from '../../core/models/metricas.model';

interface Barra {
  zonaNombre: string;
  cantidad: number;
  anchoPct: number;
}

/** Barras horizontales: pedidos por zona en el rango, ordenadas de mayor a menor. */
@Component({
  selector: 'app-zonas-bar-chart',
  template: `
    @if (barras.length > 0) {
      <div class="flex flex-col gap-2">
        @for (b of barras; track b.zonaNombre) {
          <div class="flex items-center gap-2 text-sm">
            <span class="w-32 shrink-0 truncate text-gray-600" [title]="b.zonaNombre">{{ b.zonaNombre }}</span>
            <div class="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
              <div class="h-full bg-brand-500 rounded flex items-center justify-end px-1.5" [style.width.%]="b.anchoPct">
                @if (b.anchoPct > 15) {
                  <span class="text-[10px] text-white font-medium">{{ b.cantidad }}</span>
                }
              </div>
            </div>
            @if (b.anchoPct <= 15) {
              <span class="text-xs text-gray-500 w-6 text-right">{{ b.cantidad }}</span>
            }
          </div>
        }
      </div>
    } @else {
      <p class="text-xs text-gray-400 text-center py-8">Sin pedidos en este rango.</p>
    }
  `,
})
export class ZonasBarChartComponent implements OnChanges {
  @Input() datos: ZonaMetrica[] = [];

  barras: Barra[] = [];

  ngOnChanges(): void {
    const ordenado = [...this.datos]
      .filter((z) => z.cantidadPedidos > 0)
      .sort((a, b) => b.cantidadPedidos - a.cantidadPedidos);
    const max = Math.max(...ordenado.map((z) => z.cantidadPedidos), 0);
    this.barras = ordenado.map((z) => ({
      zonaNombre: z.zonaNombre,
      cantidad: z.cantidadPedidos,
      anchoPct: max > 0 ? (z.cantidadPedidos / max) * 100 : 0,
    }));
  }
}
