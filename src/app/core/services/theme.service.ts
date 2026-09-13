import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'admin-front.tema-oscuro';

/** Modo oscuro (mejora 70) — toggle persistido en localStorage, aplicado como clase en <html>. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly oscuro = signal(this.leerPreferenciaGuardada());

  constructor() {
    this.aplicar(this.oscuro());
  }

  alternar(): void {
    this.set(!this.oscuro());
  }

  set(oscuro: boolean): void {
    this.oscuro.set(oscuro);
    this.aplicar(oscuro);
    try {
      localStorage.setItem(STORAGE_KEY, oscuro ? '1' : '0');
    } catch {
      // localStorage puede fallar en navegación privada — no es crítico, solo no persiste.
    }
  }

  private aplicar(oscuro: boolean): void {
    document.documentElement.classList.toggle('dark', oscuro);
  }

  private leerPreferenciaGuardada(): boolean {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado != null) return guardado === '1';
    } catch {
      // ignorar y caer al valor por defecto del sistema operativo
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
