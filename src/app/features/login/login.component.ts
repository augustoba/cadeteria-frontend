import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login-bg min-h-screen flex flex-col items-center justify-center px-4">
      <img src="/assets/logo.jpg" alt="Logo" class="w-32 h-32 rounded-full object-cover ring-4 ring-white/10 shadow-2xl mb-7" />

      <form class="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden" (ngSubmit)="submit()">
        <div class="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-6 py-5">
          <h1 class="text-lg font-semibold">Panel de control</h1>
          <p class="text-brand-50 text-sm">Ingresá con tu usuario de administrador</p>
        </div>

        <div class="p-6 flex flex-col gap-4">
          @if (error()) {
            <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
          }

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Usuario</span>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">👤</span>
              <input
                type="text"
                name="username"
                class="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-shadow"
                [(ngModel)]="username"
                autocomplete="username"
                required
                [disabled]="loading()"
              />
            </div>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Contraseña</span>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">🔒</span>
              <input
                type="password"
                name="password"
                class="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-shadow"
                [(ngModel)]="password"
                autocomplete="current-password"
                required
                [disabled]="loading()"
              />
            </div>
          </label>

          <button
            type="submit"
            class="mt-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 transition-colors shadow-sm"
            [disabled]="loading() || !username || !password"
          >
            {{ loading() ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </div>
      </form>

      <p class="text-white/30 text-xs mt-6">Cadetería — panel interno</p>
    </div>
  `,
  styles: [
    `
      .login-bg {
        background: radial-gradient(circle at 30% 20%, #262b33 0%, #15181d 55%, #0b0d10 100%);
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (!this.username || !this.password || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.username, this.password).subscribe(({ ok, message }) => {
      this.loading.set(false);
      if (ok) {
        this.router.navigateByUrl('/');
      } else {
        this.error.set(message ?? 'No se pudo iniciar sesión.');
      }
    });
  }
}
