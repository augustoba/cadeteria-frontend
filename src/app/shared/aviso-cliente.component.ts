import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ClienteAviso } from '../core/models/cliente.model';

const TIPOS_REPORTE: Record<string, string> = {
  DEMORO: 'de demora',
  NO_DECLARO_VALORES: 'de valores no declarados',
  PEDIDO_FALSO: 'de pedido falso',
  OTRO: 'de otro tipo',
};

/**
 * Cartel ámbar con lo que se sabe de un teléfono (spec-antiabuso Fases 1 y 4): si está marcado
 * como problemático y el resumen de reportes de cadetes. Se usa al cargar un pedido y en la
 * bandeja de pedidos web. No muestra nada si no hay ni flag ni reportes.
 */
@Component({
  selector: 'app-aviso-cliente',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (aviso(); as a) {
      @if (a.problematico || a.cantidadReportes > 0) {
        <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 flex flex-col gap-0.5">
          @if (a.problematico) {
            <span>
              ⚠️ Este teléfono está marcado como cliente problemático{{ a.notasProblematico ? ': ' + a.notasProblematico : '' }}.
            </span>
          }
          @if (a.cantidadReportes > 0) {
            <span>
              🚩 Tiene {{ a.cantidadReportes }} {{ a.cantidadReportes === 1 ? 'reporte' : 'reportes' }} de cadetes:
              {{ resumenReportes() }}@if (a.ultimoReporteEn) { (último: {{ a.ultimoReporteEn | date: 'dd/MM/yyyy' }})}.
            </span>
          }
        </div>
      }
    }
  `,
})
export class AvisoClienteComponent {
  readonly aviso = input<ClienteAviso | null | undefined>(null);

  /** "2 de demora, 1 de valores no declarados" */
  readonly resumenReportes = computed(() => {
    const porTipo = this.aviso()?.reportesPorTipo ?? {};
    return Object.entries(porTipo)
      .map(([tipo, n]) => `${n} ${TIPOS_REPORTE[tipo] ?? tipo}`)
      .join(', ');
  });
}
