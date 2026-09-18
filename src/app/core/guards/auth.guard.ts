import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Protege `/` (todo el panel): requiere estar logueado. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/**
 * Rutas sensibles (Configuración, Métricas, Pagos, Usuarios, WhatsApp, Roles) — cada una
 * exige su propio permiso (roles configurables, mejora 2026-09-16 — antes era un único
 * bit "DUENO" fijo). El backend ya rechaza estas llamadas sin el permiso correspondiente
 * (`hasAuthority("PERM_x")` en SecurityConfig); este guard es solo para no mostrarle una
 * pantalla rota si entra a la URL a mano.
 */
export function permisoGuard(permiso: string): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
    return auth.tienePermiso(permiso) ? true : router.createUrlTree(['/']);
  };
}
