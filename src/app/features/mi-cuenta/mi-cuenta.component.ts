import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

/** Mismos límites que Validaciones.PASSWORD_MIN / PASSWORD_MAX del backend. */
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;

/**
 * "Cambiar mi contraseña" (2026-10-03): cualquier usuario del panel, sin permiso especial. Hasta
 * acá la contraseña temporal que le daba otro admin quedaba como definitiva. La nueva se escribe
 * dos veces y al cambiarla se cierra la sesión para entrar con ella, igual que en la app.
 */
@Component({
  selector: 'app-mi-cuenta',
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded shadow-sm max-w-md">
      <div class="px-4 py-3 border-b border-gray-200">
        <h1 class="font-semibold text-gray-800">Mi cuenta</h1>
        <p class="text-xs text-gray-500">
          Usuario: <strong>{{ auth.username() }}</strong>
        </p>
      </div>

      <form class="p-4 flex flex-col gap-4" (ngSubmit)="guardar()">
        <h2 class="text-sm font-semibold text-gray-700">Cambiar mi contraseña</h2>

        @if (error()) {
          <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
        }

        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Contraseña actual</span>
          <div class="relative">
            <input
              [type]="ver() ? 'text' : 'password'"
              name="actual"
              class="campo"
              [ngModel]="actual()"
              (ngModelChange)="actual.set($event)"
              autocomplete="current-password"
              [maxlength]="max"
              [disabled]="guardando()"
            />
          </div>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Contraseña nueva</span>
          <input
            [type]="ver() ? 'text' : 'password'"
            name="nueva"
            class="campo"
            [ngModel]="nueva()"
            (ngModelChange)="nueva.set($event)"
            autocomplete="new-password"
            [maxlength]="max"
            [disabled]="guardando()"
          />
          <span class="text-xs text-gray-500">Entre {{ min }} y {{ max }} caracteres.</span>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Repetir la contraseña nueva</span>
          <input
            [type]="ver() ? 'text' : 'password'"
            name="repetir"
            class="campo"
            [ngModel]="repetir()"
            (ngModelChange)="repetir.set($event)"
            autocomplete="new-password"
            [maxlength]="max"
            [disabled]="guardando()"
          />
          @if (noCoinciden()) {
            <span class="text-xs text-red-600">Las dos contraseñas nuevas no son iguales.</span>
          }
        </label>

        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="ver" [ngModel]="ver()" (ngModelChange)="ver.set($event)" />
          👁️ Mostrar las contraseñas
        </label>

        <p class="text-xs text-gray-500">Al cambiarla se cierra la sesión y entrás de nuevo con la contraseña nueva.</p>

        <button
          type="submit"
          class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium rounded px-4 py-2 text-sm"
          [disabled]="!puedeGuardar()"
        >
          {{ guardando() ? 'Guardando…' : 'Cambiar contraseña' }}
        </button>
      </form>
    </div>
  `,
  styles: [
    `
      .campo {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
      }
      .campo:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-brand-400);
      }
    `,
  ],
})
export class MiCuentaComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly min = PASSWORD_MIN;
  readonly max = PASSWORD_MAX;

  readonly actual = signal('');
  readonly nueva = signal('');
  readonly repetir = signal('');
  readonly ver = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  /** Recién cuando se escribió algo en "Repetir": mientras está vacío no se marca en rojo. */
  readonly noCoinciden = computed(() => this.repetir().length > 0 && this.repetir() !== this.nueva());

  readonly puedeGuardar = computed(
    () =>
      !this.guardando() &&
      this.actual().length > 0 &&
      this.nueva().length >= PASSWORD_MIN &&
      this.nueva() === this.repetir(),
  );

  guardar(): void {
    if (!this.puedeGuardar()) return;
    if (this.nueva() === this.actual()) {
      this.error.set('La contraseña nueva tiene que ser distinta de la actual.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.auth.cambiarMiPassword(this.actual(), this.nueva()).subscribe({
      next: () => {
        this.toast.success('Contraseña cambiada. Entrá de nuevo con la contraseña nueva.');
        this.auth.logout();
        this.router.navigateByUrl('/login');
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set((err.error as { message?: string } | null)?.message ?? 'No se pudo cambiar la contraseña.');
      },
    });
  }
}
