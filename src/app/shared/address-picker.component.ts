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
import { Subject, debounce, distinctUntilChanged, switchMap, timer } from 'rxjs';
import * as L from 'leaflet';
import { GeoAddress } from '../core/models/geo-address.model';
import { GeocodingPublicoService } from '../core/services/geocoding-publico.service';

export interface PickedAddress {
  address: string;
  lat: number;
  lng: number;
  /** true si no se ubicó la altura/puerta exacta (conviene pedir referencia). */
  approximate: boolean;
  /**
   * De dónde salió el pin: "manual" (ubicado a mano), "google_link" (link de Google Maps), el
   * proveedor del resultado elegido, o null (dirección precargada). El backend aprende en su
   * cache los "manual" y "google_link" al confirmar el pedido.
   */
  fuente: string | null;
}

/** Centro de San Miguel de Tucumán — punto de partida si el admin carga la dirección a mano. */
const SMT_CENTER = { lat: -26.8306, lng: -65.2038 };

/** Espera con el pin quieto antes de preguntar qué calle hay ahí (Nominatim: ~1 consulta/seg). */
const ESPERA_REVERSE_MS = 1000;

const PIN_ICON = L.divIcon({
  className: '',
  html:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="#1e88e5" stroke="white" stroke-width="1.5">' +
    '<path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>',
  iconSize: [28, 28],
  iconAnchor: [14, 26],
});

const PALABRAS_GENERICAS = new Set([
  'av', 'avda', 'avenida', 'calle', 'pasaje', 'pje', 'gral', 'general', 'dr', 'doctor',
  'de', 'del', 'la', 'las', 'los', 'el', 'san', 'santa', 'presidente', 'pte',
]);

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Misma regla que GeocodingProxyService.mismaCalle del backend (el que decide si se aprende). */
function mismaCalle(tipeada: string, reverse: string): boolean {
  const a = normalizar(tipeada);
  const b = normalizar(reverse);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const palabrasB = new Set(b.split(' '));
  return a.split(' ').some((p) => p.length >= 3 && !PALABRAS_GENERICAS.has(p) && palabrasB.has(p));
}

/** "Colombia 4695, San Miguel de Tucumán" -> "Colombia" */
function calleDe(label: string): string {
  return label.split(',')[0].trim().replace(/[\s,]*\d{1,6}\s*$/, '').trim();
}

/** Contenido del cartel del pin como texto, no HTML: los nombres de calle vienen de OSM o de lo tipeado. */
function cartel(texto: string): HTMLElement {
  const span = document.createElement('span');
  span.textContent = texto;
  return span;
}

/** "Belgrano 750", "9 de Julio 450": tiene letras y termina en la altura (lo que el backend aprende). */
function tieneNumero(direccion: string): boolean {
  return /\p{L}.*[\s,]\d{1,6}\s*$/u.test(direccion.split(',')[0]);
}

/** Altura a medio escribir ("suipacha 7" camino a "suipacha 750"): conviene esperar antes de buscar. */
function alturaAMedias(texto: string): boolean {
  return /\s\d{1,2}$/.test(texto);
}

const SUFIJO_LINK = /\s*\(ubicaci[oó]n de Google Maps\)\s*$/i;

/** El comienzo de un link que se está escribiendo a mano ("http", "https:/", "www.", "maps."). */
function empiezaComoLink(texto: string): boolean {
  return /^\s*(https?(:\/{0,2})?$|www\.|maps\.|goo\.gl)/i.test(texto);
}

function pareceLink(texto: string): boolean {
  return /https?:\/\//i.test(texto) || /goo\.gl\//i.test(texto) || /google\.[a-z.]+\/maps/i.test(texto);
}

/**
 * Busca una dirección de Tucumán (autocompletado vía backend, sesgado a la provincia) y deja
 * ajustar el pin exacto en un mapa. Emite `{ address, lat, lng, approximate, fuente }` o `null`.
 * <p>
 * Si el buscador no la encuentra (2026-09-25): "Buscar en Google Maps" abre Google con lo
 * escrito, y el link que se pegue en el MISMO campo mueve el pin a ese punto. En el mapa, doble
 * clic pone el pin y arrastrarlo lo ajusta; con el pin quieto 1 segundo se consulta qué calle hay
 * ahí y se muestra arriba del pin, sin pisar lo que escribió el usuario (la altura tipeada es lo
 * que el backend aprende).
 * <p>
 * Con un link pegado (2026-10-03) se pide además "Calle y número": el link solo trae el punto, el
 * pedido quedaba "Belgrano (ubicación de Google Maps)" y el cadete no sabía la altura (ni el
 * backend aprendía la dirección). Se precarga con lo que haya — la dirección del link, lo último
 * que se buscó, o lo que dice el mapa — y hasta que no tenga número no se emite la dirección.
 */
@Component({
  selector: 'app-address-picker',
  imports: [FormsModule],
  template: `
    @if (!selected()) {
      <div class="relative">
        <input
          #campoBusqueda
          type="text"
          class="input w-full"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
          [placeholder]="placeholder"
          autocomplete="off"
          name="direccionBusqueda"
        />

        <!-- Sin la altura todavía (2026-10-03): las calles conocidas que coinciden, para completar el nombre. -->
        @if (sugerencias().length) {
          <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span class="text-xs text-gray-500">¿Qué calle? Elegila y escribí la altura:</span>
            @for (calle of sugerencias(); track calle) {
              <button
                type="button"
                (click)="usarSugerencia(calle)"
                class="text-xs px-2 py-1 rounded-full border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
              >
                {{ calle }}
              </button>
            }
          </div>
        }

        <!-- Tres pasos (2026-09-24): lista normal → "no está, buscar de nuevo" (sin cache, con Google si
             hay key) → "tampoco está, ubicarla a mano". Antes, si la lista traía direcciones pero
             ninguna era la correcta, no había forma de salir de ahí. -->
        @if (leyendoLink()) {
          <p class="text-xs text-gray-400 mt-1">Leyendo el link de Google Maps…</p>
        } @else if (errorLink()) {
          <p class="text-xs text-red-600 mt-1">{{ errorLink() }}</p>
        } @else if (searching()) {
          <p class="text-xs text-gray-400 mt-1">{{ ampliada() ? 'Buscando en más lugares…' : 'Buscando…' }}</p>
        } @else if (query().length >= 4 && !results().length) {
          <p class="text-xs text-gray-500 mt-1">
            @if (!ampliada()) {
              No la encontramos.
              <button type="button" (click)="buscarDeNuevo()" class="font-semibold text-brand-600 hover:underline">
                Buscar de nuevo
              </button>
            } @else {
              Tampoco la encontramos.
              <button type="button" (click)="useTyped()" class="font-semibold text-brand-600 hover:underline">
                Ubicarla a mano en el mapa
              </button>
            }
          </p>
          <p class="text-xs text-gray-500 mt-1">
            O
            <a [href]="linkGoogleMaps()" target="_blank" rel="noopener" class="font-semibold text-brand-600 hover:underline">
              buscala en Google Maps
            </a>
            y pegá acá el link.
          </p>
        }

        @if (results().length) {
          <ul class="absolute z-20 left-0 right-0 mt-1 bg-white rounded border border-gray-200 shadow-lg overflow-hidden">
            @for (r of results(); track r.label + r.lat) {
              <li>
                <button
                  type="button"
                  (click)="choose(r)"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 border-b border-gray-100"
                >
                  {{ r.label }}
                  @if (r.approximate) {
                    <span class="text-[11px] text-amber-600 whitespace-nowrap">· sin altura exacta</span>
                  }
                  <!-- TEMPORAL (pruebas en la calle, 2026-09-26): muestra de dónde salió cada resultado para
                       ver si la cache propia ya aprendió la calle. Sacarlo antes de salir: también lo ven los
                       clientes en /pedir. -->
                  @if (r.proveedor === 'cache') {
                    <span class="text-[11px] font-semibold text-green-700 whitespace-nowrap">· ✅ encontrada en servicio propio</span>
                  } @else if (r.proveedor) {
                    <span class="text-[11px] text-gray-400 whitespace-nowrap">· {{ r.proveedor }}</span>
                  }
                </button>
              </li>
            }
            <li>
              @if (!ampliada()) {
                <button
                  type="button"
                  (click)="buscarDeNuevo()"
                  class="w-full text-left px-3 py-2.5 text-sm font-semibold text-brand-700 bg-gray-50 hover:bg-brand-50"
                >
                  🔎 No está mi dirección — buscar de nuevo
                </button>
              } @else {
                <button
                  type="button"
                  (click)="useTyped()"
                  class="w-full text-left px-3 py-2.5 text-sm font-semibold text-brand-700 bg-gray-50 hover:bg-brand-50"
                >
                  📍 Tampoco está — ubicarla a mano en el mapa
                </button>
              }
            </li>
            <li>
              <a
                [href]="linkGoogleMaps()"
                target="_blank"
                rel="noopener"
                class="block px-3 py-2 text-xs text-gray-600 bg-gray-50 hover:bg-brand-50 border-t border-gray-100"
              >
                🗺️ Buscarla en Google Maps y pegar el link en este campo
              </a>
            </li>
          </ul>
        }
      </div>
    } @else {
      <div class="rounded border border-gray-300 overflow-hidden">
        <div class="flex items-center gap-2 px-3 py-2 bg-gray-50">
          <span aria-hidden="true">📍</span>
          <span class="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">
            {{ selected()!.label }}
          </span>
          <button type="button" (click)="changeAddress()" class="text-xs font-semibold text-brand-600 hover:underline shrink-0">
            Cambiar
          </button>
        </div>
        <div #mapEl class="h-48 w-full bg-gray-100"></div>
        @if (calleDistinta(); as distinta) {
          @if (distinta.propia) {
            <p class="text-xs px-3 py-2 bg-amber-50 border-t border-amber-200 text-amber-800">
              ⚠️ Según las direcciones que ya confirmamos, el pin está sobre <strong>{{ distinta.pin }}</strong>, no sobre
              <strong>{{ distinta.tipeada }}</strong>. Movelo a la calle correcta (puede haber quedado en la esquina).
            </p>
          } @else {
            <!-- 3j (2026-09-28): OpenStreetMap engancha la calle con nombre más cercana; en barrios con
                 calles sin nombre (Colombia 4695) decía "Camino del Perú" y parecía que no se podía
                 confirmar. Solo informa: el pedido se guarda igual con el pin donde quedó. -->
            <p class="text-xs px-3 py-2 bg-gray-50 border-t border-gray-200 text-gray-600">
              El mapa marca otra calle (<strong>{{ distinta.pin }}</strong>). Si el pin está en la puerta, dejalo así: la
              distancia y el precio salen desde el pin.
            </p>
          }
        } @else if (selected()!.approximate && !esLink()) {
          <!-- Sin altura exacta el pin queda en cualquier punto de la calle, y el precio se calcula
               desde el pin: con "Colombia 4695" daba 5,2 km en vez de 6,2 (2026-09-24). -->
          <p class="text-xs px-3 py-2 bg-amber-50 border-t border-amber-200 text-amber-800">
            ⚠️ <strong>No encontramos la altura exacta.</strong> Hacé doble clic en la puerta (o arrastrá el pin): la
            distancia y el precio se calculan desde ahí.
          </p>
        } @else {
          <p class="text-[11px] px-3 py-1.5 text-gray-400">Doble clic en el mapa o arrastrá el pin para corregirlo.</p>
        }
        @if (esLink()) {
          <div class="px-3 py-2 border-t border-gray-200 bg-white">
            <label class="block text-xs font-semibold text-gray-700 mb-1">Calle y número</label>
            <input
              type="text"
              class="input w-full"
              [ngModel]="direccionLink()"
              (ngModelChange)="onDireccionLink($event)"
              (blur)="emitirDireccionLink()"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Ej: Belgrano 750"
              maxlength="120"
              autocomplete="off"
            />
            @if (!direccionLinkValida()) {
              <p class="text-xs text-red-600 mt-1">
                Falta la calle y el número: el link de Google Maps solo trae el punto en el mapa, y quien lleva el pedido
                necesita la dirección escrita.
              </p>
            } @else if (alturaSugerida()) {
              <p class="text-xs text-amber-700 mt-1">El número lo sugirió el mapa y es aproximado: corregilo si lo sabés.</p>
            }
            <label class="flex items-center gap-2 text-xs text-gray-600 mt-1.5">
              <input
                type="checkbox"
                [ngModel]="sinNumero()"
                (ngModelChange)="onSinNumero($event)"
                [ngModelOptions]="{ standalone: true }"
              />
              Esta dirección no tiene número
            </label>
          </div>
        }
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
      /* Celular (spec: la mayoría pide desde el teléfono): 16px evita que iOS haga zoom al
         tocar un campo, y los campos un poco más altos se tocan mejor con el dedo. */
      @media (max-width: 639px) {
        .input {
          font-size: 16px;
          padding: 0.65rem 0.75rem;
        }
      }
    `,
  ],
})
export class AddressPickerComponent {
  placeholder = 'Calle y altura, ej: San Juan 354';

  private readonly geocoding = inject(GeocodingPublicoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  readonly addressPicked = output<PickedAddress | null>();

  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('mapEl');
  private readonly campoBusqueda = viewChild<ElementRef<HTMLInputElement>>('campoBusqueda');

  readonly query = signal('');
  readonly results = signal<GeoAddress[]>([]);
  readonly searching = signal(false);
  /** true después de "buscar de nuevo": la próxima salida ya es ubicarla a mano. */
  readonly ampliada = signal(false);
  readonly selected = signal<GeoAddress | null>(null);
  /** Coordenadas del pin (arranca en las de la dirección, se mueve al arrastrar / doble clic). */
  readonly pin = signal<{ lat: number; lng: number } | null>(null);
  readonly fuente = signal<string | null>(null);
  /** Calle que el reverse encontró bajo el pin (la que se muestra arriba del pin), null si no se consultó. */
  readonly callePin = signal<string | null>(null);
  /** La calle bajo el pin salió de la base propia (lo que confirmaron cadetes o personas), no de OpenStreetMap. */
  readonly callePinPropia = signal(false);
  readonly leyendoLink = signal(false);
  /** Calles conocidas para lo escrito sin la altura (ver GeocodingPublicoService.sugerirCalles). */
  readonly sugerencias = signal<string[]>([]);
  private esperaSugerencias?: ReturnType<typeof setTimeout>;
  readonly errorLink = signal<string | null>(null);
  /** Lo último que se escribió que no era un link — es la dirección que queda si después se pega uno. */
  private ultimoTexto = '';
  /** Lo último que se buscó, aunque después se haya borrado para pegar el link (así se usa en la práctica). */
  private ultimaBusqueda = '';
  /** "Calle y número" de un link pegado (el link solo trae el punto). */
  readonly direccionLink = signal('');
  readonly sinNumero = signal(false);
  /** El número de "Calle y número" lo puso el mapa (la cuadra), no una persona ni el link. */
  readonly alturaSugerida = signal(false);

  readonly esLink = computed(() => this.fuente() === 'google_link');
  readonly direccionLinkValida = computed(() => {
    const t = this.direccionLink().trim();
    return tieneNumero(t) || (this.sinNumero() && t.length >= 3);
  });

  readonly picked = computed<PickedAddress | null>(() => {
    const sel = this.selected();
    const p = this.pin();
    if (!sel || !p) return null;
    // Un link sin calle y número todavía no es una dirección: el formulario no deja guardar.
    if (this.esLink() && !this.direccionLinkValida()) return null;
    return { address: sel.label, lat: p.lat, lng: p.lng, approximate: sel.approximate, fuente: this.fuente() };
  });

  readonly linkGoogleMaps = computed(() => {
    const q = (pareceLink(this.query()) ? this.ultimoTexto : this.query()).trim();
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q ? `${q}, Tucumán` : 'Tucumán');
  });

  /** El pin quedó sobre otra calle que la escrita (típico: en la esquina). */
  readonly calleDistinta = computed<{ pin: string; tipeada: string; propia: boolean } | null>(() => {
    const sel = this.selected();
    const pin = this.callePin();
    if (!sel || !pin) return null;
    const tipeada = calleDe(sel.label);
    return tipeada && !mismaCalle(tipeada, pin) ? { pin, tipeada, propia: this.callePinPropia() } : null;
  });

  private readonly query$ = new Subject<string>();
  private map?: L.Map;
  private marker?: L.Marker;
  private esperaReverse?: ReturnType<typeof setTimeout>;
  private esperaLink?: ReturnType<typeof setTimeout>;
  private esperaDireccionLink?: ReturnType<typeof setTimeout>;
  /** Al crear el mapa, consultar la calle bajo el pin (link pegado) en vez de mostrar la del resultado. */
  private resolverAlIniciar = false;

  constructor() {
    this.query$
      .pipe(
        // 600ms: respeta el límite de ~1 req/s de Nominatim. Con la altura a medio escribir se
        // espera más (2026-10-03): "suipacha 7" camino a "suipacha 750" mostraba la cuadra 0 como
        // encontrada y parecía que la 700 no estaba.
        debounce((q) => timer(alturaAMedias(q) ? 1500 : 600)),
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

    this.destroyRef.onDestroy(() => {
      clearTimeout(this.esperaReverse);
      clearTimeout(this.esperaLink);
      clearTimeout(this.esperaDireccionLink);
      clearTimeout(this.esperaSugerencias);
      this.map?.remove();
    });
  }

  /** Precarga una dirección ya guardada (edición) sin volver a buscarla. */
  setValue(valor: PickedAddress | null): void {
    if (!valor) {
      this.selected.set(null);
      this.pin.set(null);
      this.fuente.set(null);
      this.query.set('');
      return;
    }
    // Un pedido viejo cargado con link ("Belgrano (ubicación de Google Maps)") vuelve a pedir el número.
    const [calle, ...resto] = valor.address.replace(SUFIJO_LINK, '').split(',');
    this.direccionLink.set(valor.fuente === 'google_link' ? calle.trim() : '');
    this.sinNumero.set(false);
    this.alturaSugerida.set(false);
    this.selected.set({
      label: valor.address,
      street: valor.address,
      number: null,
      locality: valor.fuente === 'google_link' ? resto.join(',').trim() : '',
      lat: valor.lat,
      lng: valor.lng,
      approximate: valor.approximate,
    });
    this.pin.set({ lat: valor.lat, lng: valor.lng });
    this.fuente.set(valor.fuente);
    this.query.set(valor.address);
  }

  private emit(): void {
    this.addressPicked.emit(this.picked());
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.ampliada.set(false);
    this.errorLink.set(null);
    clearTimeout(this.esperaLink);
    this.programarSugerencias(value);
    if (pareceLink(value)) {
      this.results.set([]);
      // Pegado llega de una vez; si alguien lo tipea, se espera a que termine.
      this.leyendoLink.set(true);
      this.esperaLink = setTimeout(() => this.usarLink(value), 400);
      return;
    }
    this.leyendoLink.set(false);
    // Un link escrito a mano pasa por "http", "https:/"... antes de parecer un link: eso no es una
    // dirección, y quedaba precargado en "Calle y número".
    if (empiezaComoLink(value)) {
      this.results.set([]);
      return;
    }
    this.ultimoTexto = value;
    // Borrar letra por letra para pegar el link no cuenta como una búsqueda nueva.
    const t = value.trim();
    if (t.length >= 4 && !this.ultimaBusqueda.startsWith(t)) this.ultimaBusqueda = t;
    this.query$.next(value.trim());
  }

  /** Mientras falte la altura, las calles conocidas que coinciden con lo escrito. */
  private programarSugerencias(value: string): void {
    clearTimeout(this.esperaSugerencias);
    const texto = value.trim();
    if (pareceLink(value) || empiezaComoLink(value) || texto.length < 4 || tieneNumero(texto)) {
      this.sugerencias.set([]);
      return;
    }
    this.esperaSugerencias = setTimeout(async () => {
      const calles = await this.geocoding.sugerirCalles(texto);
      // si mientras tanto siguió escribiendo, estas ya no corresponden
      if (this.query().trim() === texto) this.sugerencias.set(calles);
    }, 400);
  }

  /** Deja el nombre completo de la calle en el campo, listo para escribir la altura. */
  usarSugerencia(calle: string): void {
    this.sugerencias.set([]);
    this.onQueryChange(`${calle} `);
    this.sugerencias.set([]);
    clearTimeout(this.esperaSugerencias);
    this.campoBusqueda()?.nativeElement.focus();
  }

  /**
   * Link de Google Maps pegado en el campo: el pin salta a ese punto. La calle y el número salen
   * del link si los trae, y si no de lo que se había escrito o buscado antes; se confirman abajo.
   */
  private async usarLink(link: string): Promise<void> {
    this.leyendoLink.set(true);
    const r = await this.geocoding.resolverLink(link.trim());
    // si mientras tanto cambió el texto, este link ya no corresponde
    if (this.query() !== link) return;
    this.leyendoLink.set(false);
    if (r.error || r.lat == null || r.lng == null) {
      this.errorLink.set(r.error ?? 'No pudimos leer ese link.');
      return;
    }
    const escrito = this.ultimoTexto.trim().length >= 4 ? this.ultimoTexto.trim() : this.ultimaBusqueda;
    // Sin nada de eso, el reverse propone la calle (y la cuadra) cuando se crea el mapa.
    const texto = (r.direccion ?? '').trim() || escrito;
    this.resolverAlIniciar = true;
    this.direccionLink.set(texto);
    this.sinNumero.set(false);
    this.alturaSugerida.set(false);
    this.selected.set({
      label: texto || 'Ubicación de Google Maps',
      street: texto,
      number: null,
      locality: '',
      lat: r.lat,
      lng: r.lng,
      approximate: false,
    });
    this.pin.set({ lat: r.lat, lng: r.lng });
    this.fuente.set('google_link');
    this.emit();
  }

  /** Mientras se escribe no se emite cada letra: cada emisión recotiza el pedido. Al salir del campo, sí. */
  onDireccionLink(valor: string): void {
    this.direccionLink.set(valor);
    this.alturaSugerida.set(false);
    this.actualizarLabelDeLink(false);
    clearTimeout(this.esperaDireccionLink);
    this.esperaDireccionLink = setTimeout(() => this.emit(), 600);
  }

  emitirDireccionLink(): void {
    clearTimeout(this.esperaDireccionLink);
    this.emit();
  }

  onSinNumero(valor: boolean): void {
    this.sinNumero.set(valor);
    this.actualizarLabelDeLink();
  }

  /** "Belgrano 750, San Miguel de Tucumán" (o "Belgrano s/n, ...") a partir de "Calle y número" y la localidad del pin. */
  private actualizarLabelDeLink(emitir = true): void {
    const sel = this.selected();
    if (!sel) return;
    const t = this.direccionLink().trim().replace(/\s+/g, ' ');
    const base = this.sinNumero() && t && !tieneNumero(t) ? `${t} s/n` : t;
    const conLocalidad = sel.locality && !normalizar(base).includes(normalizar(sel.locality)) ? `${base}, ${sel.locality}` : base;
    this.selected.set({ ...sel, label: base ? conLocalidad : 'Ubicación de Google Maps', street: t });
    if (emitir) this.emit();
  }

  /** Segundo intento: sin cache y con Google si el backend tiene key (ver GeocodingProxyService.buscarAmpliado). */
  async buscarDeNuevo(): Promise<void> {
    const q = this.query().trim();
    if (q.length < 4) return;
    this.ampliada.set(true);
    this.results.set([]);
    this.searching.set(true);
    const res = await this.geocoding.searchAmpliado(q);
    // si mientras tanto el usuario siguió escribiendo, este resultado ya no corresponde
    if (this.query().trim() !== q) return;
    this.searching.set(false);
    this.results.set(res);
  }

  choose(addr: GeoAddress): void {
    this.selected.set(addr);
    this.pin.set({ lat: addr.lat, lng: addr.lng });
    this.fuente.set(addr.proveedor ?? null);
    this.sugerencias.set([]);
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
    this.fuente.set('manual');
    this.results.set([]);
    this.emit();
  }

  changeAddress(): void {
    clearTimeout(this.esperaReverse);
    this.map?.remove();
    this.map = undefined;
    this.marker = undefined;
    this.selected.set(null);
    this.pin.set(null);
    this.fuente.set(null);
    this.callePin.set(null);
    this.results.set([]);
    this.query.set('');
    this.ultimoTexto = '';
    this.ultimaBusqueda = '';
    clearTimeout(this.esperaDireccionLink);
    this.direccionLink.set('');
    this.sinNumero.set(false);
    this.alturaSugerida.set(false);
    this.emit();
  }

  /** Pin movido a mano (arrastre o doble clic): se emite ya, y la calle se consulta con el pin quieto. */
  private moverPin(lat: number, lng: number): void {
    this.marker?.setLatLng([lat, lng]);
    this.pin.set({ lat, lng });
    // Lo ubicó una persona: ya no es "sin altura exacta". Un pin de Google (link o API) sigue
    // siéndolo aunque se corrija unos metros; cualquier otro pasa a ser propio.
    this.selected.update((s) => (s ? { ...s, approximate: false } : s));
    const f = this.fuente();
    if (f !== 'google_link' && f !== 'google') this.fuente.set('manual');
    this.emit();
    this.programarReverse(lat, lng);
  }

  private programarReverse(lat: number, lng: number): void {
    clearTimeout(this.esperaReverse);
    this.callePin.set(null);
    this.marker?.setTooltipContent(cartel('…'));
    this.esperaReverse = setTimeout(() => this.zone.run(() => this.resolvePin(lat, lng)), ESPERA_REVERSE_MS);
  }

  /** Con el pin quieto: qué calle hay ahí. Se muestra arriba del pin; no pisa la dirección escrita. */
  private async resolvePin(lat: number, lng: number): Promise<void> {
    const found = await this.geocoding.reverse(lat, lng);
    // ignorar si el pin se movió otra vez mientras tanto
    const p = this.pin();
    if (!p || p.lat !== lat || p.lng !== lng || !this.selected()) return;
    if (!found) {
      this.callePin.set(null);
      this.marker?.setTooltipContent(cartel('Sin calle en este punto'));
      return;
    }
    this.callePin.set(found.street);
    this.callePinPropia.set(found.proveedor === 'cache');
    this.marker?.setTooltipContent(cartel(found.locality ? `${found.street} · ${found.locality}` : found.street));
    const sel = this.selected()!;
    if (this.esLink()) {
      this.selected.set({ ...sel, locality: found.locality });
      if (!this.direccionLink().trim()) {
        // Link pegado sin nada escrito ni buscado: lo que dice el mapa, para confirmar o corregir.
        this.direccionLink.set(found.number ? `${found.street} ${found.number}` : found.street);
        this.alturaSugerida.set(!!found.number);
      }
      this.actualizarLabelDeLink();
      return;
    }
    if (found.locality && this.fuente() !== null && !sel.label.includes(found.locality)) {
      // La localidad del texto sale del pin: "Colombia 4695, Yerba Buena" movido a la capital
      // pasa a "Colombia 4695, San Miguel de Tucumán". La calle y la altura quedan como estaban.
      this.selected.set({ ...sel, label: `${sel.label.split(',')[0].trim()}, ${found.locality}`, locality: found.locality });
    }
    this.emit();
  }

  private initMap(el: HTMLElement, addr: GeoAddress): void {
    const center: L.LatLngExpression = [addr.lat, addr.lng];
    // Sin zoom con doble clic: el doble clic pone el pin (el zoom sigue con la rueda o + / −).
    this.map = L.map(el, { attributionControl: true, doubleClickZoom: false }).setView(center, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.map);

    this.marker = L.marker(center, { draggable: true, icon: PIN_ICON }).addTo(this.map);
    const inicial = this.fuente() === 'manual' && addr.approximate ? 'Doble clic donde va' : addr.street || addr.label;
    this.marker.bindTooltip(cartel(inicial), { permanent: true, direction: 'top', offset: [0, -26] });
    this.marker.on('dragend', () => {
      const p = this.marker!.getLatLng();
      this.zone.run(() => this.moverPin(p.lat, p.lng));
    });
    this.map.on('dblclick', (e: L.LeafletMouseEvent) => {
      this.zone.run(() => this.moverPin(e.latlng.lat, e.latlng.lng));
    });

    if (this.resolverAlIniciar) {
      this.resolverAlIniciar = false;
      this.programarReverse(addr.lat, addr.lng);
    }

    this.map.whenReady(() => this.map?.invalidateSize());
    [50, 200, 500].forEach((ms) => setTimeout(() => this.map?.invalidateSize(), ms));
  }
}
