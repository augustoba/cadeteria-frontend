import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';
import { MapaDudaComponent } from './calles-a-revisar.component';

interface Punto {
  cuadra: number;
  localidad: string;
  lat: number;
  lng: number;
}

interface ABuscar {
  calleCanonica: string;
  calle: string;
  localidad: string;
  cuadra: number;
  tipo: 'INTERMEDIA' | 'INICIO' | 'FINAL';
  destraba: number;
  lat: number;
  lng: number;
  motivo: string;
  cercanas: Punto[];
}

interface Resultado {
  cargada: boolean;
  mensaje: string;
  completadas: number;
}

/**
 * Cuadras a buscar (2026-10-07): las que faltan en la base propia y que, si se cargan, permiten
 * calcular más. El backend arma la lista en el momento (con la base y el dibujo de las calles) y al
 * cargar una cuadra completa solo las del medio.
 */
@Component({
  selector: 'app-calles-a-buscar',
  imports: [FormsModule, MapaDudaComponent],
  template: `
    <div class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Calles a buscar</h2>
      <span class="text-xs text-gray-500">
        Cuadras que faltan en la base y que, si las cargás, le permiten al sistema calcular otras: la del medio de un tramo
        largo sin datos (<strong>Intermedia</strong>), la del comienzo de una calle que se conoce desde más arriba
        (<strong>Inicio</strong>) o la del final cuando la calle sigue (<strong>Final</strong>). Buscá la dirección en Google
        Maps, copiá el link y pegalo: la cuadra se guarda y el sistema completa solo las que quedan en el medio. Van primero
        las que más cuadras completan. La lista se calcula cada vez que la abrís.
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="boton" [disabled]="ocupado()" (click)="cargar()">
          {{ lista() ? 'Volver a calcular' : 'Ver la lista' }}
        </button>
        @if (lista(); as l) {
          <span class="text-xs text-gray-500">{{ l.length }} cuadras para buscar, que completarían {{ totalDestraba() }} más</span>
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
          <p class="text-sm text-emerald-700">No hay cuadras para buscar.</p>
        } @else {
          <ul class="text-sm text-gray-700 border border-gray-200 rounded divide-y divide-gray-100">
            @for (a of visibles(); track clave(a)) {
              <li class="px-3 py-2 flex flex-col gap-2">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <strong>{{ a.calle }} {{ a.cuadra }}</strong>
                  <span class="text-xs text-gray-500">{{ a.localidad }}</span>
                  <span class="text-xs rounded px-1.5 py-0.5 bg-orange-100 text-orange-800">{{ etiquetaDe(a) }}</span>
                  <span class="text-xs text-gray-500">completa {{ a.destraba }}</span>
                  <button type="button" class="ml-auto text-xs font-semibold text-brand-600 hover:underline" (click)="abrir(a)">
                    {{ abierta() === clave(a) ? 'Cerrar' : 'Buscar' }}
                  </button>
                </div>
                <span class="text-xs text-gray-600">{{ a.motivo }}</span>

                @if (abierta() === clave(a)) {
                  <app-mapa-duda [duda]="paraElMapa(a)" colorCuadra="#ea580c" />
                  <span class="text-xs text-gray-400">
                    Naranja: donde debería caer esta cuadra. Azul: las cuadras conocidas más cercanas de la misma calle.
                  </span>
                  <span class="text-sm text-gray-700">
                    Qué hacer: buscá en Google Maps <strong>{{ a.calle }} {{ a.cuadra + 50 }}</strong> (la mitad de la cuadra
                    {{ a.cuadra }}), copiá el link de la barra del navegador y pegalo acá. Tiene que caer cerca del punto naranja; si
                    Google la ubica en otro lado, mové el pin en Google Maps hasta la cuadra correcta y copiá ese link.
                  </span>
                  <div class="flex flex-wrap items-center gap-2">
                    <a [href]="buscarEnGoogle(a)" target="_blank" rel="noopener" class="boton">
                      Buscar {{ a.calle }} {{ a.cuadra + 50 }} en Google Maps
                    </a>
                    <input
                      type="text"
                      class="flex-1 min-w-48 rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder="Pegá acá el link de Google Maps"
                      [(ngModel)]="link"
                      [name]="'link-' + clave(a)"
                      (keydown.enter)="usarLink(a)"
                    />
                    <button type="button" class="boton boton-fuerte" [disabled]="ocupado() || !link.trim()" (click)="usarLink(a)">
                      Cargar con este link
                    </button>
                  </div>
                  @if (noCargada()) {
                    <p class="text-sm text-amber-700">{{ noCargada() }}</p>
                  }
                  <div>
                    <button type="button" class="boton" [disabled]="ocupado()" (click)="descartar(a)">Esa cuadra no existe</button>
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
export class CallesABuscarComponent {
  private readonly http = inject(HttpClient);
  private readonly base = '/admin/configuracion/calles/a-buscar';

  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  /** El link no sirvió: se muestra el porqué y la cuadra sigue abierta. */
  readonly noCargada = signal<string | null>(null);
  /** null = todavía no se pidió. */
  readonly lista = signal<ABuscar[] | null>(null);
  readonly abierta = signal<string | null>(null);
  readonly mostrar = signal(25);
  readonly visibles = computed(() => (this.lista() ?? []).slice(0, this.mostrar()));
  readonly totalDestraba = computed(() => (this.lista() ?? []).reduce((n, a) => n + a.destraba, 0));
  link = '';

  clave(a: ABuscar): string {
    return `${a.calleCanonica}|${a.localidad}|${a.cuadra}`;
  }

  etiquetaDe(a: ABuscar): string {
    return a.tipo === 'INTERMEDIA' ? 'Intermedia' : a.tipo === 'INICIO' ? 'Inicio' : 'Final';
  }

  /** El mapa chico es el de las dudas: el punto de la cuadra es donde se la espera. */
  paraElMapa(a: ABuscar) {
    return { cuadra: a.cuadra, lat: a.lat, lng: a.lng, linkLat: null, linkLng: null, cercanas: a.cercanas };
  }

  buscarEnGoogle(a: ABuscar): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${a.calle} ${a.cuadra + 50}, ${a.localidad}, Tucumán`);
  }

  cargar(): void {
    this.pedir(this.http.get<ABuscar[]>(apiUrl(this.base)), (l) => this.lista.set(l));
  }

  abrir(a: ABuscar): void {
    this.abierta.set(this.abierta() === this.clave(a) ? null : this.clave(a));
    this.link = '';
    this.noCargada.set(null);
  }

  usarLink(a: ABuscar): void {
    const link = this.link.trim();
    if (!link) return;
    const cuerpo = { calle: a.calleCanonica, localidad: a.localidad, cuadra: a.cuadra, link };
    this.pedir(this.http.post<Resultado>(apiUrl(this.base + '/link'), cuerpo), (r) => {
      if (!r.cargada) {
        this.noCargada.set(r.mensaje);
        return;
      }
      this.aviso.set(r.mensaje);
      this.abierta.set(null);
      this.link = '';
      this.cargar();
    });
  }

  descartar(a: ABuscar): void {
    const cuerpo = { calle: a.calleCanonica, localidad: a.localidad, cuadra: a.cuadra };
    this.pedir(this.http.post(apiUrl(this.base + '/descartar'), cuerpo), () => {
      this.aviso.set(`${a.calle} ${a.cuadra} no se vuelve a pedir.`);
      this.abierta.set(null);
      this.cargar();
    });
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
        this.error.set(e?.error?.message ?? 'No se pudo consultar. Probá de nuevo.');
      },
    });
  }
}
