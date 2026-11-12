import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Pedido } from '../../core/models/pedido.model';
import { ClienteSugerido, FiltroPedidos, PedidoService } from '../../core/services/pedido.service';
import { CadeteService } from '../../core/services/cadete.service';
import { claseEstadoPedido } from '../dashboard/tabla-pedidos.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';
import { PedidoDetalleModalComponent } from '../../shared/pedido-detalle-modal.component';
import { ESTILOS_BOTONES } from '../../shared/estilos-botones';

const TAMANO_PAGINA = 20;

/**
 * Botones de estado. EN_CURSO = aceptado sin retirar; RETIRADO = en curso ya retirado (lo separa el
 * backend). `suave` es el color del estado en la tabla (ESTADO_CLASES del dashboard); Retirado lleva
 * índigo para no confundirse con En curso. `fuerte` es el botón elegido.
 */
const ESTADOS: { id: string; texto: string; suave: string; fuerte: string }[] = [
  { id: '', texto: 'Todos', suave: 'bg-gray-100 text-gray-700', fuerte: 'bg-gray-700 text-white' },
  { id: 'SIN_ASIGNAR', texto: 'Sin asignar', suave: 'bg-gray-200 text-gray-700', fuerte: 'bg-gray-500 text-white' },
  { id: 'PENDIENTE', texto: 'Pendiente de aceptación', suave: 'bg-amber-100 text-amber-800', fuerte: 'bg-amber-500 text-white' },
  { id: 'EN_CURSO', texto: 'En curso', suave: 'bg-brand-100 text-brand-700', fuerte: 'bg-brand-600 text-white' },
  { id: 'RETIRADO', texto: 'Retirado', suave: 'bg-indigo-100 text-indigo-700', fuerte: 'bg-indigo-600 text-white' },
  { id: 'FINALIZADO', texto: 'Finalizado', suave: 'bg-emerald-100 text-emerald-700', fuerte: 'bg-emerald-600 text-white' },
  { id: 'CANCELADO', texto: 'Anulado', suave: 'bg-red-100 text-red-700', fuerte: 'bg-red-600 text-white' },
  { id: 'NO_ENTREGADO', texto: 'No entregado', suave: 'bg-orange-100 text-orange-700', fuerte: 'bg-orange-600 text-white' },
  { id: 'PROGRAMADO', texto: 'Programado', suave: 'bg-purple-100 text-purple-700', fuerte: 'bg-purple-600 text-white' },
];

type Atajo = 'hoy' | 'ayer' | '7' | '30' | 'todas';

/** "yyyy-MM-dd" de una fecha, en la hora local del navegador (la de la cadetería). */
function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return diaLocal(d);
}

/**
 * Pantalla "Pedidos" (2026-11-11): el historial completo, para poder contestar un reclamo de un pedido
 * viejo. Por defecto los de hoy; filtros por número, cliente (nombre o teléfono, con sugerencias),
 * cadete, estado, fechas y rango horario (sobre la creación). Al tocar una fila abre el mismo detalle
 * que el dashboard.
 */
@Component({
  selector: 'app-pedidos',
  styles: [
    ESTILOS_BOTONES,
    `
      .chip-estado {
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.35rem 0.75rem;
        border-radius: 9999px;
        transition: filter 0.15s;
      }
      .chip-estado:hover {
        filter: brightness(0.95);
      }
      .chip-elegido {
        box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(0, 0, 0, 0.25);
      }
    `,
  ],
  imports: [FormsModule, DatePipe, EmptyStateComponent, LoadingSkeletonComponent, PedidoDetalleModalComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Pedidos</h1>
        <span class="text-xs text-white/80">{{ total() }} pedido(s)</span>
      </div>

      <div class="px-4 py-3 border-b border-gray-200 flex flex-col gap-3 text-sm">
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-500">N° de pedido</span>
            <input
              class="input w-32"
              inputmode="numeric"
              placeholder="Ej: 1500123"
              [ngModel]="numeroTexto()"
              (ngModelChange)="cambiarNumero($event)"
              name="numero"
            />
          </label>

          <div class="flex flex-col gap-1 relative">
            <span class="text-xs text-gray-500">Cliente</span>
            @if (cliente(); as c) {
              <div class="input flex items-center gap-2 w-72 bg-brand-50">
                <span class="truncate flex-1">{{ c.nombre || 'Sin nombre' }} ({{ c.telefono }})</span>
                <button type="button" class="text-gray-500 hover:text-gray-800" title="Quitar" (click)="quitarCliente()">✕</button>
              </div>
            } @else {
              <input
                class="input w-72"
                placeholder="Nombre o teléfono"
                autocomplete="off"
                [ngModel]="clienteTexto()"
                (ngModelChange)="escribirCliente($event)"
                (blur)="cerrarSugerenciasLuego()"
                name="cliente"
              />
              @if (clienteSugerencias().length && clienteTexto().trim().length >= 2) {
                <div class="absolute left-0 top-full mt-1 w-80 bg-white rounded shadow-lg border border-gray-200 z-20 max-h-64 overflow-y-auto">
                  @for (s of clienteSugerencias(); track s.telefono) {
                    <button
                      type="button"
                      class="block w-full text-left px-3 py-1.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      (mousedown)="elegirCliente(s)"
                    >
                      {{ s.nombre || 'Sin nombre' }} <span class="text-gray-500">({{ s.telefono }})</span>
                    </button>
                  }
                </div>
              }
            }
          </div>

          <div class="flex flex-col gap-1 relative">
            <span class="text-xs text-gray-500">Cadete</span>
            @if (cadete(); as c) {
              <div class="input flex items-center gap-2 w-56 bg-brand-50">
                <span class="truncate flex-1">{{ c.nombre }}</span>
                <button type="button" class="text-gray-500 hover:text-gray-800" title="Quitar" (click)="quitarCadete()">✕</button>
              </div>
            } @else {
              <input
                class="input w-56"
                placeholder="Nombre del cadete"
                autocomplete="off"
                [ngModel]="cadeteTexto()"
                (ngModelChange)="cadeteTexto.set($event)"
                (blur)="cerrarSugerenciasLuego()"
                name="cadete"
              />
              @if (cadeteSugerencias().length) {
                <div class="absolute left-0 top-full mt-1 w-64 bg-white rounded shadow-lg border border-gray-200 z-20 max-h-64 overflow-y-auto">
                  @for (c of cadeteSugerencias(); track c.id) {
                    <button
                      type="button"
                      class="block w-full text-left px-3 py-1.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      (mousedown)="elegirCadete(c.id, c.nombre + ' ' + c.apellido)"
                    >
                      {{ c.nombre }} {{ c.apellido }}
                      @if (!c.activo) {
                        <span class="text-xs text-gray-400">(de baja)</span>
                      }
                    </button>
                  }
                </div>
              }
            }
          </div>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-500">Desde</span>
            <input type="date" class="input" [ngModel]="fechaDesde()" (ngModelChange)="cambiarFecha('desde', $event)" name="desde" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-500">Hasta</span>
            <input type="date" class="input" [ngModel]="fechaHasta()" (ngModelChange)="cambiarFecha('hasta', $event)" name="hasta" />
          </label>
          <div class="flex gap-1 pb-1">
            @for (a of atajos; track a.id) {
              <button
                type="button"
                class="btn-mini"
                [class]="atajo() === a.id ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-400 hover:bg-gray-500'"
                (click)="usarAtajo(a.id)"
              >
                {{ a.texto }}
              </button>
            }
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-500">Hora desde</span>
            <input type="time" class="input" [ngModel]="horaDesde()" (ngModelChange)="cambiarHora('desde', $event)" name="horaDesde" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-500">Hora hasta</span>
            <input type="time" class="input" [ngModel]="horaHasta()" (ngModelChange)="cambiarHora('hasta', $event)" name="horaHasta" />
          </label>
          @if (horaDesde() || horaHasta()) {
            <button type="button" class="btn-mini bg-gray-400 hover:bg-gray-500 mb-1" (click)="limpiarHoras()">✕ Horas</button>
          }
        </div>

        <div class="flex flex-wrap gap-1">
          @for (e of estados; track e.id) {
            <!-- Mismo color que el estado en la columna "Estado": suave apagado, fuerte el elegido. -->
            <button
              type="button"
              class="chip-estado"
              [class]="estado() === e.id ? e.fuerte + ' chip-elegido' : e.suave"
              (click)="cambiarEstado(e.id)"
            >
              {{ e.texto }}
            </button>
          }
        </div>

        @if (numero() != null) {
          <p class="text-xs text-gray-500">Buscando por número: no se tienen en cuenta las fechas.</p>
        }
      </div>

      <div class="p-4">
        @if (cargando()) {
          <app-loading-skeleton [filas]="5" />
        } @else if (pedidos().length === 0) {
          <app-empty-state icono="🔍" mensaje="No hay pedidos con estos filtros." hint="Probá con otras fechas o con 'Todas'." />
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="text-left text-gray-500 border-b border-gray-200">
                  <th class="py-2 pr-3 font-medium">Nº</th>
                  <th class="py-2 pr-3 font-medium">Creado</th>
                  <th class="py-2 pr-3 font-medium">Cliente</th>
                  <th class="py-2 pr-3 font-medium">Desde → Hasta</th>
                  <th class="py-2 pr-3 font-medium">Precio</th>
                  <th class="py-2 pr-3 font-medium">Cadete</th>
                  <th class="py-2 pr-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (p of pedidos(); track p.id) {
                  <tr class="border-b border-gray-100 cursor-pointer hover:bg-brand-50" (click)="pedidoAbierto.set(p.id)">
                    <td class="py-2 pr-3 whitespace-nowrap font-medium">{{ p.numero }}</td>
                    <td class="py-2 pr-3 whitespace-nowrap">{{ p.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td class="py-2 pr-3 whitespace-nowrap">
                      <div>{{ p.clienteNombre }}</div>
                      <div class="text-xs text-gray-500">{{ p.clienteTelefono }}</div>
                    </td>
                    <td class="py-2 pr-3">
                      <div>{{ p.origenDireccion }}</div>
                      <div class="text-xs text-gray-500">→ {{ p.destinoDireccion }}</div>
                    </td>
                    <td class="py-2 pr-3 whitespace-nowrap">$ {{ p.precio }}</td>
                    <td class="py-2 pr-3 whitespace-nowrap">
                      @if (p.cadeteAsignado) {
                        {{ p.cadeteAsignado.nombre }} {{ p.cadeteAsignado.apellido }}
                      } @else {
                        <span class="text-gray-400">—</span>
                      }
                    </td>
                    <td class="py-2 pr-3 whitespace-nowrap">
                      <span class="px-2 py-0.5 rounded text-xs font-medium" [class]="claseEstado(p)">{{ textoEstado(p) }}</span>
                      @if (p.reclamoTipo) {
                        <span class="ml-1" title="El cliente hizo un reclamo">📣</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (totalPaginas() > 1) {
            <div class="flex items-center justify-between px-1 pt-3 text-xs text-gray-500">
              <span>Página {{ pagina() + 1 }} de {{ totalPaginas() }}</span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="btn-mini bg-gray-400 hover:bg-gray-500"
                  [disabled]="pagina() <= 0"
                  (click)="irAPagina(pagina() - 1)"
                >
                  ‹ Anterior
                </button>
                <button
                  type="button"
                  class="btn-mini bg-gray-400 hover:bg-gray-500"
                  [disabled]="pagina() + 1 >= totalPaginas()"
                  (click)="irAPagina(pagina() + 1)"
                >
                  Siguiente ›
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <app-pedido-detalle-modal [pedidoId]="pedidoAbierto()" (cerrar)="pedidoAbierto.set(null)" (cambiado)="buscar()" />
  `,
})
export class PedidosComponent implements OnInit, OnDestroy {
  private readonly pedidosSvc = inject(PedidoService);
  private readonly cadetesSvc = inject(CadeteService);

  readonly estados = ESTADOS;
  readonly atajos: { id: Atajo; texto: string }[] = [
    { id: 'hoy', texto: 'Hoy' },
    { id: 'ayer', texto: 'Ayer' },
    { id: '7', texto: '7 días' },
    { id: '30', texto: '30 días' },
    { id: 'todas', texto: 'Todas' },
  ];

  // Filtros
  readonly numeroTexto = signal('');
  readonly numero = computed(() => {
    const d = this.numeroTexto().replace(/\D/g, '');
    return d ? Number(d) : null;
  });
  readonly cliente = signal<ClienteSugerido | null>(null);
  readonly clienteTexto = signal('');
  readonly clienteSugerencias = signal<ClienteSugerido[]>([]);
  readonly cadete = signal<{ id: string; nombre: string } | null>(null);
  readonly cadeteTexto = signal('');
  readonly estado = signal('');
  readonly fechaDesde = signal(diaLocal(new Date()));
  readonly fechaHasta = signal(diaLocal(new Date()));
  readonly atajo = signal<Atajo | null>('hoy');
  readonly horaDesde = signal('');
  readonly horaHasta = signal('');

  readonly cadeteSugerencias = computed(() => {
    const q = this.cadeteTexto().trim().toLowerCase();
    if (!q) return [];
    return this.cadetesSvc
      .cadetes()
      .filter((c) => `${c.nombre} ${c.apellido}`.toLowerCase().includes(q))
      .slice(0, 8);
  });

  // Resultado
  readonly pedidos = signal<Pedido[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly totalPaginas = signal(1);
  readonly cargando = signal(false);
  readonly pedidoAbierto = signal<string | null>(null);

  private readonly clienteBusqueda = new Subject<string>();
  private readonly numeroCambio = new Subject<void>();
  private subs: Subscription[] = [];
  private busquedaActual?: Subscription;

  ngOnInit(): void {
    this.cadetesSvc.ensureLoaded();
    this.subs.push(
      this.clienteBusqueda
        .pipe(
          debounceTime(300),
          distinctUntilChanged(),
          switchMap((q) => (q.trim().length >= 2 ? this.pedidosSvc.clientesSugeridos(q.trim()) : of([]))),
        )
        .subscribe((s) => this.clienteSugerencias.set(s)),
      this.numeroCambio.pipe(debounceTime(400)).subscribe(() => this.buscarDesdeCero()),
    );
    this.buscar();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.busquedaActual?.unsubscribe();
  }

  // ---- filtros ----

  cambiarNumero(texto: string): void {
    this.numeroTexto.set(texto);
    this.numeroCambio.next();
  }

  escribirCliente(texto: string): void {
    this.clienteTexto.set(texto);
    this.clienteBusqueda.next(texto);
  }

  elegirCliente(s: ClienteSugerido): void {
    this.cliente.set(s);
    this.clienteTexto.set('');
    this.clienteSugerencias.set([]);
    this.buscarDesdeCero();
  }

  quitarCliente(): void {
    this.cliente.set(null);
    this.buscarDesdeCero();
  }

  elegirCadete(id: string, nombre: string): void {
    this.cadete.set({ id, nombre });
    this.cadeteTexto.set('');
    this.buscarDesdeCero();
  }

  quitarCadete(): void {
    this.cadete.set(null);
    this.buscarDesdeCero();
  }

  /** Al salir del campo se cierran las listas; el click en una sugerencia usa mousedown, que llega antes. */
  cerrarSugerenciasLuego(): void {
    setTimeout(() => {
      this.clienteSugerencias.set([]);
      this.cadeteTexto.set('');
    }, 150);
  }

  cambiarEstado(id: string): void {
    this.estado.set(id);
    this.buscarDesdeCero();
  }

  cambiarFecha(cual: 'desde' | 'hasta', valor: string): void {
    (cual === 'desde' ? this.fechaDesde : this.fechaHasta).set(valor || '');
    this.atajo.set(null);
    this.buscarDesdeCero();
  }

  usarAtajo(a: Atajo): void {
    this.atajo.set(a);
    const hoy = diaLocal(new Date());
    switch (a) {
      case 'hoy':
        this.fechaDesde.set(hoy);
        this.fechaHasta.set(hoy);
        break;
      case 'ayer':
        this.fechaDesde.set(haceDias(1));
        this.fechaHasta.set(haceDias(1));
        break;
      case '7':
        this.fechaDesde.set(haceDias(6));
        this.fechaHasta.set(hoy);
        break;
      case '30':
        this.fechaDesde.set(haceDias(29));
        this.fechaHasta.set(hoy);
        break;
      case 'todas':
        this.fechaDesde.set('');
        this.fechaHasta.set('');
        break;
    }
    this.buscarDesdeCero();
  }

  cambiarHora(cual: 'desde' | 'hasta', valor: string): void {
    (cual === 'desde' ? this.horaDesde : this.horaHasta).set(valor || '');
    this.buscarDesdeCero();
  }

  limpiarHoras(): void {
    this.horaDesde.set('');
    this.horaHasta.set('');
    this.buscarDesdeCero();
  }

  // ---- búsqueda ----

  irAPagina(n: number): void {
    this.pagina.set(n);
    this.buscar();
  }

  private buscarDesdeCero(): void {
    this.pagina.set(0);
    this.buscar();
  }

  buscar(): void {
    const numero = this.numero();
    const filtro: FiltroPedidos = {
      numero,
      telefono: this.cliente()?.telefono ?? null,
      cadeteId: this.cadete()?.id ?? null,
      estado: this.estado() || null,
      // Con número de pedido no se filtra por fecha: es para encontrar ese pedido sea del día que sea.
      desde: numero == null && this.fechaDesde() ? this.inicioDelDia(this.fechaDesde()) : null,
      hasta: numero == null && this.fechaHasta() ? this.inicioDelDia(this.fechaHasta(), 1) : null,
      horaDesde: this.horaDesde() || null,
      horaHasta: this.horaHasta() || null,
    };
    this.cargando.set(true);
    this.busquedaActual?.unsubscribe();
    this.busquedaActual = this.pedidosSvc.buscar(filtro, this.pagina(), TAMANO_PAGINA).subscribe({
      next: (r) => {
        this.pedidos.set(r.items);
        this.total.set(r.total);
        this.totalPaginas.set(Math.max(1, r.totalPaginas));
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** 00:00 de ese día (hora local) en ISO; con `masDias` = 1 da el inicio del día siguiente (hasta exclusivo). */
  private inicioDelDia(dia: string, masDias = 0): string {
    const [a, m, d] = dia.split('-').map(Number);
    return new Date(a, m - 1, d + masDias, 0, 0, 0, 0).toISOString();
  }

  // ---- presentación ----

  claseEstado(p: Pedido): string {
    if (p.estado.id === 'EN_CURSO' && p.retiradoEn) return ESTADOS.find((e) => e.id === 'RETIRADO')!.suave;
    return claseEstadoPedido(p.estado.id);
  }

  textoEstado(p: Pedido): string {
    if (p.estado.id === 'EN_CURSO') return p.retiradoEn ? 'Retirado' : 'En curso';
    return ESTADOS.find((e) => e.id === p.estado.id)?.texto ?? p.estado.nombre;
  }
}
