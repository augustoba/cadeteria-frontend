import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FechaPartes } from '../core/models/cadete.model';

/**
 * Fecha de nacimiento del cadete (2026-10-05) en tres campos — día, mes y año — en vez del
 * calendario del navegador, que la muestra según el idioma del navegador (en uno en inglés sale
 * mes/día/año). Escribe sobre el mismo objeto que recibe; el formulario la arma con `fechaIso`.
 */
@Component({
  selector: 'app-fecha-nacimiento-campos',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex flex-col gap-1">
      <span class="text-sm font-medium text-gray-700">Fecha de nacimiento</span>
      <div class="flex items-center gap-2">
        <input
          class="input w-16"
          [(ngModel)]="fecha.dia"
          [ngModelOptions]="{ standalone: true }"
          inputmode="numeric"
          maxlength="2"
          placeholder="Día"
          aria-label="Día de nacimiento"
        />
        <select class="input w-36" [(ngModel)]="fecha.mes" [ngModelOptions]="{ standalone: true }" aria-label="Mes de nacimiento">
          <option value="">Mes</option>
          @for (m of meses; track m; let i = $index) {
            <option [value]="i + 1">{{ m }}</option>
          }
        </select>
        <input
          class="input w-20"
          [(ngModel)]="fecha.anio"
          [ngModelOptions]="{ standalone: true }"
          inputmode="numeric"
          maxlength="4"
          placeholder="Año"
          aria-label="Año de nacimiento"
        />
      </div>
      @if (aviso) {
        <span class="text-xs text-gray-500">{{ aviso }}</span>
      }
    </div>
  `,
})
export class FechaNacimientoCamposComponent {
  @Input({ required: true }) fecha!: FechaPartes;
  /** Renglón de ayuda debajo de los campos (opcional). */
  @Input() aviso = '';

  readonly meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
}
