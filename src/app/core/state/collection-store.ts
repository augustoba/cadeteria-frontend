import { computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../config/site-config';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Contenedor generico para un listado que viene del backend, con estado de
 * carga/error y de "guardando". Cada service compone uno y expone
 * `items` / `status` / `saving` / `reload`, sin repetir la logica.
 */
export class CollectionStore<T> {
  private readonly itemsSignal = signal<T[]>([]);
  private readonly statusSignal = signal<LoadStatus>('idle');
  private readonly savingSignal = signal(false);

  readonly items = this.itemsSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly loading = computed(() => this.statusSignal() === 'loading');
  readonly errored = computed(() => this.statusSignal() === 'error');
  readonly ready = computed(() => this.statusSignal() === 'loaded');

  private queryParams: Record<string, string | number> = {};

  constructor(private readonly http: HttpClient, private readonly path: string) {}

  ensureLoaded(): void {
    if (this.statusSignal() === 'idle' || this.statusSignal() === 'error') this.load();
  }

  load(): void {
    this.statusSignal.set('loading');
    this.http.get<T[]>(apiUrl(this.path), { params: this.queryParams }).subscribe({
      next: (items) => {
        this.itemsSignal.set(items);
        this.statusSignal.set('loaded');
      },
      error: () => this.statusSignal.set('error'),
    });
  }

  setQuery(params: Record<string, string | number | null | undefined>): void {
    this.queryParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== '') this.queryParams[k] = String(v);
    }
    this.load();
  }

  reload = (): void => this.load();

  mutate(obs: Observable<unknown>, onSuccess?: () => void): void {
    this.savingSignal.set(true);
    obs.subscribe({
      next: () => {
        this.savingSignal.set(false);
        this.load();
        onSuccess?.();
      },
      error: () => this.savingSignal.set(false),
    });
  }

  setItems(items: T[]): void {
    this.itemsSignal.set(items);
    this.statusSignal.set('loaded');
  }
}
