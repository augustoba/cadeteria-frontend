import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';

interface Recursos {
  arrancoEn: string;
  memoriaJavaUsada: number;
  memoriaJavaMaxima: number;
  memoriaTotal: number;
  memoriaLibre: number;
  usoProcesador: number;
  usoProcesadorBackend: number;
  procesadores: number;
  discoTotal: number;
  discoLibre: number;
}
interface Tabla {
  nombre: string;
  filasAprox: number;
  bytes: number;
}
interface Dia {
  dia: string;
  cantidad: number;
}
interface Ruta {
  metodo: string;
  ruta: string;
  pedidos: number;
  promedioMs: number;
  maximoMs: number;
  errores: number;
}
interface ErrorRegistrado {
  cuando: string;
  origen: string;
  mensaje: string;
  excepcion: string | null;
}
interface EstadoSistema {
  generadoEn: string;
  recursos: Recursos;
  base: { bytesTotales: number; tablas: Tabla[] };
  pedidosPorDia: Dia[];
  cadetesActivos: number;
  api: { pedidos: number; errores: number; masPesadas: Ruta[] };
  errores: { desdeElArranque: number; porDia: Dia[]; ultimos: ErrorRegistrado[] };
}

/**
 * "Sistema" (2026-10-05), solo superadmin: cómo está el servidor ahora — memoria, procesador,
 * disco, cuánto ocupa cada tabla, pedidos por día, qué pedidos a la API pesan más y los últimos
 * errores del backend — sin entrar al servidor. Es la foto del momento: los contadores de la API y
 * los errores se cuentan desde el último arranque del backend.
 */
@Component({
  selector: 'app-sistema',
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="flex flex-col gap-4">
      <div class="bg-white rounded shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div class="flex-1 min-w-0">
          <h1 class="font-semibold text-gray-800">Sistema</h1>
          <p class="text-xs text-gray-500">
            Cómo está el servidor ahora. Los pedidos a la API y los errores se cuentan desde el último arranque del
            backend@if (estado(); as e) {<span> ({{ e.recursos.arrancoEn | date: 'dd/MM/yyyy HH:mm' }})</span>}.
          </p>
        </div>
        @if (estado(); as e) {
          <span class="text-xs text-gray-400">Actualizado {{ e.generadoEn | date: 'HH:mm:ss' }}</span>
        }
        <button type="button" class="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50" [disabled]="cargando()" (click)="cargar()">
          {{ cargando() ? 'Actualizando…' : 'Actualizar' }}
        </button>
      </div>

      @if (error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3">{{ error() }}</div>
      }

      @if (estado(); as e) {
        <!-- Recursos -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (m of medidores(); track m.titulo) {
            <div class="bg-white rounded shadow-sm px-4 py-3 flex flex-col gap-1">
              <span class="text-xs font-semibold text-gray-500">{{ m.titulo }}</span>
              <span class="text-xl font-semibold" [class.text-red-600]="m.porcentaje >= 90" [class.text-amber-600]="m.porcentaje >= 75 && m.porcentaje < 90" [class.text-gray-800]="m.porcentaje < 75">
                {{ m.porcentaje | number: '1.0-0' }}%
              </span>
              <div class="h-1.5 rounded bg-gray-100 overflow-hidden">
                <div class="h-full" [class.bg-red-500]="m.porcentaje >= 90" [class.bg-amber-500]="m.porcentaje >= 75 && m.porcentaje < 90" [class.bg-emerald-500]="m.porcentaje < 75" [style.width.%]="m.porcentaje"></div>
              </div>
              <span class="text-xs text-gray-500">{{ m.detalle }}</span>
            </div>
          }
        </div>

        <div class="grid lg:grid-cols-2 gap-4">
          <!-- Base de datos -->
          <div class="bg-white rounded shadow-sm">
            <div class="px-4 py-3 border-b border-gray-200">
              <h2 class="text-sm font-semibold text-gray-700">Base de datos — {{ tamano(e.base.bytesTotales) }}</h2>
              <p class="text-xs text-gray-500">Las tablas que más ocupan. La cantidad de filas es la estimación de MySQL, no un conteo exacto.</p>
            </div>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-500">
                  <th class="px-4 py-2 font-medium">Tabla</th>
                  <th class="px-4 py-2 font-medium text-right">Filas</th>
                  <th class="px-4 py-2 font-medium text-right">Tamaño</th>
                </tr>
              </thead>
              <tbody>
                @for (t of tablas(); track t.nombre) {
                  <tr class="border-t border-gray-100">
                    <td class="px-4 py-1.5 text-gray-800">{{ t.nombre }}</td>
                    <td class="px-4 py-1.5 text-right text-gray-600">{{ t.filasAprox | number: '1.0-0' }}</td>
                    <td class="px-4 py-1.5 text-right text-gray-600">{{ tamano(t.bytes) }}</td>
                  </tr>
                }
              </tbody>
            </table>
            @if (e.base.tablas.length > tablas().length) {
              <button type="button" class="w-full text-xs text-gray-500 hover:bg-gray-50 px-4 py-2 border-t border-gray-100" (click)="todasLasTablas.set(true)">
                Ver las {{ e.base.tablas.length }} tablas
              </button>
            }
          </div>

          <!-- Actividad -->
          <div class="bg-white rounded shadow-sm">
            <div class="px-4 py-3 border-b border-gray-200">
              <h2 class="text-sm font-semibold text-gray-700">Pedidos por día (últimos 14 días)</h2>
              <p class="text-xs text-gray-500">{{ e.cadetesActivos }} cadetes activos.</p>
            </div>
            @if (e.pedidosPorDia.length) {
              <div class="px-4 py-3 flex flex-col gap-1">
                @for (d of e.pedidosPorDia; track d.dia) {
                  <div class="flex items-center gap-2 text-xs">
                    <span class="w-20 text-gray-500">{{ d.dia | date: 'EEE dd/MM' }}</span>
                    <div class="flex-1 h-3 rounded bg-gray-100 overflow-hidden">
                      <div class="h-full bg-brand-500" [style.width.%]="(100 * d.cantidad) / maximoPedidos()"></div>
                    </div>
                    <span class="w-10 text-right text-gray-700">{{ d.cantidad }}</span>
                  </div>
                }
              </div>
            } @else {
              <p class="px-4 py-3 text-sm text-gray-500">No hubo pedidos en los últimos 14 días.</p>
            }
          </div>
        </div>

        <!-- API -->
        <div class="bg-white rounded shadow-sm">
          <div class="px-4 py-3 border-b border-gray-200">
            <h2 class="text-sm font-semibold text-gray-700">
              Pedidos a la API desde el arranque — {{ e.api.pedidos | number: '1.0-0' }}
              @if (e.api.errores) {
                <span class="text-red-600">({{ e.api.errores | number: '1.0-0' }} con error del servidor)</span>
              }
            </h2>
            <p class="text-xs text-gray-500">Las rutas que más tiempo sumaron: lo primero a mirar si el sistema se pone lento.</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-500">
                  <th class="px-4 py-2 font-medium">Ruta</th>
                  <th class="px-4 py-2 font-medium text-right">Pedidos</th>
                  <th class="px-4 py-2 font-medium text-right">Promedio</th>
                  <th class="px-4 py-2 font-medium text-right">Máximo reciente</th>
                  <th class="px-4 py-2 font-medium text-right">Errores</th>
                </tr>
              </thead>
              <tbody>
                @for (r of e.api.masPesadas; track r.metodo + r.ruta) {
                  <tr class="border-t border-gray-100">
                    <td class="px-4 py-1.5 text-gray-800"><span class="text-xs text-gray-400">{{ r.metodo }}</span> {{ r.ruta }}</td>
                    <td class="px-4 py-1.5 text-right text-gray-600">{{ r.pedidos | number: '1.0-0' }}</td>
                    <td class="px-4 py-1.5 text-right" [class.text-amber-600]="r.promedioMs >= 1000" [class.text-gray-600]="r.promedioMs < 1000">{{ r.promedioMs | number: '1.0-0' }} ms</td>
                    <td class="px-4 py-1.5 text-right text-gray-600">{{ r.maximoMs | number: '1.0-0' }} ms</td>
                    <td class="px-4 py-1.5 text-right" [class.text-red-600]="r.errores > 0" [class.text-gray-400]="r.errores === 0">{{ r.errores }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-4 py-3 text-gray-500">Todavía no hay pedidos registrados.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Errores -->
        <div class="bg-white rounded shadow-sm">
          <div class="px-4 py-3 border-b border-gray-200">
            <h2 class="text-sm font-semibold text-gray-700">
              Errores del backend desde el arranque — {{ e.errores.desdeElArranque | number: '1.0-0' }}
            </h2>
            <p class="text-xs text-gray-500">
              @if (e.errores.porDia.length) {
                Por día:
                @for (d of e.errores.porDia; track d.dia; let ultimo = $last) {
                  <span>{{ d.dia | date: 'dd/MM' }}: {{ d.cantidad }}{{ ultimo ? '' : ' · ' }}</span>
                }
              } @else {
                Ninguno desde que arrancó.
              }
              Se guardan los últimos 50 y se pierden al reiniciar el backend.
            </p>
          </div>
          @for (x of e.errores.ultimos; track $index) {
            <div class="px-4 py-2 border-t border-gray-100 text-sm">
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span>{{ x.cuando | date: 'dd/MM/yyyy HH:mm:ss' }}</span>
                <span class="font-medium text-gray-600">{{ x.origen }}</span>
              </div>
              <div class="text-gray-800 break-words">{{ x.mensaje }}</div>
              @if (x.excepcion) {
                <div class="text-xs text-red-700 break-words">{{ x.excepcion }}</div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SistemaComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly estado = signal<EstadoSistema | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly todasLasTablas = signal(false);

  readonly tablas = computed(() => {
    const todas = this.estado()?.base.tablas ?? [];
    return this.todasLasTablas() ? todas : todas.slice(0, 12);
  });

  readonly maximoPedidos = computed(() => Math.max(1, ...(this.estado()?.pedidosPorDia ?? []).map((d) => d.cantidad)));

  /** Los cuatro medidores de arriba, cada uno con su porcentaje de uso. */
  readonly medidores = computed(() => {
    const r = this.estado()?.recursos;
    if (!r) return [];
    const porc = (usado: number, total: number) => (total > 0 ? Math.min(100, Math.max(0, (100 * usado) / total)) : 0);
    return [
      {
        titulo: 'Disco del servidor',
        porcentaje: porc(r.discoTotal - r.discoLibre, r.discoTotal),
        detalle: `${this.tamano(r.discoTotal - r.discoLibre)} usados de ${this.tamano(r.discoTotal)}`,
      },
      {
        titulo: 'Memoria del backend',
        porcentaje: porc(r.memoriaTotal - r.memoriaLibre, r.memoriaTotal),
        detalle: `${this.tamano(r.memoriaTotal - r.memoriaLibre)} de ${this.tamano(r.memoriaTotal)} (su límite)`,
      },
      {
        titulo: 'Memoria de Java',
        porcentaje: porc(r.memoriaJavaUsada, r.memoriaJavaMaxima),
        detalle: `${this.tamano(r.memoriaJavaUsada)} de ${this.tamano(r.memoriaJavaMaxima)}`,
      },
      {
        titulo: 'Procesador',
        porcentaje: r.usoProcesador < 0 ? 0 : r.usoProcesador * 100,
        detalle:
          r.usoProcesador < 0
            ? 'El sistema no lo informa'
            : `El backend usa ${Math.round(Math.max(0, r.usoProcesadorBackend) * 100)}% · ${r.procesadores} núcleos`,
      },
    ];
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.http.get<EstadoSistema>(apiUrl('/admin/sistema/estado')).subscribe({
      next: (e) => {
        this.estado.set(e);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo leer el estado del sistema. Probá de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** "1,2 GB", "340 MB", "12 KB". */
  tamano(bytes: number): string {
    if (!(bytes > 0)) return '0';
    const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(unidades.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const valor = bytes / Math.pow(1024, i);
    return `${valor.toLocaleString('es-AR', { maximumFractionDigits: valor >= 100 || i === 0 ? 0 : 1 })} ${unidades[i]}`;
  }
}
