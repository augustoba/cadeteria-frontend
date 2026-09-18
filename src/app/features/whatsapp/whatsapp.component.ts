import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WhatsappService, hoyLocalISO } from '../../core/services/whatsapp.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

type Pestania = 'chips' | 'mensajes' | 'respuestas';

/**
 * Panel del gateway propio de WhatsApp (Baileys + chips descartables, ver memoria del
 * proyecto "whatsapp-gateway"). Muestra si el gateway (la PC local) está conectado, el
 * estado de cada chip (para saber cuáles siguen activos sin ban, con indicador de
 * "shadowban" por baja tasa de entrega), permite cargar chips nuevos por pairing code o
 * darlos de baja, y el historial paginado/filtrable de mensajes mandados (con
 * entrega/lectura) y de respuestas de clientes.
 */
@Component({
  selector: 'app-whatsapp',
  imports: [FormsModule, DatePipe, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between flex-wrap gap-2">
        <h1 class="font-semibold">WhatsApp (gateway propio)</h1>
        <div class="flex items-center gap-2 text-sm">
          @if (wa.estadoGateway(); as eg) {
            <span class="w-2.5 h-2.5 rounded-full" [class]="eg.conectado ? 'bg-emerald-400' : 'bg-red-400'"></span>
            <span>
              Gateway {{ eg.conectado ? 'conectado' : 'desconectado' }}
              @if (eg.ultimoCambio) {
                — hace {{ eg.ultimoCambio | date: 'short' }}
              }
            </span>
          }
        </div>
      </div>

      <div class="px-4 py-2 border-b border-gray-200 flex gap-2">
        <button type="button" class="btn-mini" [class]="pestaniaClase('chips')" (click)="pestania.set('chips')">
          Chips ({{ wa.chips().length }})
        </button>
        <button type="button" class="btn-mini" [class]="pestaniaClase('mensajes')" (click)="pestania.set('mensajes')">
          Mensajes enviados ({{ wa.mensajesPagina().total }})
        </button>
        <button type="button" class="btn-mini" [class]="pestaniaClase('respuestas')" (click)="pestania.set('respuestas')">
          Respuestas de clientes ({{ wa.respuestasPagina().total }})
        </button>
      </div>

      @switch (pestania()) {
        @case ('chips') {
          <div class="p-4 flex flex-col gap-3">
            <div class="flex justify-end">
              <button type="button" class="btn-action bg-emerald-600 hover:bg-emerald-700" (click)="mostrarNuevoChip.set(true)">
                + Cargar chip nuevo
              </button>
            </div>
            @if (mostrarNuevoChip()) {
              <div class="border border-gray-200 rounded p-3 flex flex-wrap items-end gap-2">
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium text-gray-700">Id del chip</span>
                  <input class="input" [(ngModel)]="nuevoChipId" name="nuevoChipId" placeholder="ej: chip5" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium text-gray-700">Número (país + sin "+")</span>
                  <input class="input" [(ngModel)]="nuevoChipNumero" name="nuevoChipNumero" placeholder="ej: 5493811234567" />
                </label>
                <button
                  type="button"
                  class="btn bg-brand-600 hover:bg-brand-700"
                  [disabled]="!nuevoChipId.trim() || !nuevoChipNumero.trim() || vinculando()"
                  (click)="vincularChip()"
                >
                  Pedir código
                </button>
                <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="mostrarNuevoChip.set(false)">Cancelar</button>
                <p class="text-xs text-gray-500 basis-full">
                  Después de pedir el código: en el celular con ese chip, WhatsApp → Dispositivos vinculados → Vincular con número de
                  teléfono, y cargar el código de 8 dígitos que va a aparecer acá abajo apenas el gateway lo pida.
                </p>
              </div>
            }

            @if (wa.cargandoChips()) {
              <app-loading-skeleton [filas]="3" />
            } @else {
              @for (c of wa.chips(); track c.id) {
                <div class="border border-gray-200 rounded p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span class="font-mono font-medium text-gray-700">{{ c.id }}</span>
                    <span class="text-sm text-gray-500 ml-2">{{ c.numero || 'sin número aún' }}</span>
                    @if (esShadowban(c)) {
                      <span class="block text-xs text-amber-700 mt-0.5">
                        ⚠️ Posible shadowban: solo {{ c.entregadosUltimas24h }}/{{ c.mensajesUltimas24h }} entregados últimas 24hs
                      </span>
                    } @else if (c.mensajesUltimas24h > 0) {
                      <span class="block text-xs text-gray-400 mt-0.5">
                        {{ c.entregadosUltimas24h }}/{{ c.mensajesUltimas24h }} entregados últimas 24hs
                      </span>
                    }
                  </div>
                  <div class="flex items-center gap-2">
                    @if (c.pairingCodigo) {
                      <span class="font-mono text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded">
                        Código: {{ c.pairingCodigo }}
                      </span>
                    }
                    <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="estadoChipClase(c.estado)">
                      {{ estadoChipLabel(c.estado) }}
                    </span>
                    @if (c.ultimoCambioEstado) {
                      <span class="text-xs text-gray-400">{{ c.ultimoCambioEstado | date: 'short' }}</span>
                    }
                    @if (c.estado !== 'BAJA') {
                      <button type="button" class="btn-mini bg-red-500 hover:bg-red-600" (click)="darDeBaja(c.id)">Dar de baja</button>
                    } @else {
                      <button type="button" class="btn-mini bg-gray-500 hover:bg-gray-600" (click)="eliminarChip(c.id)">Eliminar</button>
                    }
                  </div>
                </div>
              } @empty {
                <app-empty-state icono="📱" mensaje="Todavía no hay chips cargados." hint="Cargá el primero con 'Cargar chip nuevo'." />
              }
            }
          </div>
        }

        @case ('mensajes') {
          <div class="p-4 flex flex-col gap-3">
            <div class="border border-gray-200 rounded p-3 flex flex-wrap items-end gap-2">
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium text-gray-700">Probar envío — teléfono</span>
                <input class="input" [(ngModel)]="pruebaTelefono" name="pruebaTelefono" placeholder="ej: 5493811234567" />
              </label>
              <label class="flex flex-col gap-1 flex-1 min-w-[200px]">
                <span class="text-xs font-medium text-gray-700">Mensaje</span>
                <input class="input w-full" [(ngModel)]="pruebaMensaje" name="pruebaMensaje" placeholder="Mensaje de prueba" />
              </label>
              <button
                type="button"
                class="btn bg-brand-600 hover:bg-brand-700"
                [disabled]="!pruebaTelefono.trim() || !pruebaMensaje.trim() || enviandoPrueba()"
                (click)="mandarPrueba()"
              >
                Mandar
              </button>
            </div>

            <div class="flex flex-wrap items-end gap-2">
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium text-gray-700">Buscar por teléfono</span>
                <input
                  class="input"
                  [(ngModel)]="filtroMensajesTelefono"
                  name="filtroMensajesTelefono"
                  placeholder="ej: 3815"
                  (keyup.enter)="aplicarFiltroMensajes()"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium text-gray-700">Desde</span>
                <input class="input" type="date" [(ngModel)]="filtroMensajesDesde" name="filtroMensajesDesde" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium text-gray-700">Hasta</span>
                <input class="input" type="date" [(ngModel)]="filtroMensajesHasta" name="filtroMensajesHasta" />
              </label>
              <button type="button" class="btn bg-brand-600 hover:bg-brand-700" (click)="aplicarFiltroMensajes()">Buscar</button>
              @if (filtroMensajesTelefono || filtroMensajesDesde || filtroMensajesHasta) {
                <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="limpiarFiltroMensajes()">Limpiar</button>
              }
            </div>

            @if (wa.cargandoMensajes()) {
              <app-loading-skeleton [filas]="6" />
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-gray-500 border-b border-gray-200">
                      <th class="py-1.5 pr-3">Cuándo</th>
                      <th class="py-1.5 pr-3">Teléfono</th>
                      <th class="py-1.5 pr-3">Mensaje</th>
                      <th class="py-1.5 pr-3">Chip</th>
                      <th class="py-1.5 pr-3">Estado</th>
                      <th class="py-1.5 pr-3">Entregado</th>
                      <th class="py-1.5 pr-3">Leído</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of wa.mensajesPagina().items; track m.id) {
                      <tr class="border-b border-gray-100 align-top">
                        <td class="py-1.5 pr-3 whitespace-nowrap text-gray-500">{{ m.creadoEn | date: 'short' }}</td>
                        <td class="py-1.5 pr-3 whitespace-nowrap">
                          <a class="text-brand-600 hover:underline" [routerLink]="['/clientes', m.telefono]">{{ m.telefono }}</a>
                        </td>
                        <td class="py-1.5 pr-3 max-w-xs truncate" [title]="m.texto">{{ m.texto }}</td>
                        <td class="py-1.5 pr-3 font-mono text-xs">{{ m.chipUsado || '—' }}</td>
                        <td class="py-1.5 pr-3">
                          <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="estadoMensajeClase(m.estado)">
                            {{ m.estado }}
                          </span>
                          @if (m.error) {
                            <span class="block text-xs text-red-500">{{ m.error }}</span>
                          }
                        </td>
                        <td class="py-1.5 pr-3 whitespace-nowrap">{{ m.entregadoEn ? '✓ ' + (m.entregadoEn | date: 'short') : '—' }}</td>
                        <td class="py-1.5 pr-3 whitespace-nowrap">{{ m.leidoEn ? '✓✓ ' + (m.leidoEn | date: 'short') : '—' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7">
                          <app-empty-state icono="💬" mensaje="No hay mensajes que coincidan con el filtro." />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (wa.mensajesPagina().totalPaginas > 1) {
                <div class="flex items-center justify-center gap-3 pt-2">
                  <button type="button" class="btn-mini bg-gray-300 hover:bg-gray-400 text-gray-700" [disabled]="wa.filtroMensajes().pagina === 0" (click)="irAPaginaMensajes(wa.filtroMensajes().pagina - 1)">
                    ← Anterior
                  </button>
                  <span class="text-xs text-gray-500">Página {{ wa.mensajesPagina().pagina + 1 }} de {{ wa.mensajesPagina().totalPaginas }}</span>
                  <button
                    type="button"
                    class="btn-mini bg-gray-300 hover:bg-gray-400 text-gray-700"
                    [disabled]="wa.filtroMensajes().pagina + 1 >= wa.mensajesPagina().totalPaginas"
                    (click)="irAPaginaMensajes(wa.filtroMensajes().pagina + 1)"
                  >
                    Siguiente →
                  </button>
                </div>
              }
            }
          </div>
        }

        @case ('respuestas') {
          <div class="p-4 flex flex-col gap-3">
            <div class="flex flex-wrap items-end gap-2">
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium text-gray-700">Buscar por teléfono</span>
                <input
                  class="input"
                  [(ngModel)]="filtroRespuestasTelefono"
                  name="filtroRespuestasTelefono"
                  placeholder="ej: 3815"
                  (keyup.enter)="aplicarFiltroRespuestas()"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium text-gray-700">Desde</span>
                <input class="input" type="date" [(ngModel)]="filtroRespuestasDesde" name="filtroRespuestasDesde" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium text-gray-700">Hasta</span>
                <input class="input" type="date" [(ngModel)]="filtroRespuestasHasta" name="filtroRespuestasHasta" />
              </label>
              <button type="button" class="btn bg-brand-600 hover:bg-brand-700" (click)="aplicarFiltroRespuestas()">Buscar</button>
              @if (filtroRespuestasTelefono || filtroRespuestasDesde || filtroRespuestasHasta) {
                <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="limpiarFiltroRespuestas()">Limpiar</button>
              }
            </div>

            @if (wa.cargandoRespuestas()) {
              <app-loading-skeleton [filas]="4" />
            } @else {
              <div class="flex flex-col gap-2">
                @for (r of wa.respuestasPagina().items; track r.id) {
                  <div class="border border-gray-200 rounded p-3">
                    <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>
                        <a class="text-brand-600 hover:underline" [routerLink]="['/clientes', r.telefono]">{{ r.telefono }}</a>
                        @if (r.chipId) { <span class="font-mono"> · {{ r.chipId }}</span> }
                      </span>
                      <span>{{ r.recibidoEn | date: 'short' }}</span>
                    </div>
                    <p class="text-sm text-gray-800 whitespace-pre-wrap">{{ r.texto }}</p>
                  </div>
                } @empty {
                  <app-empty-state icono="📨" mensaje="No hay respuestas que coincidan con el filtro." />
                }
              </div>
              @if (wa.respuestasPagina().totalPaginas > 1) {
                <div class="flex items-center justify-center gap-3 pt-2">
                  <button type="button" class="btn-mini bg-gray-300 hover:bg-gray-400 text-gray-700" [disabled]="wa.filtroRespuestas().pagina === 0" (click)="irAPaginaRespuestas(wa.filtroRespuestas().pagina - 1)">
                    ← Anterior
                  </button>
                  <span class="text-xs text-gray-500">Página {{ wa.respuestasPagina().pagina + 1 }} de {{ wa.respuestasPagina().totalPaginas }}</span>
                  <button
                    type="button"
                    class="btn-mini bg-gray-300 hover:bg-gray-400 text-gray-700"
                    [disabled]="wa.filtroRespuestas().pagina + 1 >= wa.respuestasPagina().totalPaginas"
                    (click)="irAPaginaRespuestas(wa.filtroRespuestas().pagina + 1)"
                  >
                    Siguiente →
                  </button>
                </div>
              }
            }
          </div>
        }
      }
    </div>
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
      .btn-mini:disabled {
        opacity: 0.5;
      }
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
      }
      .btn:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class WhatsappComponent implements OnInit {
  readonly wa = inject(WhatsappService);
  private readonly toast = inject(ToastService);

  readonly pestania = signal<Pestania>('chips');
  readonly mostrarNuevoChip = signal(false);
  readonly vinculando = signal(false);
  readonly enviandoPrueba = signal(false);

  nuevoChipId = '';
  nuevoChipNumero = '';
  pruebaTelefono = '';
  pruebaMensaje = '';

  filtroMensajesTelefono = '';
  filtroMensajesDesde = hoyLocalISO();
  filtroMensajesHasta = hoyLocalISO();
  filtroRespuestasTelefono = '';
  filtroRespuestasDesde = hoyLocalISO();
  filtroRespuestasHasta = hoyLocalISO();

  ngOnInit(): void {
    this.wa.iniciar();
  }

  pestaniaClase(p: Pestania): string {
    return this.pestania() === p ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-300 hover:bg-gray-400 text-gray-700';
  }

  estadoChipLabel(estado: string): string {
    return (
      { VINCULANDO: 'Vinculando…', CONECTADO: 'Conectado', DESCONECTADO: 'Desconectado', BANEADO: 'Baneado', BAJA: 'Dado de baja' }[
        estado
      ] ?? estado
    );
  }

  estadoChipClase(estado: string): string {
    return (
      {
        CONECTADO: 'bg-emerald-100 text-emerald-700',
        VINCULANDO: 'bg-amber-100 text-amber-800',
        DESCONECTADO: 'bg-gray-100 text-gray-600',
        BANEADO: 'bg-red-100 text-red-700',
        BAJA: 'bg-gray-200 text-gray-500',
      }[estado] ?? 'bg-gray-100 text-gray-600'
    );
  }

  /** Menos de 40% de entrega con al menos 5 mensajes mandados — sigue "conectado" pero WhatsApp dejó de entregar en silencio. */
  esShadowban(c: { estado: string; mensajesUltimas24h: number; entregadosUltimas24h: number }): boolean {
    return c.estado === 'CONECTADO' && c.mensajesUltimas24h >= 5 && c.entregadosUltimas24h / c.mensajesUltimas24h < 0.4;
  }

  estadoMensajeClase(estado: string): string {
    return (
      {
        ENVIADO: 'bg-emerald-100 text-emerald-700',
        PENDIENTE: 'bg-amber-100 text-amber-800',
        FALLIDO: 'bg-red-100 text-red-700',
      }[estado] ?? 'bg-gray-100 text-gray-600'
    );
  }

  vincularChip(): void {
    const chipId = this.nuevoChipId.trim();
    const numero = this.nuevoChipNumero.trim();
    if (!chipId || !numero) return;
    this.vinculando.set(true);
    this.wa.vincularChip(chipId, numero).subscribe({
      next: () => {
        this.vinculando.set(false);
        this.mostrarNuevoChip.set(false);
        this.nuevoChipId = '';
        this.nuevoChipNumero = '';
        this.wa.cargarEstadoYChips();
        this.toast.success('Chip cargado — esperando el código de vinculación del gateway.');
      },
      error: (err) => {
        this.vinculando.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo cargar el chip.');
      },
    });
  }

  darDeBaja(chipId: string): void {
    this.toast.conDeshacer(`Dando de baja ${chipId}…`, () => {
      this.wa.darDeBajaChip(chipId).subscribe({
        next: () => this.wa.cargarEstadoYChips(),
        error: (err) => this.toast.error(err?.error?.message ?? 'No se pudo dar de baja el chip.'),
      });
    });
  }

  eliminarChip(chipId: string): void {
    this.toast.conDeshacer(`Eliminando ${chipId} de la lista…`, () => {
      this.wa.eliminarChip(chipId).subscribe({
        next: () => this.wa.cargarEstadoYChips(),
        error: (err) => this.toast.error(err?.error?.message ?? 'No se pudo eliminar el chip.'),
      });
    });
  }

  mandarPrueba(): void {
    const telefono = this.pruebaTelefono.trim();
    const mensaje = this.pruebaMensaje.trim();
    if (!telefono || !mensaje) return;
    this.enviandoPrueba.set(true);
    this.wa.mandarPrueba(telefono, mensaje).subscribe({
      next: () => {
        this.enviandoPrueba.set(false);
        this.pruebaMensaje = '';
        this.toast.success('Mensaje encolado.');
      },
      error: (err) => {
        this.enviandoPrueba.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo mandar el mensaje.');
      },
    });
  }

  aplicarFiltroMensajes(): void {
    this.wa.buscarMensajes({ telefono: this.filtroMensajesTelefono, desde: this.filtroMensajesDesde, hasta: this.filtroMensajesHasta });
  }

  limpiarFiltroMensajes(): void {
    this.filtroMensajesTelefono = '';
    this.filtroMensajesDesde = '';
    this.filtroMensajesHasta = '';
    this.wa.buscarMensajes({ telefono: '', desde: '', hasta: '' });
  }

  irAPaginaMensajes(pagina: number): void {
    this.wa.buscarMensajes({ pagina });
  }

  aplicarFiltroRespuestas(): void {
    this.wa.buscarRespuestas({
      telefono: this.filtroRespuestasTelefono,
      desde: this.filtroRespuestasDesde,
      hasta: this.filtroRespuestasHasta,
    });
  }

  limpiarFiltroRespuestas(): void {
    this.filtroRespuestasTelefono = '';
    this.filtroRespuestasDesde = '';
    this.filtroRespuestasHasta = '';
    this.wa.buscarRespuestas({ telefono: '', desde: '', hasta: '' });
  }

  irAPaginaRespuestas(pagina: number): void {
    this.wa.buscarRespuestas({ pagina });
  }
}
