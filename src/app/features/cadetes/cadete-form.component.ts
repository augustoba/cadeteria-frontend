import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CadeteService } from '../../core/services/cadete.service';
import { LookupService } from '../../core/services/lookup.service';
import { CadeteEstadoLog, CadeteInput, MovimientoCredito } from '../../core/models/cadete.model';
import { ImageUploadComponent } from '../../shared/image-upload.component';

@Component({
  selector: 'app-cadete-form',
  imports: [FormsModule, RouterLink, ImageUploadComponent, DatePipe, DecimalPipe],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h1 class="font-semibold text-gray-700">{{ editId ? 'Editar cadete' : 'Nuevo cadete' }}</h1>
        <div class="flex gap-2">
          <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="cadetes.saving()" (click)="guardar()">
            💾 Guardar
          </button>
          <a routerLink="/cadetes" class="btn bg-red-500 hover:bg-red-600">↩ Volver</a>
        </div>
      </div>

      <div class="p-4 flex flex-col gap-4">
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
        </div>

        <div class="grid sm:grid-cols-3 gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Tipo de vehículo</span>
            <select class="input" [(ngModel)]="tipoVehiculoId" name="tipoVehiculoId">
              <option [ngValue]="null" disabled>Elegir…</option>
              @for (t of lookups.tiposVehiculo(); track t.id) {
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
            <span class="text-sm font-medium text-gray-700">Año</span>
            <input type="number" min="1970" [max]="anioMaximo" class="input" [(ngModel)]="vehiculoAnio" name="vehiculoAnio" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Color del vehículo</span>
            <input class="input" [(ngModel)]="vehiculoColor" name="vehiculoColor" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Patente</span>
            <input class="input" [(ngModel)]="vehiculoPatente" name="vehiculoPatente" />
          </label>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Usuario</span>
            <input class="input" [(ngModel)]="username" name="username" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Contraseña</span>
            <input
              type="password"
              class="input"
              [(ngModel)]="password"
              name="password"
              [placeholder]="editId ? 'Dejar vacío para no cambiar' : ''"
            />
          </label>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Monto máximo transportado</span>
            <input type="number" min="0" step="0.01" class="input" [(ngModel)]="montoMaximoTransportado" name="montoMaximoTransportado" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Máx. viajes simultáneos</span>
            <input type="number" min="1" step="1" class="input" [(ngModel)]="maxViajesSimultaneos" name="maxViajesSimultaneos" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Máx. viajes por día</span>
            <input type="number" min="1" step="1" class="input" [(ngModel)]="maxViajesDiarios" name="maxViajesDiarios" placeholder="Sin tope" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Máx. viajes por semana</span>
            <input type="number" min="1" step="1" class="input" [(ngModel)]="maxViajesSemanales" name="maxViajesSemanales" placeholder="Sin tope" />
          </label>
        </div>

        <div class="grid sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Modelo de cobro</span>
            <select class="input" [(ngModel)]="modalidadPago" name="modalidadPago">
              <option value="SEMANAL">Semanal (cuota fija, se lo habilita a mano)</option>
              <option value="PORCENTAJE">Porcentaje (carga crédito, se descuenta por viaje)</option>
            </select>
          </label>
          <p class="col-span-2 text-xs text-gray-400 -mt-1">
            El pago semanal y el crédito por porcentaje se administran desde la lista de Cadetes, no acá.
          </p>
        </div>

        <div class="grid sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Turno — desde</span>
            <input type="time" class="input" [(ngModel)]="turnoInicio" name="turnoInicio" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Turno — hasta</span>
            <input type="time" class="input" [(ngModel)]="turnoFin" name="turnoFin" />
          </label>
          <p class="col-span-2 text-xs text-gray-400 -mt-1">
            Dejar los dos vacíos si el cadete no tiene turno fijo (queda disponible siempre para la sugerencia
            automática). Si carga ambos, solo se lo va a sugerir dentro de ese horario — funciona también si el
            turno cruza la medianoche (ej. 22:00 a 06:00).
          </p>
        </div>

        <div class="grid sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Foto del cadete</span>
            <app-image-upload [value]="fotoUrl" (valueChange)="fotoUrl = $event" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Foto del vehículo</span>
            <app-image-upload [value]="fotoVehiculoUrl" (valueChange)="fotoVehiculoUrl = $event" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Foto del carnet</span>
            <app-image-upload [value]="fotoCarnetUrl" (valueChange)="fotoCarnetUrl = $event" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Foto de la tarjeta verde</span>
            <app-image-upload [value]="fotoTarjetaVerdeUrl" (valueChange)="fotoTarjetaVerdeUrl = $event" />
          </div>
        </div>

        @if (editId && (cbu || aliasCbu)) {
          <div class="grid sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">CBU</span>
              <span class="text-sm text-gray-600">{{ cbu || '—' }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Alias</span>
              <span class="text-sm text-gray-600">{{ aliasCbu || '—' }}</span>
            </div>
            <p class="col-span-2 text-xs text-gray-400 -mt-1">
              Datos de cobro por transferencia — los carga el propio cadete desde la app, acá son de solo lectura.
            </p>
          </div>
        }

        <div class="border-t border-gray-200 pt-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Notas internas (solo las ve el admin)</span>
            <textarea class="input" rows="2" [(ngModel)]="notasInternas" name="notasInternas" placeholder="Ej: llega tarde seguido"></textarea>
          </label>
        </div>

        @if (editId && modalidadPago === 'PORCENTAJE') {
          <div class="border-t border-gray-200 pt-4 flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700">Historial de crédito</span>
            <div class="overflow-x-auto max-h-56 border border-gray-200 rounded">
              <table class="w-full text-sm border-collapse">
                <thead class="sticky top-0 bg-gray-50">
                  <tr class="text-left text-gray-500 border-b border-gray-200">
                    <th class="py-2 px-3 font-medium">Tipo</th>
                    <th class="py-2 px-3 font-medium">Monto</th>
                    <th class="py-2 px-3 font-medium">Saldo resultante</th>
                    <th class="py-2 px-3 font-medium">Pedido</th>
                    <th class="py-2 px-3 font-medium">Cuándo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of movimientosCredito(); track m.id) {
                    <tr class="border-b border-gray-100">
                      <td class="py-1.5 px-3">
                        {{ m.tipo === 'ACREDITACION' ? '💰 Acreditación' : m.tipo === 'COMISION' ? '➖ Comisión' : '↩ Reembolso' }}
                      </td>
                      <td class="py-1.5 px-3">$ {{ m.monto | number: '1.0-0' }}</td>
                      <td class="py-1.5 px-3">$ {{ m.saldoResultante | number: '1.0-0' }}</td>
                      <td class="py-1.5 px-3">{{ m.pedidoNumero ? '#' + m.pedidoNumero : '—' }}</td>
                      <td class="py-1.5 px-3 whitespace-nowrap">{{ m.creadoEn | date: 'short' }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="py-4 text-center text-gray-400">Todavía no hay movimientos.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        @if (editId && historialEstado().length > 0) {
          <div class="border-t border-gray-200 pt-4 flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700">Historial de altas/bajas</span>
            <div class="overflow-x-auto max-h-56 border border-gray-200 rounded">
              <table class="w-full text-sm border-collapse">
                <thead class="sticky top-0 bg-gray-50">
                  <tr class="text-left text-gray-500 border-b border-gray-200">
                    <th class="py-2 px-3 font-medium">Estado</th>
                    <th class="py-2 px-3 font-medium">Motivo</th>
                    <th class="py-2 px-3 font-medium">Cuándo</th>
                    <th class="py-2 px-3 font-medium">Quién</th>
                  </tr>
                </thead>
                <tbody>
                  @for (h of historialEstado(); track h.id) {
                    <tr class="border-b border-gray-100">
                      <td class="py-1.5 px-3">
                        <span
                          class="px-1.5 py-0.5 rounded text-xs font-medium"
                          [class]="h.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                        >
                          {{ h.activo ? 'Reactivado' : 'Dado de baja' }}
                        </span>
                      </td>
                      <td class="py-1.5 px-3">{{ h.motivo || '—' }}</td>
                      <td class="py-1.5 px-3 whitespace-nowrap">{{ h.cambiadoEn | date: 'short' }}</td>
                      <td class="py-1.5 px-3">{{ h.cambiadoPorUsername || '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
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
      textarea.input {
        font-family: inherit;
        resize: vertical;
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
export class CadeteFormComponent implements OnInit {
  readonly cadetes = inject(CadeteService);
  readonly lookups = inject(LookupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  editId: string | null = null;

  nombre = '';
  apellido = '';
  dni = '';
  telefono = '';
  tipoVehiculoId: string | null = null;
  vehiculoColor = '';
  vehiculoPatente = '';
  vehiculoMarca = '';
  vehiculoModelo = '';
  vehiculoAnio: number | null = null;
  readonly anioMaximo = new Date().getFullYear() + 1;
  username = '';
  password = '';
  montoMaximoTransportado: number | null = null;
  maxViajesSimultaneos: number | null = null;
  maxViajesDiarios: number | null = null;
  maxViajesSemanales: number | null = null;
  modalidadPago: 'SEMANAL' | 'PORCENTAJE' = 'SEMANAL';
  turnoInicio = '';
  turnoFin = '';

  fotoUrl: string | null = null;
  fotoVehiculoUrl: string | null = null;
  fotoCarnetUrl: string | null = null;
  fotoTarjetaVerdeUrl: string | null = null;
  cbu: string | null = null;
  aliasCbu: string | null = null;
  notasInternas = '';

  readonly movimientosCredito = signal<MovimientoCredito[]>([]);
  readonly historialEstado = signal<CadeteEstadoLog[]>([]);

  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.lookups.ensureLoaded();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = id;
      this.cadetes.get(id).subscribe((c) => {
        this.nombre = c.nombre;
        this.apellido = c.apellido;
        this.dni = c.dni;
        this.telefono = c.telefono;
        this.tipoVehiculoId = c.tipoVehiculo.id;
        this.vehiculoColor = c.vehiculoColor ?? '';
        this.vehiculoPatente = c.vehiculoPatente ?? '';
        this.vehiculoMarca = c.vehiculoMarca ?? '';
        this.vehiculoModelo = c.vehiculoModelo ?? '';
        this.vehiculoAnio = c.vehiculoAnio;
        this.username = c.username;
        this.montoMaximoTransportado = c.montoMaximoTransportado;
        this.maxViajesSimultaneos = c.maxViajesSimultaneos;
        this.maxViajesDiarios = c.maxViajesDiarios;
        this.maxViajesSemanales = c.maxViajesSemanales;
        this.modalidadPago = c.modalidadPago;
        this.turnoInicio = c.turnoInicio ? c.turnoInicio.slice(0, 5) : '';
        this.turnoFin = c.turnoFin ? c.turnoFin.slice(0, 5) : '';
        this.fotoUrl = c.fotoUrl;
        this.fotoVehiculoUrl = c.fotoVehiculoUrl;
        this.fotoCarnetUrl = c.fotoCarnetUrl;
        this.fotoTarjetaVerdeUrl = c.fotoTarjetaVerdeUrl;
        this.cbu = c.cbu;
        this.aliasCbu = c.aliasCbu;
        this.notasInternas = c.notasInternas ?? '';
      });
      this.cadetes.historialEstado(id).subscribe((h) => this.historialEstado.set(h));
      this.cadetes.historialCredito(id).subscribe((m) => this.movimientosCredito.set(m));
    }
  }

  guardar(): void {
    this.error.set(null);

    if (!this.nombre || !this.apellido || !this.dni || !this.telefono) {
      this.error.set('Completá nombre, apellido, DNI y teléfono.');
      return;
    }
    if (!this.tipoVehiculoId) {
      this.error.set('Elegí el tipo de vehículo.');
      return;
    }
    if (!this.username) {
      this.error.set('Completá el usuario.');
      return;
    }
    if (!this.editId && !this.password) {
      this.error.set('Completá la contraseña.');
      return;
    }

    const input: CadeteInput = {
      nombre: this.nombre,
      apellido: this.apellido,
      dni: this.dni,
      telefono: this.telefono,
      fotoUrl: this.fotoUrl,
      tipoVehiculoId: this.tipoVehiculoId,
      vehiculoColor: this.vehiculoColor || null,
      vehiculoPatente: this.vehiculoPatente || null,
      vehiculoMarca: this.vehiculoMarca || null,
      vehiculoModelo: this.vehiculoModelo || null,
      vehiculoAnio: this.vehiculoAnio,
      fotoVehiculoUrl: this.fotoVehiculoUrl,
      fotoCarnetUrl: this.fotoCarnetUrl,
      fotoTarjetaVerdeUrl: this.fotoTarjetaVerdeUrl,
      username: this.username,
      password: this.password || null,
      montoMaximoTransportado: this.montoMaximoTransportado,
      maxViajesSimultaneos: this.maxViajesSimultaneos,
      maxViajesDiarios: this.maxViajesDiarios,
      maxViajesSemanales: this.maxViajesSemanales,
      modalidadPago: this.modalidadPago,
      turnoInicio: this.turnoInicio || null,
      turnoFin: this.turnoFin || null,
      notasInternas: this.notasInternas || null,
    };

    const onSuccess = () => this.router.navigateByUrl('/cadetes');
    if (this.editId) {
      this.cadetes.actualizar(this.editId, input, onSuccess);
    } else {
      this.cadetes.crear(input, onSuccess);
    }
  }
}
