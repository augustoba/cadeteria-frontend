import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { apiUrl } from '../../core/config/site-config';

interface Punto {
  cuadra: number;
  localidad: string;
  lat: number;
  lng: number;
}

interface Duda {
  id: string;
  tipo: 'NOMBRE' | 'UBICACION' | 'NOMBRE_VIEJO';
  calle: string;
  localidad: string;
  cuadra: number;
  otraCalle: string;
  motivo: string;
  lat: number | null;
  lng: number | null;
  proveedor: string | null;
  usos: number;
  linkLat: number | null;
  linkLng: number | null;
  cercanas: Punto[];
}

interface Resultado {
  estado: string;
  mensaje: string;
}

function globo(color: string, texto: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:white;font-size:11px;font-weight:600;padding:1px 5px;border-radius:9px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);white-space:nowrap;transform:translate(-50%,-50%);display:inline-block">${texto}</div>`,
    iconSize: [0, 0],
  });
}

/** Mapa chico de una duda: la cuadra dudosa (rojo), las cuadras con las que se compara (azul) y el punto de Google (verde). */
@Component({
  selector: 'app-mapa-duda',
  template: `<div #mapEl class="h-56 w-full rounded border border-gray-200"></div>`,
})
export class MapaDudaComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Solo lo que el mapa dibuja: sirve también para las cuadras a buscar. */
  @Input({ required: true }) duda!: Pick<Duda, 'cuadra' | 'lat' | 'lng' | 'linkLat' | 'linkLng' | 'cercanas'>;
  @Input() colorCuadra = '#dc2626';
  @ViewChild('mapEl', { static: true }) private readonly mapEl!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private capa: L.LayerGroup | null = null;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, { attributionControl: false }).setView([-26.8241, -65.2226], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);
    this.capa = L.layerGroup().addTo(this.map);
    // El recuadro recién toma su tamaño después de dibujarse: sin esto el mapa calcula el zoom para
    // un recuadro chico y abre tan lejos que los puntos quedan encimados.
    setTimeout(() => {
      this.map?.invalidateSize();
      this.dibujar();
    });
  }

  ngOnChanges(): void {
    this.dibujar();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private dibujar(): void {
    if (!this.map || !this.capa) return;
    this.capa.clearLayers();
    const d = this.duda;
    const puntos: L.LatLngExpression[] = [];
    for (const p of d.cercanas) {
      puntos.push([p.lat, p.lng]);
      L.marker([p.lat, p.lng], { icon: globo('#2563eb', String(p.cuadra)) }).addTo(this.capa);
    }
    if (d.lat != null && d.lng != null) {
      puntos.push([d.lat, d.lng]);
      L.marker([d.lat, d.lng], { icon: globo(this.colorCuadra, String(d.cuadra)), zIndexOffset: 500 }).addTo(this.capa);
    }
    if (d.linkLat != null && d.linkLng != null) {
      puntos.push([d.linkLat, d.linkLng]);
      L.marker([d.linkLat, d.linkLng], { icon: globo('#16a34a', 'Google'), zIndexOffset: 1000 }).addTo(this.capa);
    }
    if (puntos.length) this.map.fitBounds(L.latLngBounds(puntos), { padding: [30, 30], maxZoom: 17 });
  }
}

/**
 * Calles a revisar (2026-10-07): lo que la base propia de calles no puede dar por bueno sola. Dos
 * clases de duda: dos nombres que se escriben casi igual, y cuadras que no cierran con sus vecinas.
 * Se resuelven pegando el link de Google Maps de esa dirección: el backend saca el punto y decide
 * solo cuando el resultado es claro; si no, muestra las distancias y acá se elige a mano.
 */
@Component({
  selector: 'app-calles-a-revisar',
  imports: [FormsModule, MapaDudaComponent],
  template: `
    <div class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Calles a revisar</h2>
      <span class="text-xs text-gray-500">
        Calles y cuadras que el sistema no puede dar por buenas solo. Hay tres clases:
        <strong>Ubicación</strong> (una cuadra que no cae donde sus vecinas dicen), <strong>Nombre</strong> (dos nombres que
        se escriben casi igual) y <strong>Nombre viejo</strong> (una cuadra repetida con el nombre que la calle tenía antes).
        En las dos primeras, buscá la dirección en Google Maps, copiá el link y pegalo: si el resultado es claro el sistema
        decide solo; si no, no cambia nada y te deja elegir. Van primero las cuadras más usadas. La lista se actualiza sola
        todas las noches.
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="boton" [disabled]="ocupado()" (click)="cargar()">
          {{ lista() ? 'Volver a cargar' : 'Ver la lista' }}
        </button>
        <button type="button" class="boton" [disabled]="ocupado()" (click)="actualizar()">Actualizar la lista</button>
        @if (lista(); as l) {
          <span class="text-xs text-gray-500">{{ l.length }} pendientes ({{ cuantas('UBICACION') }} de ubicación, {{ cuantas('NOMBRE') }} de nombre, {{ cuantas('NOMBRE_VIEJO') }} de nombre viejo)</span>
        }
      </div>

      @if (error()) {
        <p class="text-sm text-red-600">{{ error() }}</p>
      }
      @if (aviso()) {
        <p class="text-sm text-emerald-700">{{ aviso() }}</p>
      }

      @if (lista(); as l) {
        @if (!l.length) {
          <p class="text-sm text-emerald-700">No hay calles para revisar.</p>
        } @else {
          <ul class="text-sm text-gray-700 border border-gray-200 rounded divide-y divide-gray-100">
            @for (d of visibles(); track d.id) {
              <li class="px-3 py-2 flex flex-col gap-2">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <strong>{{ d.calle }} {{ d.cuadra }}</strong>
                  <span class="text-xs text-gray-500">{{ d.localidad }}</span>
                  <span class="text-xs rounded px-1.5 py-0.5" [class]="colorDe(d)">{{ etiquetaDe(d) }}</span>
                  @if (d.usos > 1) {
                    <span class="text-xs text-gray-500">usada {{ d.usos }} veces</span>
                  }
                  <button type="button" class="ml-auto text-xs font-semibold text-brand-600 hover:underline" (click)="abrir(d)">
                    {{ abierta() === d.id ? 'Cerrar' : 'Revisar' }}
                  </button>
                </div>
                <span class="text-xs text-gray-600">{{ d.motivo }}</span>

                @if (abierta() === d.id) {
                  <app-mapa-duda [duda]="d" />
                  <span class="text-xs text-gray-400">
                    Rojo: esta cuadra. Azul:
                    {{ d.tipo === 'UBICACION' ? 'la cuadra anterior y la siguiente' : 'las cuadras de "' + d.otraCalle + '" de altura parecida' }}.
                    @if (d.tipo !== 'NOMBRE_VIEJO') {
                      Verde: donde la ubica Google, después de pegar el link.
                    }
                  </span>
                  @if (d.tipo === 'NOMBRE_VIEJO') {
                    <span class="text-sm text-gray-700">
                      Qué hacer: no hace falta buscar nada. Esta cuadra está guardada dos veces: como
                      <strong>{{ d.calle }}</strong> (el nombre de antes) y como <strong>{{ d.otraCalle }}</strong> (el de hoy). Al quitar la
                      repetida queda solo la de hoy, y quien escriba el nombre de antes la sigue encontrando.
                    </span>
                    <div class="flex flex-wrap items-center gap-2">
                      <button type="button" class="boton boton-fuerte" [disabled]="ocupado()" (click)="marcar(d, 'QUITAR')">
                        Quitar la repetida (queda "{{ d.otraCalle }}")
                      </button>
                      <button type="button" class="boton" [disabled]="ocupado()" (click)="marcar(d, 'DISTINTAS')">Son calles distintas, dejar las dos</button>
                    </div>
                  } @else {
                  <span class="text-sm text-gray-700">
                    Qué hacer: buscá en Google Maps <strong>{{ d.calle }} {{ alturaParaBuscar(d) }}</strong> (la mitad de la cuadra
                    {{ d.cuadra }}, que va del {{ d.cuadra }} al {{ d.cuadra + 99 }}), copiá el link de la barra del navegador y
                    pegalo acá. Solo se revisa el punto rojo; los azules son para comparar. Si Google la ubica mal, mové el pin en
                    Google Maps hasta el lugar correcto y copiá ese link.
                  </span>
                  <div class="flex flex-wrap items-center gap-2">
                    <a [href]="buscarEnGoogle(d)" target="_blank" rel="noopener" class="boton">
                      Buscar {{ d.calle }} {{ alturaParaBuscar(d) }} en Google Maps
                    </a>
                    <input
                      type="text"
                      class="flex-1 min-w-48 rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder="Pegá acá el link de Google Maps"
                      [(ngModel)]="link"
                      [name]="'link-' + d.id"
                      (keydown.enter)="usarLink(d)"
                    />
                    <button type="button" class="boton boton-fuerte" [disabled]="ocupado() || !link.trim()" (click)="usarLink(d)">
                      Usar este link
                    </button>
                  </div>
                  @if (sinDecidir()) {
                    <p class="text-sm text-amber-700">{{ sinDecidir() }}</p>
                    @if (d.tipo === 'UBICACION' && d.linkLat !== null) {
                      <div>
                        <button type="button" class="boton" [disabled]="ocupado()" (click)="marcar(d, 'USAR_GOOGLE')">
                          Usar igual el punto de Google (el verde)
                        </button>
                      </div>
                    }
                  }
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs text-gray-500">O elegí a mano:</span>
                    @if (d.tipo === 'NOMBRE') {
                      <button type="button" class="boton" [disabled]="ocupado()" (click)="marcar(d, 'MISMA')">
                        Son la misma calle (queda "{{ d.otraCalle }}")
                      </button>
                      <button type="button" class="boton" [disabled]="ocupado()" (click)="marcar(d, 'DISTINTAS')">Son calles distintas</button>
                    } @else {
                      <button type="button" class="boton" [disabled]="ocupado()" (click)="marcar(d, 'ESTA_BIEN')">Está bien ubicada</button>
                      <button type="button" class="boton" [disabled]="ocupado()" (click)="marcar(d, 'NO_EXISTE')">Esa cuadra no existe</button>
                    }
                  </div>
                  }
                }
              </li>
            }
          </ul>
          @if (l.length > mostrar()) {
            <div>
              <button type="button" class="boton" (click)="mostrar.set(mostrar() + 25)">Mostrar 25 más</button>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .boton {
        font-size: 0.875rem;
        padding: 0.375rem 0.75rem;
        border-radius: 0.25rem;
        border: 1px solid #d1d5db;
      }
      .boton:hover:not(:disabled) {
        background: #f9fafb;
      }
      .boton:disabled {
        opacity: 0.6;
      }
      .boton-fuerte {
        background: var(--color-brand-600);
        border-color: var(--color-brand-600);
        color: white;
      }
      .boton-fuerte:hover:not(:disabled) {
        background: var(--color-brand-700);
      }
    `,
  ],
})
export class CallesARevisarComponent {
  private readonly http = inject(HttpClient);
  private readonly base = '/admin/configuracion/calles/a-revisar';

  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);
  /** Lo último que se resolvió, en palabras del backend. */
  readonly aviso = signal<string | null>(null);
  /** El link no alcanzó para decidir: se muestra el porqué y la duda sigue abierta. */
  readonly sinDecidir = signal<string | null>(null);
  /** null = todavía no se cargó. */
  readonly lista = signal<Duda[] | null>(null);
  readonly abierta = signal<string | null>(null);
  readonly mostrar = signal(25);
  readonly visibles = computed(() => (this.lista() ?? []).slice(0, this.mostrar()));

  cuantas(tipo: Duda['tipo']): number {
    return (this.lista() ?? []).filter((d) => d.tipo === tipo).length;
  }

  etiquetaDe(d: Duda): string {
    return d.tipo === 'NOMBRE' ? 'Nombre' : d.tipo === 'NOMBRE_VIEJO' ? 'Nombre viejo' : 'Ubicación';
  }

  colorDe(d: Duda): string {
    return d.tipo === 'NOMBRE' ? 'bg-amber-100 text-amber-800' : d.tipo === 'NOMBRE_VIEJO' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800';
  }
  link = '';

  cargar(): void {
    this.pedir(this.http.get<Duda[]>(apiUrl(this.base)), (l) => this.lista.set(l));
  }

  actualizar(): void {
    this.pedir(this.http.post<{ nuevas: number }>(apiUrl(this.base + '/actualizar'), {}), (r) => {
      this.aviso.set(r.nuevas ? `Se agregaron ${r.nuevas} a la lista.` : 'No hay nada nuevo para revisar.');
      this.cargar();
    });
  }

  abrir(d: Duda): void {
    this.abierta.set(this.abierta() === d.id ? null : d.id);
    this.link = '';
    this.sinDecidir.set(null);
  }

  /**
   * El punto de una cuadra es el del medio de la cuadra (la 2600 va del 2600 al 2699): se busca el
   * 2650, no el 2600, que en Google es la esquina y dejaría el punto corrido media cuadra.
   */
  alturaParaBuscar(d: Duda): number {
    return d.cuadra + 50;
  }

  buscarEnGoogle(d: Duda): string {
    return (
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(`${d.calle} ${this.alturaParaBuscar(d)}, ${d.localidad}, Tucumán`)
    );
  }

  usarLink(d: Duda): void {
    const link = this.link.trim();
    if (!link) return;
    this.pedir(this.http.post<Resultado>(apiUrl(`${this.base}/${d.id}/link`), { link }), (r) => this.alResolver(r));
  }

  marcar(d: Duda, decision: 'MISMA' | 'DISTINTAS' | 'ESTA_BIEN' | 'NO_EXISTE' | 'QUITAR' | 'USAR_GOOGLE'): void {
    this.pedir(this.http.post<Resultado>(apiUrl(`${this.base}/${d.id}/marcar`), { decision }), (r) => this.alResolver(r));
  }

  private alResolver(r: Resultado): void {
    if (r.estado === 'PENDIENTE') {
      // No decidió: la duda sigue abierta, con el punto de Google ya dibujado en el mapa.
      this.sinDecidir.set(r.mensaje);
      const abierta = this.abierta();
      this.pedir(this.http.get<Duda[]>(apiUrl(this.base)), (l) => {
        this.lista.set(l);
        this.abierta.set(abierta);
      });
      return;
    }
    this.aviso.set(r.mensaje);
    this.abierta.set(null);
    this.link = '';
    this.sinDecidir.set(null);
    this.cargar();
  }

  private pedir<T>(pedido: import('rxjs').Observable<T>, alTerminar: (dato: T) => void): void {
    this.ocupado.set(true);
    this.error.set(null);
    pedido.subscribe({
      next: (dato) => {
        this.ocupado.set(false);
        alTerminar(dato);
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(e?.error?.message ?? e?.error?.mensaje ?? 'No se pudo consultar. Probá de nuevo.');
      },
    });
  }
}
