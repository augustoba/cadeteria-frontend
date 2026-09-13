import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SeguimientoService } from '../../core/services/seguimiento.service';
import { Seguimiento } from '../../core/models/seguimiento.model';
import { SeguimientoMapaComponent } from './seguimiento-mapa.component';

const ESTADO_TEXTO: Record<string, string> = {
  'Sin asignación': 'Estamos buscando un cadete para tu pedido.',
  Pendiente: 'Le ofrecimos tu pedido a un cadete, estamos esperando que confirme.',
  'En curso': 'Tu cadete está en camino.',
  Finalizado: 'Tu pedido fue entregado.',
  Cancelado: 'Este pedido fue cancelado.',
};

/** Stepper de progreso (ronda 11, punto 117) — complementa el texto/mapa, no los reemplaza. */
const PASOS_PROGRESO = ['Pedido recibido', 'Cadete asignado', 'En camino', 'Entregado'];

/** Cuántos pasos del stepper ya se cumplieron según el estado — 0 = ninguno más que "recibido". */
function pasoActual(estado: string): number {
  switch (estado) {
    case 'Sin asignación':
      return 0;
    case 'Pendiente':
      return 1;
    case 'En curso':
      return 2;
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
                        [class]="i <= pasoActualDe(s.estado) ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-400'"
                      >
                        {{ i < pasoActualDe(s.estado) ? '✓' : i + 1 }}
                      </div>
                      <span
                        class="text-[10px] text-center leading-tight"
                        [class]="i <= pasoActualDe(s.estado) ? 'text-brand-700 font-medium' : 'text-gray-400'"
                      >
                        {{ paso }}
                      </span>
                    </div>
                    @if (!last) {
                      <div class="flex-1 h-0.5 -mt-4" [class]="i < pasoActualDe(s.estado) ? 'bg-brand-600' : 'bg-gray-200'"></div>
                    }
                  </div>
                }
              </div>
            }

            <div class="rounded bg-brand-50 text-brand-700 text-sm px-3 py-2">
              {{ estadoTexto(s.estado) }}
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
            </div>

            @if (s.cadete) {
              <div class="border-t border-gray-200 pt-4 flex items-center gap-3">
                @if (s.cadete.fotoUrl) {
                  <img [src]="s.cadete.fotoUrl" class="w-16 h-16 rounded-full object-cover border border-gray-200" />
                } @else {
                  <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl">🏍️</div>
                }
                <div class="text-sm">
                  <div class="font-semibold text-gray-700">{{ s.cadete.nombre }}</div>
                  @if (s.cadete.tipoVehiculo) {
                    <div class="text-gray-500">
                      {{ s.cadete.tipoVehiculo }}
                      {{ s.cadete.vehiculoColor ? '· ' + s.cadete.vehiculoColor : '' }}
                      {{ s.cadete.vehiculoPatente ? '· ' + s.cadete.vehiculoPatente : '' }}
                    </div>
                  }
                </div>
              </div>
              @if (s.cadete.cbu || s.cadete.aliasCbu) {
                <div class="rounded bg-gray-50 text-sm px-3 py-2 flex flex-col gap-0.5">
                  <span class="text-gray-500 text-xs">¿Preferís pagar por transferencia?</span>
                  @if (s.cadete.aliasCbu) {
                    <div><span class="text-gray-500">Alias:</span> {{ s.cadete.aliasCbu }}</div>
                  }
                  @if (s.cadete.cbu) {
                    <div><span class="text-gray-500">CBU:</span> {{ s.cadete.cbu }}</div>
                  }
                </div>
              } @else if (s.estado !== 'Cancelado') {
                <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">
                  💵 Tené <span class="font-semibold">$ {{ s.precio }}</span> en efectivo listo para el cadete.
                </div>
              }
            }

            @if (s.estado === 'Finalizado') {
              <div class="border-t border-gray-200 pt-4 flex flex-col gap-2 text-sm">
                <h2 class="font-medium text-gray-700">Entrega</h2>
                @if (s.entregaReceptorNombre) {
                  <div><span class="text-gray-500">Recibió:</span> {{ s.entregaReceptorNombre }}</div>
                }
                @if (s.entregaFotoUrl) {
                  @if (mostrarFoto()) {
                    <img [src]="s.entregaFotoUrl" class="rounded border border-gray-200 max-h-64 object-cover" />
                  } @else {
                    <button
                      type="button"
                      class="self-start bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium px-3 py-1.5 rounded"
                      (click)="mostrarFoto.set(true)"
                    >
                      👁 Ver foto
                    </button>
                  }
                }
                @if (s.comprobanteDisponible) {
                  <button
                    type="button"
                    class="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 rounded"
                    [disabled]="descargando()"
                    (click)="descargarComprobante()"
                  >
                    {{ descargando() ? 'Generando…' : '⬇ Descargar comprobante' }}
                  </button>
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
          <p class="text-red-600 text-sm py-10 text-center px-4">No encontramos este pedido.</p>
        }
      </div>
    </div>
  `,
})
export class SeguimientoComponent implements OnInit, OnChanges, OnDestroy {
  @Input() token = '';

  private readonly seguimientoSvc = inject(SeguimientoService);
  private readonly router = inject(Router);
  private intervaloActualizacion: ReturnType<typeof setInterval> | null = null;

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly seguimiento = signal<Seguimiento | null>(null);
  readonly nombreCadeteria = signal('Cadetería');
  readonly descargando = signal(false);
  readonly mostrarFoto = signal(false);

  readonly pasos = PASOS_PROGRESO;
  readonly pasoActualDe = pasoActual;

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
      this.mostrarFoto.set(false);
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
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
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
