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
  tipo: 'NOMBRE' | 'UBICACION';
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
  @Input({ required: true }) duda!: Duda;
  @ViewChild('mapEl', { static: true }) private readonly mapEl!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private capa: L.LayerGroup | null = null;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, { attributionControl: false }).setView([-26.8241, -65.2226], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);
    this.capa = L.layerGroup().addTo(this.map);
    this.dibujar();
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
      L.marker([d.lat, d.lng], { icon: globo('#dc2626', String(d.cuadra)), zIndexOffset: 500 }).addTo(this.capa);
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
    <div class="flex flex-col gap-2 border-t border-gray-200 pt-3">
      <span class="text-sm font-medium text-gray-700">Calles a revisar</span>
      <span class="text-xs text-gray-400 -mt-1">
        Calles y cuadras de la base propia que el sistema no puede dar por buenas solo: dos nombres que se escriben casi
        igual, o una cuadra que no cae donde sus vecinas dicen. Buscá la dirección en Google Maps, copiá el link y pegalo:
        si el resultado es claro el sistema decide solo (une los nombres, los deja como distintos o corrige la cuadra). Van
        primero las cuadras más usadas. La lista se actualiza sola todas las noches.
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="boton" [disabled]="ocupado()" (click)="cargar()">
          {{ lista() ? 'Volver a cargar' : 'Ver la lista' }}
        </button>
        <button type="button" class="boton" [disabled]="ocupado()" (click)="actualizar()">Actualizar la lista</button>
        @if (lista(); as l) {
          <span class="text-xs text-gray-500">{{ l.length }} pendientes ({{ deNombre() }} de nombre, {{ l.length - deNombre() }} de ubicación)</span>
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
                  <span class="text-xs rounded px-1.5 py-0.5" [class]="d.tipo === 'NOMBRE' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'">
                    {{ d.tipo === 'NOMBRE' ? 'Nombre' : 'Ubicación' }}
                  </span>
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
                    {{ d.tipo === 'NOMBRE' ? 'las cuadras de "' + d.otraCalle + '" de altura parecida' : 'la cuadra anterior y la siguiente' }}.
                    Verde: donde la ubica Google, después de pegar el link.
                  </span>
                  <span class="text-sm text-gray-700">
                    Qué hacer: buscá en Google Maps <strong>{{ d.calle }} {{ alturaParaBuscar(d) }}</strong> (la mitad de la cuadra
                    {{ d.cuadra }}, que va del {{ d.cuadra }} al {{ d.cuadra + 99 }}), copiá el link de la barra del navegador y
                    pegalo acá. Solo se revisa el punto rojo; los azules son para comparar.
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
  readonly deNombre = computed(() => (this.lista() ?? []).filter((d) => d.tipo === 'NOMBRE').length);
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

  marcar(d: Duda, decision: 'MISMA' | 'DISTINTAS' | 'ESTA_BIEN' | 'NO_EXISTE'): void {
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
