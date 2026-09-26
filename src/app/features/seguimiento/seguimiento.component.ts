import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SeguimientoService } from '../../core/services/seguimiento.service';
import { Seguimiento } from '../../core/models/seguimiento.model';
import { optimizarImagen } from '../../core/utils/imagen.util';
import { SeguimientoMapaComponent } from './seguimiento-mapa.component';

const ESTADO_TEXTO: Record<string, string> = {
  'Sin asignación': 'Estamos buscando un cadete para tu pedido.',
  Pendiente: 'Le ofrecimos tu pedido a un cadete, estamos esperando que confirme.',
  'En curso': 'Tu cadete está en camino.',
  Finalizado: 'Tu pedido fue entregado.',
  Cancelado: 'Este pedido fue cancelado.',
};

/**
 * Stepper de progreso (ronda 11, punto 117; rehecho 2026-09-25). El cliente recibe el link recién
 * cuando un cadete TOMA el pedido, así que no hay paso "cadete asignado" aparte:
 * Recibido → En camino (el cadete va a buscarlo) → Retirado (ya lo lleva) → Entregado.
 */
const PASOS_PROGRESO = ['Pedido recibido', 'En camino', 'Retirado', 'Entregado'];

/** Cuántos pasos del stepper ya se cumplieron — 0 = ninguno más que "recibido". */
function pasoActual(estado: string, retirado: boolean): number {
  switch (estado) {
    case 'En curso':
      return retirado ? 2 : 1;
    case 'Finalizado':
      return 3;
    default:
      return 0;
  }
}

/** Convierte la clave pública VAPID (base64url) al formato Uint8Array que pide PushManager.subscribe. */
function base64UrlAUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Página pública de seguimiento (sin login) — el link que llega por SMS al aceptar/finalizar el viaje. */
@Component({
  selector: 'app-seguimiento',
  imports: [FormsModule, SeguimientoMapaComponent],
  template: `
    <div class="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-sm w-full max-w-md overflow-hidden">
        <div class="bg-brand-600 text-white px-5 py-4">
          <h1 class="font-semibold text-lg">{{ nombreCadeteria() }}</h1>
          <p class="text-white/80 text-xs mt-0.5">Seguimiento de tu pedido</p>
        </div>

        @if (seguimiento(); as s) {
          <div class="p-5 flex flex-col gap-4">
            @if (s.estado !== 'Cancelado' && s.estado !== 'Finalizado' && pushDisponible() && !pushSuscripto()) {
              <button
                type="button"
                class="self-start bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded flex items-center gap-1.5"
                [disabled]="activandoPush()"
                (click)="activarNotificaciones()"
              >
                🔔 {{ activandoPush() ? 'Activando…' : 'Avisame acá cuando cambie de estado' }}
              </button>
            } @else if (pushSuscripto()) {
              <p class="text-xs text-emerald-600">🔔 Notificaciones activadas en este navegador.</p>
            }
            @if (errorPush()) {
              <p class="text-xs text-red-600">{{ errorPush() }}</p>
            }
            @if (s.estado !== 'Cancelado') {
              <div class="flex items-center">
                @for (paso of pasos; track paso; let i = $index; let last = $last) {
                  <div class="flex items-center" [class.flex-1]="!last">
                    <div class="flex flex-col items-center gap-1" style="width: 4.5rem">
                      <div
                        class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        [class]="i <= pasoActualDe(s.estado, s.retirado) ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-400'"
                      >
                        {{ i < pasoActualDe(s.estado, s.retirado) ? '✓' : i + 1 }}
                      </div>
                      <span
                        class="text-[10px] text-center leading-tight"
                        [class]="i <= pasoActualDe(s.estado, s.retirado) ? 'text-brand-700 font-medium' : 'text-gray-400'"
                      >
                        {{ paso }}
                      </span>
                    </div>
                    @if (!last) {
                      <div class="flex-1 h-0.5 -mt-4" [class]="i < pasoActualDe(s.estado, s.retirado) ? 'bg-brand-600' : 'bg-gray-200'"></div>
                    }
                  </div>
                }
              </div>
            }

            <div class="rounded bg-brand-50 text-brand-700 text-sm px-3 py-2">
              @if (s.estado === 'En curso') {
                {{ s.retirado ? 'El cadete ya retiró tu pedido y va hacia el destino.' : 'Un cadete tomó tu pedido y está en camino a buscarlo.' }}
              } @else {
                {{ estadoTexto(s.estado) }}
              }
              @if (s.etaMinutos != null) {
                <span class="font-semibold"> Llega en ~{{ s.etaMinutos }} min.</span>
              }
            </div>

            @if (s.cadeteLat != null && s.cadeteLng != null) {
              <div class="h-56 rounded overflow-hidden border border-gray-200">
                <app-seguimiento-mapa
                  [cadeteLat]="s.cadeteLat"
                  [cadeteLng]="s.cadeteLng"
                  [destinoLat]="s.destinoLat"
                  [destinoLng]="s.destinoLng"
                />
              </div>
            }

            <div class="text-sm flex flex-col gap-1">
              <div><span class="text-gray-500">Origen:</span> {{ s.origenDireccion }}</div>
              <div><span class="text-gray-500">Destino:</span> {{ s.destinoDireccion }}</div>
              <div><span class="text-gray-500">Precio:</span> $ {{ s.precio }}</div>
              @if (s.llevaDinero) {
                <div>💵 Declaraste llevar dinero{{ s.montoDeclarado ? ' ($' + s.montoDeclarado + ')' : '' }}.</div>
              }
              @if (s.llevaValores) {
                <div>💎 Declaraste transportar objetos de valor{{ s.montoValores ? ' ($' + s.montoValores + ')' : '' }}.</div>
              }
            </div>

            <!-- Desde que lo toma hasta que lo entrega (2026-09-25): quién es, con qué viene y cómo pagarle. -->
            @if (s.cadete) {
              <div class="border-t border-gray-200 pt-4 flex flex-col gap-3">
                <h2 class="text-sm font-medium text-gray-700">Tu cadete</h2>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col items-center gap-1">
                    @if (s.cadete.fotoUrl) {
                      <a [href]="s.cadete.fotoUrl" target="_blank" rel="noopener">
                        <img [src]="optimizar(s.cadete.fotoUrl, 400)" alt="Foto del cadete" class="w-28 h-28 rounded-full object-cover border border-gray-200" />
                      </a>
                    } @else {
                      <div class="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center text-4xl">🧑</div>
                    }
                    <span class="font-semibold text-gray-800 text-center">{{ s.cadete.nombre }} {{ s.cadete.apellido }}</span>
                    @if (s.cadete.dni) {
                      <span class="text-xs text-gray-500">DNI {{ s.cadete.dni }}</span>
                    }
                  </div>
                  <div class="flex flex-col items-center gap-1">
                    @if (s.cadete.fotoVehiculoUrl) {
                      <a [href]="s.cadete.fotoVehiculoUrl" target="_blank" rel="noopener">
                        <img [src]="optimizar(s.cadete.fotoVehiculoUrl, 400)" alt="Foto del vehículo" class="w-28 h-28 rounded object-cover border border-gray-200" />
                      </a>
                    } @else {
                      <div class="w-28 h-28 rounded bg-gray-100 flex items-center justify-center text-4xl">
                        {{ s.cadete.tipoVehiculo === 'Bici' ? '🚲' : '🏍️' }}
                      </div>
                    }
                    <span class="text-sm text-gray-600 text-center">
                      {{ s.cadete.tipoVehiculo }}{{ s.cadete.vehiculoColor ? ' ' + s.cadete.vehiculoColor : '' }}
                    </span>
                    @if (s.cadete.vehiculoPatente) {
                      <span class="font-mono text-sm font-semibold text-gray-800 border border-gray-300 rounded px-2">{{ s.cadete.vehiculoPatente }}</span>
                    }
                  </div>
                </div>

                <div class="rounded bg-gray-50 border border-gray-200 text-sm px-3 py-2 flex flex-col gap-1">
                  <span class="text-gray-700">
                    💵 {{ s.estado === 'Finalizado' ? 'Total del envío' : 'A pagar' }}: <strong>$ {{ s.precio }}</strong>
                    @if (s.estado !== 'Finalizado') {
                      <span class="text-gray-500"> — en efectivo{{ s.cadete.cbu || s.cadete.aliasCbu ? ' o por transferencia' : '' }}.</span>
                    }
                  </span>
                  @if (s.cadete.aliasCbu) {
                    <div class="flex items-center gap-2">
                      <span class="text-gray-500">Alias:</span>
                      <span class="font-mono font-medium text-gray-800 break-all">{{ s.cadete.aliasCbu }}</span>
                      <button type="button" class="btn-copiar" (click)="copiar(s.cadete.aliasCbu, 'alias')">
                        {{ copiado() === 'alias' ? '✓ Copiado' : 'Copiar' }}
                      </button>
                    </div>
                  }
                  @if (s.cadete.cbu) {
                    <div class="flex items-center gap-2">
                      <span class="text-gray-500">CBU:</span>
                      <span class="font-mono font-medium text-gray-800 break-all">{{ s.cadete.cbu }}</span>
                      <button type="button" class="btn-copiar" (click)="copiar(s.cadete.cbu, 'cbu')">
                        {{ copiado() === 'cbu' ? '✓ Copiado' : 'Copiar' }}
                      </button>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Desde "En camino" (2026-09-25): constancia de quién lleva el pedido; al entregar suma quién recibió. -->
            @if (s.comprobanteDisponible) {
              <button
                type="button"
                class="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 rounded"
                [disabled]="descargando()"
                (click)="descargarComprobante()"
              >
                {{ descargando() ? 'Generando…' : '⬇ Descargar comprobante' }}
              </button>
            }

            <!-- Fotos del viaje (2026-09-25): la del retiro desde que retiró; al entregar, también entrega y firma. -->
            @if (s.retiroFotoUrl || s.entregaFotoUrl || s.firmaUrl) {
              <div class="border-t border-gray-200 pt-4 flex flex-col gap-2">
                <h2 class="text-sm font-medium text-gray-700">Fotos del viaje</h2>
                <div class="grid grid-cols-2 gap-3">
                  @if (s.retiroFotoUrl) {
                    <a [href]="s.retiroFotoUrl" target="_blank" rel="noopener" class="flex flex-col gap-1">
                      <img [src]="optimizar(s.retiroFotoUrl, 800)" alt="Retiro" class="w-full h-32 object-cover rounded border border-gray-200 " />
                      <span class="text-xs text-gray-500 text-center">Retiro</span>
                    </a>
                  }
                  @if (s.entregaFotoUrl) {
                    <a [href]="s.entregaFotoUrl" target="_blank" rel="noopener" class="flex flex-col gap-1">
                      <img [src]="optimizar(s.entregaFotoUrl, 800)" alt="Entrega" class="w-full h-32 object-cover rounded border border-gray-200 " />
                      <span class="text-xs text-gray-500 text-center">Entrega</span>
                    </a>
                  }
                  @if (s.firmaUrl) {
                    <a [href]="s.firmaUrl" target="_blank" rel="noopener" class="flex flex-col gap-1">
                      <img [src]="optimizar(s.firmaUrl, 800)" alt="Firma de quien recibió" class="w-full h-32 object-cover rounded border border-gray-200 bg-white object-contain" />
                      <span class="text-xs text-gray-500 text-center">Firma de quien recibió</span>
                    </a>
                  }
                </div>
              </div>
            }

            @if (s.estado === 'Finalizado') {
              <div class="border-t border-gray-200 pt-4 flex flex-col gap-2 text-sm">
                <h2 class="font-medium text-gray-700">Entrega</h2>
                @if (s.entregaReceptorNombre) {
                  <div><span class="text-gray-500">Recibió:</span> {{ s.entregaReceptorNombre }}</div>
                }
              </div>

              <div class="border-t border-gray-200 pt-4 flex flex-col gap-2 text-sm">
                @if (s.puedeCalificar && !calificacionEnviada()) {
                  <h2 class="font-medium text-gray-700">¿Cómo estuvo tu pedido?</h2>
                  <div class="flex gap-1 text-2xl">
                    @for (n of [1, 2, 3, 4, 5]; track n) {
                      <button type="button" (click)="estrellas.set(n)" [attr.aria-label]="n + ' estrellas'">
                        {{ n <= estrellas() ? '⭐' : '☆' }}
                      </button>
                    }
                  </div>
                  <textarea
                    class="border border-gray-300 rounded px-3 py-2 text-sm"
                    rows="2"
                    placeholder="Dejanos una nota (opcional)"
                    [(ngModel)]="comentario"
                    name="comentario"
                  ></textarea>
                  @if (errorCalificacion()) {
                    <p class="text-red-600 text-xs">{{ errorCalificacion() }}</p>
                  }
                  <button
                    type="button"
                    class="self-start bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded"
                    [disabled]="estrellas() === 0 || enviandoCalificacion()"
                    (click)="enviarCalificacion()"
                  >
                    {{ enviandoCalificacion() ? 'Enviando…' : 'Enviar calificación' }}
                  </button>
                } @else if (s.calificacionEstrellas != null || calificacionEnviada()) {
                  <p class="text-emerald-700 text-sm">
                    ¡Gracias por tu calificación! {{ '⭐'.repeat(s.calificacionEstrellas ?? estrellas()) }}
                  </p>
                }
              </div>

              <button
                type="button"
                class="self-start bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded"
                [disabled]="repitiendo()"
                (click)="repetirPedido()"
              >
                {{ repitiendo() ? 'Creando pedido…' : '🔁 Repetir mi pedido' }}
              </button>
              @if (errorRepetir()) {
                <p class="text-red-600 text-xs">{{ errorRepetir() }}</p>
              }
            }
          </div>
        } @else if (cargando()) {
          <p class="text-gray-500 text-sm py-10 text-center">Cargando…</p>
        } @else {
          <p class="text-red-600 text-sm py-10 text-center px-4">{{ mensajeError() }}</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .btn-copiar {
        margin-left: auto;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.15rem 0.5rem;
        border-radius: 0.25rem;
        color: var(--color-brand-700);
        border: 1px solid var(--color-brand-200);
        background: white;
      }
    `,
  ],
})
export class SeguimientoComponent implements OnInit, OnChanges, OnDestroy {
  @Input() token = '';

  private readonly seguimientoSvc = inject(SeguimientoService);
  private readonly router = inject(Router);
  private intervaloActualizacion: ReturnType<typeof setInterval> | null = null;

  readonly cargando = signal(true);
  /** Qué dato se acaba de copiar ("alias" / "cbu"), para mostrar "✓ Copiado" un momento. */
  readonly copiado = signal<string | null>(null);

  copiar(texto: string, cual: string): void {
    navigator.clipboard?.writeText(texto).then(() => {
      this.copiado.set(cual);
      setTimeout(() => this.copiado.set(null), 2000);
    });
  }

  readonly error = signal(false);
  /** "No encontramos este pedido." o, pasadas las horas de Configuración, "Este link de seguimiento ya venció." */
  readonly mensajeError = signal('No encontramos este pedido.');
  readonly seguimiento = signal<Seguimiento | null>(null);
  readonly nombreCadeteria = signal('Cadetería');
  readonly descargando = signal(false);

  readonly pasos = PASOS_PROGRESO;
  readonly pasoActualDe = pasoActual;
  /** Una función no es visible desde el template: se expone como propiedad. */
  readonly optimizar = optimizarImagen;

  readonly estrellas = signal(0);
  comentario = '';
  readonly enviandoCalificacion = signal(false);
  readonly calificacionEnviada = signal(false);
  readonly errorCalificacion = signal<string | null>(null);

  readonly repitiendo = signal(false);
  readonly errorRepetir = signal<string | null>(null);

  readonly pushDisponible = signal(false);
  readonly pushSuscripto = signal(false);
  readonly activandoPush = signal(false);
  readonly errorPush = signal<string | null>(null);
  private vapidPublicKey: string | null = null;

  ngOnInit(): void {
    this.cargar();
    this.seguimientoSvc.marca().subscribe((m) => this.nombreCadeteria.set(m.nombreCadeteria));
    this.chequearPush();
    // Mientras el viaje está en curso, refresca la ubicación del cadete y el ETA solo (ronda 4, punto 12).
    this.intervaloActualizacion = setInterval(() => {
      if (this.seguimiento()?.estado === 'En curso') this.cargar();
    }, 20_000);
  }

  /** Angular reutiliza el componente al navegar de un token a otro (mismo route, mejora 87) — sin esto quedaría la data vieja. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['token'] && !changes['token'].firstChange) {
      this.cargando.set(true);
      this.seguimiento.set(null);
      this.calificacionEnviada.set(false);
      this.estrellas.set(0);
      this.comentario = '';
      this.cargar();
    }
  }

  ngOnDestroy(): void {
    if (this.intervaloActualizacion != null) clearInterval(this.intervaloActualizacion);
  }

  private cargar(): void {
    this.seguimientoSvc.obtener(this.token).subscribe({
      next: (s) => {
        this.seguimiento.set(s);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(true);
        this.cargando.set(false);
        // Link vencido (400) o inexistente (404): se deja de mostrar el pedido y de consultar. Un
        // corte de conexión no: el próximo intervalo vuelve a probar.
        if (e?.status === 400 || e?.status === 404) {
          if (e?.error?.message) this.mensajeError.set(e.error.message);
          this.seguimiento.set(null);
          if (this.intervaloActualizacion != null) clearInterval(this.intervaloActualizacion);
        }
      },
    });
  }

  estadoTexto(estado: string): string {
    return ESTADO_TEXTO[estado] ?? estado;
  }

  /** Mejora 89 — chequea soporte del navegador y si ya hay una suscripción activa de una visita anterior. */
  private chequearPush(): void {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    this.seguimientoSvc.vapidPublicKey().subscribe((r) => {
      if (!r.habilitado || !r.publicKey) return;
      this.vapidPublicKey = r.publicKey;
      this.pushDisponible.set(true);
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.pushManager.getSubscription().then((sub) => {
          if (sub) this.pushSuscripto.set(true);
        });
      });
    });
  }

  activarNotificaciones(): void {
    if (!this.vapidPublicKey) return;
    this.activandoPush.set(true);
    this.errorPush.set(null);
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlAUint8Array(this.vapidPublicKey!),
      }))
      .then((sub) => {
        const json = sub.toJSON();
        return firstValueFrom(
          this.seguimientoSvc.pushSubscribe(this.token, {
            endpoint: json.endpoint!,
            p256dh: json.keys!['p256dh'],
            auth: json.keys!['auth'],
          }),
        );
      })
      .then(() => {
        this.activandoPush.set(false);
        this.pushSuscripto.set(true);
      })
      .catch(() => {
        this.activandoPush.set(false);
        this.errorPush.set('No se pudo activar — puede que hayas bloqueado los permisos de notificación.');
      });
  }

  repetirPedido(): void {
    this.repitiendo.set(true);
    this.errorRepetir.set(null);
    this.seguimientoSvc.repetir(this.token).subscribe({
      next: (r) => {
        this.repitiendo.set(false);
        this.router.navigateByUrl(`/seguimiento/${r.nuevoToken}`);
      },
      error: () => {
        this.repitiendo.set(false);
        this.errorRepetir.set('No se pudo crear el pedido, probá de nuevo.');
      },
    });
  }

  descargarComprobante(): void {
    this.descargando.set(true);
    this.seguimientoSvc.comprobante(this.token).subscribe({
      next: (blob) => {
        this.descargando.set(false);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.descargando.set(false),
    });
  }

  enviarCalificacion(): void {
    if (this.estrellas() === 0) return;
    this.enviandoCalificacion.set(true);
    this.errorCalificacion.set(null);
    this.seguimientoSvc.calificar(this.token, this.estrellas(), this.comentario.trim() || null).subscribe({
      next: (s) => {
        this.enviandoCalificacion.set(false);
        this.calificacionEnviada.set(true);
        this.seguimiento.set(s);
      },
      error: () => {
        this.enviandoCalificacion.set(false);
        this.errorCalificacion.set('No se pudo enviar la calificación, probá de nuevo.');
      },
    });
  }
}
