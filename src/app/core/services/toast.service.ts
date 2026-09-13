import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
  /** Si tiene botón de "Deshacer" (ronda 10, punto 104) — segundosRestantes cuenta hacia atrás en pantalla. */
  accionLabel?: string;
  segundosRestantes?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  readonly toasts = this.toastsSignal.asReadonly();
  private seq = 0;
  private readonly timersDeshacer = new Map<number, ReturnType<typeof setInterval>>();

  success(message: string): void {
    this.push('success', message);
  }
  error(message: string): void {
    this.push('error', message);
  }
  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this.toastsSignal.update((list) => list.filter((t) => t.id !== id));
    const timer = this.timersDeshacer.get(id);
    if (timer) {
      clearInterval(timer);
      this.timersDeshacer.delete(id);
    }
  }

  /**
   * Acción crítica con ventana para arrepentirse (ronda 10, punto 104) — la acción real
   * no se ejecuta hasta que se agote el contador, así que "Deshacer" es simplemente no
   * ejecutarla nunca (no hace falta revertir nada en pantalla).
   */
  conDeshacer(mensaje: string, ejecutar: () => void, segundos = 5): void {
    const id = ++this.seq;
    this.toastsSignal.update((list) => [...list, { id, kind: 'info', message: mensaje, accionLabel: 'Deshacer', segundosRestantes: segundos }]);
    const intervalo = setInterval(() => {
      const actual = this.toastsSignal().find((t) => t.id === id);
      if (!actual || actual.segundosRestantes == null) return;
      const restante = actual.segundosRestantes - 1;
      if (restante <= 0) {
        clearInterval(intervalo);
        this.timersDeshacer.delete(id);
        this.toastsSignal.update((list) => list.filter((t) => t.id !== id));
        ejecutar();
        return;
      }
      this.toastsSignal.update((list) => list.map((t) => (t.id === id ? { ...t, segundosRestantes: restante } : t)));
    }, 1000);
    this.timersDeshacer.set(id, intervalo);
  }

  private push(kind: Toast['kind'], message: string): void {
    const id = ++this.seq;
    this.toastsSignal.update((list) => [...list, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 6000 : 3500);
  }
}
