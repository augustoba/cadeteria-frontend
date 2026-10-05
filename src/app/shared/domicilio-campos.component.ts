import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Domicilio } from '../core/models/cadete.model';

/**
 * Campos del domicilio del cadete (2026-10-05): calle, altura y localidad obligatorios; piso y
 * departamento solo si corresponde. Es solo texto: no se ubica en el mapa. Se usa en el alta y la
 * edición del panel y en el formulario público de solicitud; escribe sobre el mismo objeto que
 * recibe.
 */
@Component({
  selector: 'app-domicilio-campos',
  standalone: true,
  imports: [FormsModule],
  template: `
    <fieldset class="flex flex-col gap-2 border-t border-gray-200 pt-4">
      <legend class="text-sm font-semibold text-gray-700">Domicilio (dónde vive)</legend>
      <div class="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <label class="flex flex-col gap-1 col-span-2 sm:col-span-3">
          <span class="text-sm font-medium text-gray-700">Calle</span>
          <input class="input" [(ngModel)]="domicilio.calle" [ngModelOptions]="{ standalone: true }" maxlength="120" placeholder="Ej: Lamadrid" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Altura</span>
          <input class="input" [(ngModel)]="domicilio.altura" [ngModelOptions]="{ standalone: true }" maxlength="15" placeholder="Ej: 450" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Piso</span>
          <input class="input" [(ngModel)]="domicilio.piso" [ngModelOptions]="{ standalone: true }" maxlength="15" placeholder="Si tiene" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Depto</span>
          <input class="input" [(ngModel)]="domicilio.depto" [ngModelOptions]="{ standalone: true }" maxlength="15" placeholder="Si tiene" />
        </label>
        <label class="flex flex-col gap-1 col-span-2 sm:col-span-3">
          <span class="text-sm font-medium text-gray-700">Localidad</span>
          <input class="input" [(ngModel)]="domicilio.localidad" [ngModelOptions]="{ standalone: true }" maxlength="80" placeholder="Ej: San Miguel de Tucumán" />
        </label>
      </div>
      @if (aviso) {
        <span class="text-xs text-gray-500">{{ aviso }}</span>
      }
    </fieldset>
  `,
})
export class DomicilioCamposComponent {
  @Input({ required: true }) domicilio!: Domicilio;
  /** Renglón de ayuda debajo de los campos (opcional). */
  @Input() aviso = '';
}
