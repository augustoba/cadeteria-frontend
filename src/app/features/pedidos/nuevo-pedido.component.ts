import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { DireccionFrecuente, PedidoService } from '../../core/services/pedido.service';
import { ClienteService } from '../../core/services/cliente.service';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { ParadaInput, PedidoInput } from '../../core/models/pedido.model';
import { ClienteAviso } from '../../core/models/cliente.model';
import { AvisoClienteComponent } from '../../shared/aviso-cliente.component';
import { AddressPickerComponent, PickedAddress } from '../../shared/address-picker.component';
import * as V from '../../core/utils/validaciones';

@Component({
  selector: 'app-nuevo-pedido',
  imports: [FormsModule, AddressPickerComponent, AvisoClienteComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-end gap-2 px-4 py-3 border-b border-gray-200">
        <button
          type="button"
          class="btn bg-indigo-600 hover:bg-indigo-700"
          [disabled]="pedidos.saving() || !origenPicked"
          title="Guarda este pedido y deja cargado el mismo origen para pedir otro destino (mismo cliente que pide varios envíos separados)"
          (click)="guardar(true, true)"
        >
          ➕ Agregar otro pedido (mismo origen)
        </button>
        <button
          type="button"
          class="btn bg-emerald-600 hover:bg-emerald-700"
          [disabled]="pedidos.saving()"
          (click)="guardar(true)"
        >
          💾 Guardar y cargar otro
        </button>
        <button type="button" class="btn bg-emerald-700 hover:bg-emerald-800" [disabled]="pedidos.saving()" (click)="guardar(false)">
          ✅ Guardar
        </button>
        <button type="button" class="btn bg-red-500 hover:bg-red-600" (click)="volver()">↩ Volver</button>
      </div>

      <div class="p-4 flex flex-col gap-5">
        @if (guardadoAviso()) {
          <div class="rounded bg-emerald-50 text-emerald-700 text-sm px-3 py-2">{{ guardadoAviso() }}</div>
        }
        @if (error()) {
          <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
        }
        @if (fueraDeHorario()) {
          <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">
            ⏰ Estás cargando este pedido fuera del horario habitual de atención.
          </div>
        }

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Cliente</span>
            <input
              class="input"
              [(ngModel)]="clienteNombre"
              name="clienteNombre"
              placeholder="Nombre"
              (ngModelChange)="autocompletado = false"
            />
            @if (autocompletado) {
              <span class="text-xs text-emerald-600">
                Autocompletado por teléfono — lo podés cambiar, no se guarda como cambio permanente.
              </span>
            }
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Teléfono</span>
            <input
              class="input"
              [ngModel]="clienteTelefono"
              (ngModelChange)="onTelefonoChange($event)"
              name="clienteTelefono"
              placeholder="Teléfono"
            />
          </label>
        </div>

        <app-aviso-cliente [aviso]="clienteAviso()" />

        <!-- Direcciones de siempre del cliente (2026-09-25): un clic y queda cargada, sin buscar. -->
        @if (direccionesCliente().length) {
          <div class="rounded border border-brand-200 bg-brand-50 px-3 py-2 flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-gray-600">📍 Direcciones que ya usó este cliente</span>
            @for (d of direccionesCliente(); track d.clave) {
              <div class="flex items-center gap-2 flex-wrap text-sm">
                <span class="flex-1 min-w-0 truncate text-gray-800" [title]="d.direccion">
                  {{ d.direccion }}
                  @if (d.piso || d.depto) {
                    <span class="text-gray-500">— {{ d.piso ? 'piso ' + d.piso : '' }} {{ d.depto ? 'depto ' + d.depto : '' }}</span>
                  }
                  <span class="text-xs text-gray-400">({{ d.vecesOrigen + d.vecesDestino }} {{ d.vecesOrigen + d.vecesDestino === 1 ? 'vez' : 'veces' }})</span>
                </span>
                <button type="button" class="btn-dir" (click)="usarDireccion(d, 'origen')">Usar como origen</button>
                <button type="button" class="btn-dir" (click)="usarDireccion(d, 'destino')">Usar como destino</button>
                <!-- La "x" (2026-10-05): saca una dirección que quedó mal o que el cliente ya no usa. Pide confirmar: está al lado de botones de todos los días. -->
                @if (quitando() === d.clave) {
                  <span class="text-xs text-gray-600">¿Quitarla de la lista?</span>
                  <button type="button" class="btn-dir" (click)="quitarDireccion(d)">Sí, quitar</button>
                  <button type="button" class="btn-dir" (click)="quitando.set(null)">No</button>
                } @else {
                  <button
                    type="button"
                    class="btn-dir"
                    title="Quitar esta dirección de las sugerencias de este cliente"
                    aria-label="Quitar esta dirección de las sugerencias"
                    (click)="quitando.set(d.clave)"
                  >
                    ✕
                  </button>
                }
              </div>
            }
          </div>
        }

        <div class="grid sm:grid-cols-3 gap-4 items-end">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">¿Pedido programado?</span>
            <select class="input" [(ngModel)]="programado" name="programado">
              <option [ngValue]="false">No</option>
              <option [ngValue]="true">Sí</option>
            </select>
          </label>
          @if (programado) {
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Fecha</span>
              <input type="date" class="input" [(ngModel)]="fecha" name="fecha" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Hora</span>
              <input type="time" class="input" [(ngModel)]="hora" name="hora" />
            </label>
          }
        </div>

        <div class="border border-gray-200 rounded p-4 flex flex-col gap-4">
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Dirección origen</span>
              @for (k of [formKey()]; track k) {
                <app-address-picker #origenPickerRef (addressPicked)="onOrigenPicked($event)" />
              }
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input class="input" [(ngModel)]="origenPiso" name="origenPiso" maxlength="20" placeholder="Piso (opcional)" />
                <input class="input" [(ngModel)]="origenDepto" name="origenDepto" maxlength="20" placeholder="Depto (opcional)" />
                <input
                  class="input col-span-2"
                  [(ngModel)]="origenObservaciones"
                  name="origenObservaciones"
                  maxlength="300"
                  placeholder="Observaciones de la dirección (opcional)"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Dirección destino</span>
              @for (k of [formKey()]; track k) {
                <app-address-picker #destinoPickerRef (addressPicked)="onDestinoPicked($event)" />
              }
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input class="input" [(ngModel)]="destinoPiso" name="destinoPiso" maxlength="20" placeholder="Piso (opcional)" />
                <input class="input" [(ngModel)]="destinoDepto" name="destinoDepto" maxlength="20" placeholder="Depto (opcional)" />
                <input
                  class="input col-span-2"
                  [(ngModel)]="destinoObservaciones"
                  name="destinoObservaciones"
                  maxlength="300"
                  placeholder="Observaciones de la dirección (opcional)"
                />
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">Paradas adicionales (opcional)</span>
              <div class="flex gap-2">
                @if (paradas().length >= 2 && todasLasParadasTienenDireccion()) {
                  <button type="button" class="btn-mini bg-violet-600 hover:bg-violet-700" (click)="sugerirOrdenParadas()">
                    🧭 Sugerir orden óptimo
                  </button>
                }
                <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="agregarParada()">
                  + Agregar parada
                </button>
              </div>
            </div>
            <p class="text-xs text-gray-400 -mt-2">
              Para repartos que entregan varios paquetes en la misma vuelta — se entregan en el orden en que las
              cargués, antes de la dirección destino de arriba (que sigue siendo la última entrega).
            </p>
            @for (parada of paradas(); track parada.idLocal) {
              <div class="flex items-start gap-2 border border-gray-200 rounded p-3">
                <span class="text-xs font-semibold text-gray-400 mt-2">{{ $index + 1 }}</span>
                <div class="flex-1">
                  <app-address-picker (addressPicked)="onParadaPicked(parada.idLocal, $event)" />
                </div>
                <button
                  type="button"
                  class="btn-mini bg-red-500 hover:bg-red-600 mt-0.5"
                  (click)="quitarParada(parada.idLocal)"
                >
                  Quitar
                </button>
              </div>
            }
          </div>

          <div class="grid sm:grid-cols-4 gap-4">
            <label class="flex items-center gap-2 mt-6">
              <input type="checkbox" [(ngModel)]="requiereMoto" name="requiereMoto" />
              <span class="text-sm font-medium text-gray-700">Requiere moto</span>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Valor trámite</span>
              <input
                type="number"
                min="0"
                step="0.01"
                class="input"
                [ngModel]="precio"
                (ngModelChange)="precio = $event; precioSugeridoInfo = null"
                name="precio"
              />
              @if (precioSugeridoInfo) {
                <span class="text-xs text-emerald-600">💰 {{ precioSugeridoInfo }} — lo podés cambiar.</span>
              }
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Dinero</span>
              <input
                type="number"
                min="0"
                step="0.01"
                class="input"
                [ngModel]="montoDeclarado"
                (ngModelChange)="onMontoDeclaradoChange($event)"
                name="montoDeclarado"
              />
            </label>
            <label class="flex items-center gap-2 mt-6" title="Objetos de valor (no dinero en efectivo) — suma recargo igual que el dinero">
              <input type="checkbox" [ngModel]="llevaValores" (ngModelChange)="onLlevaValoresChange($event)" name="llevaValores" />
              <span class="text-sm font-medium text-gray-700">Transporta valores</span>
            </label>
            @if (llevaValores) {
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Valor de los objetos</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  class="input"
                  [ngModel]="montoValores"
                  (ngModelChange)="onMontoValoresChange($event)"
                  name="montoValores"
                />
              </label>
            }
          </div>

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Detalle del pedido</span>
            <textarea
              class="input"
              rows="2"
              [(ngModel)]="detalle"
              name="detalle"
              placeholder="Qué se lleva, cómo va embalado, a quién preguntar…"
            ></textarea>
            <span class="text-xs text-gray-400">
              El cadete ve el detalle, el piso, el depto y las observaciones recién cuando acepta el viaje.
            </span>
          </label>
        </div>
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
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
      }
      .btn-dir {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.25rem 0.6rem;
        border-radius: 0.25rem;
        color: var(--color-brand-700);
        background: white;
        border: 1px solid var(--color-brand-200);
      }
      .btn-dir:hover {
        background: var(--color-brand-100);
      }
      .btn:disabled {
        opacity: 0.6;
      }
      .btn-mini {
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.35rem 0.65rem;
        border-radius: 0.25rem;
        white-space: nowrap;
      }
    `,
  ],
})
export class NuevoPedidoComponent implements OnInit {
  private readonly config = inject(ConfiguracionService);
  readonly pedidos = inject(PedidoService);
  private readonly clientes = inject(ClienteService);
  private readonly cotizacion = inject(CotizacionService);
  private readonly router = inject(Router);

  clienteNombre = '';
  clienteTelefono = '';
  autocompletado = false;
  readonly clienteAviso = signal<ClienteAviso | null>(null);
  private readonly telefono$ = new Subject<string>();
  programado = false;
  fecha = '';
  hora = '';

  origenPicked: PickedAddress | null = null;
  destinoPicked: PickedAddress | null = null;

  private siguienteIdLocal = 1;
  readonly paradas = signal<Array<{ idLocal: number; picked: PickedAddress | null }>>([]);

  requiereMoto = false;
  precio: number | null = null;
  precioSugeridoInfo: string | null = null;
  montoDeclarado: number | null = null;
  llevaValores = false;
  montoValores: number | null = null;
  detalle = '';
  origenPiso = '';
  origenDepto = '';
  origenObservaciones = '';
  destinoPiso = '';
  destinoDepto = '';
  destinoObservaciones = '';

  readonly error = signal<string | null>(null);
  readonly guardadoAviso = signal<string | null>(null);
  readonly formKey = signal(0);
  private readonly destinoPickerRef = viewChild<AddressPickerComponent>('destinoPickerRef');
  private readonly origenPickerRef = viewChild<AddressPickerComponent>('origenPickerRef');
  readonly direccionesCliente = signal<DireccionFrecuente[]>([]);
  /** Clave de la dirección habitual que está pidiendo confirmación para quitarse. */
  readonly quitando = signal<string | null>(null);

  /** Mejora 77 — franja horaria de atención configurable, solo avisa, no bloquea la carga. */
  readonly fueraDeHorario = computed(() => {
    const v = this.config.valores();
    if ((v['horario_atencion_activo'] ?? 'false') !== 'true') return false;
    const desde = v['horario_atencion_desde'] ?? '08:00';
    const hasta = v['horario_atencion_hasta'] ?? '22:00';
    const ahora = new Date();
    const actual = ahora.getHours() * 60 + ahora.getMinutes();
    const [hd, md] = desde.split(':').map(Number);
    const [hh, mh] = hasta.split(':').map(Number);
    const minDesde = hd * 60 + md;
    const minHasta = hh * 60 + mh;
    return minDesde <= minHasta ? actual < minDesde || actual > minHasta : actual < minDesde && actual > minHasta;
  });

  constructor() {
    // Spec 5.6: al cargar un pedido con un teléfono ya visto, autocompleta el nombre
    // del último pedido con ese número — editable acá sin que se guarde en ningún lado
    // (no hay entidad "cliente", el teléfono nunca fuerza un único nombre).
    this.telefono$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((t) => t.trim().length >= 6),
        switchMap((t) => this.pedidos.buscarCliente(t.trim())),
      )
      .subscribe((nombre) => {
        if (nombre && !this.clienteNombre.trim()) {
          this.clienteNombre = nombre;
          this.autocompletado = true;
        }
      });

    // Direcciones de siempre de ese teléfono (2026-09-25).
    this.telefono$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((t) => t.replace(/\D/g, '').length >= 6),
        switchMap((t) => this.pedidos.direccionesCliente(t.trim())),
      )
      .subscribe((lista) => this.direccionesCliente.set(lista));

    // Aviso si el teléfono está marcado como problemático, y sugerencia de tarifa especial (ronda 4, puntos 44/58).
    this.telefono$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((t) => t.trim().length >= 6),
        switchMap((t) => this.clientes.aviso(t.trim())),
      )
      .subscribe((aviso) => {
        this.clienteAviso.set(aviso);
        if (aviso.tarifaEspecial != null && this.precio == null) {
          this.precio = aviso.tarifaEspecial;
        }
      });
  }

  ngOnInit(): void {
    this.config.ensureLoaded();
  }

  onTelefonoChange(valor: string): void {
    this.clienteTelefono = valor;
    this.autocompletado = false;
    this.clienteAviso.set(null);
    this.direccionesCliente.set([]);
    this.telefono$.next(valor);
  }

  /** Quita una dirección habitual de las sugerencias de este cliente. Vuelve sola si se carga otro pedido ahí. */
  quitarDireccion(d: DireccionFrecuente): void {
    this.quitando.set(null);
    this.pedidos.ocultarDireccionCliente(this.clienteTelefono.trim(), d.clave).subscribe({
      next: () => this.direccionesCliente.update((lista) => lista.filter((x) => x.clave !== d.clave)),
      error: () => this.error.set('No se pudo quitar la dirección. Probá de nuevo.'),
    });
  }

  /** Carga una dirección habitual del cliente en origen o destino, con su piso/depto/observaciones. */
  usarDireccion(d: DireccionFrecuente, donde: 'origen' | 'destino'): void {
    // fuente null: ya es una dirección conocida, no hay nada que aprender
    const picked: PickedAddress = { address: d.direccion, lat: d.lat, lng: d.lng, approximate: false, fuente: null };
    if (donde === 'origen') {
      this.origenPickerRef()?.setValue(picked);
      this.origenPiso = d.piso ?? '';
      this.origenDepto = d.depto ?? '';
      this.origenObservaciones = d.observaciones ?? '';
      this.onOrigenPicked(picked);
    } else {
      this.destinoPickerRef()?.setValue(picked);
      this.destinoPiso = d.piso ?? '';
      this.destinoDepto = d.depto ?? '';
      this.destinoObservaciones = d.observaciones ?? '';
      this.onDestinoPicked(picked);
    }
  }

  agregarParada(): void {
    this.paradas.update((actuales) => [...actuales, { idLocal: this.siguienteIdLocal++, picked: null }]);
  }

  onParadaPicked(idLocal: number, picked: PickedAddress | null): void {
    this.paradas.update((actuales) => actuales.map((p) => (p.idLocal === idLocal ? { ...p, picked } : p)));
  }

  quitarParada(idLocal: number): void {
    this.paradas.update((actuales) => actuales.filter((p) => p.idLocal !== idLocal));
  }

  todasLasParadasTienenDireccion(): boolean {
    return this.paradas().every((p) => !!p.picked);
  }

  /**
   * Vecino más cercano en línea recta (ronda 10, punto 102) — no pega a OpenRouteService
   * para no gastar cupo/plata en una simple sugerencia; con 2-5 paradas la distancia real
   * de calles casi siempre da el mismo orden que la distancia recta.
   */
  sugerirOrdenParadas(): void {
    if (!this.origenPicked) return;
    const restantes = [...this.paradas()];
    const ordenadas: typeof restantes = [];
    let actual: { lat: number; lng: number } = this.origenPicked;
    while (restantes.length) {
      let mejorIdx = 0;
      let mejorDistancia = Infinity;
      restantes.forEach((p, i) => {
        if (!p.picked) return;
        const d = this.distanciaMetros(actual.lat, actual.lng, p.picked.lat, p.picked.lng);
        if (d < mejorDistancia) {
          mejorDistancia = d;
          mejorIdx = i;
        }
      });
      const [siguiente] = restantes.splice(mejorIdx, 1);
      ordenadas.push(siguiente);
      actual = siguiente.picked!;
    }
    this.paradas.set(ordenadas);
  }

  private distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  onOrigenPicked(p: PickedAddress | null): void {
    this.origenPicked = p;
    this.sugerirPrecio();
  }

  onDestinoPicked(p: PickedAddress | null): void {
    this.destinoPicked = p;
    this.sugerirPrecio();
  }

  /**
   * Cotización automática por GPS (mejora 2026-09-16): con origen y destino ya elegidos,
   * pide una sugerencia de precio — por Zona (la más cara entre la del origen y la del
   * destino, para no cobrar de menos en un viaje que sale del centro hacia una zona más
   * lejana) o por distancia real si ninguna de las dos zonas tiene precio cargado, más el
   * recargo por dinero declarado si corresponde. Hace falta el destino también: con solo
   * el origen no se sabe si el viaje se queda adentro de esa zona o cruza a una más cara.
   * Nunca pisa un precio ya editado a mano — pero si el precio actual vino de una
   * sugerencia anterior (`precioSugeridoInfo` todavía cargado), se puede volver a calcular,
   * por ejemplo cuando el admin recién completa "Dinero" después de elegir las direcciones.
   */
  private sugerirPrecio(): void {
    if (!this.origenPicked || !this.destinoPicked) return;
    if (this.precio != null && this.precioSugeridoInfo == null) return;
    this.cotizacion
      .cotizar(
        this.origenPicked.lat,
        this.origenPicked.lng,
        this.destinoPicked.lat,
        this.destinoPicked.lng,
        this.montoDeclarado,
        false,
        this.llevaValores ? this.montoValores : null,
      )
      .subscribe((c) => {
        if ((this.precio != null && this.precioSugeridoInfo == null) || c.precioSugerido == null) return;
        this.precio = c.precioSugerido;
        this.precioSugeridoInfo =
          c.metodo === 'DISTANCIA_ESTIMADA'
            ? `Sugerido por distancia estimada (~${c.distanciaKm?.toFixed(1)} km, no se pudo calcular la ruta)`
            : `Sugerido por distancia (~${c.distanciaKm?.toFixed(1)} km)`;
      });
  }

  /** Si ya hay origen/destino y el precio sigue siendo el sugerido (no lo tocaron a mano), recalcula al cambiar el dinero declarado. */
  onMontoDeclaradoChange(valor: number | null): void {
    this.montoDeclarado = valor;
    this.sugerirPrecio();
  }

  /** El valor de los objetos de valor suma recargo igual que el dinero (2026-09-25). */
  onLlevaValoresChange(valor: boolean): void {
    this.llevaValores = valor;
    this.sugerirPrecio();
  }

  onMontoValoresChange(valor: number | null): void {
    this.montoValores = valor;
    this.sugerirPrecio();
  }

  guardar(seguirCargando: boolean, mismoOrigen = false): void {
    this.error.set(null);
    this.guardadoAviso.set(null);

    if (!this.clienteNombre || !this.clienteTelefono) {
      this.error.set('Completá el nombre y teléfono del cliente.');
      return;
    }
    // Mismas reglas que el backend (core/utils/validaciones.ts).
    const mal = V.problemas([
      [!V.TELEFONO.test(this.clienteTelefono), V.MSJ.telefono],
      [!V.NOMBRE_CLIENTE.test(this.clienteNombre.trim()), V.MSJ.nombreCliente],
    ]);
    if (mal) {
      this.error.set(mal);
      return;
    }
    if (!this.origenPicked) {
      this.error.set('Buscá y marcá la dirección de origen.');
      return;
    }
    if (!this.destinoPicked) {
      this.error.set('Buscá y marcá la dirección de destino.');
      return;
    }
    const paradasSinDireccion = this.paradas().some((p) => !p.picked);
    if (paradasSinDireccion) {
      this.error.set('Buscá y marcá la dirección de todas las paradas, o quitá las que no vayas a usar.');
      return;
    }
    if (this.precio == null || this.precio < 0) {
      this.error.set('Ingresá el precio del pedido.');
      return;
    }

    let fechaProgramada: string | null = null;
    if (this.programado) {
      if (!this.fecha || !this.hora) {
        this.error.set('Completá la fecha y hora del pedido programado.');
        return;
      }
      fechaProgramada = new Date(`${this.fecha}T${this.hora}`).toISOString();
    }

    const paradasAdicionales: ParadaInput[] = this.paradas().map((p) => ({
      direccion: p.picked!.address,
      lat: p.picked!.lat,
      lng: p.picked!.lng,
    }));

    const input: PedidoInput = {
      clienteTelefono: this.clienteTelefono,
      clienteNombre: this.clienteNombre,
      origenDireccion: this.origenPicked.address,
      origenLat: this.origenPicked.lat,
      origenLng: this.origenPicked.lng,
      destinoDireccion: this.destinoPicked.address,
      destinoLat: this.destinoPicked.lat,
      destinoLng: this.destinoPicked.lng,
      precio: this.precio,
      montoDeclarado: this.montoDeclarado,
      llevaValores: this.llevaValores,
      montoValores: this.llevaValores ? this.montoValores : null,
      detalle: this.detalle || null,
      origenPiso: this.origenPiso.trim() || null,
      origenDepto: this.origenDepto.trim() || null,
      origenObservaciones: this.origenObservaciones.trim() || null,
      destinoPiso: this.destinoPiso.trim() || null,
      destinoDepto: this.destinoDepto.trim() || null,
      destinoObservaciones: this.destinoObservaciones.trim() || null,
      requiereMoto: this.requiereMoto,
      programado: this.programado,
      fechaProgramada,
      paradasAdicionales: paradasAdicionales.length ? paradasAdicionales : null,
      origenFuente: this.origenPicked.fuente,
      destinoFuente: this.destinoPicked.fuente,
    };

    this.pedidos.crear(input, () => {
      if (!seguirCargando) {
        this.router.navigateByUrl('/');
      } else if (mismoOrigen) {
        this.resetearFormularioMismoOrigen();
      } else {
        this.resetearFormulario();
      }
    });
  }

  /**
   * Para un cliente que hace varios envíos separados desde el mismo lugar (no paradas de
   * un solo viaje, sino pedidos independientes): deja el origen tal cual está cargado y
   * solo limpia lo que cambia de un pedido a otro (destino, precio, requiere moto, etc.).
   */
  private resetearFormularioMismoOrigen(): void {
    this.guardadoAviso.set('✅ Pedido cargado. Buscá el destino del próximo — el origen queda igual.');
    this.programado = false;
    this.fecha = '';
    this.hora = '';
    this.destinoPicked = null;
    this.paradas.set([]);
    this.requiereMoto = false;
    this.precio = null;
    this.precioSugeridoInfo = null;
    this.montoDeclarado = null;
    this.llevaValores = false;
    this.montoValores = null;
    this.detalle = '';
    this.destinoPiso = '';
    this.destinoDepto = '';
    this.destinoObservaciones = '';
    this.destinoPickerRef()?.setValue(null);
  }

  /** Ronda de auditoría UX — evita perder el "requiere moto" elegido cuando se cargan varios pedidos seguidos del mismo lado. */
  private resetearFormulario(): void {
    this.guardadoAviso.set('✅ Pedido cargado. Podés cargar otro.');
    this.clienteNombre = '';
    this.clienteTelefono = '';
    this.autocompletado = false;
    this.clienteAviso.set(null);
    this.direccionesCliente.set([]);
    this.programado = false;
    this.fecha = '';
    this.hora = '';
    this.origenPicked = null;
    this.destinoPicked = null;
    this.paradas.set([]);
    this.precio = null;
    this.precioSugeridoInfo = null;
    this.montoDeclarado = null;
    this.llevaValores = false;
    this.montoValores = null;
    this.detalle = '';
    this.origenPiso = '';
    this.origenDepto = '';
    this.origenObservaciones = '';
    this.destinoPiso = '';
    this.destinoDepto = '';
    this.destinoObservaciones = '';
    this.formKey.update((k) => k + 1);
  }

  volver(): void {
    this.router.navigateByUrl('/');
  }
}
