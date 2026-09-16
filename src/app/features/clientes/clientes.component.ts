import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ClienteService } from '../../core/services/cliente.service';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

@Component({
  selector: 'app-clientes',
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Clientes</h1>
      </div>

      <div class="px-4 py-2 border-b border-gray-200 flex items-center justify-between gap-3">
        <input
          type="search"
          class="input w-full sm:w-80"
          placeholder="Buscar por nombre, empresa o teléfono…"
          [ngModel]="busqueda()"
          (ngModelChange)="onBusquedaChange($event)"
          name="busqueda"
        />
        <p class="text-xs text-gray-400 whitespace-nowrap hidden sm:block">
          Se arma con los teléfonos usados en pedidos — para agregar datos de un cliente que todavía no pidió nada,
          buscá su teléfono igual y completá la ficha.
        </p>
      </div>

      <div class="p-4 overflow-x-auto">
        @if (clientes.loading()) {
          <app-loading-skeleton [filas]="6" />
        } @else {
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-200">
                <th class="py-2 pr-3 font-medium">Cliente</th>
                <th class="py-2 pr-3 font-medium">Empresa</th>
                <th class="py-2 pr-3 font-medium">Teléfono</th>
                <th class="py-2 pr-3 font-medium">Pedidos</th>
                <th class="py-2 pr-3 font-medium">Monto total</th>
                <th class="py-2 pr-3 font-medium">Último pedido</th>
                <th class="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              @for (c of clientes.clientes(); track c.telefono) {
                <tr class="border-b border-gray-100 hover:bg-gray-50" [class.opacity-50]="!c.activo">
                  <td class="py-2 pr-3 whitespace-nowrap">
                    {{ c.nombreContacto || '(sin nombre)' }}
                    @if (c.problematico) {
                      <span title="{{ c.notasProblematico || 'Marcado como problemático' }}">⚠️</span>
                    }
                  </td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.empresa || '—' }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.telefono }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.cantidadPedidos }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">$ {{ c.montoTotal | number: '1.0-0' }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.ultimoPedidoEn ? (c.ultimoPedidoEn | date: 'short') : '—' }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    <a [routerLink]="['/clientes', c.telefono]" class="btn-mini bg-brand-600 hover:bg-brand-700">Ver ficha</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <app-empty-state icono="👤" mensaje="Todavía no hay clientes." hint="Aparecen solos acá apenas cargues el primer pedido." />
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (clientes.total() > 0) {
            <div class="flex items-center justify-between pt-3 text-xs text-gray-500">
              <span>{{ clientes.total() }} cliente(s) — página {{ clientes.pagina() + 1 }} de {{ clientes.totalPaginas() }}</span>
              <div class="flex gap-1.5">
                <button
                  type="button"
                  class="btn-mini bg-gray-500 hover:bg-gray-600"
                  [disabled]="clientes.pagina() <= 0"
                  (click)="clientes.irAPagina(clientes.pagina() - 1)"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  class="btn-mini bg-gray-500 hover:bg-gray-600"
                  [disabled]="clientes.pagina() + 1 >= clientes.totalPaginas()"
                  (click)="clientes.irAPagina(clientes.pagina() + 1)"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          }
        }
      </div>
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
      .btn-mini {
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 0.3rem;
        display: inline-block;
      }
      .btn-mini:disabled {
        opacity: 0.5;
      }
    `,
  ],
})
export class ClientesComponent implements OnInit {
  readonly clientes = inject(ClienteService);

  readonly busqueda = signal('');
  private readonly busqueda$ = new Subject<string>();

  constructor() {
    this.busqueda$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((q) => this.clientes.buscar(q));
  }

  ngOnInit(): void {
    this.clientes.buscar();
  }

  onBusquedaChange(valor: string): void {
    this.busqueda.set(valor);
    this.busqueda$.next(valor);
  }
}
