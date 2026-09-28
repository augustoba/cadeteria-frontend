import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';
import { FichaCadeteEnLugar, TEXTO_REGISTRO_EN_LUGAR, TipoRegistroEnLugar } from '../../core/models/en-el-lugar.model';

/**
 * Ficha del cadete → Desempeño: cuántas veces marcó Retirado/Entregado con "Estoy en el lugar" lejos del
 * punto, intentó con GPS falso, marcó con el GPS impreciso o le finalizaron un viaje desde el panel
 * (2026-09-28). Nadie aprueba nada: está para mirar si alguien abusa.
 */
@Component({
  selector: 'app-registros-en-el-lugar',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (datos(); as d) {
      <section class="border border-gray-200 rounded p-3">
        <h2 class="font-semibold text-gray-700 mb-2">
          Marcas en el lugar
          <span class="text-xs font-normal text-gray-400">(todo el historial)</span>
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div class="text-xl font-semibold" [class]="d.resumen.vecesFueraZona ? 'text-red-600' : 'text-gray-700'">
              {{ d.resumen.vecesFueraZona }}
            </div>
            <div class="text-xs text-gray-500">"Estoy en el lugar" lejos del punto</div>
          </div>
          <div>
            <div class="text-xl font-semibold" [class]="d.resumen.intentosUbicacionSimulada ? 'text-red-600' : 'text-gray-700'">
              {{ d.resumen.intentosUbicacionSimulada }}
            </div>
            <div class="text-xs text-gray-500">
              Intentos con GPS falso
              @if (d.resumen.ultimoIntentoUbicacionSimuladaEn) {
                <br />(último {{ d.resumen.ultimoIntentoUbicacionSimuladaEn | date: 'dd/MM HH:mm' }})
              }
            </div>
          </div>
          <div>
            <div class="text-xl font-semibold text-gray-700">{{ d.resumen.vecesImprecisa }}</div>
            <div class="text-xs text-gray-500">Con GPS impreciso</div>
          </div>
          <div>
            <div class="text-xl font-semibold text-gray-700">{{ d.resumen.vecesFinalizadoPorAdmin }}</div>
            <div class="text-xs text-gray-500">Finalizados por el admin</div>
          </div>
        </div>
        @if (d.ultimos.length) {
          <table class="w-full text-xs mt-3">
            <thead class="text-gray-400 text-left">
              <tr><th class="py-1">Pedido</th><th>Fecha</th><th>Qué pasó</th></tr>
            </thead>
            <tbody>
              @for (r of d.ultimos; track r.pedidoId) {
                <tr class="border-t border-gray-100 align-top">
                  <td class="py-1 pr-2">#{{ r.numero }}</td>
                  <td class="py-1 pr-2 whitespace-nowrap">{{ r.creadoEn | date: 'dd/MM HH:mm' }}</td>
                  <td class="py-1">
                    {{ textos(r.tipos) }}
                    @if (r.retiroDistanciaM != null && r.tipos.includes('RETIRO_FUERA_ZONA')) { · retiro a {{ r.retiroDistanciaM }} m }
                    @if (r.entregaDistanciaM != null && r.tipos.includes('ENTREGA_FUERA_ZONA')) { · entrega a {{ r.entregaDistanciaM }} m }
                    @if (r.finalizadoPorAdmin) {
                      <div class="text-gray-500">{{ r.finalizadoPorAdmin }}: {{ r.finalizadoAdminMotivo }}</div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="text-xs text-gray-400 mt-2">Sin marcas fuera de lo normal.</p>
        }
      </section>
    }
  `,
})
export class RegistrosEnElLugarComponent {
  private readonly http = inject(HttpClient);
  readonly cadeteId = input.required<string>();
  readonly datos = signal<FichaCadeteEnLugar | null>(null);

  constructor() {
    effect(() => {
      const id = this.cadeteId();
      if (!id) return;
      this.http
        .get<FichaCadeteEnLugar>(apiUrl(`/admin/cadetes/${id}/en-el-lugar`))
        .subscribe({ next: (d) => this.datos.set(d), error: () => this.datos.set(null) });
    });
  }

  textos(tipos: TipoRegistroEnLugar[]): string {
    return tipos.map((t) => TEXTO_REGISTRO_EN_LUGAR[t] ?? t).join(', ');
  }
}
