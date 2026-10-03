import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'admin-front.tema-oscuro';

/** Páginas que ve gente de afuera (clientes, cadetes que se anotan): siempre en claro. */
const RUTAS_PUBLICAS = ['/pedir', '/registro-cadete', '/seguimiento', '/confirmar-pedido', '/ayuda'];

/**
 * Modo oscuro (mejora 70) — toggle persistido en localStorage, aplicado como clase en <html>.
 * 2026-10-03: sin preferencia guardada arranca en claro (antes seguía al dispositivo, y con el
 * celular en oscuro el formulario de alta del cadete salía negro y su mensaje final casi no se
 * leía), y las páginas públicas no se oscurecen aunque el panel esté en oscuro en ese navegador.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly oscuro = signal(this.leerPreferenciaGuardada());
  private rutaPublica = false;

  constructor() {
    this.aplicar(this.oscuro());
  }

  /** La llama AppComponent en cada navegación. */
  enRuta(url: string): void {
    const ruta = url.split(/[?#]/)[0];
    this.rutaPublica = RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(p + '/'));
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
    document.documentElement.classList.toggle('dark', oscuro && !this.rutaPublica);
  }

  private leerPreferenciaGuardada(): boolean {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado != null) return guardado === '1';
    } catch {
      // ignorar y caer al valor por defecto
    }
    return false;
  }
}
