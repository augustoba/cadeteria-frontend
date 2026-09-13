import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SolicitudCadeteService } from '../../core/services/solicitud-cadete.service';
import { SolicitudCadete } from '../../core/models/solicitud-cadete.model';
import { ToastService } from '../../core/services/toast.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

const ESTADO_CLASES: Record<string, string> = {
  PENDIENTE: 'bg-gray-200 text-gray-600',
  EN_REVISION: 'bg-amber-100 text-amber-800',
  APROBADA: 'bg-emerald-100 text-emerald-700',
  RECHAZADA: 'bg-red-100 text-red-700',
};

/** Alta de cadete por link propio — lado admin: generar el link y revisar lo que llega (ronda 7). */
@Component({
  selector: 'app-solicitudes-cadete',
  imports: [DatePipe, FormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Solicitudes de alta de cadete</h1>
        <div class="flex gap-2">
          <button type="button" class="btn-action bg-emerald-600 hover:bg-emerald-700" (click)="generarLink()">
            🔗 Generar link
          </button>
          <a routerLink="/cadetes" class="btn-action bg-red-500 hover:bg-red-600">↩ Volver</a>
        </div>
      </div>

      @if (linkGenerado()) {
        <div class="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 flex-wrap">
          <span class="text-sm text-emerald-800">Pasale este link al postulante (sirve una sola vez):</span>
          <code class="text-xs bg-white border border-emerald-200 rounded px-2 py-1 break-all">{{ linkGenerado() }}</code>
          <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="copiarLink()">Copiar</button>
        </div>
      }

      <div class="px-4 py-2 border-b border-gray-200 flex gap-2">
        <button type="button" class="btn-mini" [class]="filtroClase('')" (click)="filtrar(null)">Todas</button>
        <button type="button" class="btn-mini" [class]="filtroClase('EN_REVISION')" (click)="filtrar('EN_REVISION')">A revisar</button>
        <button type="button" class="btn-mini" [class]="filtroClase('APROBADA')" (click)="filtrar('APROBADA')">Aprobadas</button>
        <button type="button" class="btn-mini" [class]="filtroClase('RECHAZADA')" (click)="filtrar('RECHAZADA')">Rechazadas</button>
      </div>

      <div class="p-4 flex flex-col gap-3">
        @if (service.loading()) {
          <app-loading-skeleton [filas]="4" />
        } @else {
          @for (s of service.solicitudes(); track s.id) {
            <div class="border border-gray-200 rounded p-3 flex flex-col gap-2">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="px-2 py-0.5 rounded text-xs font-medium mr-2" [class]="ESTADO_CLASES[s.estado]">
                    {{ s.estado }}
                  </span>
                  <span class="font-medium text-gray-700">
                    {{ s.nombre ? s.nombre + ' ' + s.apellido : '(link sin completar todavía)' }}
                  </span>
                </div>
                <span class="text-xs text-gray-400">Creado {{ s.creadoEn | date: 'short' }}</span>
              </div>

              @if (s.estado === 'EN_REVISION') {
                <div class="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>DNI: {{ s.dni }}</span>
                  <span>Teléfono: {{ s.telefono }}</span>
                  <span>Email: {{ s.email }}</span>
                  <span>Vehículo: {{ s.tipoVehiculo?.nombre }} {{ s.vehiculoMarca }} {{ s.vehiculoModelo }} ({{ s.vehiculoPatente }})</span>
                </div>
                @if (s.fotoUrl || s.fotoVehiculoUrl || s.fotoCarnetUrl || s.fotoTarjetaVerdeUrl) {
                  <div class="flex gap-2 flex-wrap">
                    @if (s.fotoUrl) {
                      <button type="button" (click)="lightbox.abrir(s.fotoUrl!)"><img [src]="s.fotoUrl" class="w-14 h-14 object-cover rounded border" /></button>
                    }
                    @if (s.fotoVehiculoUrl) {
                      <button type="button" (click)="lightbox.abrir(s.fotoVehiculoUrl!)"><img [src]="s.fotoVehiculoUrl" class="w-14 h-14 object-cover rounded border" /></button>
                    }
                    @if (s.fotoCarnetUrl) {
                      <button type="button" (click)="lightbox.abrir(s.fotoCarnetUrl!)"><img [src]="s.fotoCarnetUrl" class="w-14 h-14 object-cover rounded border" /></button>
                    }
                    @if (s.fotoTarjetaVerdeUrl) {
                      <button type="button" (click)="lightbox.abrir(s.fotoTarjetaVerdeUrl!)"><img [src]="s.fotoTarjetaVerdeUrl" class="w-14 h-14 object-cover rounded border" /></button>
                    }
                  </div>
                }
                <div class="flex items-end gap-2 flex-wrap border-t border-gray-100 pt-2">
                  <label class="flex flex-col gap-1">
                    <span class="text-xs font-medium text-gray-700">Usuario</span>
                    <input
                      class="input"
                      [ngModel]="usernameActual(s)"
                      (ngModelChange)="usernameEditado[s.id] = $event"
                      [name]="'username-' + s.id"
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs font-medium text-gray-700">Modelo de cobro</span>
                    <select
                      class="input"
                      [ngModel]="modalidadPagoActual(s)"
                      (ngModelChange)="modalidadPagoEditada[s.id] = $event"
                      [name]="'modalidadPago-' + s.id"
                    >
                      <option value="SEMANAL">Semanal (cuota fija)</option>
                      <option value="PORCENTAJE">Porcentaje (crédito)</option>
                    </select>
                  </label>
                  <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="aprobar(s)">
                    ✔ Aprobar y dar de alta
                  </button>
                  <button type="button" class="btn-mini bg-red-600 hover:bg-red-700" (click)="rechazar(s)">✕ Rechazar</button>
                </div>
              }

              @if (s.estado === 'RECHAZADA' && s.motivoRechazo) {
                <p class="text-xs text-gray-500">Motivo: {{ s.motivoRechazo }}</p>
              }
              @if (s.estado === 'APROBADA') {
                <p class="text-xs text-emerald-600">Usuario: {{ s.usernamePropuesto }} — cadete ya creado.</p>
              }
              @if (s.estado === 'PENDIENTE') {
                <p class="text-xs text-gray-400">Vence {{ s.expiraEn | date: 'short' }} si no lo completa antes.</p>
              }
            </div>
          } @empty {
            <app-empty-state icono="📝" mensaje="Sin solicitudes todavía." hint="Generá un link y pasáselo al postulante para que se dé de alta solo." />
          }
        }
      </div>
    </div>

    @if (credencialesGeneradas(); as c) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarCredenciales()">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-emerald-600 text-white px-5 py-4">
            <h2 class="font-semibold">✔ {{ c.nombreCompleto }} dado de alta</h2>
          </div>
          <div class="p-5 flex flex-col gap-3 text-sm">
            <p class="text-gray-600">
              Le mandamos un mail con estos datos — si el mail todavía no está configurado, pasáselos vos a mano.
              Esta es la única vez que vas a poder ver la contraseña temporal, después queda solo el hash.
            </p>
            <div class="bg-gray-50 border border-gray-200 rounded p-3 flex flex-col gap-1.5">
              <div><span class="text-xs text-gray-400">Usuario</span><div class="font-mono font-medium text-gray-800">{{ c.username }}</div></div>
              <div><span class="text-xs text-gray-400">Contraseña temporal</span><div class="font-mono font-medium text-gray-800">{{ c.passwordTemporal }}</div></div>
            </div>
          </div>
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
            <button type="button" class="btn bg-brand-600 hover:bg-brand-700" (click)="copiarCredenciales(c)">
              {{ credencialesCopiadas() ? '✓ Copiado' : '📋 Copiar usuario y contraseña' }}
            </button>
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarCredenciales()">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (solicitudARechazar(); as s) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarRechazar()">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-red-600 text-white px-5 py-4">
            <h2 class="font-semibold">Rechazar solicitud</h2>
            <p class="text-red-50 text-sm">{{ s.nombre }} {{ s.apellido }}</p>
          </div>
          <div class="p-5 flex flex-col gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Motivo (opcional)</span>
              <textarea class="input" rows="3" [(ngModel)]="motivoRechazoModal" name="motivoRechazo"></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarRechazar()">Volver</button>
            <button type="button" class="btn bg-red-600 hover:bg-red-700" (click)="confirmarRechazar()">Rechazar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .btn-action {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.375rem 0.75rem;
        border-radius: 0.25rem;
      }
      .btn-mini {
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.35rem 0.75rem;
        border-radius: 0.3rem;
        display: inline-block;
        color: white;
      }
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.8125rem;
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
      }
    `,
  ],
})
export class SolicitudesCadeteComponent implements OnInit {
  readonly service = inject(SolicitudCadeteService);
  private readonly toast = inject(ToastService);
  readonly lightbox = inject(LightboxService);

  readonly ESTADO_CLASES = ESTADO_CLASES;
  readonly filtroActual = signal<string | null>('EN_REVISION');
  readonly linkGenerado = signal<string | null>(null);
  usernameEditado: Record<string, string> = {};
  modalidadPagoEditada: Record<string, 'SEMANAL' | 'PORCENTAJE'> = {};

  readonly credencialesGeneradas = signal<{ nombreCompleto: string; username: string; passwordTemporal: string } | null>(null);
  readonly credencialesCopiadas = signal(false);

  readonly solicitudARechazar = signal<SolicitudCadete | null>(null);
  motivoRechazoModal = '';

  ngOnInit(): void {
    this.service.listar(this.filtroActual() ?? undefined);
  }

  filtrar(estado: string | null): void {
    this.filtroActual.set(estado);
    this.service.listar(estado ?? undefined);
  }

  filtroClase(estado: string): string {
    const activo = (this.filtroActual() ?? '') === estado;
    return activo ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-300 hover:bg-gray-400 text-gray-700';
  }

  generarLink(): void {
    this.service.generarLink((r) => {
      this.linkGenerado.set(r.url);
      this.filtrar(null);
    });
  }

  copiarLink(): void {
    const url = this.linkGenerado();
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => this.toast.info('Link copiado.'));
  }

  usernameActual(s: SolicitudCadete): string {
    return this.usernameEditado[s.id] ?? s.usernamePropuesto ?? '';
  }

  modalidadPagoActual(s: SolicitudCadete): 'SEMANAL' | 'PORCENTAJE' {
    return this.modalidadPagoEditada[s.id] ?? 'SEMANAL';
  }

  aprobar(s: SolicitudCadete): void {
    const username = this.usernameActual(s).trim();
    if (!username) return;
    this.service.aprobar(s.id, username, this.modalidadPagoActual(s), (r) => {
      this.credencialesCopiadas.set(false);
      this.credencialesGeneradas.set({
        nombreCompleto: `${s.nombre} ${s.apellido}`,
        username: r.username,
        passwordTemporal: r.passwordTemporal,
      });
      this.filtrar(this.filtroActual());
    });
  }

  copiarCredenciales(c: { username: string; passwordTemporal: string }): void {
    navigator.clipboard?.writeText(`Usuario: ${c.username}\nContraseña temporal: ${c.passwordTemporal}`).then(() => {
      this.credencialesCopiadas.set(true);
    });
  }

  cerrarCredenciales(): void {
    this.credencialesGeneradas.set(null);
  }

  rechazar(s: SolicitudCadete): void {
    this.motivoRechazoModal = '';
    this.solicitudARechazar.set(s);
  }

  cerrarRechazar(): void {
    this.solicitudARechazar.set(null);
  }

  confirmarRechazar(): void {
    const s = this.solicitudARechazar();
    if (!s) return;
    const motivo = this.motivoRechazoModal.trim();
    this.service.rechazar(s.id, motivo || null, () => this.filtrar(this.filtroActual()));
    this.solicitudARechazar.set(null);
  }
}
