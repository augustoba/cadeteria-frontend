import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Índice de "Ayuda": elegí la guía del panel o la de la app del cadete. Ruta pública. */
@Component({
  selector: 'app-ayuda-index',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-white flex items-center justify-center px-5 py-12">
      <div class="max-w-xl w-full">
        <div class="flex items-center gap-2 mb-6">
          <span class="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-base">C</span>
          <span class="font-bold text-lg text-gray-800">Cadetería — Ayuda</span>
        </div>
        <h1 class="text-2xl font-extrabold text-gray-900 mb-2">¿Qué guía necesitás?</h1>
        <p class="text-sm text-gray-500 mb-8 leading-relaxed">
          Manuales paso a paso, pensados para que los use quien no vio el sistema nunca.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            routerLink="/ayuda/panel"
            class="block border border-gray-200 rounded-xl p-5 hover:border-brand-400 hover:shadow-sm transition"
          >
            <div class="text-2xl mb-2">🖥️</div>
            <div class="font-bold text-gray-900 mb-1">Guía del panel</div>
            <p class="text-sm text-gray-500 leading-relaxed">
              Para quien maneja el día a día: cargar pedidos, asignar cadetes, cobrar y configurar el sistema.
            </p>
          </a>
          <a
            routerLink="/ayuda/app"
            class="block border border-gray-200 rounded-xl p-5 hover:border-brand-400 hover:shadow-sm transition"
          >
            <div class="text-2xl mb-2">📱</div>
            <div class="font-bold text-gray-900 mb-1">Guía de la app</div>
            <p class="text-sm text-gray-500 leading-relaxed">
              Para el cadete: instalar la app, recibir viajes, entregarlos y cobrar. Ideal para mandar por WhatsApp.
            </p>
          </a>
        </div>
      </div>
    </div>
  `,
})
export class AyudaIndexComponent {}
