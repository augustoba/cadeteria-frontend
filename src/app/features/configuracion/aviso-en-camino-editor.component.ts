import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { apiUrl } from '../../core/config/site-config';

interface AvisoEnCamino {
  texto: string;
  textoOriginal: string;
  personalizado: boolean;
  editadoPor: string | null;
  editadoEn: string | null;
}

interface VistaPrevia {
  texto: string;
  pedidoNumero: number;
}

const VARIABLES = [
  { clave: '{cadete}', ayuda: 'nombre del cadete' },
  { clave: '{numero}', ayuda: 'número de pedido' },
  { clave: '{link}', ayuda: 'link de seguimiento' },
  { clave: '{marca}', ayuda: 'nombre de la cadetería' },
];

/**
 * Texto del aviso "en camino" que el admin le manda al cliente con el botón "Avisar al cliente" (3n,
 * 2026-09-28). Se guarda aparte del botón "Guardar cambios" de Configuración porque tiene su propio
 * registro de quién lo editó, y la vista previa se arma con un pedido real reciente.
 */
@Component({
  selector: 'app-aviso-en-camino-editor',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-4">Aviso "en camino" por WhatsApp</h2>
    <p class="text-xs text-gray-400 -mt-2">
      Es el mensaje del botón "Avisar al cliente" del dashboard: abre WhatsApp con este texto escrito. Va por la app de
      WhatsApp, así que las tildes están bien.
    </p>
    @if (aviso(); as a) {
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap gap-2">
          @for (v of variables; track v.clave) {
            <button
              type="button"
              class="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
              [title]="'Insertar ' + v.ayuda"
              (click)="insertar(v.clave, area)"
            >
              + {{ v.clave }} <span class="text-gray-400">({{ v.ayuda }})</span>
            </button>
          }
        </div>
        <textarea
          #area
          class="input"
          rows="3"
          maxlength="500"
          [(ngModel)]="texto"
          name="avisoEnCamino"
          (ngModelChange)="cambio$.next($event)"
        ></textarea>
        @if (!texto.includes('{link}')) {
          <div class="rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">
            ⚠️ Falta <code>{{ '{link}' }}</code>: sin el link el cliente no puede seguir el envío, y así no se puede guardar.
          </div>
        }
        <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <span class="block text-xs text-gray-400 mb-1">
            Vista previa
            @if (vistaPrevia(); as vp) { con el pedido #{{ vp.pedidoNumero }} } @else { (no hay pedidos con cadete para armarla) }
          </span>
          <span class="whitespace-pre-wrap text-gray-700">{{ vistaPrevia()?.texto ?? texto }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn bg-emerald-600 hover:bg-emerald-700"
            [disabled]="guardando() || !texto.includes('{link}') || texto === a.texto"
            (click)="guardar()"
          >
            Guardar aviso
          </button>
          @if (texto !== a.textoOriginal) {
            <button type="button" class="text-sm text-gray-600 underline" (click)="volverAlOriginal()">
              Volver al texto original
            </button>
          }
          @if (a.editadoPor) {
            <span class="text-xs text-gray-400">
              Editado por {{ a.editadoPor }}@if (a.editadoEn) { el {{ a.editadoEn | date: 'dd/MM HH:mm' }}}
            </span>
          }
          @if (mensaje(); as m) {
            <span class="text-xs" [class]="huboError() ? 'text-red-600' : 'text-emerald-600'">{{ m }}</span>
          }
        </div>
      </div>
    }
  `,
})
export class AvisoEnCaminoEditorComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly url = apiUrl('/admin/configuracion/aviso-en-camino');

  readonly variables = VARIABLES;
  readonly aviso = signal<AvisoEnCamino | null>(null);
  readonly vistaPrevia = signal<VistaPrevia | null>(null);
  readonly guardando = signal(false);
  readonly mensaje = signal<string | null>(null);
  readonly huboError = signal(false);
  readonly cambio$ = new Subject<string>();
  texto = '';

  ngOnInit(): void {
    this.cambio$
      .pipe(
        debounceTime(300),
        switchMap((texto) => this.http.post<VistaPrevia | null>(this.url + '/vista-previa', { texto }))
      )
      .subscribe({ next: (vp) => this.vistaPrevia.set(vp), error: () => this.vistaPrevia.set(null) });
    this.http.get<AvisoEnCamino>(this.url).subscribe((a) => this.cargar(a));
  }

  private cargar(a: AvisoEnCamino): void {
    this.aviso.set(a);
    this.texto = a.texto;
    this.cambio$.next(a.texto);
  }

  /** Inserta la variable donde está el cursor (o al final). */
  insertar(variable: string, area: HTMLTextAreaElement): void {
    const desde = area.selectionStart ?? this.texto.length;
    const hasta = area.selectionEnd ?? desde;
    this.texto = this.texto.slice(0, desde) + variable + this.texto.slice(hasta);
    this.cambio$.next(this.texto);
    setTimeout(() => {
      area.focus();
      area.setSelectionRange(desde + variable.length, desde + variable.length);
    });
  }

  /** Solo lo vuelve a poner en el cuadro: se aplica al tocar "Guardar aviso". */
  volverAlOriginal(): void {
    this.texto = this.aviso()?.textoOriginal ?? '';
    this.cambio$.next(this.texto);
  }

  guardar(): void {
    this.guardando.set(true);
    this.mensaje.set(null);
    this.huboError.set(false);
    this.http.put<AvisoEnCamino>(this.url, { texto: this.texto }).subscribe({
      next: (a) => {
        this.guardando.set(false);
        this.cargar(a);
        this.mensaje.set('Aviso guardado.');
      },
      error: (e) => {
        this.guardando.set(false);
        this.huboError.set(true);
        this.mensaje.set(e?.error?.message ?? 'No se pudo guardar el aviso.');
      },
    });
  }
}
