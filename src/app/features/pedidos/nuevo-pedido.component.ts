import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { LookupService } from '../../core/services/lookup.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { ZonaService } from '../../core/services/zona.service';
import { PedidoService } from '../../core/services/pedido.service';
import { ClienteService } from '../../core/services/cliente.service';
import { ParadaInput, PedidoInput } from '../../core/models/pedido.model';
import { ClienteAviso } from '../../core/models/cliente.model';
import { AddressPickerComponent, PickedAddress } from '../../shared/address-picker.component';

@Component({
  selector: 'app-nuevo-pedido',
  imports: [FormsModule, AddressPickerComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-end gap-2 px-4 py-3 border-b border-gray-200">
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

        @if (clienteAviso()?.problematico) {
          <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">
            ⚠️ Este teléfono está marcado como cliente problemático{{ clienteAviso()!.notasProblematico ? ': ' + clienteAviso()!.notasProblematico : '' }}.
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
                <app-address-picker (addressPicked)="origenPicked = $event" />
              }
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Dirección destino</span>
              @for (k of [formKey()]; track k) {
                <app-address-picker (addressPicked)="destinoPicked = $event" />
              }
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
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Zona</span>
              <select class="input" [ngModel]="zonaId" (ngModelChange)="onZonaChange($event)" name="zonaId">
                <option [ngValue]="null" disabled>Elegir…</option>
                @for (z of zonas.zonas(); track z.id) {
                  @if (z.activo) {
                    <option [ngValue]="z.id">{{ z.nombre }}</option>
                  }
                }
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Tipo de vehículo</span>
              <select class="input" [(ngModel)]="tipoVehiculoRequeridoId" name="tipoVehiculoRequeridoId">
                <option [ngValue]="null" disabled>Elegir…</option>
                @for (t of lookups.tiposVehiculo(); track t.id) {
                  <option [ngValue]="t.id">{{ t.nombre }}</option>
                }
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Dinero</span>
              <input type="number" min="0" step="0.01" class="input" [(ngModel)]="precio" name="precio" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Valor trámite</span>
              <input type="number" min="0" step="0.01" class="input" [(ngModel)]="montoDeclarado" name="montoDeclarado" />
            </label>
          </div>

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Descripción</span>
            <textarea class="input" rows="2" [(ngModel)]="detalle" name="detalle"></textarea>
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
  readonly lookups = inject(LookupService);
  readonly zonas = inject(ZonaService);
  private readonly config = inject(ConfiguracionService);
  readonly pedidos = inject(PedidoService);
  private readonly clientes = inject(ClienteService);
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

  zonaId: string | null = null;
  tipoVehiculoRequeridoId: string | null = null;
  precio: number | null = null;
  montoDeclarado: number | null = null;
  detalle = '';

  readonly error = signal<string | null>(null);
  readonly guardadoAviso = signal<string | null>(null);
  readonly formKey = signal(0);

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
    this.lookups.ensureLoaded();
    this.zonas.ensureLoaded();
    this.config.ensureLoaded();
  }

  onTelefonoChange(valor: string): void {
    this.clienteTelefono = valor;
    this.autocompletado = false;
    this.clienteAviso.set(null);
    this.telefono$.next(valor);
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

  onZonaChange(zonaId: string | null): void {
    this.zonaId = zonaId;
    if (this.precio != null) return;
    const zona = this.zonas.zonas().find((z) => z.id === zonaId);
    if (zona?.tarifaSugerida != null) {
      this.precio = zona.tarifaSugerida;
    }
  }

  guardar(seguirCargando: boolean): void {
    this.error.set(null);
    this.guardadoAviso.set(null);

    if (!this.clienteNombre || !this.clienteTelefono) {
      this.error.set('Completá el nombre y teléfono del cliente.');
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
    if (!this.zonaId || !this.tipoVehiculoRequeridoId) {
      this.error.set('Elegí la zona y el tipo de vehículo.');
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
      detalle: this.detalle || null,
      zonaId: this.zonaId,
      tipoVehiculoRequeridoId: this.tipoVehiculoRequeridoId,
      programado: this.programado,
      fechaProgramada,
      paradasAdicionales: paradasAdicionales.length ? paradasAdicionales : null,
    };

    this.pedidos.crear(input, () => {
      if (seguirCargando) {
        this.resetearFormulario();
      } else {
        this.router.navigateByUrl('/');
      }
    });
  }

  /** Ronda de auditoría UX — evita perder la zona/tipo de vehículo elegidos cuando se cargan varios pedidos seguidos del mismo lado. */
  private resetearFormulario(): void {
    this.guardadoAviso.set('✅ Pedido cargado. Podés cargar otro.');
    this.clienteNombre = '';
    this.clienteTelefono = '';
    this.autocompletado = false;
    this.clienteAviso.set(null);
    this.programado = false;
    this.fecha = '';
    this.hora = '';
    this.origenPicked = null;
    this.destinoPicked = null;
    this.paradas.set([]);
    this.precio = null;
    this.montoDeclarado = null;
    this.detalle = '';
    this.formKey.update((k) => k + 1);
  }

  volver(): void {
    this.router.navigateByUrl('/');
  }
}
