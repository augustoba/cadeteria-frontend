import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';
import { AuthService } from '../../core/services/auth.service';

interface CelularCadete {
  /** null = sin celular vinculado: el próximo login lo vincula. */
  modelo: string | null;
  vinculadoEn: string | null;
  intentosOtroCelular: number;
  ultimoIntentoOtroCelularEn: string | null;
  ultimoIntentoOtroCelularModelo: string | null;
  /** "NOTIFICACIONES,BATERIA"; '' = todos dados; null = la app nunca lo informó. */
  permisosFaltantes: string | null;
  permisosInformadosEn: string | null;
  ultimoLinkApkEn: string | null;
  ultimoLinkApkDescargadoEn: string | null;
}

const NOMBRE_PERMISO: Record<string, string> = {
  UBICACION: 'Ubicación precisa',
  NOTIFICACIONES: 'Notificaciones',
  MICROFONO: 'Micrófono',
  BATERIA: 'Batería sin restricciones',
};

/**
 * Ficha del cadete → Datos personales: el celular con el que puede entrar (2026-09-29, un celular por
 * cadete para que no le pase la cuenta a otro). "Habilitar nuevo celular" borra el vinculado y cierra su
 * sesión: el próximo login queda como el único (nunca hay dos). Exige el permiso celular_cadete.
 */
@Component({
  selector: 'app-celular-cadete',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (datos(); as d) {
      <h2 class="subtitulo">Celular</h2>
      <div class="border border-gray-200 rounded p-3 flex flex-col gap-2 text-sm">
        @if (d.modelo || d.vinculadoEn) {
          <div>
            📱 <span class="font-medium">{{ d.modelo || 'Celular sin modelo informado' }}</span>
            <span class="text-gray-500"> — vinculado el {{ d.vinculadoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
          </div>
          <p class="text-xs text-gray-400">Solo puede entrar a la app desde este celular.</p>
        } @else {
          <div class="text-gray-600">Sin celular vinculado: el próximo celular con el que entre queda como el suyo.</div>
        }
        @if (d.intentosOtroCelular > 0) {
          <div class="text-amber-700">
            ⚠️ Intentó entrar desde otro celular {{ d.intentosOtroCelular }} {{ d.intentosOtroCelular === 1 ? 'vez' : 'veces' }}
            (el último: {{ d.ultimoIntentoOtroCelularModelo || 'modelo desconocido' }},
            {{ d.ultimoIntentoOtroCelularEn | date: 'dd/MM/yyyy HH:mm' }}).
          </div>
        }
        @if (puedeHabilitar && (d.modelo || d.vinculadoEn)) {
          @if (!confirmando()) {
            <button type="button" class="self-start text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                    (click)="confirmando.set(true)">
              Habilitar nuevo celular
            </button>
          } @else {
            <div class="bg-amber-50 border border-amber-200 rounded p-2 flex flex-col gap-2">
              <span>
                Se da de baja el celular actual y se le cierra la sesión. El próximo celular con el que entre queda como
                el único habilitado.
              </span>
              <div class="flex gap-2">
                <button type="button" class="text-sm px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                        [disabled]="enviando()" (click)="habilitarNuevo()">
                  Sí, habilitar nuevo celular
                </button>
                <button type="button" class="text-sm px-3 py-1.5 rounded border border-gray-300" (click)="confirmando.set(false)">
                  Cancelar
                </button>
              </div>
            </div>
          }
        }
        @if (d.permisosFaltantes != null) {
          @if (d.permisosFaltantes) {
            <div class="text-amber-700">
              ⚠️ A la app le faltan permisos: {{ nombresPermisos(d.permisosFaltantes) }}
              (informado el {{ d.permisosInformadosEn | date: 'dd/MM/yyyy HH:mm' }}). Sin ellos no puede trabajar.
            </div>
          } @else {
            <div class="text-gray-500 text-xs">✔ La app tiene todos los permisos ({{ d.permisosInformadosEn | date: 'dd/MM HH:mm' }}).</div>
          }
        }

        <div class="border-t border-gray-100 pt-2 flex flex-col gap-1">
          <span class="font-medium text-gray-700">Descargar la app</span>
          @if (d.ultimoLinkApkEn) {
            <span class="text-xs text-gray-500">
              Último link: {{ d.ultimoLinkApkEn | date: 'dd/MM/yyyy HH:mm' }} —
              {{ d.ultimoLinkApkDescargadoEn ? 'descargado el ' + (d.ultimoLinkApkDescargadoEn | date: 'dd/MM HH:mm') : 'todavía no lo usó' }}
            </span>
          }
          @if (puedeHabilitar) {
            <button type="button" class="self-start text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                    [disabled]="enviando()" (click)="generarLink()">
              Generar link de descarga
            </button>
          }
          @if (link(); as l) {
            <div class="bg-gray-50 border border-gray-200 rounded p-2 flex flex-col gap-1">
              <span class="text-xs text-gray-500">
                Pasáselo por WhatsApp. Es personal, sirve una sola vez y vence el {{ l.venceEn | date: 'dd/MM HH:mm' }}.
              </span>
              <div class="flex gap-2 items-center">
                <input class="input text-xs font-mono flex-1" [value]="l.url" readonly />
                <button type="button" class="text-sm px-3 py-1.5 rounded border border-gray-300" (click)="copiar(l.url)">
                  {{ copiado() ? '✔ Copiado' : 'Copiar' }}
                </button>
              </div>
            </div>
          }
        </div>
        @if (error()) {
          <div class="text-red-600">{{ error() }}</div>
        }
      </div>
    }
  `,
})
export class CelularCadeteComponent {
  private readonly http = inject(HttpClient);
  readonly cadeteId = input.required<string>();
  readonly datos = signal<CelularCadete | null>(null);
  readonly confirmando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly puedeHabilitar = inject(AuthService).tienePermiso('celular_cadete');

  constructor() {
    effect(() => {
      const id = this.cadeteId();
      if (!id) return;
      this.http
        .get<CelularCadete>(apiUrl(`/admin/cadetes/${id}/celular`))
        .subscribe({ next: (d) => this.datos.set(d), error: () => this.datos.set(null) });
    });
  }

  readonly link = signal<{ url: string; venceEn: string } | null>(null);
  readonly copiado = signal(false);

  nombresPermisos(faltantes: string): string {
    return faltantes.split(',').filter(Boolean).map((p) => NOMBRE_PERMISO[p] ?? p).join(', ');
  }

  generarLink(): void {
    this.enviando.set(true);
    this.error.set(null);
    this.copiado.set(false);
    this.http.post<{ url: string; venceEn: string }>(apiUrl(`/admin/cadetes/${this.cadeteId()}/celular/link-apk`), {}).subscribe({
      next: (l) => {
        this.link.set(l);
        this.enviando.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'No se pudo generar el link.');
        this.enviando.set(false);
      },
    });
  }

  copiar(url: string): void {
    navigator.clipboard?.writeText(url).then(() => this.copiado.set(true));
  }

  habilitarNuevo(): void {
    this.enviando.set(true);
    this.error.set(null);
    this.http.post<CelularCadete>(apiUrl(`/admin/cadetes/${this.cadeteId()}/celular/habilitar-nuevo`), {}).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.confirmando.set(false);
        this.enviando.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'No se pudo habilitar el nuevo celular.');
        this.enviando.set(false);
      },
    });
  }
}
