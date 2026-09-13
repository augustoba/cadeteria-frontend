import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import * as L from 'leaflet';
import { GeoAddress, GeocodingService } from '../core/services/geocoding.service';

export interface PickedAddress {
  address: string;
  lat: number;
  lng: number;
  /** true si no se ubicó la altura/puerta exacta (conviene pedir referencia). */
  approximate: boolean;
}

/** Centro de San Miguel de Tucumán — punto de partida si el admin carga la dirección a mano. */
const SMT_CENTER = { lat: -26.8306, lng: -65.2038 };

const PIN_ICON = L.divIcon({
  className: '',
  html:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="#1e88e5" stroke="white" stroke-width="1.5">' +
    '<path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>',
  iconSize: [28, 28],
  iconAnchor: [14, 26],
});

/**
 * Busca una dirección de Tucumán (autocompletado con Nominatim/OSM, sesgado a la
 * provincia) y deja ajustar el pin exacto en un mapa; al arrastrarlo, re-resuelve
 * la dirección (reverse geocoding). Emite `{ address, lat, lng, approximate }` o `null`.
 */
@Component({
  selector: 'app-address-picker',
  imports: [FormsModule],
  template: `
    @if (!selected()) {
      <div class="relative">
        <input
          type="text"
          class="input w-full"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
          [placeholder]="placeholder"
          autocomplete="off"
          name="direccionBusqueda"
        />

        @if (searching()) {
          <p class="text-xs text-gray-400 mt-1">Buscando…</p>
        } @else if (query().length >= 4 && !results().length) {
          <p class="text-xs text-gray-500 mt-1">
            No encontramos esa dirección.
            <button type="button" (click)="useTyped()" class="font-semibold text-brand-600 hover:underline">
              Cargarla igual
            </button>
            y ubicarla a mano en el mapa.
          </p>
        }

        @if (results().length) {
          <ul class="absolute z-20 left-0 right-0 mt-1 bg-white rounded border border-gray-200 shadow-lg overflow-hidden">
            @for (r of results(); track r.label + r.lat) {
              <li>
                <button
                  type="button"
                  (click)="choose(r)"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 border-b border-gray-100 last:border-0"
                >
                  {{ r.label }}
                </button>
              </li>
            }
          </ul>
        }
      </div>
    } @else {
      <div class="rounded border border-gray-300 overflow-hidden">
        <div class="flex items-center gap-2 px-3 py-2 bg-gray-50">
          <span aria-hidden="true">📍</span>
          <span class="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">
            {{ locating() ? 'Ubicando…' : selected()!.label }}
          </span>
          <button type="button" (click)="changeAddress()" class="text-xs font-semibold text-brand-600 hover:underline shrink-0">
            Cambiar
          </button>
        </div>
        <div #mapEl class="h-40 w-full bg-gray-100"></div>
        <p class="text-[11px] px-3 py-1.5" [class]="selected()!.approximate ? 'text-amber-600' : 'text-gray-400'">
          @if (selected()!.approximate) {
            Arrastrá el pin al punto exacto — la dirección de arriba se ajusta sola.
          } @else {
            Arrastrá el pin para corregirlo si quedó desviado.
          }
        </p>
      </div>
    }
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
    `,
  ],
})
export class AddressPickerComponent {
  placeholder = 'Calle y altura, ej: San Juan 354';

  private readonly geocoding = inject(GeocodingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  readonly addressPicked = output<PickedAddress | null>();

  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('mapEl');

  readonly query = signal('');
  readonly results = signal<GeoAddress[]>([]);
  readonly searching = signal(false);
  /** Re-resolviendo la dirección después de arrastrar el pin. */
  readonly locating = signal(false);
  readonly selected = signal<GeoAddress | null>(null);
  /** Coordenadas del pin (arranca en las de la dirección, se mueve al arrastrar). */
  readonly pin = signal<{ lat: number; lng: number } | null>(null);

  readonly picked = computed<PickedAddress | null>(() => {
    const sel = this.selected();
    const p = this.pin();
    if (!sel || !p) return null;
    return { address: sel.label, lat: p.lat, lng: p.lng, approximate: sel.approximate };
  });

  private readonly query$ = new Subject<string>();
  private map?: L.Map;
  private marker?: L.Marker;

  constructor() {
    this.query$
      .pipe(
        // 600ms: respeta el límite de ~1 req/s de Nominatim
        debounceTime(600),
        distinctUntilChanged()
      )
      .pipe(
        switchMap((q) => {
          this.searching.set(true);
          return this.geocoding.search(q);
        })
      )
      .subscribe((res) => {
        this.searching.set(false);
        this.results.set(res);
      });

    // (re)crear el mapa cuando hay una dirección elegida y el div ya existe
    effect(() => {
      const sel = this.selected();
      const el = this.mapEl()?.nativeElement;
      if (sel && el && !this.map) this.initMap(el, sel);
    });

    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  /** Precarga una dirección ya guardada (edición) sin volver a buscarla. */
  setValue(valor: PickedAddress | null): void {
    if (!valor) {
      this.selected.set(null);
      this.pin.set(null);
      this.query.set('');
      return;
    }
    this.selected.set({
      label: valor.address,
      street: valor.address,
      number: null,
      locality: '',
      lat: valor.lat,
      lng: valor.lng,
      approximate: valor.approximate,
    });
    this.pin.set({ lat: valor.lat, lng: valor.lng });
    this.query.set(valor.address);
  }

  private emit(): void {
    this.addressPicked.emit(this.picked());
  }

  /** Después de mover el pin: buscar qué dirección hay ahí y actualizar el texto. */
  private async resolvePin(lat: number, lng: number): Promise<void> {
    this.locating.set(true);
    const found = await this.geocoding.reverse(lat, lng);
    this.locating.set(false);
    // ignorar si el admin movió el pin otra vez mientras tanto
    const p = this.pin();
    if (!p || p.lat !== lat || p.lng !== lng || !this.selected()) return;
    if (found) {
      this.selected.set({ ...found, lat, lng });
    } else {
      this.selected.update((s) =>
        s ? { ...s, number: null, approximate: true, label: `${s.street} (ubicación marcada en el mapa)` } : s
      );
    }
    this.query.set(this.selected()!.label);
    this.emit();
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.query$.next(value.trim());
  }

  choose(addr: GeoAddress): void {
    this.selected.set(addr);
    this.pin.set({ lat: addr.lat, lng: addr.lng });
    this.results.set([]);
    this.query.set(addr.label);
    this.emit();
  }

  /** El admin escribió una dirección que el mapa no encuentra: la carga igual y la ubica a mano. */
  useTyped(): void {
    const text = this.query().trim();
    if (text.length < 4) return;
    this.selected.set({
      label: text,
      street: text,
      number: null,
      locality: '',
      lat: SMT_CENTER.lat,
      lng: SMT_CENTER.lng,
      approximate: true,
    });
    this.pin.set({ ...SMT_CENTER });
    this.results.set([]);
    this.emit();
  }

  changeAddress(): void {
    this.map?.remove();
    this.map = undefined;
    this.marker = undefined;
    this.selected.set(null);
    this.pin.set(null);
    this.results.set([]);
    this.query.set('');
    this.emit();
  }

  private initMap(el: HTMLElement, addr: GeoAddress): void {
    const center: L.LatLngExpression = [addr.lat, addr.lng];
    this.map = L.map(el, { attributionControl: true }).setView(center, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.map);

    this.marker = L.marker(center, { draggable: true, icon: PIN_ICON }).addTo(this.map);
    this.marker.on('dragend', () => {
      const p = this.marker!.getLatLng();
      this.zone.run(() => {
        this.pin.set({ lat: p.lat, lng: p.lng });
        this.emit();
        this.resolvePin(p.lat, p.lng);
      });
    });

    this.map.whenReady(() => this.map?.invalidateSize());
    [50, 200, 500].forEach((ms) => setTimeout(() => this.map?.invalidateSize(), ms));
  }
}
