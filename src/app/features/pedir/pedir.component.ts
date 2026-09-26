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
    <div class="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center sm:p-4">
      <div class="bg-white sm:rounded-lg shadow-sm w-full max-w-md overflow-hidden min-h-screen sm:min-h-0">
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
          <div class="p-4 sm:p-5 flex flex-col gap-4">
            @if (error()) {
              <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
            }

            <!-- Primero el celular de quien pide (2026-09-24): es el contacto del pedido y el que se verifica. -->
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Tu número de celular <span class="text-red-600">*</span></span>
              <input
                class="input"
                [ngModel]="clienteTelefono"
                (ngModelChange)="onTelefonoChange($event)"
                name="clienteTelefono"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="Ej: 381 555 1234"
                [disabled]="verificandoCodigo()"
              />
            </label>
            <p class="text-xs text-gray-400 -mt-3">Es el número al que te contactamos por este envío.</p>

            @if (verificarTelefono() && !telefonoVerificado()) {
              <div class="rounded bg-gray-50 border border-gray-200 px-3 py-2 flex flex-col gap-2">
                @if (!codigoEnviado()) {
                  <p class="text-xs text-gray-500">Antes de enviar el pedido, confirmamos que ese teléfono es real.</p>
                  <button
                    type="button"
                    class="w-full sm:w-auto sm:self-start bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 sm:py-1.5 sm:text-xs rounded"
                    [disabled]="!clienteTelefono.trim() || enviandoCodigo()"
                    (click)="enviarCodigo()"
                  >
                    {{ enviandoCodigo() ? 'Enviando…' : '📲 Enviarme un código' }}
                  </button>
                } @else {
                  <p class="text-xs text-gray-500">
                    Te mandamos un código por {{ medioCodigo() }} a {{ clienteTelefono }} — vence en 10 minutos.
                  </p>
                  <div class="flex gap-2">
                    <input
                      class="input flex-1 min-w-0"
                      [(ngModel)]="codigoInput"
                      name="codigoInput"
                      placeholder="Código de 6 dígitos"
                      maxlength="6"
                      inputmode="numeric"
                      autocomplete="one-time-code"
                    />
                    <button
                      type="button"
                      class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm sm:text-xs font-medium px-4 py-2 sm:py-1.5 rounded"
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
            } @else if (verificarTelefono()) {
              @if (sinVerificar()) {
                <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
                  No pudimos mandarte el código ahora. Podés enviar el pedido igual: te vamos a contactar a ese
                  número para confirmarlo antes de salir.
                </div>
              } @else {
                <div class="rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2">
                  ✅ Teléfono verificado
                </div>
              }
            }


            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Lugar de origen</span>
              <app-address-picker (addressPicked)="onOrigenPicked($event)" />
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input class="input" [(ngModel)]="origenPiso" name="origenPiso" maxlength="20" placeholder="Piso" />
                <input class="input" [(ngModel)]="origenDepto" name="origenDepto" maxlength="20" placeholder="Depto" />
                <input
                  class="input col-span-2"
                  [(ngModel)]="origenObservaciones"
                  name="origenObservaciones"
                  maxlength="300"
                  placeholder="Observaciones (timbre, portón…)"
                />
              </div>
              <span class="text-xs text-gray-400">Opcionales.</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Lugar de destino</span>
              <app-address-picker (addressPicked)="onDestinoPicked($event)" />
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input class="input" [(ngModel)]="destinoPiso" name="destinoPiso" maxlength="20" placeholder="Piso" />
                <input class="input" [(ngModel)]="destinoDepto" name="destinoDepto" maxlength="20" placeholder="Depto" />
                <input
                  class="input col-span-2"
                  [(ngModel)]="destinoObservaciones"
                  name="destinoObservaciones"
                  maxlength="300"
                  placeholder="Observaciones (timbre, portón…)"
                />
              </div>
              <span class="text-xs text-gray-400">Opcionales.</span>
            </div>

            @if (cotizando()) {
              <p class="text-xs text-gray-400">Calculando un estimado…</p>
            } @else if (precioEstimado() != null) {
              <div class="rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2">
                💰 Precio del envío: <strong>$ {{ precioEstimado() }}</strong>
              </div>
            }

            <label class="check flex items-center gap-3">
              <input type="checkbox" [ngModel]="llevaDinero" (ngModelChange)="onLlevaDineroChange($event)" name="llevaDinero" />
              <span class="text-sm text-gray-700">¿Lleva dinero?</span>
            </label>
            @if (llevaDinero) {
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">¿Cuánto dinero? <span class="text-red-600">*</span></span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  class="input"
                  [ngModel]="montoDeclarado"
                  (ngModelChange)="onMontoDeclaradoChange($event)"
                  name="montoDeclarado"
                />
              </label>
            }

            <label class="check flex items-center gap-3">
              <input type="checkbox" [ngModel]="llevaValores" (ngModelChange)="onLlevaValoresChange($event)" name="llevaValores" />
              <span class="text-sm text-gray-700">¿Transporta objetos de valor?</span>
            </label>
            @if (llevaValores) {
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">¿Cuánto valen? <span class="text-red-600">*</span></span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  class="input"
                  [ngModel]="montoValores"
                  (ngModelChange)="onMontoValoresChange($event)"
                  name="montoValores"
                  placeholder="Valor aproximado en $"
                />
              </label>
            }

            <label class="check flex items-center gap-3">
              <input type="checkbox" [(ngModel)]="requiereMoto" name="requiereMoto" />
              <span class="text-sm text-gray-700">¿Necesitás que vaya en moto?</span>
            </label>

            <label class="check flex items-center gap-3">
              <input type="checkbox" [ngModel]="retornaAlOrigen" (ngModelChange)="onRetornaAlOrigenChange($event)" name="retornaAlOrigen" />
              <span class="text-sm text-gray-700">¿El cadete tiene que volver al origen?</span>
            </label>
            @if (retornaAlOrigen) {
              <p class="text-xs text-gray-500 -mt-3">Volver al origen tiene un recargo: ya está sumado en el precio de arriba.</p>
            }

            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">¿Por quién pregunta el cadete? <span class="text-red-600">*</span></span>
              <input class="input" [(ngModel)]="clienteNombre" name="clienteNombre" placeholder="Nombre" autocomplete="name" />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Detalle del pedido (opcional)</span>
              <textarea
                class="input"
                rows="2"
                [(ngModel)]="detalle"
                name="detalle"
                placeholder="Qué hay que llevar, cómo va embalado, algo que tengamos que saber…"
              ></textarea>
            </label>

            <button
              type="button"
              class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-3 rounded"
              [disabled]="enviando() || (verificarTelefono() && !telefonoVerificado())"
              (click)="enviar()"
            >
              {{ enviando() ? 'Enviando…' : 'Pedir envío' }}
            </button>
          </div>
        }
      </div>
    </div>

    @if (mostrarDisclaimer()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cancelarDisclaimer()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t">
            <h2 class="font-semibold">¿Confirmás el envío?</h2>
          </div>
          <div class="p-4 flex flex-col gap-2">
            <p class="text-sm text-gray-700">
              No declaraste que el envío lleve dinero ni objetos de valor.
              <strong>Si no se declaran dinero ni valores, la cadetería no se hace responsable por ellos.</strong>
            </p>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cancelarDisclaimer()">Cancelar</button>
            <button type="button" class="btn bg-brand-600 hover:bg-brand-700" (click)="confirmarEnvioSinDeclarar()">Aceptar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
      }
      /* Casillas más grandes y filas más altas: se tocan con el pulgar sin errarle. */
      .check {
        min-height: 2.25rem;
      }
      .check input[type='checkbox'] {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
      }
      /* Celular (spec: la mayoría pide desde el teléfono): 16px evita que iOS haga zoom al
         tocar un campo, y los campos un poco más altos se tocan mejor con el dedo. */
      @media (max-width: 639px) {
        .input {
          font-size: 16px;
          padding: 0.65rem 0.75rem;
        }
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
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
  /** Si hay que pedir el código antes de enviar — apagado por ahora desde Configuración (2026-09-24). */
  readonly verificarTelefono = signal(false);
  readonly mensajeNoDisponible = signal<string>('Volvé a intentar más tarde.');

  constructor() {
    this.svc.estado().subscribe({
      next: (r) => {
        this.disponible.set(r.disponible);
        this.verificarTelefono.set(r.verificarTelefono);
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
  llevaValores = false;
  montoValores: number | null = null;
  requiereMoto = false;
  retornaAlOrigen = false;
  origenPiso = '';
  origenDepto = '';
  origenObservaciones = '';
  destinoPiso = '';
  destinoDepto = '';
  destinoObservaciones = '';
  clienteNombre = '';
  clienteTelefono = '';
  detalle = '';
  codigoInput = '';

  readonly enviando = signal(false);
  readonly enviado = signal(false);
  readonly error = signal<string | null>(null);
  readonly cotizando = signal(false);
  readonly precioEstimado = signal<number | null>(null);
  readonly mostrarDisclaimer = signal(false);

  readonly codigoEnviado = signal(false);
  readonly enviandoCodigo = signal(false);
  readonly verificandoCodigo = signal(false);
  readonly telefonoVerificado = signal(false);
  /** No hubo forma de mandar el código (spec-antiabuso §6): se puede enviar igual, el admin lo confirma. */
  readonly sinVerificar = signal(false);
  readonly medioCodigo = signal<'WhatsApp' | 'SMS'>('SMS');
  readonly errorVerificacion = signal<string | null>(null);
  private verificacionToken: string | null = null;

  /** Si cambia el teléfono después de haberlo verificado, hay que verificarlo de nuevo. */
  onTelefonoChange(valor: string): void {
    this.clienteTelefono = valor;
    this.telefonoVerificado.set(false);
    this.sinVerificar.set(false);
    this.codigoEnviado.set(false);
    this.verificacionToken = null;
    this.errorVerificacion.set(null);
  }

  enviarCodigo(): void {
    if (!this.clienteTelefono.trim()) return;
    this.errorVerificacion.set(null);
    this.enviandoCodigo.set(true);
    this.verificacionTelefono.enviarCodigo(this.clienteTelefono.trim()).subscribe({
      next: (r) => {
        this.enviandoCodigo.set(false);
        if (r.token) {
          // YA_VALIDADO (ya confirmó este teléfono antes) o SIN_VERIFICAR (no hubo forma de mandar el código).
          this.verificacionToken = r.token;
          this.sinVerificar.set(r.resultado === 'SIN_VERIFICAR');
          this.telefonoVerificado.set(true);
          return;
        }
        this.medioCodigo.set(r.resultado === 'CODIGO_WHATSAPP' ? 'WhatsApp' : 'SMS');
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

  /** El valor de los objetos de valor suma recargo igual que el dinero (2026-09-25). */
  onLlevaValoresChange(valor: boolean): void {
    this.llevaValores = valor;
    this.actualizarEstimado();
  }

  onMontoValoresChange(valor: number | null): void {
    this.montoValores = valor;
    clearTimeout(this.debounceMontoDeclarado);
    this.debounceMontoDeclarado = setTimeout(() => this.actualizarEstimado(), 500);
  }

  onRetornaAlOrigenChange(valor: boolean): void {
    this.retornaAlOrigen = valor;
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
      .cotizar(
        this.origenPicked.lat,
        this.origenPicked.lng,
        this.destinoPicked.lat,
        this.destinoPicked.lng,
        montoDeclarado,
        this.retornaAlOrigen,
        this.llevaValores ? this.montoValores : null,
      )
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

  /** El error se muestra arriba del formulario y el botón está abajo: en el celular no se veía. */
  private fallar(mensaje: string): void {
    this.error.set(mensaje);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  enviar(): void {
    this.error.set(null);
    if (!this.origenPicked) {
      this.fallar('Buscá y marcá la dirección de origen.');
      return;
    }
    if (!this.destinoPicked) {
      this.fallar('Buscá y marcá la dirección de destino.');
      return;
    }
    // Mismas reglas que valida el backend (SolicitudPedidoService.validarDatosDelCliente).
    const digitos = this.clienteTelefono.replace(/\D/g, '');
    if (!digitos) {
      this.fallar('Completá tu número de celular.');
      return;
    }
    if (digitos.length < 10 || digitos.length > 13) {
      this.fallar('El celular tiene que tener la característica, ej: 381 555 1234.');
      return;
    }
    if (!this.clienteNombre.trim()) {
      this.fallar('Completá por quién pregunta el cadete.');
      return;
    }
    if (this.llevaDinero && !(Number(this.montoDeclarado) > 0)) {
      this.fallar('Marcaste que lleva dinero: indicá cuánto.');
      return;
    }
    if (this.llevaValores && !(Number(this.montoValores) > 0)) {
      this.fallar('Marcaste que transporta objetos de valor: indicá cuánto valen.');
      return;
    }
    if (this.verificarTelefono() && (!this.telefonoVerificado() || !this.verificacionToken)) {
      this.fallar('Verificá el teléfono antes de enviar el pedido.');
      return;
    }

    if (!this.llevaDinero && !this.llevaValores) {
      this.mostrarDisclaimer.set(true);
      return;
    }

    this.enviarPedido();
  }

  cancelarDisclaimer(): void {
    this.mostrarDisclaimer.set(false);
  }

  confirmarEnvioSinDeclarar(): void {
    this.mostrarDisclaimer.set(false);
    this.enviarPedido();
  }

  private enviarPedido(): void {
    const input: SolicitudPedidoInput = {
      origenDireccion: this.origenPicked!.address,
      origenLat: this.origenPicked!.lat,
      origenLng: this.origenPicked!.lng,
      destinoDireccion: this.destinoPicked!.address,
      destinoLat: this.destinoPicked!.lat,
      destinoLng: this.destinoPicked!.lng,
      llevaDinero: this.llevaDinero,
      montoDeclarado: this.llevaDinero ? this.montoDeclarado : null,
      llevaValores: this.llevaValores,
      montoValores: this.llevaValores ? this.montoValores : null,
      requiereMoto: this.requiereMoto,
      retornaAlOrigen: this.retornaAlOrigen,
      clienteNombre: this.clienteNombre.trim(),
      clienteTelefono: this.clienteTelefono.trim(),
      detalle: this.detalle.trim() || null,
      origenPiso: this.origenPiso.trim() || null,
      origenDepto: this.origenDepto.trim() || null,
      origenObservaciones: this.origenObservaciones.trim() || null,
      destinoPiso: this.destinoPiso.trim() || null,
      destinoDepto: this.destinoDepto.trim() || null,
      destinoObservaciones: this.destinoObservaciones.trim() || null,
      verificacionToken: this.verificacionToken,
      origenFuente: this.origenPicked!.fuente,
      destinoFuente: this.destinoPicked!.fuente,
    };

    this.enviando.set(true);
    this.svc.crear(input).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviado.set(true);
      },
      error: (e) => {
        this.enviando.set(false);
        this.fallar(e?.error?.message ?? 'No se pudo enviar el pedido — probá de nuevo.');
      },
    });
  }
}
