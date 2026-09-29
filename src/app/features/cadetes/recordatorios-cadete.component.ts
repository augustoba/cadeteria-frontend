import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/config/site-config';

interface ConfirmacionRecordatorio {
  confirmadoEn: string;
  titulo: string;
  textos: string[];
}

/**
 * Ficha del cadete: cuándo tocó "Entendido" en el cartel de recordatorios al entrar a la app
 * (2026-09-29), con lo que decía el cartel en ese momento. Sirve si pasa algo ("nunca me dijeron lo
 * del casco"). Los textos se editan en Configuración → App del cadete.
 */
@Component({
  selector: 'app-recordatorios-cadete',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="border border-gray-200 rounded p-3">
      <h2 class="font-semibold text-gray-700 mb-2">
        Recordatorios al entrar
        <span class="text-xs font-normal text-gray-400">(últimos 10 "Entendido")</span>
      </h2>
      @if (lista().length === 0) {
        <p class="text-sm text-gray-500">Todavía no confirmó ninguno.</p>
      } @else {
        <ul class="text-sm divide-y divide-gray-100">
          @for (c of lista(); track c.confirmadoEn) {
            <li class="py-1.5">
              <button type="button" class="w-full text-left flex justify-between gap-2" (click)="alternar(c.confirmadoEn)">
                <span>{{ c.confirmadoEn | date: 'dd/MM/yyyy HH:mm' }} · {{ c.titulo }}</span>
                <span class="text-xs text-gray-400">{{ abierto() === c.confirmadoEn ? 'ocultar' : 'qué decía' }}</span>
              </button>
              @if (abierto() === c.confirmadoEn) {
                <ul class="mt-1 ml-4 list-disc text-xs text-gray-600 space-y-0.5">
                  @for (t of c.textos; track $index) {
                    <li>{{ t }}</li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class RecordatoriosCadeteComponent {
  private readonly http = inject(HttpClient);
  readonly cadeteId = input.required<string>();
  readonly lista = signal<ConfirmacionRecordatorio[]>([]);
  readonly abierto = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.cadeteId();
      if (!id) return;
      this.http
        .get<ConfirmacionRecordatorio[]>(apiUrl(`/admin/cadetes/${id}/recordatorios`))
        .subscribe({ next: (l) => this.lista.set(l), error: () => this.lista.set([]) });
    });
  }

  alternar(clave: string): void {
    this.abierto.set(this.abierto() === clave ? null : clave);
  }
}
