import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SolicitudPedidoPublicoService } from '../../core/services/solicitud-pedido-publico.service';
import { SolicitudPedidoInput } from '../../core/models/solicitud-pedido.model';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { VerificacionTelefonoService } from '../../core/services/verificacion-telefono.service';
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

        @if (disponible() === null) {
          <p class="text-gray-400 text-sm py-6 text-center">Cargando…</p>
        } @else if (!disponible()) {
          <div class="p-6 flex flex-col items-center gap-3 text-center">
            <span class="text-4xl">⏸</span>
            <p class="text-gray-700 font-medium">No estamos tomando pedidos en este momento.</p>
            <p class="text-sm text-gray-500">{{ mensajeNoDisponible() }}</p>
          </div>
        } @else if (enviado()) {
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
              <app-address-picker [modoPublico]="true" (addressPicked)="onOrigenPicked($event)" />
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Lugar de destino</span>
              <app-address-picker [modoPublico]="true" (addressPicked)="onDestinoPicked($event)" />
            </div>

            @if (cotizando()) {
              <p class="text-xs text-gray-400">Calculando un estimado…</p>
            } @else if (precioEstimado() != null) {
              <div class="rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2">
                💰 Estimado: <strong>$ {{ precioEstimado() }}</strong>
                <span class="text-xs block text-emerald-700/80 mt-0.5">Puede variar — te lo confirmamos antes de salir.</span>
              </div>
            }

            <label class="flex items-center gap-2">
              <input type="checkbox" [ngModel]="llevaDinero" (ngModelChange)="onLlevaDineroChange($event)" name="llevaDinero" />
              <span class="text-sm text-gray-700">¿Lleva dinero?</span>
            </label>
            @if (llevaDinero) {
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">¿Cuánto?</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  class="input"
                  [ngModel]="montoDeclarado"
                  (ngModelChange)="onMontoDeclaradoChange($event)"
                  name="montoDeclarado"
                />
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
                <input
                  class="input"
                  [ngModel]="clienteTelefono"
                  (ngModelChange)="onTelefonoChange($event)"
                  name="clienteTelefono"
                  placeholder="Teléfono"
                  [disabled]="verificandoCodigo()"
                />
              </label>
            </div>

            @if (!telefonoVerificado()) {
              <div class="rounded bg-gray-50 border border-gray-200 px-3 py-2 flex flex-col gap-2">
                @if (!codigoEnviado()) {
                  <p class="text-xs text-gray-500">Antes de enviar el pedido, confirmamos que ese teléfono es real.</p>
                  <button
                    type="button"
                    class="self-start bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded"
                    [disabled]="!clienteTelefono.trim() || enviandoCodigo()"
                    (click)="enviarCodigo()"
                  >
                    {{ enviandoCodigo() ? 'Enviando…' : '📲 Enviar código por SMS' }}
                  </button>
                } @else {
                  <p class="text-xs text-gray-500">Te mandamos un código por SMS a {{ clienteTelefono }} — vence en 10 minutos.</p>
                  <div class="flex gap-2">
                    <input class="input flex-1" [(ngModel)]="codigoInput" name="codigoInput" placeholder="Código de 6 dígitos" maxlength="6" />
                    <button
                      type="button"
                      class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded"
                      [disabled]="verificandoCodigo()"
                      (click)="verificarCodigo()"
                    >
                      {{ verificandoCodigo() ? 'Verificando…' : 'Verificar' }}
                    </button>
                  </div>
                  <button type="button" class="text-xs text-brand-600 hover:underline self-start" (click)="enviarCodigo()">
                    Reenviar código
                  </button>
                }
                @if (errorVerificacion()) {
                  <p class="text-xs text-red-600">{{ errorVerificacion() }}</p>
                }
              </div>
            } @else {
              <div class="rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2">
                ✅ Teléfono verificado
              </div>
            }

            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Detalle (opcional)</span>
              <textarea class="input" rows="2" [(ngModel)]="detalle" name="detalle" placeholder="Algo que tengamos que saber…"></textarea>
            </label>

            <button
              type="button"
              class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-3 rounded"
              [disabled]="enviando() || !telefonoVerificado()"
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
  private readonly cotizacion = inject(CotizacionService);
  private readonly verificacionTelefono = inject(VerificacionTelefonoService);

  /** null = todavía no se sabe (cargando). */
  readonly disponible = signal<boolean | null>(null);
  readonly mensajeNoDisponible = signal<string>('Volvé a intentar más tarde.');

  constructor() {
    this.svc.estado().subscribe({
      next: (r) => {
        this.disponible.set(r.disponible);
        if (r.mensaje) this.mensajeNoDisponible.set(r.mensaje);
      },
      error: () => this.disponible.set(true), // si falla la consulta, no le bloqueamos el pedido a nadie por un error nuestro
    });
  }

  origenPicked: PickedAddress | null = null;
  destinoPicked: PickedAddress | null = null;
  llevaDinero = false;
  montoDeclarado: number | null = null;
  private debounceMontoDeclarado: ReturnType<typeof setTimeout> | undefined;

  /** Debounce simple — sin esto, cada dígito tipeado en "¿Cuánto?" dispara un pedido de cotización aparte. */
  onMontoDeclaradoChange(valor: number | null): void {
    this.montoDeclarado = valor;
    clearTimeout(this.debounceMontoDeclarado);
    this.debounceMontoDeclarado = setTimeout(() => this.actualizarEstimado(), 500);
  }
  retornaAlOrigen = false;
  clienteNombre = '';
  clienteTelefono = '';
  detalle = '';
  codigoInput = '';

  readonly enviando = signal(false);
  readonly enviado = signal(false);
  readonly error = signal<string | null>(null);
  readonly cotizando = signal(false);
  readonly precioEstimado = signal<number | null>(null);

  readonly codigoEnviado = signal(false);
  readonly enviandoCodigo = signal(false);
  readonly verificandoCodigo = signal(false);
  readonly telefonoVerificado = signal(false);
  readonly errorVerificacion = signal<string | null>(null);
  private verificacionToken: string | null = null;

  /** Si cambia el teléfono después de haberlo verificado, hay que verificarlo de nuevo. */
  onTelefonoChange(valor: string): void {
    this.clienteTelefono = valor;
    this.telefonoVerificado.set(false);
    this.codigoEnviado.set(false);
    this.verificacionToken = null;
    this.errorVerificacion.set(null);
  }

  enviarCodigo(): void {
    if (!this.clienteTelefono.trim()) return;
    this.errorVerificacion.set(null);
    this.enviandoCodigo.set(true);
    this.verificacionTelefono.enviarCodigo(this.clienteTelefono.trim()).subscribe({
      next: () => {
        this.enviandoCodigo.set(false);
        this.codigoEnviado.set(true);
      },
      error: (e) => {
        this.enviandoCodigo.set(false);
        this.errorVerificacion.set(e?.error?.message ?? 'No se pudo mandar el código — probá de nuevo.');
      },
    });
  }

  verificarCodigo(): void {
    if (!this.codigoInput.trim()) return;
    this.errorVerificacion.set(null);
    this.verificandoCodigo.set(true);
    this.verificacionTelefono.verificarCodigo(this.clienteTelefono.trim(), this.codigoInput.trim()).subscribe({
      next: (r) => {
        this.verificandoCodigo.set(false);
        this.verificacionToken = r.token;
        this.telefonoVerificado.set(true);
      },
      error: (e) => {
        this.verificandoCodigo.set(false);
        this.errorVerificacion.set(e?.error?.message ?? 'Código incorrecto.');
      },
    });
  }

  onOrigenPicked(p: PickedAddress | null): void {
    this.origenPicked = p;
    this.actualizarEstimado();
  }

  onDestinoPicked(p: PickedAddress | null): void {
    this.destinoPicked = p;
    this.actualizarEstimado();
  }

  onLlevaDineroChange(valor: boolean): void {
    this.llevaDinero = valor;
    this.actualizarEstimado();
  }

  /**
   * Solo un estimado para el cliente (mejora 2026-09-16) — no crea ni ata nada, la
   * solicitud igual queda pendiente de revisión del admin. Se recalcula también al
   * tocar "¿Lleva dinero?"/el monto, no solo al elegir origen/destino — si no, el
   * estimado quedaría desactualizado porque esos campos aparecen después en el formulario.
   */
  private actualizarEstimado(): void {
    if (!this.origenPicked || !this.destinoPicked) {
      this.precioEstimado.set(null);
      return;
    }
    this.cotizando.set(true);
    const montoDeclarado = this.llevaDinero ? this.montoDeclarado : null;
    this.cotizacion
      .cotizar(this.origenPicked.lat, this.origenPicked.lng, this.destinoPicked.lat, this.destinoPicked.lng, montoDeclarado)
      .subscribe({
        next: (c) => {
          this.cotizando.set(false);
          this.precioEstimado.set(c.precioSugerido);
        },
        error: () => {
          this.cotizando.set(false);
          this.precioEstimado.set(null);
        },
      });
  }

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
    if (!this.telefonoVerificado() || !this.verificacionToken) {
      this.error.set('Verificá el teléfono antes de enviar el pedido.');
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
      verificacionToken: this.verificacionToken,
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
