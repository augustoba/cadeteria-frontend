import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SolicitudCadeteService } from '../../core/services/solicitud-cadete.service';
import { SolicitudCadete } from '../../core/models/solicitud-cadete.model';
import { ToastService } from '../../core/services/toast.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { optimizarImagen } from '../../core/utils/imagen.util';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

const ESTADO_ETIQUETA: Record<string, string> = {
  PENDIENTE: 'Link sin completar',
  EN_REVISION: 'A revisar',
  A_CORREGIR: 'Esperando corrección',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

/** Lo que el admin puede marcar para corregir — mismas claves que SolicitudCadeteService.CAMPOS_REVISABLES. */
const DATOS_REVISABLES: Array<{ campo: string; etiqueta: string; valor: (s: SolicitudCadete) => string }> = [
  { campo: 'nombre', etiqueta: 'Nombre y apellido', valor: (s) => `${s.nombre ?? ''} ${s.apellido ?? ''}` },
  { campo: 'dni', etiqueta: 'DNI', valor: (s) => s.dni ?? '' },
  { campo: 'telefono', etiqueta: 'Teléfono', valor: (s) => s.telefono ?? '' },
  { campo: 'email', etiqueta: 'Email', valor: (s) => s.email ?? '' },
  {
    campo: 'vehiculo',
    etiqueta: 'Vehículo',
    valor: (s) =>
      [s.tipoVehiculo?.nombre, s.vehiculoMarca, s.vehiculoModelo, s.vehiculoColor, s.vehiculoPatente].filter((x) => !!x).join(' · '),
  },
];

const FOTOS_REVISABLES: Array<{ campo: keyof SolicitudCadete; etiqueta: string }> = [
  { campo: 'fotoUrl', etiqueta: 'Su foto' },
  { campo: 'fotoCarnetUrl', etiqueta: 'DNI frente' },
  { campo: 'fotoCarnetDorsoUrl', etiqueta: 'DNI dorso' },
  { campo: 'fotoVehiculoUrl', etiqueta: 'Vehículo' },
  { campo: 'fotoTarjetaVerdeUrl', etiqueta: 'Tarjeta verde frente' },
  { campo: 'fotoTarjetaVerdeDorsoUrl', etiqueta: 'Tarjeta verde dorso' },
];

const ESTADO_CLASES: Record<string, string> = {
  PENDIENTE: 'bg-gray-200 text-gray-600',
  EN_REVISION: 'bg-amber-100 text-amber-800',
  A_CORREGIR: 'bg-orange-100 text-orange-800',
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
          <span class="text-sm text-emerald-800">{{ textoLink() }}</span>
          <code class="text-xs bg-white border border-emerald-200 rounded px-2 py-1 break-all">{{ linkGenerado() }}</code>
          <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="copiarLink()">Copiar</button>
        </div>
      }

      <div class="px-4 py-2 border-b border-gray-200 flex gap-2 flex-wrap">
        <button type="button" class="btn-mini" [class]="filtroClase('')" (click)="filtrar(null)">Todas</button>
        <button type="button" class="btn-mini" [class]="filtroClase('EN_REVISION')" (click)="filtrar('EN_REVISION')">A revisar</button>
        <button type="button" class="btn-mini" [class]="filtroClase('A_CORREGIR')" (click)="filtrar('A_CORREGIR')">Esperando corrección</button>
        <button type="button" class="btn-mini" [class]="filtroClase('PENDIENTE')" (click)="filtrar('PENDIENTE')">Links sin completar</button>
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
                    {{ ESTADO_ETIQUETA[s.estado] || s.estado }}
                  </span>
                  @if (s.correcciones) {
                    <span class="text-xs text-gray-400 mr-2">corregida {{ s.correcciones }} {{ s.correcciones === 1 ? 'vez' : 'veces' }}</span>
                  }
                  <span class="font-medium text-gray-700">
                    {{ s.nombre ? s.nombre + ' ' + s.apellido : '(link sin completar todavía)' }}
                  </span>
                </div>
                <span class="text-xs text-gray-400">Creado {{ s.creadoEn | date: 'short' }}</span>
              </div>

              @if (s.mayorEdadDeclaradaEn) {
                <p class="text-xs text-gray-500">✔ Declaró ser mayor de 18 años el {{ s.mayorEdadDeclaradaEn | date: 'dd/MM/yyyy HH:mm' }}.</p>
              } @else if (s.estado === 'EN_REVISION') {
                <p class="text-xs text-amber-700">⚠ Esta solicitud es anterior a la declaración de mayoría de edad: verificalo con el DNI.</p>
              }
              @if (s.estado === 'EN_REVISION' || s.estado === 'A_CORREGIR') {
                <!-- ¿Ya estuvo registrado? (2026-09-25): alguien que vuelve tiene que verse, con el motivo de su baja. -->
                @if (s.cadeteExistente; as c) {
                  <div class="rounded border px-3 py-2 text-sm" [class]="c.activo ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'">
                    @if (c.activo) {
                      ⚠️ <strong>Ya hay un cadete ACTIVO con este DNI:</strong> {{ c.nombre }} {{ c.apellido }} (usuario {{ c.username }}).
                      No hace falta darlo de alta.
                    } @else {
                      ⚠️ <strong>Ya estuvo registrado:</strong> {{ c.nombre }} {{ c.apellido }} (usuario {{ c.username }}), dado de baja
                      @if (c.fechaUltimaBaja) {
                        el {{ c.fechaUltimaBaja | date: 'dd/MM/yyyy' }}
                      }
                      — motivo: <strong>{{ c.motivoUltimaBaja || 'sin motivo cargado' }}</strong>.
                      Si lo aprobás, se reactiva el mismo cadete con los datos nuevos (conserva su historial).
                    }
                    <a [routerLink]="['/cadetes', c.id, 'ficha']" [queryParams]="{ solapa: 'historial' }" class="font-semibold underline ml-1">
                      Ver ficha e historial →
                    </a>
                  </div>
                } @else {
                  <div class="rounded border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">
                    ✓ Este DNI nunca se registró como cadete.
                  </div>
                }
              }

              @if (s.estado === 'EN_REVISION') {
                <p class="text-xs text-gray-500">
                  Si algo está mal, tocá <strong>✕</strong> al lado del dato o de la foto y escribí el motivo: se le pide que lo corrija.
                </p>
                <div class="flex flex-col gap-1.5">
                  @for (d of DATOS_REVISABLES; track d.campo) {
                    <div class="flex items-start gap-2 text-sm">
                      <button
                        type="button"
                        class="marca"
                        [class.marca-activa]="marcado(s, d.campo)"
                        [title]="marcado(s, d.campo) ? 'Quitar la marca' : 'Marcar para corregir'"
                        (click)="alternarMarca(s, d.campo)"
                      >
                        ✕
                      </button>
                      <div class="flex-1 min-w-0">
                        <span class="text-gray-400 text-xs">{{ d.etiqueta }}:</span>
                        <span class="text-gray-700" [class.line-through]="marcado(s, d.campo)">{{ d.valor(s) || '—' }}</span>
                        @if (marcado(s, d.campo)) {
                          <input
                            class="input w-full mt-1"
                            placeholder="¿Qué tiene que corregir?"
                            [ngModel]="marcas[s.id][d.campo]"
                            (ngModelChange)="marcas[s.id][d.campo] = $event"
                            [name]="'motivo-' + s.id + '-' + d.campo"
                          />
                        }
                      </div>
                    </div>
                  }
                </div>
                <div class="flex gap-3 flex-wrap">
                  @for (f of fotosDe(s); track f.campo) {
                    <div class="flex flex-col gap-1 w-28">
                      <div class="relative">
                        <button type="button" (click)="lightbox.abrir(f.url)">
                          <img
                            [src]="optimizar(f.url, 200)"
                            class="w-28 h-24 object-cover rounded border"
                            [class.opacity-40]="marcado(s, f.campo)"
                            [alt]="f.etiqueta"
                          />
                        </button>
                        <button
                          type="button"
                          class="marca absolute top-1 right-1"
                          [class.marca-activa]="marcado(s, f.campo)"
                          [title]="marcado(s, f.campo) ? 'Quitar la marca' : 'Marcar para que la suba de nuevo'"
                          (click)="alternarMarca(s, f.campo)"
                        >
                          ✕
                        </button>
                      </div>
                      <span class="text-[11px] text-gray-500">{{ f.etiqueta }}</span>
                      @if (marcado(s, f.campo)) {
                        <input
                          class="input w-full"
                          placeholder="Motivo (ej: borrosa)"
                          [ngModel]="marcas[s.id][f.campo]"
                          (ngModelChange)="marcas[s.id][f.campo] = $event"
                          [name]="'motivo-' + s.id + '-' + f.campo"
                        />
                      }
                    </div>
                  }
                </div>
                <div class="flex items-end gap-2 flex-wrap border-t border-gray-100 pt-2">
                  @if (cantidadMarcas(s) > 0) {
                    <button type="button" class="btn-mini bg-orange-500 hover:bg-orange-600" (click)="pedirCorreccion(s)">
                      ✉ Pedir corrección ({{ cantidadMarcas(s) }})
                    </button>
                  } @else {
                    @if (!s.cadeteExistente) {
                      <label class="flex flex-col gap-1">
                        <span class="text-xs font-medium text-gray-700">Usuario</span>
                        <input
                          class="input"
                          [ngModel]="usernameActual(s)"
                          (ngModelChange)="usernameEditado[s.id] = $event"
                          [name]="'username-' + s.id"
                        />
                      </label>
                    }
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
                    @if (!s.cadeteExistente?.activo) {
                      <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="aprobar(s)">
                        {{ s.cadeteExistente ? '✔ Reactivar cadete' : '✔ Aprobar y dar de alta' }}
                      </button>
                    }
                  }
                  <button type="button" class="btn-mini bg-red-600 hover:bg-red-700" (click)="rechazar(s)">✕ Rechazar del todo</button>
                </div>
              }

              @if (s.estado === 'A_CORREGIR') {
                <div class="text-sm text-gray-600">
                  <p class="text-xs text-gray-500 mb-1">Se le pidió corregir (le llegó por mail a {{ s.email }}):</p>
                  <ul class="list-disc pl-5">
                    @for (o of s.observaciones; track o.campo) {
                      <li><strong>{{ o.etiqueta }}</strong>: {{ o.motivo }}</li>
                    }
                  </ul>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs text-gray-400">El link vence {{ s.expiraEn | date: 'short' }}.</span>
                  <button type="button" class="btn-mini bg-brand-600 hover:bg-brand-700" (click)="reenviarLink(s)">↻ Reenviar link</button>
                  <button type="button" class="btn-mini bg-red-600 hover:bg-red-700" (click)="rechazar(s)">✕ Rechazar del todo</button>
                </div>
              }

              @if (s.estado === 'RECHAZADA' && s.motivoRechazo) {
                <p class="text-xs text-gray-500">Motivo: {{ s.motivoRechazo }}</p>
              }
              @if (s.estado === 'APROBADA') {
                <p class="text-xs text-emerald-600">Usuario: {{ s.usernamePropuesto }} — cadete ya creado.</p>
              }
              @if (s.estado === 'PENDIENTE') {
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs text-gray-400">
                    {{ vencido(s) ? 'Venció el' : 'Vence' }} {{ s.expiraEn | date: 'short' }} si no lo completa antes.
                  </span>
                  <button type="button" class="btn-mini bg-brand-600 hover:bg-brand-700" (click)="reenviarLink(s)">
                    ↻ {{ vencido(s) ? 'Renovar link' : 'Volver a pasar el link' }}
                  </button>
                </div>
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
              <span class="text-sm font-medium text-gray-700">Motivo (opcional — le llega por mail)</span>
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
      .marca {
        width: 1.5rem;
        height: 1.5rem;
        flex-shrink: 0;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #9ca3af;
        background: white;
        border: 1px solid #d1d5db;
      }
      .marca:hover {
        color: #dc2626;
        border-color: #dc2626;
      }
      .marca-activa {
        color: white;
        background: #dc2626;
        border-color: #dc2626;
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
  readonly ESTADO_ETIQUETA = ESTADO_ETIQUETA;
  readonly DATOS_REVISABLES = DATOS_REVISABLES;
  /** solicitudId -> campo -> motivo. Un campo presente = marcado para corregir. */
  marcas: Record<string, Record<string, string>> = {};
  readonly textoLink = signal('Pasale este link al postulante:');
  /** Una función no es visible desde el template: se expone como propiedad (la miniatura pide w_120). */
  readonly optimizar = optimizarImagen;
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
      this.textoLink.set('Pasale este link al postulante:');
      this.linkGenerado.set(r.url);
      this.filtrar(null);
    });
  }

  copiarLink(): void {
    const url = this.linkGenerado();
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => this.toast.info('Link copiado.'));
  }

  fotosDe(s: SolicitudCadete): Array<{ campo: string; etiqueta: string; url: string }> {
    return FOTOS_REVISABLES.filter((f) => !!s[f.campo]).map((f) => ({
      campo: f.campo,
      etiqueta: f.etiqueta,
      url: s[f.campo] as string,
    }));
  }

  marcado(s: SolicitudCadete, campo: string): boolean {
    return this.marcas[s.id]?.[campo] !== undefined;
  }

  alternarMarca(s: SolicitudCadete, campo: string): void {
    const m = (this.marcas[s.id] ??= {});
    if (m[campo] !== undefined) delete m[campo];
    else m[campo] = '';
  }

  cantidadMarcas(s: SolicitudCadete): number {
    return Object.keys(this.marcas[s.id] ?? {}).length;
  }

  pedirCorreccion(s: SolicitudCadete): void {
    const m = this.marcas[s.id] ?? {};
    const sinMotivo = Object.entries(m).filter(([, motivo]) => !motivo.trim());
    if (sinMotivo.length) {
      this.toast.error('Escribí el motivo de cada cosa marcada: es lo que le llega al postulante.');
      return;
    }
    this.service.pedirCorreccion(s.id, m, () => {
      delete this.marcas[s.id];
      this.toast.success(`Le pedimos a ${s.nombre} que corrija ${Object.keys(m).length === 1 ? 'eso' : 'esas cosas'} — le llega por mail.`);
      this.filtrar(this.filtroActual());
    });
  }

  vencido(s: SolicitudCadete): boolean {
    return new Date(s.expiraEn).getTime() < Date.now();
  }

  /** Renueva el link 7 días; si ya se le había pedido corregir, le vuelve a llegar el mail. */
  reenviarLink(s: SolicitudCadete): void {
    this.service.reenviarLink(s.id, (r) => {
      this.textoLink.set(
        r.mailEnviado
          ? `Le reenviamos el mail a ${s.email}. Por si no le llega, el link es:`
          : 'Link renovado por 7 días. Pasáselo por WhatsApp:',
      );
      this.linkGenerado.set(r.url);
      this.filtrar(this.filtroActual());
    });
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
