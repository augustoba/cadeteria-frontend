import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SolicitudPedidoPublicoService } from '../../core/services/solicitud-pedido-publico.service';
import { SolicitudPedidoInput } from '../../core/models/solicitud-pedido.model';
import { AddressPickerComponent, PickedAddress } from '../../shared/address-picker.component';

/**
 * Página pública "/pedir" (sin login) — el cliente carga su propio pedido en vez de
 * dictarlo por WhatsApp para que el admin lo tipee. Queda como una solicitud pendiente
 * de revisión, no como un pedido real todavía (eso lo confirma el admin).
 */
@Component({
  selector: 'app-pedir',
  imports: [FormsModule, AddressPickerComponent],
  template: `
    <div class="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-sm w-full max-w-md overflow-hidden">
        <div class="bg-brand-600 text-white px-5 py-4">
          <h1 class="font-semibold text-lg">Pedir un envío</h1>
          <p class="text-white/80 text-xs mt-0.5">Completá los datos y te confirmamos en breve.</p>
        </div>

        @if (enviado()) {
          <div class="p-6 flex flex-col items-center gap-3 text-center">
            <span class="text-4xl">✅</span>
            <p class="text-gray-700 font-medium">¡Listo! Recibimos tu pedido.</p>
            <p class="text-sm text-gray-500">En breve te confirmamos por SMS — si hace falta cotizar, te va a llegar un link para confirmarlo.</p>
          </div>
        } @else {
          <div class="p-5 flex flex-col gap-4">
            @if (error()) {
              <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
            }

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Lugar de origen</span>
              <app-address-picker (addressPicked)="origenPicked = $event" />
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Lugar de destino</span>
              <app-address-picker (addressPicked)="destinoPicked = $event" />
            </div>

            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="llevaDinero" name="llevaDinero" />
              <span class="text-sm text-gray-700">¿Lleva dinero?</span>
            </label>
            @if (llevaDinero) {
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">¿Cuánto?</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="montoDeclarado" name="montoDeclarado" />
              </label>
            }

            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="retornaAlOrigen" name="retornaAlOrigen" />
              <span class="text-sm text-gray-700">¿El cadete tiene que volver al origen?</span>
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">¿Por quién pregunta el cadete?</span>
                <input class="input" [(ngModel)]="clienteNombre" name="clienteNombre" placeholder="Nombre" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Teléfono de esa persona</span>
                <input class="input" [(ngModel)]="clienteTelefono" name="clienteTelefono" placeholder="Teléfono" />
              </label>
            </div>

            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Detalle (opcional)</span>
              <textarea class="input" rows="2" [(ngModel)]="detalle" name="detalle" placeholder="Algo que tengamos que saber…"></textarea>
            </label>

            <button
              type="button"
              class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-3 rounded"
              [disabled]="enviando()"
              (click)="enviar()"
            >
              {{ enviando() ? 'Enviando…' : 'Pedir envío' }}
            </button>
          </div>
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
    `,
  ],
})
export class PedirComponent {
  private readonly svc = inject(SolicitudPedidoPublicoService);

  origenPicked: PickedAddress | null = null;
  destinoPicked: PickedAddress | null = null;
  llevaDinero = false;
  montoDeclarado: number | null = null;
  retornaAlOrigen = false;
  clienteNombre = '';
  clienteTelefono = '';
  detalle = '';

  readonly enviando = signal(false);
  readonly enviado = signal(false);
  readonly error = signal<string | null>(null);

  enviar(): void {
    this.error.set(null);
    if (!this.origenPicked) {
      this.error.set('Buscá y marcá la dirección de origen.');
      return;
    }
    if (!this.destinoPicked) {
      this.error.set('Buscá y marcá la dirección de destino.');
      return;
    }
    if (!this.clienteNombre.trim() || !this.clienteTelefono.trim()) {
      this.error.set('Completá por quién pregunta el cadete y el teléfono.');
      return;
    }

    const input: SolicitudPedidoInput = {
      origenDireccion: this.origenPicked.address,
      origenLat: this.origenPicked.lat,
      origenLng: this.origenPicked.lng,
      destinoDireccion: this.destinoPicked.address,
      destinoLat: this.destinoPicked.lat,
      destinoLng: this.destinoPicked.lng,
      llevaDinero: this.llevaDinero,
      montoDeclarado: this.llevaDinero ? this.montoDeclarado : null,
      retornaAlOrigen: this.retornaAlOrigen,
      clienteNombre: this.clienteNombre.trim(),
      clienteTelefono: this.clienteTelefono.trim(),
      detalle: this.detalle.trim() || null,
    };

    this.enviando.set(true);
    this.svc.crear(input).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviado.set(true);
      },
      error: () => {
        this.enviando.set(false);
        this.error.set('No se pudo enviar el pedido — probá de nuevo.');
      },
    });
  }
}
