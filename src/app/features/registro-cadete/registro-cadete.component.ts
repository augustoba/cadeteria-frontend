import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Lookup } from '../../core/models/lookup.model';
import { CorreccionSolicitud, ObservacionSolicitud } from '../../core/models/solicitud-cadete.model';
import { SolicitudCadetePublicaService } from '../../core/services/solicitud-cadete.service';
import { ImageUploadComponent } from '../../shared/image-upload.component';

/** Formulario público de alta de cadete — link de un solo uso que le pasa el admin (ronda 7). */
@Component({
  selector: 'app-registro-cadete',
  imports: [FormsModule, ImageUploadComponent],
  template: `
    <div class="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-md w-full max-w-2xl">
        <div class="bg-brand-600 text-white px-5 py-4 rounded-t-lg flex items-center gap-3">
          <img src="/assets/logo.jpg" alt="Logo" class="w-10 h-10 rounded-full object-cover" />
          <div>
            <h1 class="font-semibold">Alta de cadete</h1>
            <p class="text-sm text-white/80">Completá tus datos para sumarte a la cadetería.</p>
          </div>
        </div>

        @if (cargando()) {
          <p class="text-gray-400 text-sm py-10 text-center">Cargando…</p>
        } @else if (!tokenValido()) {
          <div class="p-8 text-center">
            <p class="text-red-600 font-medium">{{ motivoInvalido() }}</p>
            <p class="text-sm text-gray-500 mt-2">Pedile un link nuevo a la cadetería.</p>
          </div>
        } @else if (enviado()) {
          <div class="p-8 text-center flex flex-col gap-2">
            <p class="text-emerald-600 font-semibold text-lg">
              {{ enCorreccion() ? '¡Listo! Enviamos tu corrección.' : '¡Listo! Enviamos tu solicitud.' }}
            </p>
            <p class="text-sm text-gray-600">
              La cadetería va a revisar tus datos. Si te aprueban, te va a llegar un mail a
              <strong>{{ email }}</strong> con tu usuario y una contraseña temporal para entrar a la app.
            </p>
          </div>
        } @else {
          <div class="p-5 flex flex-col gap-4">
            @if (enCorreccion()) {
              <div class="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                <p class="font-semibold">Revisamos tu solicitud y hay que corregir esto:</p>
                <ul class="list-disc pl-5 mt-1">
                  @for (o of observaciones(); track o.campo) {
                    <li><strong>{{ o.etiqueta }}</strong>: {{ o.motivo }}</li>
                  }
                </ul>
                <p class="text-xs mt-1">Lo demás ya está cargado. Las fotos marcadas tenés que subirlas de nuevo.</p>
              </div>
            }
            @if (error()) {
              <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
            }

            <div class="grid sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Nombre</span>
                <input class="input" [class.input-error]="obs('nombre')" [(ngModel)]="nombre" name="nombre" />
                @if (obs('nombre'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Apellido</span>
                <input class="input" [class.input-error]="obs('nombre')" [(ngModel)]="apellido" name="apellido" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">DNI</span>
                <input class="input" [class.input-error]="obs('dni')" [(ngModel)]="dni" name="dni" inputmode="numeric" placeholder="Ej: 30111222" />
                @if (obs('dni'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
                <span class="text-xs text-gray-400">Va a ser tu usuario para entrar a la app.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Teléfono</span>
                <input class="input" [class.input-error]="obs('telefono')" [(ngModel)]="telefono" name="telefono" />
                @if (obs('telefono'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Email</span>
                <input
                  type="email"
                  class="input"
                  [class.input-error]="obs('email')"
                  [(ngModel)]="email"
                  name="email"
                  placeholder="para mandarte tu usuario y contraseña"
                />
                @if (obs('email'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
              </label>
            </div>

            @if (obs('vehiculo'); as m) {
              <p class="text-xs text-red-600 -mb-2">⚠ Datos del vehículo: {{ m }}</p>
            }
            <div class="grid sm:grid-cols-3 gap-4 border-t border-gray-200 pt-4">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Tipo de vehículo</span>
                <select class="input" [(ngModel)]="tipoVehiculoId" name="tipoVehiculoId">
                  <option [ngValue]="null" disabled>Elegir…</option>
                  @for (t of tiposVehiculo(); track t.id) {
                    <option [ngValue]="t.id">{{ t.nombre }}</option>
                  }
                </select>
              </label>
              @if (esMoto()) {
                <label class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Marca</span>
                  <input class="input" [(ngModel)]="vehiculoMarca" name="vehiculoMarca" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Modelo</span>
                  <input class="input" [(ngModel)]="vehiculoModelo" name="vehiculoModelo" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Color</span>
                  <input class="input" [(ngModel)]="vehiculoColor" name="vehiculoColor" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Patente</span>
                  <input class="input" [(ngModel)]="vehiculoPatente" name="vehiculoPatente" />
                </label>
              }
            </div>

            <div class="grid sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Tu foto (de frente, sin gorra ni nada que te tape la cara)</span>
                <app-image-upload [value]="fotoUrl" [credenciales]="cloudinaryCreds()" (valueChange)="fotoUrl = $event" />
                @if (obs('fotoUrl'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
              </div>
              <div></div>
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">DNI — frente</span>
                <app-image-upload [value]="fotoCarnetUrl" [credenciales]="cloudinaryCreds()" (valueChange)="fotoCarnetUrl = $event" />
                @if (obs('fotoCarnetUrl'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">DNI — dorso</span>
                <app-image-upload [value]="fotoCarnetDorsoUrl" [credenciales]="cloudinaryCreds()" (valueChange)="fotoCarnetDorsoUrl = $event" />
                @if (obs('fotoCarnetDorsoUrl'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
              </div>
              @if (esMoto()) {
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Foto del vehículo (que se vea la patente)</span>
                  <app-image-upload [value]="fotoVehiculoUrl" [credenciales]="cloudinaryCreds()" (valueChange)="fotoVehiculoUrl = $event" />
                @if (obs('fotoVehiculoUrl'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
                </div>
                <div></div>
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Tarjeta verde — frente</span>
                  <app-image-upload
                    [value]="fotoTarjetaVerdeUrl"
                    [credenciales]="cloudinaryCreds()"
                    (valueChange)="fotoTarjetaVerdeUrl = $event"
                  />
                @if (obs('fotoTarjetaVerdeUrl'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Tarjeta verde — dorso</span>
                  <app-image-upload
                    [value]="fotoTarjetaVerdeDorsoUrl"
                    [credenciales]="cloudinaryCreds()"
                    (valueChange)="fotoTarjetaVerdeDorsoUrl = $event"
                  />
                @if (obs('fotoTarjetaVerdeDorsoUrl'); as m) {
                  <span class="text-xs text-red-600">⚠ {{ m }}</span>
                }
                </div>
              }
            </div>

            <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700 self-end" [disabled]="enviando()" (click)="enviar()">
              {{ enviando() ? 'Enviando…' : enCorreccion() ? 'Enviar corrección' : 'Enviar formulario' }}
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
      .input:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-brand-400);
      }
      .btn {
        color: white;
        font-size: 0.875rem;
        font-weight: 500;
        padding: 0.6rem 1.25rem;
        border-radius: 0.25rem;
      }
      .input-error {
        border-color: #dc2626;
        background: #fef2f2;
      }
      .btn:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class RegistroCadeteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(SolicitudCadetePublicaService);

  private token = '';

  readonly cargando = signal(true);
  readonly tokenValido = signal(false);
  readonly motivoInvalido = signal<string | null>(null);
  readonly enviado = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  /** El admin pidió corregir (2026-09-25): el formulario viene precargado y marca qué cambiar. */
  readonly observaciones = signal<ObservacionSolicitud[]>([]);
  enCorreccion(): boolean {
    return this.observaciones().length > 0;
  }
  /** Motivo si el admin marcó ese campo; null si está bien. */
  obs(campo: string): string | null {
    return this.observaciones().find((o) => o.campo === campo)?.motivo ?? null;
  }

  readonly tiposVehiculo = signal<Lookup[]>([]);
  readonly cloudinaryCreds = signal<{ cloudName: string; uploadPreset: string } | undefined>(undefined);

  nombre = '';
  apellido = '';
  dni = '';
  telefono = '';
  email = '';
  tipoVehiculoId: string | null = null;
  vehiculoColor = '';
  vehiculoPatente = '';
  vehiculoMarca = '';
  vehiculoModelo = '';
  fotoUrl: string | null = null;
  fotoVehiculoUrl: string | null = null;
  fotoCarnetUrl: string | null = null;
  fotoCarnetDorsoUrl: string | null = null;
  fotoTarjetaVerdeUrl: string | null = null;
  fotoTarjetaVerdeDorsoUrl: string | null = null;

  /** BICI no necesita marca/patente/foto de vehículo ni tarjeta verde — eso es de un motor. */
  esMoto(): boolean {
    return this.tipoVehiculoId === 'MOTO';
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.service.validarToken(this.token).subscribe({
      next: (r) => {
        this.tokenValido.set(r.valido);
        this.motivoInvalido.set(r.motivo);
        this.cargando.set(false);
        if (r.valido && r.correccion) this.precargar(r.correccion);
        if (r.valido) {
          this.service.tiposVehiculo().subscribe((t) => this.tiposVehiculo.set(t));
          this.service.cloudinaryConfig().subscribe((c) => this.cloudinaryCreds.set(c));
        }
      },
      error: () => {
        this.tokenValido.set(false);
        this.motivoInvalido.set('Este link no es válido.');
        this.cargando.set(false);
      },
    });
  }

  private precargar(c: CorreccionSolicitud): void {
    this.nombre = c.nombre ?? '';
    this.apellido = c.apellido ?? '';
    this.dni = c.dni ?? '';
    this.telefono = c.telefono ?? '';
    this.email = c.email ?? '';
    this.tipoVehiculoId = c.tipoVehiculoId;
    this.vehiculoColor = c.vehiculoColor ?? '';
    this.vehiculoPatente = c.vehiculoPatente ?? '';
    this.vehiculoMarca = c.vehiculoMarca ?? '';
    this.vehiculoModelo = c.vehiculoModelo ?? '';
    // las fotos marcadas vienen en null: hay que subirlas de nuevo
    this.fotoUrl = c.fotoUrl;
    this.fotoVehiculoUrl = c.fotoVehiculoUrl;
    this.fotoCarnetUrl = c.fotoCarnetUrl;
    this.fotoCarnetDorsoUrl = c.fotoCarnetDorsoUrl;
    this.fotoTarjetaVerdeUrl = c.fotoTarjetaVerdeUrl;
    this.fotoTarjetaVerdeDorsoUrl = c.fotoTarjetaVerdeDorsoUrl;
    this.observaciones.set(c.observaciones);
  }

  enviar(): void {
    this.error.set(null);
    if (!this.nombre || !this.apellido || !this.dni || !this.telefono || !this.email) {
      this.error.set('Completá nombre, apellido, DNI, teléfono y email.');
      return;
    }
    if (!this.tipoVehiculoId) {
      this.error.set('Elegí el tipo de vehículo.');
      return;
    }
    if (!/^[0-9]{6,8}$/.test(this.dni.replace(/[.\s]/g, ''))) {
      this.error.set('El DNI tiene que ser solo números, hasta 8 dígitos (ej: 30111222).');
      return;
    }
    if (!this.fotoUrl || !this.fotoCarnetUrl || !this.fotoCarnetDorsoUrl) {
      this.error.set('Faltan tu foto y/o las fotos de frente y dorso del DNI.');
      return;
    }
    if (this.esMoto() && (!this.fotoVehiculoUrl || !this.fotoTarjetaVerdeUrl || !this.fotoTarjetaVerdeDorsoUrl)) {
      this.error.set('Para moto faltan: foto del vehículo y las fotos de frente y dorso de la tarjeta verde.');
      return;
    }

    this.enviando.set(true);
    this.service
      .enviar(this.token, {
        nombre: this.nombre,
        apellido: this.apellido,
        dni: this.dni,
        telefono: this.telefono,
        email: this.email,
        tipoVehiculoId: this.tipoVehiculoId,
        vehiculoColor: this.esMoto() ? this.vehiculoColor || null : null,
        vehiculoPatente: this.esMoto() ? this.vehiculoPatente || null : null,
        vehiculoMarca: this.esMoto() ? this.vehiculoMarca || null : null,
        vehiculoModelo: this.esMoto() ? this.vehiculoModelo || null : null,
        fotoUrl: this.fotoUrl,
        fotoVehiculoUrl: this.esMoto() ? this.fotoVehiculoUrl : null,
        fotoCarnetUrl: this.fotoCarnetUrl,
        fotoCarnetDorsoUrl: this.fotoCarnetDorsoUrl,
        fotoTarjetaVerdeUrl: this.esMoto() ? this.fotoTarjetaVerdeUrl : null,
        fotoTarjetaVerdeDorsoUrl: this.esMoto() ? this.fotoTarjetaVerdeDorsoUrl : null,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.enviado.set(true);
        },
        error: (err) => {
          this.enviando.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo enviar el formulario.');
        },
      });
  }
}
