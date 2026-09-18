import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminUsuarioService } from '../../core/services/admin-usuario.service';
import { AuthService } from '../../core/services/auth.service';
import { RolService } from '../../core/services/rol.service';
import { ToastService } from '../../core/services/toast.service';
import { AdminUsuario } from '../../core/models/admin-usuario.model';
import { EmptyStateComponent } from '../../shared/empty-state.component';

/**
 * ABM de usuarios del panel (roles configurables, mejora pedida por el dueño 2026-09-16
 * — antes DUENO/OPERADOR fijo) — solo la ve/usa un admin con permiso "usuarios" (guard
 * `permisoGuard('usuarios')` en las rutas, el backend lo exige igual). Qué puede hacer
 * cada rol se define ahora en "Roles".
 */
@Component({
  selector: 'app-usuarios',
  imports: [FormsModule, DatePipe, RouterLink, EmptyStateComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h1 class="font-semibold text-gray-800">Usuarios del panel</h1>
        <button type="button" class="btn bg-brand-600 hover:bg-brand-700" (click)="nuevoAbierto.set(true)">
          + Nuevo usuario
        </button>
      </div>

      <p class="text-xs text-gray-500 px-4 pt-3">
        Qué puede hacer cada rol se define en <a routerLink="/roles" class="text-brand-600 hover:underline">Roles</a>.
      </p>

      <div class="p-4">
        @if (service.usuarios().length) {
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-gray-400 uppercase">
                <th class="pb-2">Usuario</th>
                <th class="pb-2">Rol</th>
                <th class="pb-2">Estado</th>
                <th class="pb-2">Creado</th>
                <th class="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              @for (u of service.usuarios(); track u.id) {
                <tr class="border-t border-gray-100">
                  <td class="py-2 font-medium text-gray-800">
                    {{ u.username }}
                    @if (u.username === auth.username()) {
                      <span class="text-xs text-gray-400">(vos)</span>
                    }
                  </td>
                  <td class="py-2">
                    <select
                      class="input-mini"
                      [ngModel]="u.rol"
                      (ngModelChange)="cambiarRol(u, $event)"
                      [disabled]="u.username === auth.username()"
                    >
                      @for (r of roles.roles(); track r.id) {
                        <option [value]="r.id">{{ r.nombre }}</option>
                      }
                    </select>
                  </td>
                  <td class="py-2">
                    @if (u.enabled) {
                      <span class="text-xs bg-emerald-100 text-emerald-700 rounded px-2 py-0.5">Habilitado</span>
                    } @else {
                      <span class="text-xs bg-gray-200 text-gray-600 rounded px-2 py-0.5">Deshabilitado</span>
                    }
                  </td>
                  <td class="py-2 text-gray-500">{{ u.createdAt | date: 'dd/MM/yyyy' }}</td>
                  <td class="py-2 flex gap-2 justify-end flex-wrap">
                    <button type="button" class="btn-mini bg-violet-600 hover:bg-violet-700" (click)="resetearPassword(u)">
                      🔑 Resetear contraseña
                    </button>
                    @if (u.username !== auth.username()) {
                      <button
                        type="button"
                        class="btn-mini"
                        [class]="u.enabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'"
                        (click)="habilitar(u, !u.enabled)"
                      >
                        {{ u.enabled ? '⛔ Deshabilitar' : '✔ Habilitar' }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else if (!service.loading()) {
          <app-empty-state icono="👥" mensaje="Todavía no hay más usuarios cargados." hint="Solo existe el admin inicial." />
        }
      </div>
    </div>

    @if (nuevoAbierto()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="nuevoAbierto.set(false)">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-5 py-4">
            <h2 class="font-semibold">Nuevo usuario del panel</h2>
          </div>
          <div class="p-5 flex flex-col gap-3">
            @if (errorNuevo()) {
              <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ errorNuevo() }}</div>
            }
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Usuario</span>
              <input class="input" [(ngModel)]="nuevoUsername" name="nuevoUsername" placeholder="ej: operador1" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Rol</span>
              <select class="input" [(ngModel)]="nuevoRol" name="nuevoRol">
                @for (r of roles.roles(); track r.id) {
                  <option [value]="r.id">{{ r.nombre }}</option>
                }
              </select>
            </label>
          </div>
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="nuevoAbierto.set(false)">Cancelar</button>
            <button type="button" class="btn bg-brand-600 hover:bg-brand-700" [disabled]="creando()" (click)="crear()">
              {{ creando() ? 'Creando…' : 'Crear' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (credencialesGeneradas(); as c) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="credencialesGeneradas.set(null)">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          <div class="bg-emerald-600 text-white px-5 py-4">
            <h2 class="font-semibold">✔ Contraseña generada</h2>
          </div>
          <div class="p-5 flex flex-col gap-3 text-sm">
            <p class="text-gray-600">
              Pasásela a esta persona por un canal seguro — esta es la única vez que vas a poder verla, después
              queda solo el hash. <strong>Tiene 10 minutos para entrar con esta contraseña</strong> — si se vence
              sin usarla, volvé a esta pantalla para reenviarle una nueva.
            </p>
            <div class="bg-gray-50 border border-gray-200 rounded p-3 flex flex-col gap-1.5">
              <div><span class="text-xs text-gray-400">Usuario</span><div class="font-mono font-medium text-gray-800">{{ c.username }}</div></div>
              <div><span class="text-xs text-gray-400">Contraseña temporal</span><div class="font-mono font-medium text-gray-800">{{ c.passwordTemporal }}</div></div>
            </div>
          </div>
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
            <button type="button" class="btn bg-brand-600 hover:bg-brand-700" (click)="copiar(c)">
              {{ copiado() ? '✓ Copiado' : '📋 Copiar usuario y contraseña' }}
            </button>
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="credencialesGeneradas.set(null)">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
      }
      .input-mini {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
      }
      .btn:disabled {
        opacity: 0.6;
      }
      .btn-mini {
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.35rem 0.65rem;
        border-radius: 0.25rem;
        white-space: nowrap;
      }
    `,
  ],
})
export class UsuariosComponent implements OnInit {
  readonly service = inject(AdminUsuarioService);
  readonly auth = inject(AuthService);
  readonly roles = inject(RolService);
  private readonly toast = inject(ToastService);

  readonly nuevoAbierto = signal(false);
  readonly creando = signal(false);
  readonly errorNuevo = signal<string | null>(null);
  readonly credencialesGeneradas = signal<{ username: string; passwordTemporal: string } | null>(null);
  readonly copiado = signal(false);

  nuevoUsername = '';
  nuevoRol = 'operador';

  ngOnInit(): void {
    this.service.ensureLoaded();
    this.roles.ensureLoaded();
  }

  crear(): void {
    this.errorNuevo.set(null);
    if (!this.nuevoUsername.trim()) {
      this.errorNuevo.set('Ingresá un nombre de usuario.');
      return;
    }
    this.creando.set(true);
    this.service.crear({ username: this.nuevoUsername.trim(), rol: this.nuevoRol }).subscribe({
      next: (r) => {
        this.creando.set(false);
        this.nuevoAbierto.set(false);
        this.nuevoUsername = '';
        this.nuevoRol = 'operador';
        this.service.reload();
        this.credencialesGeneradas.set({ username: r.admin.username, passwordTemporal: r.passwordTemporal });
      },
      error: (err) => {
        this.creando.set(false);
        this.errorNuevo.set(err.error?.message ?? 'No se pudo crear el usuario.');
      },
    });
  }

  nombreRol(id: string): string {
    return this.roles.roles().find((r) => r.id === id)?.nombre ?? id;
  }

  cambiarRol(u: AdminUsuario, rol: string): void {
    this.service.cambiarRol(u.id, rol).subscribe({
      next: () => {
        this.toast.success(`${u.username} ahora es ${this.nombreRol(rol)}.`);
        this.service.reload();
      },
      error: (err) => this.toast.error(err.error?.message ?? 'No se pudo cambiar el rol.'),
    });
  }

  habilitar(u: AdminUsuario, enabled: boolean): void {
    this.service.habilitar(u.id, enabled).subscribe({
      next: () => {
        this.toast.success(enabled ? `${u.username} habilitado.` : `${u.username} deshabilitado.`);
        this.service.reload();
      },
      error: (err) => this.toast.error(err.error?.message ?? 'No se pudo cambiar el estado.'),
    });
  }

  resetearPassword(u: AdminUsuario): void {
    this.service.resetearPassword(u.id).subscribe((r) => {
      this.credencialesGeneradas.set({ username: u.username, passwordTemporal: r.passwordTemporal });
    });
  }

  copiar(c: { username: string; passwordTemporal: string }): void {
    navigator.clipboard?.writeText(`Usuario: ${c.username}\nContraseña temporal: ${c.passwordTemporal}`).then(() => {
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    });
  }
}
