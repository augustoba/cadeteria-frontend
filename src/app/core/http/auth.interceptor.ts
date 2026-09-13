import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Agrega `Authorization: Bearer <jwt>` a todas las requests a `/api/admin/**` y `/api/chat/**`. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const needsAuth = req.url.includes('/api/admin/') || req.url.includes('/api/chat/');
  const token = auth.token();

  if (needsAuth && token) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
