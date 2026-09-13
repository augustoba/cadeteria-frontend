import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Lookup } from '../../core/models/lookup.model';
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
            <p class="text-emerald-600 font-semibold text-lg">¡Listo! Enviamos tu solicitud.</p>
            <p class="text-sm text-gray-600">
              La cadetería va a revisar tus datos. Si te aprueban, te va a llegar un mail a
              <strong>{{ email }}</strong> con tu usuario y una contraseña temporal para entrar a la app.
            </p>
          </div>
        } @else {
          <div class="p-5 flex flex-col gap-4">
            @if (error()) {
              <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
            }

            <div class="grid sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Nombre</span>
                <input class="input" [(ngModel)]="nombre" name="nombre" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Apellido</span>
                <input class="input" [(ngModel)]="apellido" name="apellido" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">DNI</span>
                <input class="input" [(ngModel)]="dni" name="dni" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Teléfono</span>
                <input class="input" [(ngModel)]="telefono" name="telefono" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Email</span>
                <input type="email" class="input" [(ngModel)]="email" name="email" placeholder="para mandarte tu usuario y contraseña" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Usuario que querés usar</span>
                <input class="input" [(ngModel)]="usernamePropuesto" name="usernamePropuesto" />
              </label>
            </div>

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
            </div>

            <div class="grid sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Tu foto</span>
                <app-image-upload [value]="fotoUrl" [credenciales]="cloudinaryCreds()" (valueChange)="fotoUrl = $event" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Foto del vehículo</span>
                <app-image-upload [value]="fotoVehiculoUrl" [credenciales]="cloudinaryCreds()" (valueChange)="fotoVehiculoUrl = $event" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Foto del carnet</span>
                <app-image-upload [value]="fotoCarnetUrl" [credenciales]="cloudinaryCreds()" (valueChange)="fotoCarnetUrl = $event" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Foto de la tarjeta verde</span>
                <app-image-upload
                  [value]="fotoTarjetaVerdeUrl"
                  [credenciales]="cloudinaryCreds()"
                  (valueChange)="fotoTarjetaVerdeUrl = $event"
                />
              </div>
            </div>

            <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700 self-end" [disabled]="enviando()" (click)="enviar()">
              {{ enviando() ? 'Enviando…' : 'Enviar formulario' }}
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

  readonly tiposVehiculo = signal<Lookup[]>([]);
  readonly cloudinaryCreds = signal<{ cloudName: string; uploadPreset: string } | undefined>(undefined);

  nombre = '';
  apellido = '';
  dni = '';
  telefono = '';
  email = '';
  usernamePropuesto = '';
  tipoVehiculoId: string | null = null;
  vehiculoColor = '';
  vehiculoPatente = '';
  vehiculoMarca = '';
  vehiculoModelo = '';
  fotoUrl: string | null = null;
  fotoVehiculoUrl: string | null = null;
  fotoCarnetUrl: string | null = null;
  fotoTarjetaVerdeUrl: string | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.service.validarToken(this.token).subscribe({
      next: (r) => {
        this.tokenValido.set(r.valido);
        this.motivoInvalido.set(r.motivo);
        this.cargando.set(false);
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
    if (!this.usernamePropuesto) {
      this.error.set('Elegí un usuario.');
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
        vehiculoColor: this.vehiculoColor || null,
        vehiculoPatente: this.vehiculoPatente || null,
        vehiculoMarca: this.vehiculoMarca || null,
        vehiculoModelo: this.vehiculoModelo || null,
        fotoUrl: this.fotoUrl,
        fotoVehiculoUrl: this.fotoVehiculoUrl,
        fotoCarnetUrl: this.fotoCarnetUrl,
        fotoTarjetaVerdeUrl: this.fotoTarjetaVerdeUrl,
        usernamePropuesto: this.usernamePropuesto,
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
