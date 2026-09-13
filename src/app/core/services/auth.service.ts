import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiUrl } from '../config/site-config';

const STORAGE_KEY = 'cadeteria_admin_token';

interface StoredToken {
  token: string;
  expiresAt: number; // epoch ms
}

interface LoginResponse {
  token: string;
  tokenType: string;
  tipo: string;
  expiresAt: string; // ISO
}

/**
 * Autenticacion del panel de administrador contra `POST /api/auth/login/admin`.
 * El JWT se guarda en localStorage y se manda como `Authorization: Bearer` en
 * las requests a `/api/admin/**` (ver auth.interceptor.ts).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly tokenSignal = signal<StoredToken | null>(this.loadStored());

  readonly isAuthenticated = computed(() => {
    const t = this.tokenSignal();
    return !!t && t.expiresAt > Date.now();
  });

  readonly username = computed(() => {
    const t = this.tokenSignal();
    if (!t || t.expiresAt <= Date.now()) return '';
    return decodeSub(t.token);
  });

  token(): string | null {
    const t = this.tokenSignal();
    return t && t.expiresAt > Date.now() ? t.token : null;
  }

  login(username: string, password: string): Observable<{ ok: boolean; message?: string }> {
    return this.http.post<LoginResponse>(apiUrl('/auth/login/admin'), { username, password }).pipe(
      map((res) => {
        const stored: StoredToken = { token: res.token, expiresAt: new Date(res.expiresAt).getTime() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        this.tokenSignal.set(stored);
        return { ok: true };
      }),
      catchError((err: HttpErrorResponse) => {
        const message = (err.error as { message?: string } | null)?.message ?? 'Usuario o contraseña incorrectos.';
        return of({ ok: false, message });
      })
    );
  }

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    this.tokenSignal.set(null);
  }

  private loadStored(): StoredToken | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredToken;
      if (!parsed?.token || !parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}

function decodeSub(jwt: string): string {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.sub === 'string' ? payload.sub : '';
  } catch {
    return '';
  }
}
