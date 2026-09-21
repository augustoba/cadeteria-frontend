import { AfterViewInit, Component, HostListener, input, output, signal } from '@angular/core';

export interface TourStep {
  titulo: string;
  texto: string;
  /** Selector CSS del elemento a resaltar; sin él, el paso se muestra centrado. */
  selector?: string;
}

/** Recorrido guiado: oscurece la pantalla, resalta un elemento por paso y muestra un globo con Atrás / Siguiente / Entendido. */
@Component({
  selector: 'app-tour',
  template: `
    <div class="tour-back" [class.sin-foco]="!rect()" (click)="cerrar()"></div>
    @if (rect(); as r) {
      <div class="tour-ring" [style.top.px]="r.top - 6" [style.left.px]="r.left - 6" [style.width.px]="r.width + 12" [style.height.px]="r.height + 12"></div>
    }
    <div class="tour-pop" [style.top.px]="pos().top" [style.left.px]="pos().left" role="dialog" aria-live="polite">
      <button type="button" class="x" (click)="cerrar()" aria-label="Cerrar">×</button>
      <b>{{ paso().titulo }}</b>
      <p>{{ paso().texto }}</p>
      <div class="tour-foot">
        <small>{{ idx() + 1 }} de {{ steps().length }}</small>
        <span>
          @if (idx() > 0) {
            <button type="button" (click)="atras()">Atrás</button>
          }
          <button type="button" class="cta" (click)="siguiente()">{{ idx() === steps().length - 1 ? 'Entendido' : 'Siguiente' }}</button>
        </span>
      </div>
    </div>
  `,
  styles: [
    `
      .tour-back {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 41, 0.55);
        z-index: 100;
      }
      .tour-ring {
        position: fixed;
        border: 2px solid #f26b1d;
        border-radius: 10px;
        box-shadow: 0 0 0 4000px rgba(15, 23, 41, 0.55);
        z-index: 101;
        pointer-events: none;
        transition: all 0.2s ease;
      }
      .tour-pop {
        position: fixed;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px -16px rgba(15, 23, 41, 0.35);
        padding: 16px;
        z-index: 102;
        transition: all 0.2s ease;
      }
      .tour-pop b {
        display: block;
        font-size: 14.5px;
        margin-bottom: 6px;
        color: #1f2328;
      }
      .tour-pop p {
        font-size: 13px;
        color: #667085;
        line-height: 1.5;
        margin: 0 0 12px;
      }
      .tour-pop .x {
        position: absolute;
        top: 8px;
        right: 10px;
        border: none;
        background: none;
        font-size: 18px;
        color: #9ca3af;
        cursor: pointer;
        line-height: 1;
      }
      .tour-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tour-foot small {
        color: #9ca3af;
        font-size: 11.5px;
      }
      .tour-foot button {
        border: none;
        background: #f1f2f6;
        color: #374151;
        font-weight: 700;
        font-size: 12.5px;
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        margin-left: 6px;
      }
      .tour-foot button.cta {
        background: #f26b1d;
        color: #fff;
      }
    `,
  ],
})
export class TourComponent implements AfterViewInit {
  readonly steps = input.required<TourStep[]>();
  readonly closed = output<void>();
  readonly idx = signal(0);
  readonly rect = signal<DOMRect | null>(null);
  readonly pos = signal({ top: 120, left: 120 });

  paso() {
    return this.steps()[this.idx()];
  }

  ngAfterViewInit() {
    this.ubicar();
  }

  @HostListener('window:resize')
  ubicar() {
    setTimeout(() => {
      const sel = this.paso().selector;
      const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
      const W = 320;
      const H = 190;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!el) {
        this.rect.set(null);
        this.pos.set({ top: Math.max(20, vh / 2 - H / 2), left: Math.max(20, vw / 2 - W / 2) });
        return;
      }
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      this.rect.set(r);
      const debajo = r.bottom + 16 + H < vh;
      const top = debajo ? r.bottom + 16 : Math.max(16, r.top - H - 16);
      this.pos.set({ top, left: Math.min(Math.max(16, r.left), vw - W - 16) });
    }, 30);
  }

  siguiente() {
    if (this.idx() >= this.steps().length - 1) {
      this.cerrar();
      return;
    }
    this.idx.update((i) => i + 1);
    this.ubicar();
  }

  atras() {
    this.idx.update((i) => Math.max(0, i - 1));
    this.ubicar();
  }

  cerrar() {
    this.closed.emit();
  }

  @HostListener('window:keydown.escape')
  esc() {
    this.cerrar();
  }
}
