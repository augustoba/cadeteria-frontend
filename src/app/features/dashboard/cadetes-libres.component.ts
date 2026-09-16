import { Component, EventEmitter, OnInit, Output, computed, effect, inject, signal } from '@angular/core';
import { CadeteService } from '../../core/services/cadete.service';
import { GeocodingService } from '../../core/services/geocoding.service';
import { MetricasService } from '../../core/services/metricas.service';
import { PedidoService } from '../../core/services/pedido.service';
import { Cadete } from '../../core/models/cadete.model';
import { EmptyStateComponent } from '../../shared/empty-state.component';

/** Estados que "ocupan" a un cadete aunque siga LIBRE — mismo criterio que ESTADOS_OCUPAN_CADETE
 * del backend (PedidoService.buscarCandidato). */
const ESTADOS_OCUPAN_CADETE = new Set(['PENDIENTE', 'EN_CURSO']);

/** Metros mínimos de movimiento para volver a resolver la dirección — evita pegarle a
 * Nominatim en cada micro-jitter del GPS (respeta el límite de ~1 req/seg). */
const UMBRAL_METROS = 150;

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Cola de espera": cadetes Libres ahora mismo, con su ubicación aproximada (reverse
 * geocoding con Nominatim) y cuántos pedidos finalizó hoy — para que el admin pueda
 * ver dónde está cada uno y balancear la carga sin ir a Métricas. También se puede
 * asignarle un viaje directo desde acá (botón "Asignar viaje"), además de hacerlo desde
 * el pedido como siempre.
 */
@Component({
  selector: 'app-cadetes-libres',
  imports: [EmptyStateComponent],
  template: `
    <div class="bg-white rounded shadow-sm mt-6">
      <div
        class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between cursor-pointer select-none"
        (click)="abierto.set(!abierto())"
      >
        <h2 class="font-semibold">Cadetes libres ({{ libres().length }})</h2>
        <span class="text-xs text-white/80">{{ abierto() ? '▲ Ocultar' : '▼ Mostrar' }}</span>
      </div>
      @if (abierto()) {
      <div class="p-4">
        <div class="flex items-center gap-2 mb-3 text-xs">
          <span class="text-gray-500">Cobro:</span>
          <button type="button" class="px-2 py-1 rounded" [class]="filtroClase(null)" (click)="filtroModalidad.set(null)">Todos</button>
          <button type="button" class="px-2 py-1 rounded" [class]="filtroClase('SEMANAL')" (click)="filtroModalidad.set('SEMANAL')">
            💵 Semanal
          </button>
          <button type="button" class="px-2 py-1 rounded" [class]="filtroClase('PORCENTAJE')" (click)="filtroModalidad.set('PORCENTAJE')">
            % Porcentaje
          </button>
        </div>
        @if (!libresFiltrados().length) {
          <app-empty-state icono="🏍️" mensaje="No hay cadetes libres ahora mismo." hint="Se van a ir sumando acá a medida que se desocupen." />
        } @else {
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-200">
                <th class="py-2 pr-3 font-medium">Cadete</th>
                <th class="py-2 pr-3 font-medium">Vehículo</th>
                <th class="py-2 pr-3 font-medium" title="Modelo de cobro">Cobro</th>
                <th class="py-2 pr-3 font-medium">Ubicación aproximada</th>
                <th class="py-2 pr-3 font-medium" title="Viajes aceptados/en curso todavía sin finalizar">Sin finalizar</th>
                <th class="py-2 pr-3 font-medium">Pedidos hoy</th>
                <th class="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              @for (c of libresFiltrados(); track c.id) {
                <tr
                  class="border-b border-gray-100"
                  [class.bg-indigo-50]="filaResaltada() === c.id"
                  (dragover)="onDragOver($event, c.id)"
                  (dragleave)="onDragLeave(c.id)"
                  (drop)="onDrop($event, c)"
                >
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.nombre }} {{ c.apellido }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">{{ c.tipoVehiculo.nombre }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap" [title]="c.modalidadPago === 'SEMANAL' ? 'Paga cuota semanal' : 'Paga % por viaje'">
                    {{ c.modalidadPago === 'SEMANAL' ? '💵' : '%' }}
                  </td>
                  <td class="py-2 pr-3">{{ direccionDe(c) }}</td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    <span
                      class="px-2 py-0.5 rounded text-xs font-medium"
                      [class]="pendientesDe(c.id) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'"
                    >
                      {{ pendientesDe(c.id) }}
                    </span>
                  </td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    <span
                      class="px-2 py-0.5 rounded text-xs font-medium"
                      [class]="pedidosHoyDe(c.id) >= 8 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'"
                    >
                      {{ pedidosHoyDe(c.id) }}
                    </span>
                  </td>
                  <td class="py-2 pr-3 whitespace-nowrap">
                    <button type="button" class="btn-mini bg-indigo-600 hover:bg-indigo-700" (click)="asignarClick.emit(c)">
                      Asignar viaje
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      .btn-mini {
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 0.3rem;
      }
    `,
  ],
})
export class CadetesLibresComponent implements OnInit {
  @Output() asignarClick = new EventEmitter<Cadete>();
  /** Mejora 84 — arrastrar una tarjeta "Sin asignar" del Kanban hasta acá para asignarla directo. */
  @Output() pedidoSoltado = new EventEmitter<{ cadete: Cadete; pedidoId: string }>();
  readonly filaResaltada = signal<string | null>(null);

  onDragOver(ev: DragEvent, cadeteId: string): void {
    ev.preventDefault();
    this.filaResaltada.set(cadeteId);
  }

  onDragLeave(cadeteId: string): void {
    if (this.filaResaltada() === cadeteId) this.filaResaltada.set(null);
  }

  onDrop(ev: DragEvent, c: Cadete): void {
    ev.preventDefault();
    this.filaResaltada.set(null);
    const pedidoId = ev.dataTransfer?.getData('text/pedido-id');
    if (pedidoId) this.pedidoSoltado.emit({ cadete: c, pedidoId });
  }

  private readonly cadetesSvc = inject(CadeteService);
  private readonly geocoding = inject(GeocodingService);
  private readonly metricasSvc = inject(MetricasService);
  private readonly pedidosSvc = inject(PedidoService);

  /** Cuántos viajes aceptados/en curso (sin finalizar) tiene cada cadete ahora mismo — mismo
   * criterio que ESTADOS_OCUPAN_CADETE del backend. */
  readonly pendientesPorCadete = computed(() => {
    const mapa = new Map<string, number>();
    for (const p of this.pedidosSvc.pedidos()) {
      if (!ESTADOS_OCUPAN_CADETE.has(p.estado.id) || !p.cadeteAsignado) continue;
      mapa.set(p.cadeteAsignado.id, (mapa.get(p.cadeteAsignado.id) ?? 0) + 1);
    }
    return mapa;
  });

  pendientesDe(cadeteId: string): number {
    return this.pendientesPorCadete().get(cadeteId) ?? 0;
  }

  readonly libres = computed(() => {
    const pendientes = this.pendientesPorCadete();
    return this.cadetesSvc
      .cadetes()
      .filter((c) => c.activo && c.estado.id === 'LIBRE' && c.lat != null && c.lng != null)
      // Primero los libres sin nada pendiente, después los que ya tienen uno o más viajes sin
      // entregar encima — dentro de cada grupo, el que quedó libre primero, primero (FIFO).
      .sort((a, b) => {
        const aOcupado = (pendientes.get(a.id) ?? 0) > 0 ? 1 : 0;
        const bOcupado = (pendientes.get(b.id) ?? 0) > 0 ? 1 : 0;
        if (aOcupado !== bOcupado) return aOcupado - bOcupado;
        return new Date(a.ordenColaEspera).getTime() - new Date(b.ordenColaEspera).getTime();
      });
  });
  readonly abierto = signal(true);

  /** Filtro por modelo de cobro (pedido del dueño) — para balancear carga entre cadetes semanales y por %. */
  readonly filtroModalidad = signal<'SEMANAL' | 'PORCENTAJE' | null>(null);
  readonly libresFiltrados = computed(() => {
    const filtro = this.filtroModalidad();
    return filtro ? this.libres().filter((c) => c.modalidadPago === filtro) : this.libres();
  });

  filtroClase(valor: 'SEMANAL' | 'PORCENTAJE' | null): string {
    return this.filtroModalidad() === valor ? 'bg-brand-100 text-brand-700 font-medium' : 'text-gray-400 hover:bg-gray-50';
  }

  private readonly direcciones = signal<Record<string, string>>({});
  private readonly ultimaResolucion = new Map<string, { lat: number; lng: number }>();
  private readonly resolviendo = new Set<string>();

  private readonly pedidosHoy = signal<Record<string, number>>({});

  constructor() {
    // Re-resuelve la dirección de cada cadete libre cuando se movió lo suficiente
    // (spec: "la zona ... se debe actualizar ... a medida que el cadete va dando la ubicación").
    effect(() => {
      for (const c of this.libres()) {
        const anterior = this.ultimaResolucion.get(c.id);
        const seMovio = !anterior || distanciaMetros(anterior.lat, anterior.lng, c.lat!, c.lng!) > UMBRAL_METROS;
        if (!seMovio || this.resolviendo.has(c.id)) continue;

        this.resolviendo.add(c.id);
        this.ultimaResolucion.set(c.id, { lat: c.lat!, lng: c.lng! });
        this.geocoding.reverse(c.lat!, c.lng!).then((direccion) => {
          this.resolviendo.delete(c.id);
          const texto = direccion?.label ?? `${c.lat!.toFixed(4)}, ${c.lng!.toFixed(4)}`;
          this.direcciones.update((d) => ({ ...d, [c.id]: texto }));
        });
      }
    });
  }

  ngOnInit(): void {
    this.cadetesSvc.ensureLoaded();
    this.cargarPedidosHoy();
  }

  private cargarPedidosHoy(): void {
    const hoy = hoyIso();
    this.metricasSvc.cadetes(hoy, hoy).subscribe((lista) => {
      const mapa: Record<string, number> = {};
      for (const c of lista) mapa[c.cadeteId] = c.viajesFinalizados;
      this.pedidosHoy.set(mapa);
    });
  }

  direccionDe(c: Cadete): string {
    return this.direcciones()[c.id] ?? 'Ubicando…';
  }

  pedidosHoyDe(cadeteId: string): number {
    return this.pedidosHoy()[cadeteId] ?? 0;
  }
}
