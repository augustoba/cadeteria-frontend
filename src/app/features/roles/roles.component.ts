import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RolService } from '../../core/services/rol.service';
import { ToastService } from '../../core/services/toast.service';
import { Permiso, Rol } from '../../core/models/rol.model';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton.component';

/**
 * ABM de roles con permisos configurables (mejora pedida por el dueño 2026-09-16, en
 * reemplazo del "DUEÑO"/"OPERADOR" fijo de antes). "admin" y "operador" son roles del
 * sistema (no se pueden borrar), pero sus permisos se editan igual que cualquier otro.
 *
 * Convención para el futuro: cada vista/funcionalidad nueva que tenga sentido restringir
 * por rol necesita sumar su propio permiso al catálogo (`RolSeeder` en el backend) y
 * gatillarlo en `SecurityConfig` — si no, cualquier admin puede entrar. Ver
 * RolSeeder.CATALOGO (backend) para la lista completa y cómo se agrega uno nuevo.
 */
@Component({
  selector: 'app-roles',
  imports: [FormsModule, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
        <h1 class="font-semibold">Roles y permisos</h1>
        <button type="button" class="btn-action bg-emerald-600 hover:bg-emerald-700" (click)="abrirNuevo()">
          + Nuevo rol
        </button>
      </div>

      <p class="text-xs text-gray-500 px-4 pt-3">
        Cada rol es un conjunto de permisos — asignalo a un usuario desde "Usuarios". "Admin" y "Operador" son los
        roles base del sistema (no se pueden borrar), pero sus permisos se pueden tildar/destildar igual que en
        cualquier rol nuevo.
      </p>

      <div class="p-4 flex flex-col gap-3">
        @if (service.loading()) {
          <app-loading-skeleton [filas]="4" />
        } @else {
          @for (r of service.roles(); track r.id) {
            <div class="border border-gray-200 rounded p-3 flex flex-col gap-2">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-700">{{ r.nombre }}</span>
                  @if (r.esSistema) {
                    <span class="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5">Rol del sistema</span>
                  }
                  <span class="text-xs text-gray-400">{{ r.permisos.length }} permiso(s)</span>
                </div>
                <div class="flex gap-1.5">
                  <button type="button" class="btn-mini bg-brand-600 hover:bg-brand-700" (click)="abrirEditar(r)">
                    ✏ Editar permisos
                  </button>
                  @if (!r.esSistema) {
                    <button type="button" class="btn-mini bg-red-500 hover:bg-red-600" (click)="eliminar(r)">🗑 Borrar</button>
                  }
                </div>
              </div>
              @if (r.permisos.length) {
                <div class="flex flex-wrap gap-1.5">
                  @for (p of r.permisos; track p.id) {
                    <span class="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">{{ p.nombre }}</span>
                  }
                </div>
              } @else {
                <p class="text-xs text-gray-400">Sin permisos especiales — solo el día a día (pedidos, cadetes, chat, zonas, clientes, incidencias).</p>
              }
            </div>
          } @empty {
            <app-empty-state icono="🔑" mensaje="Todavía no hay roles cargados." />
          }
        }
      </div>
    </div>

    @if (modalAbierto()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModal()">
        <div class="bg-white rounded shadow-lg w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="bg-brand-600 text-white px-4 py-3 rounded-t flex items-center justify-between">
            <h2 class="font-semibold">{{ editando() ? 'Editar ' + editando()!.nombre : 'Nuevo rol' }}</h2>
            <button type="button" class="text-white/80 hover:text-white text-lg leading-none" (click)="cerrarModal()">✕</button>
          </div>
          <div class="p-4 flex flex-col gap-3">
            @if (error()) {
              <div class="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{{ error() }}</div>
            }
            @if (!editando()) {
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Nombre del rol</span>
                <input class="input" [(ngModel)]="nombreModal" name="nombreModal" placeholder="Ej: Operador zona sur" />
              </label>
            }
            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium text-gray-700">Permisos</span>
              @for (cat of categorias(); track cat) {
                <div class="flex flex-col gap-1 border-t border-gray-100 pt-2 first:border-0 first:pt-0">
                  <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ cat }}</span>
                  @for (p of permisosPorCategoria(cat); track p.id) {
                    <label class="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" [checked]="permisosModal.has(p.id)" (change)="togglePermiso(p.id)" />
                      {{ p.nombre }}
                    </label>
                  }
                </div>
              }
            </div>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
            <button type="button" class="btn bg-gray-400 hover:bg-gray-500" (click)="cerrarModal()">Cancelar</button>
            <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="guardando()" (click)="guardar()">
              {{ guardando() ? 'Guardando…' : '💾 Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .btn-action {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.375rem 0.75rem;
        border-radius: 0.25rem;
      }
      .btn-mini {
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.35rem 0.75rem;
        border-radius: 0.3rem;
        display: inline-block;
        color: white;
      }
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        width: 100%;
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
    `,
  ],
})
export class RolesComponent implements OnInit {
  readonly service = inject(RolService);
  private readonly toast = inject(ToastService);

  readonly modalAbierto = signal(false);
  readonly editando = signal<Rol | null>(null);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  nombreModal = '';
  permisosModal = new Set<string>();

  readonly categorias = computed(() => {
    const cats = new Set(this.service.permisos().map((p) => p.categoria || 'General'));
    return [...cats];
  });

  ngOnInit(): void {
    this.service.ensureLoaded();
  }

  permisosPorCategoria(cat: string): Permiso[] {
    return this.service.permisos().filter((p) => (p.categoria || 'General') === cat);
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.nombreModal = '';
    this.permisosModal = new Set();
    this.error.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(r: Rol): void {
    this.editando.set(r);
    this.nombreModal = r.nombre;
    this.permisosModal = new Set(r.permisos.map((p) => p.id));
    this.error.set(null);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  togglePermiso(id: string): void {
    if (this.permisosModal.has(id)) this.permisosModal.delete(id);
    else this.permisosModal.add(id);
  }

  guardar(): void {
    this.error.set(null);
    const editando = this.editando();
    const permisos = [...this.permisosModal];
    this.guardando.set(true);
    const obs = editando
      ? this.service.actualizar(editando.id, { nombre: editando.nombre, permisos })
      : this.service.crear({ nombre: this.nombreModal.trim(), permisos });
    obs.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalAbierto.set(false);
        this.service.reload();
        this.toast.success(editando ? 'Rol actualizado.' : 'Rol creado.');
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(err.error?.message ?? 'No se pudo guardar el rol.');
      },
    });
  }

  eliminar(r: Rol): void {
    this.toast.conDeshacer(`Borrando el rol "${r.nombre}"…`, () => {
      this.service.eliminar(r.id).subscribe({
        next: () => this.service.reload(),
        error: (err) => this.toast.error(err.error?.message ?? 'No se pudo borrar el rol.'),
      });
    });
  }
}
