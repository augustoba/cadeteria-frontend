import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClienteService } from '../../core/services/cliente.service';
import { ClienteFicha } from '../../core/models/cliente.model';

const ESTADO_CLASES: Record<string, string> = {
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-red-100 text-red-700',
};

@Component({
  selector: 'app-cliente-ficha',
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h1 class="font-semibold text-gray-700">Ficha de cliente — {{ telefono }}</h1>
        <div class="flex gap-2">
          <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="clientes.saving()" (click)="guardar()">
            💾 Guardar
          </button>
          <a routerLink="/clientes" class="btn bg-red-500 hover:bg-red-600">↩ Volver</a>
        </div>
      </div>

      @if (!ficha()) {
        <p class="text-gray-400 text-sm py-6 text-center">Cargando…</p>
      } @else {
        <div class="p-4 flex flex-col gap-5">
          @if (guardado()) {
            <div class="rounded bg-emerald-50 text-emerald-700 text-sm px-3 py-2">Guardado.</div>
          }

          <div class="grid sm:grid-cols-3 gap-4">
            <div class="bg-gray-50 rounded px-3 py-2">
              <div class="text-xs text-gray-400">Pedidos totales</div>
              <div class="text-lg font-semibold text-gray-700">{{ ficha()!.cliente.cantidadPedidos }}</div>
            </div>
            <div class="bg-gray-50 rounded px-3 py-2">
              <div class="text-xs text-gray-400">Monto acumulado</div>
              <div class="text-lg font-semibold text-gray-700">$ {{ ficha()!.cliente.montoTotal | number: '1.0-0' }}</div>
            </div>
            <div class="bg-gray-50 rounded px-3 py-2">
              <div class="text-xs text-gray-400">Último pedido</div>
              <div class="text-lg font-semibold text-gray-700">
                {{ ficha()!.cliente.ultimoPedidoEn ? (ficha()!.cliente.ultimoPedidoEn | date: 'short') : '—' }}
              </div>
            </div>
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Nombre de contacto</span>
              <input class="input" [(ngModel)]="nombreContacto" name="nombreContacto" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Empresa</span>
              <input class="input" [(ngModel)]="empresa" name="empresa" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Tarifa especial</span>
              <input
                type="number"
                min="0"
                step="0.01"
                class="input"
                [(ngModel)]="tarifaEspecial"
                name="tarifaEspecial"
                placeholder="Sin tarifa especial"
              />
            </label>
            <label class="flex items-center gap-2 pt-6">
              <input type="checkbox" [(ngModel)]="activo" name="activo" />
              <span class="text-sm text-gray-700">Cliente activo</span>
            </label>
          </div>

          <div class="border-t border-gray-200 pt-4 flex flex-col gap-3">
            <label class="flex flex-col gap-1 max-w-xs">
              <span class="text-sm font-medium text-gray-700">Facturación</span>
              <select class="input" [(ngModel)]="modalidadFacturacion" name="modalidadFacturacion">
                <option value="CONTADO">Contado (paga cada viaje)</option>
                <option value="CUENTA_CORRIENTE">Cuenta corriente (factura a fin de mes)</option>
              </select>
            </label>
            @if (modalidadFacturacion === 'CUENTA_CORRIENTE') {
              <div class="bg-amber-50 border border-amber-200 rounded p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div class="text-xs text-gray-500">Saldo pendiente de liquidar</div>
                  <div class="text-lg font-semibold text-gray-700">$ {{ ficha()!.cliente.saldoPendiente | number: '1.0-0' }}</div>
                </div>
                <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" (click)="liquidar()">
                  ✔ Liquidar cuenta corriente
                </button>
              </div>
            }
          </div>

          <div class="border-t border-gray-200 pt-4 flex flex-col gap-3">
            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="problematico" name="problematico" />
              <span class="text-sm font-medium text-gray-700">Marcar como cliente problemático</span>
            </label>
            @if (problematico) {
              <label class="flex flex-col gap-1 max-w-lg">
                <span class="text-sm font-medium text-gray-700">Notas (motivo)</span>
                <textarea class="input" rows="2" [(ngModel)]="notasProblematico" name="notasProblematico" placeholder="Ej: no atiende, canceló varias veces"></textarea>
              </label>
            }
            <p class="text-xs text-gray-400 -mt-1">
              Aparece como aviso al cargar un pedido nuevo con este teléfono.
            </p>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Historial de pedidos</h2>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="text-left text-gray-500 border-b border-gray-200">
                  <th class="py-2 pr-3 font-medium">Nº</th>
                  <th class="py-2 pr-3 font-medium">Fecha</th>
                  <th class="py-2 pr-3 font-medium">Precio</th>
                  <th class="py-2 pr-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (p of ficha()!.pedidosRecientes; track p.id) {
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-3 whitespace-nowrap">#{{ p.numero }}</td>
                    <td class="py-2 pr-3 whitespace-nowrap">{{ p.creadoEn | date: 'short' }}</td>
                    <td class="py-2 pr-3 whitespace-nowrap">$ {{ p.precio | number: '1.0-0' }}</td>
                    <td class="py-2 pr-3 whitespace-nowrap">
                      <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="claseEstado(p.estadoId)">
                        {{ p.estadoId }}
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="py-6 text-center text-gray-400">Sin pedidos todavía.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
      }
      .input:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-brand-400);
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
        display: inline-block;
      }
      .btn:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class ClienteFichaComponent implements OnInit {
  readonly clientes = inject(ClienteService);
  private readonly route = inject(ActivatedRoute);

  telefono = '';
  readonly ficha = signal<ClienteFicha | null>(null);
  readonly guardado = signal(false);

  nombreContacto = '';
  empresa = '';
  tarifaEspecial: number | null = null;
  problematico = false;
  notasProblematico = '';
  activo = true;
  modalidadFacturacion: 'CONTADO' | 'CUENTA_CORRIENTE' = 'CONTADO';

  ngOnInit(): void {
    this.telefono = this.route.snapshot.paramMap.get('telefono') ?? '';
    this.cargar();
  }

  private cargar(): void {
    this.clientes.ficha(this.telefono).subscribe((f) => {
      this.ficha.set(f);
      this.nombreContacto = f.cliente.nombreContacto ?? '';
      this.empresa = f.cliente.empresa ?? '';
      this.tarifaEspecial = f.cliente.tarifaEspecial;
      this.problematico = f.cliente.problematico;
      this.notasProblematico = f.cliente.notasProblematico ?? '';
      this.activo = f.cliente.activo;
      this.modalidadFacturacion = f.cliente.modalidadFacturacion;
    });
  }

  liquidar(): void {
    this.clientes.liquidarCuentaCorriente(this.telefono, () => this.cargar());
  }

  claseEstado(estadoId: string): string {
    return ESTADO_CLASES[estadoId] ?? 'bg-gray-100 text-gray-600';
  }

  guardar(): void {
    this.guardado.set(false);
    this.clientes.guardar(
      this.telefono,
      {
        nombreContacto: this.nombreContacto || null,
        empresa: this.empresa || null,
        tarifaEspecial: this.tarifaEspecial,
        problematico: this.problematico,
        notasProblematico: this.problematico ? this.notasProblematico || null : null,
        activo: this.activo,
        modalidadFacturacion: this.modalidadFacturacion,
      },
      () => {
        this.guardado.set(true);
        this.cargar();
      },
    );
  }
}
