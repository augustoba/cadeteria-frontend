import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CadeteService } from '../../core/services/cadete.service';
import { PedidoService } from '../../core/services/pedido.service';

/** Hoja de ruta imprimible del día por cadete (ronda 4, punto 62) — respaldo en papel. */
@Component({
  selector: 'app-hoja-ruta',
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="hoja">
      <div class="encabezado">
        <div>
          <h1>Hoja de ruta</h1>
          <p class="subtitulo">{{ cadetes.nombreDe(cadeteId) }} — {{ hoy | date: 'fullDate' }}</p>
        </div>
        <button type="button" class="btn-imprimir no-print" (click)="imprimir()">🖨️ Imprimir</button>
      </div>

      @if (pedidos.loading()) {
        <p class="no-print">Cargando…</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Dinero</th>
              <th>Firma de recibido</th>
            </tr>
          </thead>
          <tbody>
            @for (p of pedidosDelCadete(); track p.id) {
              <tr>
                <td>#{{ p.numero }}</td>
                <td>{{ p.origenDireccion }}</td>
                <td>{{ p.destinoDireccion }}</td>
                <td>{{ p.clienteNombre }}</td>
                <td>{{ p.clienteTelefono }}</td>
                <td>$ {{ p.precio | number: '1.0-0' }}</td>
                <td class="firma"></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="vacio">Este cadete no tiene pedidos asignados ahora mismo.</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background: white;
        min-height: 100vh;
        padding: 24px;
        font-family: system-ui, sans-serif;
        color: #1f2937;
      }
      .hoja {
        max-width: 900px;
        margin: 0 auto;
      }
      .encabezado {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        border-bottom: 2px solid #1f2937;
        padding-bottom: 12px;
        margin-bottom: 16px;
      }
      h1 {
        font-size: 1.4rem;
        margin: 0;
      }
      .subtitulo {
        margin: 2px 0 0;
        color: #4b5563;
      }
      .btn-imprimir {
        color: white;
        background: #4f46e5;
        font-size: 0.875rem;
        font-weight: 600;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        border: none;
        cursor: pointer;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      th,
      td {
        border: 1px solid #9ca3af;
        padding: 8px;
        text-align: left;
      }
      th {
        background: #f3f4f6;
      }
      .firma {
        min-width: 120px;
      }
      .vacio {
        text-align: center;
        color: #9ca3af;
        padding: 24px;
      }
      @media print {
        .no-print {
          display: none !important;
        }
        :host {
          padding: 0;
        }
      }
    `,
  ],
})
export class HojaRutaComponent implements OnInit {
  readonly cadetes = inject(CadeteService);
  readonly pedidos = inject(PedidoService);
  private readonly route = inject(ActivatedRoute);

  cadeteId = '';
  readonly hoy = new Date();

  readonly pedidosDelCadete = computed(() =>
    this.pedidos.pedidos().filter((p) => p.cadeteAsignado?.id === this.cadeteId),
  );

  ngOnInit(): void {
    this.cadeteId = this.route.snapshot.paramMap.get('cadeteId') ?? '';
    this.cadetes.ensureLoaded();
    this.pedidos.cargar('activos');
  }

  imprimir(): void {
    window.print();
  }
}
