import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/**
 * Maneja los errores HTTP de forma centralizada:
 *  - 401 en `/api/admin/**` -> cierra sesion y manda al login.
 *  - resto -> toast con un mensaje legible.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAdminApi = req.url.includes('/api/admin/');
      const isAuth = req.url.includes('/api/auth/');

      if (err.status === 401 && isAdminApi) {
        auth.logout();
        router.navigate(['/login']);
        toast.error('Tu sesión expiró. Volvé a ingresar.');
      } else if (!isAuth) {
        toast.error(messageFor(err));
      }
      return throwError(() => err);
    })
  );
};

function messageFor(err: HttpErrorResponse): string {
  if (err.status === 0) return 'No se pudo conectar con el servidor.';
  const body = err.error as { message?: string } | string | null;
  if (body && typeof body === 'object' && body.message) return body.message;
  if (err.status === 404) return 'No se encontró lo que buscabas.';
  if (err.status === 403) return 'No tenés permiso para hacer eso.';
  if (err.status >= 500) return 'Hubo un error en el servidor. Probá de nuevo.';
  return 'Algo salió mal. Probá de nuevo.';
}
