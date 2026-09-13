import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SolicitudPedidoPublicoService } from '../../core/services/solicitud-pedido-publico.service';
import { ConfirmacionPublica } from '../../core/models/solicitud-pedido.model';

/** Página pública "/confirmar-pedido/:token" — el cliente ve la cotización y confirma con un toque, sin llamar. */
@Component({
  selector: 'app-confirmar-pedido',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-sm w-full max-w-md overflow-hidden">
        <div class="bg-brand-600 text-white px-5 py-4">
          <h1 class="font-semibold text-lg">Confirmar pedido</h1>
        </div>

        @if (cargando()) {
          <p class="text-gray-500 text-sm py-10 text-center">Cargando…</p>
        } @else if (error()) {
          <p class="text-red-600 text-sm py-10 text-center px-4">{{ error() }}</p>
        } @else {
          @if (info(); as i) {
          <div class="p-5 flex flex-col gap-4">
            @if (i.estado === 'CONFIRMADA') {
              <div class="flex flex-col items-center gap-3 text-center py-4">
                <span class="text-4xl">✅</span>
                <p class="text-gray-700 font-medium">¡Pedido confirmado!</p>
                @if (i.tokenSeguimiento) {
                  <a [routerLink]="['/seguimiento', i.tokenSeguimiento]" class="text-brand-600 text-sm underline">
                    Ver el seguimiento de tu pedido
                  </a>
                }
              </div>
            } @else {
              <div class="text-sm flex flex-col gap-1">
                <div><span class="text-gray-500">Origen:</span> {{ i.origenDireccion }}</div>
                <div><span class="text-gray-500">Destino:</span> {{ i.destinoDireccion }}</div>
                <div class="font-semibold text-lg mt-1">$ {{ i.precio }}</div>
              </div>
              @if (errorConfirmar()) {
                <p class="text-red-600 text-xs">{{ errorConfirmar() }}</p>
              }
              <button
                type="button"
                class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-3 rounded"
                [disabled]="confirmando()"
                (click)="confirmar()"
              >
                {{ confirmando() ? 'Confirmando…' : '✔ Confirmar pedido' }}
              </button>
            }
          </div>
          }
        }
      </div>
    </div>
  `,
})
export class ConfirmarPedidoComponent implements OnInit {
  @Input() token = '';

  private readonly svc = inject(SolicitudPedidoPublicoService);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly info = signal<ConfirmacionPublica | null>(null);
  readonly confirmando = signal(false);
  readonly errorConfirmar = signal<string | null>(null);

  ngOnInit(): void {
    this.svc.verCotizacion(this.token).subscribe({
      next: (r) => {
        this.info.set(r);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No encontramos esta cotización.');
        this.cargando.set(false);
      },
    });
  }

  confirmar(): void {
    this.confirmando.set(true);
    this.errorConfirmar.set(null);
    this.svc.confirmar(this.token).subscribe({
      next: (r) => {
        this.confirmando.set(false);
        this.info.set(r);
      },
      error: () => {
        this.confirmando.set(false);
        this.errorConfirmar.set('No se pudo confirmar — probá de nuevo.');
      },
    });
  }
}
