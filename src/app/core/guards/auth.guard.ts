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
 * Rutas de plata/config sensible (Configuración, Métricas, Pagos, Usuarios) — solo rol
 * DUENO (roles de admin, mejora 2026-09-16). El backend ya rechaza estas llamadas para un
 * OPERADOR (`hasRole("ADMIN_DUENO")` en SecurityConfig); este guard es solo para no
 * mostrarle una pantalla rota si entra a la URL a mano.
 */
export const duenoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  return auth.esDueno() ? true : router.createUrlTree(['/']);
};
