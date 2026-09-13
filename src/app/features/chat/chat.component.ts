import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CadeteService } from '../../core/services/cadete.service';
import { ChatService } from '../../core/services/chat.service';
import { CloudinaryUploadService } from '../../core/services/cloudinary-upload.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { ToastService } from '../../core/services/toast.service';
import { Cadete } from '../../core/models/cadete.model';

@Component({
  selector: 'app-chat',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="bg-white rounded shadow-sm flex h-[32rem]">
      <aside class="w-64 border-r border-gray-200 shrink-0 flex flex-col">
        <div class="bg-brand-600 text-white px-4 py-3 rounded-tl font-semibold">Cadetes</div>
        <div class="overflow-y-auto flex-1">
          @for (c of cadetes.cadetes(); track c.id) {
            <button
              type="button"
              class="w-full text-left px-4 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 flex items-center justify-between gap-2"
              [class.bg-brand-50]="c.id === seleccionado()?.id"
              (click)="elegir(c)"
            >
              <span [class.font-semibold]="!!chat.noLeidosPorCadete()[c.id]">{{ c.nombre }} {{ c.apellido }}</span>
              @if (chat.noLeidosPorCadete()[c.id]; as cantidad) {
                <span class="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {{ cantidad > 99 ? '99+' : cantidad }}
                </span>
              }
            </button>
          } @empty {
            <p class="text-sm text-gray-400 p-4">Sin cadetes cargados.</p>
          }
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0">
        @if (!seleccionado()) {
          <p class="text-gray-400 text-sm py-6 text-center m-auto">Elegí un cadete para ver la conversación.</p>
        } @else {
          <div class="px-4 py-3 border-b border-gray-200 font-semibold text-gray-700">
            {{ seleccionado()!.nombre }} {{ seleccionado()!.apellido }}
          </div>

          <div #scrollEl class="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-gray-50">
            @if (chat.cargando()) {
              <p class="text-gray-400 text-sm text-center">Cargando…</p>
            } @else {
              @for (m of chat.mensajes(); track m.id) {
                <div class="flex" [class.justify-end]="m.autor === 'ADMIN'">
                  <div
                    class="max-w-[70%] rounded px-3 py-2 text-sm shadow-sm"
                    [class]="m.autor === 'ADMIN' ? 'bg-brand-600 text-white' : 'bg-white text-gray-800'"
                  >
                    @if (m.imagenUrl) {
                      <button type="button" (click)="lightbox.abrir(m.imagenUrl!)">
                        <img [src]="m.imagenUrl" class="max-w-full max-h-48 rounded" />
                      </button>
                    } @else if (m.audioUrl) {
                      <audio controls [src]="m.audioUrl" class="max-w-full"></audio>
                    } @else {
                      <p class="whitespace-pre-wrap">{{ m.texto }}</p>
                    }
                    <p class="text-[10px] opacity-70 mt-1 text-right">{{ m.enviadoEn | date: 'short' }}</p>
                  </div>
                </div>
              } @empty {
                <p class="text-gray-400 text-sm text-center">Todavía no hay mensajes.</p>
              }
            }
          </div>

          <form class="flex gap-2 p-3 border-t border-gray-200" (ngSubmit)="enviar()">
            <input #fileInput type="file" accept="image/*" class="hidden" (change)="onImagenElegida($event)" />
            <button
              type="button"
              class="bg-gray-500 hover:bg-gray-600 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded"
              [disabled]="chat.enviando() || subiendoImagen()"
              (click)="fileInput.click()"
              title="Adjuntar foto"
            >
              {{ subiendoImagen() ? '…' : '📷' }}
            </button>
            <input
              class="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              [(ngModel)]="texto"
              name="texto"
              placeholder="Escribí un mensaje…"
              [disabled]="chat.enviando()"
            />
            <button
              type="submit"
              class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded"
              [disabled]="chat.enviando() || !texto.trim()"
            >
              Enviar
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class ChatComponent implements OnInit, OnDestroy {
  readonly cadetes = inject(CadeteService);
  readonly chat = inject(ChatService);
  readonly lightbox = inject(LightboxService);
  private readonly cloudinary = inject(CloudinaryUploadService);
  private readonly toast = inject(ToastService);

  @ViewChild('scrollEl') private scrollEl?: ElementRef<HTMLDivElement>;

  readonly seleccionado = signal<Cadete | null>(null);
  readonly subiendoImagen = signal(false);
  texto = '';

  onImagenElegida(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.subiendoImagen.set(true);
    this.cloudinary.subir(file).subscribe({
      next: (url) => {
        this.subiendoImagen.set(false);
        this.chat.enviarImagen(url);
      },
      error: (err) => {
        this.subiendoImagen.set(false);
        this.toast.error(err?.message ?? 'No se pudo subir la foto.');
      },
    });
  }

  ngOnInit(): void {
    this.cadetes.ensureLoaded();
  }

  ngOnDestroy(): void {
    this.chat.cerrar();
  }

  elegir(c: Cadete): void {
    this.seleccionado.set(c);
    this.chat.abrir(c.id);
    setTimeout(() => this.scrollAbajo(), 100);
  }

  enviar(): void {
    if (!this.texto.trim()) return;
    this.chat.enviar(this.texto);
    this.texto = '';
    setTimeout(() => this.scrollAbajo(), 100);
  }

  private scrollAbajo(): void {
    const el = this.scrollEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
