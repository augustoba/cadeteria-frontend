import { Injectable } from '@angular/core';

/** Cada tipo de aviso del panel suena distinto, para saber qué pasó sin mirar la pantalla (2026-09-26). */
export type TipoSonido = 'mensaje' | 'pedido-nuevo' | 'pedido-web' | 'reclamo-demora' | 'reclamo-problema' | 'alerta';

interface Nota {
  /** Hz */
  frecuencia: number;
  /** segundos */
  duracion: number;
  /** segundos de silencio después */
  pausa?: number;
  forma?: OscillatorType;
  volumen?: number;
}

const SONIDOS: Record<TipoSonido, { nombre: string; notas: Nota[] }> = {
  mensaje: {
    nombre: 'Mensaje de un cadete',
    notas: [
      { frecuencia: 1318, duracion: 0.12, pausa: 0.05, volumen: 0.1 },
      { frecuencia: 1568, duracion: 0.18, volumen: 0.1 },
    ],
  },
  'pedido-nuevo': {
    nombre: 'Pedido nuevo cargado',
    notas: [{ frecuencia: 880, duracion: 0.4 }],
  },
  'pedido-web': {
    nombre: 'Pedido web (/pedir)',
    notas: [
      { frecuencia: 660, duracion: 0.12, pausa: 0.03 },
      { frecuencia: 880, duracion: 0.12, pausa: 0.03 },
      { frecuencia: 1100, duracion: 0.2 },
    ],
  },
  'reclamo-demora': {
    nombre: 'Reclamo por demora (retiro o entrega)',
    notas: [
      { frecuencia: 700, duracion: 0.22, pausa: 0.12, forma: 'triangle', volumen: 0.2 },
      { frecuencia: 700, duracion: 0.22, forma: 'triangle', volumen: 0.2 },
    ],
  },
  'reclamo-problema': {
    nombre: 'Problema con la entrega',
    notas: [
      { frecuencia: 950, duracion: 0.16, forma: 'square', volumen: 0.07 },
      { frecuencia: 650, duracion: 0.16, forma: 'square', volumen: 0.07 },
      { frecuencia: 950, duracion: 0.16, forma: 'square', volumen: 0.07 },
      { frecuencia: 650, duracion: 0.16, forma: 'square', volumen: 0.07 },
      { frecuencia: 950, duracion: 0.16, forma: 'square', volumen: 0.07 },
      { frecuencia: 650, duracion: 0.3, forma: 'square', volumen: 0.07 },
    ],
  },
  alerta: {
    nombre: 'Alerta operativa (rechazo, sin ubicación, WhatsApp/SMS, cupo)',
    notas: [
      { frecuencia: 440, duracion: 0.25, pausa: 0.04, forma: 'triangle', volumen: 0.22 },
      { frecuencia: 330, duracion: 0.35, forma: 'triangle', volumen: 0.22 },
    ],
  },
};

/**
 * Sonidos del panel generados con Web Audio — sin archivos. Un solo AudioContext para toda la
 * sesión (el navegador limita cuántos se pueden crear). Si el navegador bloquea el audio (todavía
 * no hubo un clic en la página), no suena: el toast igual se ve.
 */
@Injectable({ providedIn: 'root' })
export class SonidosService {
  private ctx?: AudioContext;

  readonly tipos = (Object.keys(SONIDOS) as TipoSonido[]).map((tipo) => ({ tipo, nombre: SONIDOS[tipo].nombre }));

  reproducir(tipo: TipoSonido): void {
    try {
      const ctx = this.contexto();
      if (ctx.state === 'suspended') void ctx.resume();
      let t = ctx.currentTime + 0.02;
      for (const n of SONIDOS[tipo].notas) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.forma ?? 'sine';
        osc.frequency.value = n.frecuencia;
        gain.gain.setValueAtTime(n.volumen ?? 0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.duracion);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + n.duracion);
        t += n.duracion + (n.pausa ?? 0);
      }
    } catch {
      // Audio bloqueado u otro error: no es crítico, ya se ve el toast.
    }
  }

  private contexto(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }
}
