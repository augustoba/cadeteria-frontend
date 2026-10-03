import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';

interface ApkInfo {
  subida: boolean;
  version: number | null;
  subidaEn: string | null;
  tamanoBytes: number | null;
}

/**
 * Configuración → App de cadetes (2026-09-29): la APK que bajan los cadetes con el link de un solo uso del
 * mail de alta, de su ficha o de "Tu versión es vieja". Hay una sola: subir otra reemplaza a la anterior, y
 * los links ya mandados que todavía no se usaron bajan la nueva. Con "Obligar a actualizar" se sube la
 * versión mínima y las APK viejas ya no pueden entrar (les aparece el botón para bajar la nueva).
 */
@Component({
  selector: 'app-apk-cadetes',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  template: `
    <section class="flex flex-col gap-3 border-t border-gray-200 pt-4">
      <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">App de cadetes</h2>
      @if (info(); as i) {
        @if (i.subida) {
          <p class="text-sm text-gray-700">
            📱 APK actual: versión <b>{{ i.version ?? '—' }}</b>, subida el {{ i.subidaEn | date: 'dd/MM/yyyy HH:mm' }}
            ({{ (i.tamanoBytes ?? 0) / 1048576 | number: '1.1-1' }} MB).
          </p>
        } @else {
          <p class="text-sm text-amber-700">
            Todavía no se subió la APK: los mails de alta salen sin link para bajar la app.
          </p>
        }
      }
      <div class="grid sm:grid-cols-2 gap-3 max-w-2xl">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Archivo .apk</span>
          <input type="file" accept=".apk" (change)="elegir($event)" class="text-sm" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Número de versión (versionCode)</span>
          <input type="number" min="1" step="1" class="input" [(ngModel)]="version" name="apkVersion" />
        </label>
      </div>
      <label class="flex items-center gap-2">
        <input type="checkbox" [(ngModel)]="obligar" name="apkObligar" />
        <span class="text-sm text-gray-700">Obligar a actualizar (las versiones anteriores ya no pueden entrar)</span>
      </label>
      <p class="text-xs text-gray-400 -mt-2">
        Subir una APK reemplaza a la anterior. Los links de descarga son personales, sirven una sola vez y vencen a
        las 24 h; los que ya se mandaron bajan siempre la APK que esté subida. Con "Obligar a actualizar", al cadete
        con una versión vieja le aparece "Descargar la nueva versión" al entrar.
      </p>
      <!-- 2026-10-03: se elegía el archivo, se tocaba "Guardar cambios" (que no la sube) y parecía subida. -->
      <p class="text-xs text-gray-500 -mt-1">
        Esta sección no usa "Guardar cambios": la APK se sube con el botón de acá abajo.
      </p>
      @if (archivo && !subiendo()) {
        <p class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 max-w-2xl">
          ⚠️ Elegiste <strong>{{ archivo.name }}</strong> pero todavía no se subió. Revisá la versión
          @if (obligar) {
            (va a quedar como <strong>obligatoria</strong>)
          } @else {
            (no va a ser obligatoria: las versiones anteriores siguen entrando)
          }
          y tocá <strong>Subir APK</strong>.
        </p>
      }
      <div class="flex items-center gap-3">
        <button type="button" class="btn bg-brand-600 hover:bg-brand-700" [disabled]="!archivo || subiendo()" (click)="subir()">
          {{ subiendo() ? 'Subiendo…' : '⬆ Subir APK' }}
        </button>
        @if (mensaje()) {
          <span class="text-sm" [class]="error() ? 'text-red-600' : 'text-emerald-700'">{{ mensaje() }}</span>
        }
      </div>
    </section>
  `,
})
export class ApkCadetesComponent {
  private readonly http = inject(HttpClient);
  readonly info = signal<ApkInfo | null>(null);
  readonly subiendo = signal(false);
  readonly mensaje = signal<string | null>(null);
  readonly error = signal(false);
  archivo: File | null = null;
  private campoArchivo: HTMLInputElement | null = null;
  version: number | null = null;
  obligar = false;

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.http.get<ApkInfo>(apiUrl('/admin/configuracion/apk')).subscribe({
      next: (i) => {
        this.info.set(i);
        if (this.version == null && i.version != null) this.version = i.version + 1;
      },
      error: () => this.info.set(null),
    });
  }

  elegir(evento: Event): void {
    this.campoArchivo = evento.target as HTMLInputElement;
    this.archivo = this.campoArchivo.files?.[0] ?? null;
    this.mensaje.set(null);
  }

  subir(): void {
    if (!this.archivo) return;
    const datos = new FormData();
    datos.append('archivo', this.archivo);
    if (this.version != null) datos.append('version', String(this.version));
    datos.append('obligar', String(this.obligar));
    this.subiendo.set(true);
    this.mensaje.set(null);
    this.http.post<ApkInfo>(apiUrl('/admin/configuracion/apk'), datos).subscribe({
      next: (i) => {
        this.info.set(i);
        this.subiendo.set(false);
        this.error.set(false);
        this.mensaje.set(this.obligar ? 'APK subida. Las versiones anteriores ya no pueden entrar.' : 'APK subida.');
        this.obligar = false;
        // Ya está subida: se vacía el campo para que no quede el aviso de "todavía no se subió".
        this.archivo = null;
        if (this.campoArchivo) this.campoArchivo.value = '';
      },
      error: (e) => {
        this.subiendo.set(false);
        this.error.set(true);
        this.mensaje.set(e?.error?.message ?? 'No se pudo subir la APK.');
      },
    });
  }
}
