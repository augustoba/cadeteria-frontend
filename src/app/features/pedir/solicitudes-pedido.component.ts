import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SolicitudPedidoService } from '../../core/services/solicitud-pedido.service';
import { ToastService } from '../../core/services/toast.service';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { SolicitudPedido } from '../../core/models/solicitud-pedido.model';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';
import { AvisoClienteComponent } from '../../shared/aviso-cliente.component';

const ESTADO_CLASES: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  COTIZADO: 'bg-indigo-100 text-indigo-700',
  CONFIRMADA: 'bg-emerald-100 text-emerald-700',
  RECHAZADA: 'bg-red-100 text-red-700',
};

/** Revisión de los pedidos que el cliente carga solo desde "/pedir" (sin llamar/escribir por WhatsApp). */
@Component({
  selector: 'app-solicitudes-pedido',
  imports: [DatePipe, FormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent, AvisoClienteComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Pedidos cargados por clientes</h1>
        <a routerLink="/" class="btn-action bg-red-500 hover:bg-red-600">↩ Volver</a>
      </div>

      <div class="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 flex-wrap">
        <span class="text-sm text-emerald-800">Pasale este link a un cliente para que cargue su pedido solo:</span>
        <code class="text-xs bg-white border border-emerald-200 rounded px-2 py-1 break-all">{{ linkPedir }}</code>
        <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="copiarLink()">
          {{ linkCopiado() ? '✓ Copiado' : 'Copiar' }}
        </button>
      </div>

      <div class="px-4 py-2 border-b border-gray-200 flex gap-2">
        <button type="button" class="btn-mini" [class]="filtroClase('')" (click)="filtrar(null)">Todas</button>
        <button type="button" class="btn-mini" [class]="filtroClase('PENDIENTE')" (click)="filtrar('PENDIENTE')">A revisar</button>
        <button type="button" class="btn-mini" [class]="filtroClase('COTIZADO')" (click)="filtrar('COTIZADO')">Cotizadas</button>
        <button type="button" class="btn-mini" [class]="filtroClase('CONFIRMADA')" (click)="filtrar('CONFIRMADA')">Confirmadas</button>
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
                  <span class="font-medium text-gray-700">{{ s.clienteNombre }}</span>
                  <span class="text-xs text-gray-400"> — {{ s.clienteTelefono }}</span>
                  @if (s.sinVerificar) {
                    <span
                      class="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                      title="No se pudo mandar el código de verificación — confirmá el teléfono antes de despachar"
                    >
                      Teléfono sin verificar
                    </span>
                  }
                </div>
                <span class="text-xs text-gray-400">Creado {{ s.creadoEn | date: 'short' }}</span>
              </div>

              <div class="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                <span>
                  📍 Origen: {{ s.origenDireccion }}
                  @if (s.origenPiso) { <strong> — Piso {{ s.origenPiso }}</strong> }
                  @if (s.origenDepto) { <strong> — Depto {{ s.origenDepto }}</strong> }
                  @if (s.origenObservaciones) { <span class="block text-xs text-gray-500">📝 {{ s.origenObservaciones }}</span> }
                </span>
                <span>
                  🏁 Destino: {{ s.destinoDireccion }}
                  @if (s.destinoPiso) { <strong> — Piso {{ s.destinoPiso }}</strong> }
                  @if (s.destinoDepto) { <strong> — Depto {{ s.destinoDepto }}</strong> }
                  @if (s.destinoObservaciones) { <span class="block text-xs text-gray-500">📝 {{ s.destinoObservaciones }}</span> }
                </span>
                <span>{{ s.llevaDinero ? '💵 Lleva dinero' + (s.montoDeclarado ? ' ($' + s.montoDeclarado + ')' : '') : 'No lleva dinero' }}</span>
                <span>{{ s.llevaValores ? '💎 Transporta valores' + (s.montoValores ? ' ($' + s.montoValores + ')' : '') : 'No transporta valores' }}</span>
                <span>{{ s.retornaAlOrigen ? '🔁 Retorna al origen' : 'No retorna al origen' }}</span>
                @if (s.requiereMoto) {
                  <span>🏍️ Pidió moto</span>
                }
              </div>
              @if (s.detalle) {
                <p class="text-sm text-gray-600 italic">"{{ s.detalle }}"</p>
              }
              <app-aviso-cliente [aviso]="s.avisoCliente" />

              @if (s.estado === 'PENDIENTE') {
                <div class="border-t border-gray-100 pt-2 flex flex-col gap-2">
                  <div class="grid sm:grid-cols-4 gap-2">
                    <label class="flex items-center gap-2">
                      <input type="checkbox" [ngModel]="requiereMotoSeleccionado[s.id] ?? s.requiereMoto"
                        (ngModelChange)="requiereMotoSeleccionado[s.id] = $event"
                        [name]="'requiereMoto-' + s.id" />
                      <span class="text-xs font-medium text-gray-700">Requiere moto</span>
                    </label>
                    <label class="flex flex-col gap-1">
                      <span class="text-xs font-medium text-gray-700">Valor trámite</span>
                      <div class="flex gap-1">
                        <input type="number" min="0" step="1" class="input flex-1" [(ngModel)]="precioModal[s.id]" [name]="'precio-' + s.id" />
                        <button
                          type="button"
                          class="btn-mini bg-violet-600 hover:bg-violet-700"
                          title="Sugerir precio por distancia"
                          (click)="sugerirPrecio(s)"
                        >
                          💰
                        </button>
                      </div>
                    </label>
                    <label class="flex flex-col gap-1">
                      <span class="text-xs font-medium text-gray-700">Dinero</span>
                      <input type="number" min="0" step="1" class="input" [(ngModel)]="montoModal[s.id]" [name]="'monto-' + s.id" />
                    </label>
                  </div>
                  <div class="flex gap-2 flex-wrap">
                    <button type="button" class="btn-mini bg-emerald-600 hover:bg-emerald-700" (click)="confirmarDirecto(s)">
                      ✔ Ya tengo el precio — confirmar pedido
                    </button>
                    <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="cotizar(s)">
                      💬 Enviar cotización (que confirme el cliente)
                    </button>
                    <button type="button" class="btn-mini bg-red-600 hover:bg-red-700" (click)="rechazar(s)">✕ Rechazar</button>
                  </div>
                </div>
              }
              @if (s.estado === 'PENDIENTE' || s.estado === 'COTIZADO') {
                <div class="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    class="btn-mini bg-green-600 hover:bg-green-700"
                    title="Le manda al cliente origen y destino por WhatsApp para que confirme — la respuesta se ve en WhatsApp → Respuestas"
                    (click)="pedirConfirmacionWhatsapp(s)"
                  >
                    📱 Pedir confirmación por WhatsApp
                  </button>
                  @if (s.sinVerificar) {
                    <button type="button" class="btn-mini bg-amber-600 hover:bg-amber-700" (click)="validarTelefono(s)">
                      ✔ Ya confirmé el teléfono
                    </button>
                  }
                  <button
                    type="button"
                    class="btn-mini bg-gray-700 hover:bg-gray-800"
                    title="Marca el teléfono como cliente problemático (avisa en próximos pedidos, no bloquea)"
                    (click)="abrirFraudulenta(s)"
                  >
                    🚫 Marcar como fraudulento
                  </button>
                </div>
              }
              @if (s.estado === 'COTIZADO') {
                <p class="text-xs text-indigo-700">
                  Cotización enviada: $ {{ s.precio }} — esperando que el cliente confirme por el link que le mandamos.
                </p>
              }
              @if (s.estado === 'RECHAZADA' && s.motivoRechazo) {
                <p class="text-xs text-gray-500">Motivo: {{ s.motivoRechazo }}</p>
              }
            </div>
          } @empty {
            <app-empty-state icono="📩" mensaje="Sin pedidos cargados por clientes todavía." hint="Compartí el link /pedir por WhatsApp para que lo usen." />
          }
        }
      </div>
    </div>

    @if (solicitudAFraude(); as s) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="solicitudAFraude.set(null)">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-gray-800 text-white px-5 py-4">
            <h2 class="font-semibold">Marcar como fraudulento</h2>
            <p class="text-gray-200 text-sm">{{ s.clienteNombre }} — {{ s.clienteTelefono }}</p>
          </div>
          <div class="p-5 flex flex-col gap-2">
            <p class="text-sm text-gray-600">
              El teléfono queda como cliente problemático: se avisa en sus próximos pedidos, no se bloquea.
              @if (s.estado === 'PENDIENTE' || s.estado === 'COTIZADO') { La solicitud se rechaza. }
            </p>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Nota (opcional)</span>
              <textarea class="input" rows="3" [(ngModel)]="notaFraudeModal" name="notaFraude"></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="solicitudAFraude.set(null)">Volver</button>
            <button type="button" class="btn bg-gray-800 hover:bg-gray-900" (click)="confirmarFraudulenta()">Marcar</button>
          </div>
        </div>
      </div>
    }

    @if (solicitudARechazar(); as s) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarRechazar()">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-red-600 text-white px-5 py-4">
            <h2 class="font-semibold">Rechazar pedido</h2>
            <p class="text-red-50 text-sm">{{ s.clienteNombre }}</p>
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
export class SolicitudesPedidoComponent implements OnInit {
  readonly service = inject(SolicitudPedidoService);
  private readonly toast = inject(ToastService);
  private readonly cotizacion = inject(CotizacionService);

  readonly ESTADO_CLASES = ESTADO_CLASES;
  readonly filtroActual = signal<string | null>('PENDIENTE');
  readonly linkPedir = `${window.location.origin}/pedir`;
  readonly linkCopiado = signal(false);

  /** Sin entrada = lo que pidió el cliente (s.requiereMoto). */
  requiereMotoSeleccionado: Record<string, boolean | undefined> = {};
  precioModal: Record<string, number | null> = {};
  montoModal: Record<string, number | null> = {};

  readonly solicitudARechazar = signal<SolicitudPedido | null>(null);
  motivoRechazoModal = '';

  readonly solicitudAFraude = signal<SolicitudPedido | null>(null);
  notaFraudeModal = '';

  ngOnInit(): void {
    this.service.listar(this.filtroActual() ?? undefined);
  }

  copiarLink(): void {
    navigator.clipboard?.writeText(this.linkPedir).then(() => {
      this.linkCopiado.set(true);
      setTimeout(() => this.linkCopiado.set(false), 2000);
    });
  }

  filtrar(estado: string | null): void {
    this.filtroActual.set(estado);
    this.service.listar(estado ?? undefined);
  }

  filtroClase(estado: string): string {
    const activo = (this.filtroActual() ?? '') === estado;
    return activo ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700';
  }

  private datosValidos(s: SolicitudPedido): boolean {
    return !!this.precioModal[s.id];
  }

  confirmarDirecto(s: SolicitudPedido): void {
    if (!this.datosValidos(s)) {
      this.toast.error('Ingresá el precio antes de confirmar.');
      return;
    }
    this.service.confirmarDirecto(
      s.id,
      {
        requiereMoto: this.requiereMotoSeleccionado[s.id] ?? s.requiereMoto,
        precio: this.precioModal[s.id]!,
        montoDeclarado: this.montoModal[s.id] ?? null,
      },
      () => {
        this.toast.success(`Pedido confirmado — se le avisó a ${s.clienteNombre} por SMS.`);
        this.filtrar(this.filtroActual());
      },
    );
  }

  /** Sugerencia de precio por GPS (mejora 2026-09-16) — por zona si el origen cae en una con precio cargado, si no por distancia real. */
  sugerirPrecio(s: SolicitudPedido): void {
    this.cotizacion.cotizar(s.origenLat, s.origenLng, s.destinoLat, s.destinoLng, this.montoModal[s.id], s.retornaAlOrigen, s.montoValores).subscribe((c) => {
      if (c.precioSugerido == null) {
        this.toast.error('No hay "precio por km" configurado — cargalo a mano.');
        return;
      }
      this.precioModal[s.id] = c.precioSugerido;
      this.toast.success(
        c.metodo === 'DISTANCIA_ESTIMADA'
          ? `Sugerido por distancia estimada (~${c.distanciaKm?.toFixed(1)} km) — no se pudo calcular la ruta, revisalo.`
          : `Sugerido por distancia (~${c.distanciaKm?.toFixed(1)} km).`,
      );
    });
  }

  cotizar(s: SolicitudPedido): void {
    if (!this.datosValidos(s)) {
      this.toast.error('Ingresá el precio antes de cotizar.');
      return;
    }
    this.service.cotizar(
      s.id,
      {
        requiereMoto: this.requiereMotoSeleccionado[s.id] ?? s.requiereMoto,
        precio: this.precioModal[s.id]!,
        montoDeclarado: this.montoModal[s.id] ?? null,
      },
      () => {
        this.toast.success(`Cotización enviada a ${s.clienteNombre} por SMS.`);
        this.filtrar(this.filtroActual());
      },
    );
  }

  rechazar(s: SolicitudPedido): void {
    this.motivoRechazoModal = '';
    this.solicitudARechazar.set(s);
  }

  cerrarRechazar(): void {
    this.solicitudARechazar.set(null);
  }

  abrirFraudulenta(s: SolicitudPedido): void {
    this.notaFraudeModal = '';
    this.solicitudAFraude.set(s);
  }

  confirmarFraudulenta(): void {
    const s = this.solicitudAFraude();
    if (!s) return;
    this.service.marcarFraudulenta(s.id, this.notaFraudeModal.trim() || null, () => {
      this.toast.success('Teléfono marcado como cliente problemático.');
      this.filtrar(this.filtroActual());
    });
    this.solicitudAFraude.set(null);
  }

  pedirConfirmacionWhatsapp(s: SolicitudPedido): void {
    this.service.pedirConfirmacionWhatsapp(s.id, () =>
      this.toast.success(`Mensaje encolado para ${s.clienteNombre}. La respuesta aparece en WhatsApp → Respuestas.`),
    );
  }

  validarTelefono(s: SolicitudPedido): void {
    this.service.validarTelefono(s.id, () => {
      this.toast.success('Teléfono validado — la próxima vez no le vamos a pedir código.');
      this.filtrar(this.filtroActual());
    });
  }

  confirmarRechazar(): void {
    const s = this.solicitudARechazar();
    if (!s) return;
    const motivo = this.motivoRechazoModal.trim();
    this.service.rechazar(s.id, motivo || null, () => this.filtrar(this.filtroActual()));
    this.solicitudARechazar.set(null);
  }
}
