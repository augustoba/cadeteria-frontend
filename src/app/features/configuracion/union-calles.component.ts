import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';

interface UnionCalle {
  seFue: string;
  queda: string;
  localidad: string;
  cuadra: number;
  distanciaM: number;
  filasMovidas: number;
  filasFusionadas: number;
}

interface UnionHecha extends UnionCalle {
  id: string;
  origen: string;
  cuando: string;
  /** Las uniones desde el 2026-10-07 guardan cómo estaba todo antes y se pueden volver atrás una vez. */
  sePuedeDeshacer: boolean;
  deshechaEn: string | null;
}

/**
 * Calles que la base propia aprendió con dos nombres (2026-10-03): el teléfono del cadete dice
 * "Batalla de Suipacha" y el mapa "Suipacha", y cada nombre abría su fila. Al aprender una cuadra
 * nueva el backend ya las une solo; esto es para las que quedaron de antes: primero muestra qué
 * uniría y recién con el segundo botón lo hace. Cada unión queda en el historial.
 */
@Component({
  selector: 'app-union-calles',
  imports: [DatePipe],
  template: `
    <div class="flex flex-col gap-2 border-t border-gray-200 pt-3">
      <span class="text-sm font-medium text-gray-700">Calles con dos nombres</span>
      <span class="text-xs text-gray-400 -mt-1">
        Cuando la misma calle quedó guardada con dos nombres ("Suipacha" y "Batalla de Suipacha"), el buscador ofrece
        las dos y lo que confirma un cadete con un nombre no corrige el otro. Son la misma calle si tienen la misma
        cuadra, en la misma localidad, a menos de 60 metros, y un nombre contiene al otro. Las cuadras nuevas ya se
        unen solas al aprenderse; esto revisa las que quedaron de antes.
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="boton" [disabled]="ocupado()" (click)="buscar()">
          {{ ocupado() ? 'Revisando…' : 'Buscar calles duplicadas' }}
        </button>
        <button type="button" class="boton" [disabled]="ocupado()" (click)="verHistorial()">Ver uniones hechas</button>
      </div>

      @if (error()) {
        <p class="text-sm text-red-600">{{ error() }}</p>
      }

      @if (pendientes(); as lista) {
        @if (!lista.length) {
          <p class="text-sm text-emerald-700">No hay calles duplicadas para unir.</p>
        } @else {
          <p class="text-sm text-gray-700">
            Se encontraron <strong>{{ lista.length }}</strong>. Revisalas: al unir, el primer nombre pasa a ser el
            segundo en toda la base y no se puede deshacer desde acá.
          </p>
          <ul class="text-sm text-gray-700 border border-gray-200 rounded divide-y divide-gray-100">
            @for (u of lista; track u.seFue + u.queda) {
              <li class="px-3 py-1.5">
                <strong>{{ mostrar(u.seFue) }}</strong> → <strong>{{ mostrar(u.queda) }}</strong>
                <span class="text-xs text-gray-500">
                  · misma cuadra {{ u.cuadra }} en {{ u.localidad }}, a {{ u.distanciaM }} m
                </span>
              </li>
            }
          </ul>
          <div>
            <button type="button" class="boton boton-fuerte" [disabled]="ocupado()" (click)="unir()">
              Unir estas {{ lista.length }}
            </button>
          </div>
        }
      }

      @if (hechas(); as lista) {
        @if (!lista.length) {
          <p class="text-sm text-gray-500">Todavía no se unió ninguna calle.</p>
        } @else {
          <ul class="text-sm text-gray-700 border border-gray-200 rounded divide-y divide-gray-100">
            @for (u of lista; track u.cuando + u.seFue) {
              <li class="px-3 py-1.5">
                <strong>{{ mostrar(u.seFue) }}</strong> → <strong>{{ mostrar(u.queda) }}</strong>
                <span class="text-xs text-gray-500">
                  · {{ u.cuando | date: 'dd/MM/yyyy HH:mm' }} · {{ u.origen }} · cuadra {{ u.cuadra }} en {{ u.localidad }} a
                  {{ u.distanciaM }} m · {{ u.filasMovidas }} cuadras pasadas, {{ u.filasFusionadas }} repetidas
                </span>
                @if (u.deshechaEn) {
                  <span class="text-xs text-amber-700">· deshecha el {{ u.deshechaEn | date: 'dd/MM/yyyy HH:mm' }}</span>
                } @else if (u.sePuedeDeshacer) {
                  <button type="button" class="ml-2 text-xs font-semibold text-brand-600 hover:underline" [disabled]="ocupado()" (click)="deshacer(u)">
                    Deshacer
                  </button>
                }
              </li>
            }
          </ul>
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
export class UnionCallesComponent {
  private readonly http = inject(HttpClient);

  /** Los nombres llegan como los guarda la base ("batalla de suipacha"): se muestran como en el buscador. */
  mostrar(nombre: string): string {
    const conectores = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);
    return nombre
      .split(' ')
      .map((p, i) => (i > 0 && conectores.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(' ');
  }

  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);
  /** null = todavía no se buscó. */
  readonly pendientes = signal<UnionCalle[] | null>(null);
  readonly hechas = signal<UnionHecha[] | null>(null);

  buscar(): void {
    this.pedir(this.http.get<UnionCalle[]>(apiUrl('/admin/configuracion/calles/duplicadas')), (lista) => {
      this.hechas.set(null);
      this.pendientes.set(lista);
    });
  }

  unir(): void {
    this.pedir(this.http.post<UnionCalle[]>(apiUrl('/admin/configuracion/calles/unir-duplicadas'), {}), () => {
      this.pendientes.set(null);
      this.verHistorial();
    });
  }

  verHistorial(): void {
    this.pedir(this.http.get<UnionHecha[]>(apiUrl('/admin/configuracion/calles/uniones')), (lista) => {
      this.pendientes.set(null);
      this.hechas.set(lista);
    });
  }

  /** Vuelve atrás una unión: las cuadras y las formas de escribir la calle quedan como estaban. */
  deshacer(u: UnionHecha): void {
    this.pedir(this.http.post<UnionHecha>(apiUrl(`/admin/configuracion/calles/uniones/${u.id}/deshacer`), {}), () => this.verHistorial());
  }

  private pedir<T>(pedido: import('rxjs').Observable<T>, alTerminar: (dato: T) => void): void {
    this.ocupado.set(true);
    this.error.set(null);
    pedido.subscribe({
      next: (dato) => {
        this.ocupado.set(false);
        alTerminar(dato);
      },
      error: () => {
        this.ocupado.set(false);
        this.error.set('No se pudo consultar. Probá de nuevo.');
      },
    });
  }
}
