import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ZonaService } from '../../core/services/zona.service';
import { PuntoZona, Zona, ZonaInput } from '../../core/models/zona.model';
import { MapaPickerComponent } from '../../shared/mapa-picker.component';

@Component({
  selector: 'app-zona-form',
  imports: [FormsModule, RouterLink, MapaPickerComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h1 class="font-semibold text-gray-700">{{ editId ? 'Editar zona' : 'Nueva zona' }}</h1>
        <div class="flex gap-2">
          <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="zonas.saving()" (click)="guardar()">
            💾 Guardar
          </button>
          <a routerLink="/zonas" class="btn bg-red-500 hover:bg-red-600">↩ Volver</a>
        </div>
      </div>

      <div class="p-4 flex flex-col gap-4">
        @if (error()) {
          <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
        }

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Nombre</span>
            <input class="input" [(ngModel)]="nombre" name="nombre" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Radio (metros)</span>
            <input type="number" min="1" step="1" class="input" [(ngModel)]="radioM" name="radioM" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Tarifa sugerida</span>
            <input
              type="number"
              min="0"
              step="0.01"
              class="input"
              [(ngModel)]="tarifaSugerida"
              name="tarifaSugerida"
              placeholder="Sin sugerencia"
            />
          </label>
        </div>

        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-sm font-medium text-gray-700">
              {{
                modoRectangulo
                  ? 'Marcá una esquina y después la opuesta'
                  : modoPoligono
                    ? 'Dibujá el contorno real de la zona: cada click agrega un vértice'
                    : 'Marcá el centro y arrastrá el punto naranja para ajustar el radio'
              }}
            </span>
            <div class="flex gap-1.5 flex-wrap">
              @if (modoPoligono || modoRectangulo) {
                <button type="button" class="btn-mini bg-gray-500 hover:bg-gray-600" (click)="mapa.deshacerUltimoPunto()">
                  ↩ Deshacer último punto
                </button>
                <button
                  type="button"
                  class="btn-mini bg-red-500 hover:bg-red-600"
                  (click)="mapa.limpiarPoligono(); poligono = []"
                >
                  🗑 Borrar
                </button>
              }
              <button
                type="button"
                class="btn-mini"
                [class]="modoPoligono ? 'bg-brand-600 hover:bg-brand-700' : 'bg-violet-600 hover:bg-violet-700'"
                (click)="activarModoPoligono()"
              >
                {{ modoPoligono ? '⚪ Volver a modo círculo' : '✏️ Dibujar polígono libre' }}
              </button>
              <button
                type="button"
                class="btn-mini"
                [class]="modoRectangulo ? 'bg-brand-600 hover:bg-brand-700' : 'bg-teal-600 hover:bg-teal-700'"
                (click)="activarModoRectangulo()"
              >
                {{ modoRectangulo ? '⚪ Volver a modo círculo' : '▭ Dibujar rectángulo' }}
              </button>
            </div>
          </div>
          <div class="h-80">
            <app-mapa-picker
              #mapa
              [lat]="centroLat"
              [lng]="centroLng"
              [radioM]="radioM"
              [modoPoligono]="modoPoligono"
              [modoRectangulo]="modoRectangulo"
              [poligono]="poligono"
              (picked)="onPicked($event)"
              (radioChange)="radioM = $event"
              (poligonoChange)="poligono = $event"
            />
          </div>
          <p class="text-xs text-gray-400">
            {{ centroLat != null ? centroLat + ', ' + centroLng : 'Sin marcar' }} — radio {{ radioM }} m
            @if (poligono.length >= 3) {
              — polígono de {{ poligono.length }} vértices (define la forma real; el círculo queda como referencia)
            } @else if (poligono.length > 0) {
              — faltan {{ 3 - poligono.length }} punto(s) más para cerrar el polígono
            }
          </p>
        </div>

        @if (editId) {
          <div class="flex flex-col gap-2 border-t border-gray-200 pt-4">
            <span class="text-sm font-medium text-gray-700">Zonas aledañas</span>
            <div class="flex flex-wrap gap-2">
              @for (z of otrasZonas(); track z.id) {
                <button
                  type="button"
                  class="px-2 py-1 rounded text-xs font-medium border"
                  [class]="esAledana(z.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300'"
                  (click)="toggleAledana(z)"
                >
                  {{ z.nombre }}
                </button>
              }
              @if (!otrasZonas().length) {
                <span class="text-sm text-gray-400">No hay otras zonas cargadas todavía.</span>
              }
            </div>
          </div>
        }
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
        display: inline-block;
      }
      .btn:disabled {
        opacity: 0.6;
      }
      .btn-mini {
        color: white;
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.375rem 0.625rem;
        border-radius: 0.25rem;
        white-space: nowrap;
      }
    `,
  ],
})
export class ZonaFormComponent implements OnInit {
  readonly zonas = inject(ZonaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  editId: string | null = null;
  actual = signal<Zona | null>(null);

  nombre = '';
  radioM: number | null = 500;
  centroLat: number | null = null;
  centroLng: number | null = null;
  tarifaSugerida: number | null = null;
  modoPoligono = false;
  modoRectangulo = false;
  poligono: PuntoZona[] = [];

  readonly error = signal<string | null>(null);

  readonly otrasZonas = computed(() => this.zonas.zonas().filter((z) => z.id !== this.editId));

  ngOnInit(): void {
    this.zonas.ensureLoaded();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = id;
      this.zonas.get(id).subscribe((z) => {
        this.actual.set(z);
        this.nombre = z.nombre;
        this.radioM = z.radioM;
        this.centroLat = z.centroLat;
        this.centroLng = z.centroLng;
        this.tarifaSugerida = z.tarifaSugerida;
        this.poligono = z.poligono ?? [];
        this.modoPoligono = this.poligono.length >= 3;
      });
    }
  }

  activarModoPoligono(): void {
    this.modoRectangulo = false;
    this.modoPoligono = !this.modoPoligono;
  }

  activarModoRectangulo(): void {
    this.modoPoligono = false;
    this.modoRectangulo = !this.modoRectangulo;
  }

  onPicked(ev: { lat: number; lng: number }): void {
    this.centroLat = ev.lat;
    this.centroLng = ev.lng;
  }

  esAledana(id: string): boolean {
    return !!this.actual()?.zonasAledanas.some((a) => a.id === id);
  }

  toggleAledana(z: Zona): void {
    if (!this.editId) return;
    const id = this.editId;
    if (this.esAledana(z.id)) {
      this.zonas.quitarAdyacente(id, z.id, () => this.recargarActual());
    } else {
      this.zonas.agregarAdyacente(id, z.id, () => this.recargarActual());
    }
  }

  private recargarActual(): void {
    if (!this.editId) return;
    this.zonas.get(this.editId).subscribe((z) => this.actual.set(z));
  }

  guardar(): void {
    this.error.set(null);

    if (!this.nombre) {
      this.error.set('Completá el nombre de la zona.');
      return;
    }
    if (this.centroLat == null || this.centroLng == null) {
      this.error.set('Marcá el centro de la zona en el mapa.');
      return;
    }
    if (!this.radioM || this.radioM <= 0) {
      this.error.set('Ingresá un radio válido.');
      return;
    }

    const input: ZonaInput = {
      nombre: this.nombre,
      centroLat: this.centroLat,
      centroLng: this.centroLng,
      radioM: this.radioM,
      tarifaSugerida: this.tarifaSugerida,
      poligono: this.poligono.length >= 3 ? this.poligono : [],
    };

    const onSuccess = () => this.router.navigateByUrl('/zonas');
    if (this.editId) {
      this.zonas.actualizar(this.editId, input, onSuccess);
    } else {
      this.zonas.crear(input, onSuccess);
    }
  }
}
