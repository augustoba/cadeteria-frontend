import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface AyudaSeccion {
  id: string;
  label: string;
}

/** Layout compartido (TOC + hero) entre las guías de "Ayuda" — panel y app del cadete. */
@Component({
  selector: 'app-ayuda-shell',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-white md:flex max-w-5xl mx-auto">
      <nav class="md:w-56 md:flex-shrink-0 md:sticky md:top-0 md:self-start md:max-h-screen md:overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 p-5">
        <a routerLink="/ayuda" class="flex items-center gap-2 mb-5">
          <span class="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">C</span>
          <span>
            <span class="block font-bold text-sm text-gray-800 leading-tight">Cadetería</span>
            <span class="block text-xs text-gray-500 font-semibold leading-tight">{{ subtitulo }}</span>
          </span>
        </a>
        <div class="flex flex-wrap gap-1 md:flex-col md:flex-nowrap md:gap-0.5">
          @for (s of secciones; track s.id) {
            <a [href]="'#' + s.id" class="block px-2 py-1.5 rounded text-xs md:text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 whitespace-nowrap">{{ s.label }}</a>
          }
        </div>
        @if (crosslinkPath) {
          <div class="mt-5 pt-4 border-t border-gray-200">
            <a [routerLink]="crosslinkPath" class="text-sm font-semibold text-brand-700 hover:text-brand-800">{{ crosslinkLabel }} →</a>
          </div>
        }
      </nav>

      <main class="flex-1 min-w-0 px-5 py-8 md:px-10 md:py-10">
        <div class="mb-9 max-w-[62ch]">
          <div class="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-2">{{ eyebrow }}</div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">{{ titulo }}</h1>
          <p class="text-sm text-gray-500 leading-relaxed">{{ descripcion }}</p>
        </div>

        <ng-content></ng-content>

        <footer class="max-w-[62ch] pt-6 mt-8 border-t border-gray-200 text-xs text-gray-500">
          {{ footer }}
        </footer>
      </main>
    </div>
  `,
})
export class AyudaShellComponent {
  @Input() subtitulo = '';
  @Input() eyebrow = '';
  @Input() titulo = '';
  @Input() descripcion = '';
  @Input() secciones: AyudaSeccion[] = [];
  @Input() crosslinkPath?: string;
  @Input() crosslinkLabel = '';
  @Input() footer = '';
}
