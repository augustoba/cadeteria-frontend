import { Component } from '@angular/core';
import { AyudaSeccion, AyudaShellComponent } from './ayuda-shell.component';

const SECCIONES: AyudaSeccion[] = [
  { id: 'instalar', label: '1. Instalar la app' },
  { id: 'login', label: '2. Iniciar sesión' },
  { id: 'inicio', label: '3. Pantalla de Inicio' },
  { id: 'oferta', label: '4. Te llega un viaje' },
  { id: 'viaje', label: '5. Hacer el viaje' },
  { id: 'no-entrega', label: '6. Si no podés entregar' },
  { id: 'chat', label: '7. Chat con el admin' },
  { id: 'perfil', label: '8. Mi perfil y cómo cobro' },
  { id: 'avisos', label: '9. Avisos y Ayuda' },
  { id: 'reglas', label: '10. Reglas del juego' },
];

/** Guía de la app — manual para el cadete, pensado para mandarlo por WhatsApp sin login. */
@Component({
  selector: 'app-ayuda-app',
  imports: [AyudaShellComponent],
  template: `
    <app-ayuda-shell
      subtitulo="Guía de la app"
      eyebrow="Manual del cadete"
      titulo="Cómo usar la app"
      descripcion="Todo lo que necesitás saber para trabajar con la app desde el primer día: cómo activarte, recibir un viaje, entregarlo y hablar con el admin. Pasásela a cada cadete nuevo apenas le instalás la app."
      [secciones]="secciones"
      crosslinkPath="/ayuda/panel"
      crosslinkLabel="Guía del panel (admin)"
      footer="Guía de la app — Cadetería. Cualquier duda que no esté acá, hablalo con el admin desde el chat de la app."
    >
      <section id="instalar" class="py-7 border-t border-gray-200 first:border-t-0 first:pt-0 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">1</span>
          <h2 class="text-lg font-extrabold text-gray-900">Instalar la app</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          La app no está en Play Store — se instala pasándola directo por Bluetooth desde el celular de otro cadete o
          del admin (así vino tu instalación). Si tu celular es Android, primero puede pedirte permiso para "instalar
          de fuentes desconocidas": aceptalo, es normal para este tipo de instalación.
        </p>
      </section>

      <section id="login" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">2</span>
          <h2 class="text-lg font-extrabold text-gray-900">Iniciar sesión</h2>
        </div>
        <div class="flex flex-col gap-3.5 max-w-[62ch] mt-5 mb-5">
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">1</span><p class="text-sm leading-relaxed text-gray-700">Tu <strong class="text-gray-900">usuario es tu DNI</strong> (solo números). La contraseña te la da el admin.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">2</span><p class="text-sm leading-relaxed text-gray-700">La primera vez, la app te muestra un pequeño tutorial de bienvenida de 4 pasos.</p></div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-amber-50 text-amber-700">
          <span>⚠️</span>
          <span>Solo podés estar logueado en <strong class="text-amber-800">un celular a la vez</strong>. Si entrás desde otro, el anterior se desconecta solo.</span>
        </div>
      </section>

      <section id="inicio" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">3</span>
          <h2 class="text-lg font-extrabold text-gray-900">Pantalla de Inicio</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">
          Tu estado se controla tocando un botón grande, y define si te pueden asignar viajes:
        </p>
        <div class="flex flex-col gap-2 max-w-[62ch] my-4">
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-emerald-50 text-emerald-700">Libre</span><span class="text-gray-700">Podés recibir viajes nuevos. El ícono de estado pulsa suavemente para que se note de un vistazo.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-amber-50 text-amber-700">Ocupado</span><span class="text-gray-700">Seguís con viajes en curso, pero no querés que te asignen más por ahora.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-gray-100 text-gray-600">Desconectado</span><span class="text-gray-700">No recibís nada. No podés desconectarte si tenés un viaje pendiente sin terminar.</span></div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-emerald-50 text-emerald-700">
          <span>💡</span>
          <span>Sin abrir la app: hay un <strong class="text-emerald-800">widget en la pantalla de inicio del Android</strong> para activarte/desconectarte con un toque.</span>
        </div>
      </section>

      <section id="oferta" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">4</span>
          <h2 class="text-lg font-extrabold text-gray-900">Te llega un viaje</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">
          Cuando te ofrecen un pedido, la pantalla muestra un <strong class="text-gray-900">anillo con la cuenta
          regresiva</strong> — tenés un tiempo limitado para aceptar o rechazar. A los últimos segundos, el celular
          <strong class="text-gray-900">vibra y suena</strong> (con el volumen de alarma, para que se escuche igual
          arriba de la moto) para que no se te pase.
        </p>
        <div class="flex flex-col gap-3.5 max-w-[62ch] mb-5">
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">1</span><p class="text-sm leading-relaxed text-gray-700">Mirá <strong class="text-gray-900">distancia, zona y pago</strong> antes de decidir.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">2</span><p class="text-sm leading-relaxed text-gray-700">Tocá <strong class="text-gray-900">Aceptar</strong> o <strong class="text-gray-900">Rechazar</strong>.</p></div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-amber-50 text-amber-700">
          <span>⚠️</span>
          <span><strong class="text-amber-800">Si no respondés a tiempo</strong>, es lo mismo que rechazarlo: se le ofrece a otro cadete. Rechazar (activo o por no responder) tiene un límite de veces para el mismo pedido puntual — pasado ese límite, no te lo vuelven a ofrecer a vos para ese pedido en particular.</span>
        </div>
      </section>

      <section id="viaje" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">5</span>
          <h2 class="text-lg font-extrabold text-gray-900">Hacer el viaje</h2>
        </div>
        <div class="flex flex-col gap-3.5 max-w-[62ch] mt-5 mb-5">
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">1</span><p class="text-sm leading-relaxed text-gray-700">Mirá el mapa: <strong class="text-gray-900">origen</strong> (dónde retirás), <strong class="text-gray-900">destino</strong> (dónde entregás) y tu propia posición, cada uno con un color distinto.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">2</span><p class="text-sm leading-relaxed text-gray-700">Botones de <strong class="text-gray-900">Llamar, Maps y Waze</strong> para contactar al cliente o navegar directo con la app que ya usás.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">3</span><p class="text-sm leading-relaxed text-gray-700">Tocá <strong class="text-gray-900">"Retirado"</strong> cuando pasás por lo del cliente/comercio a buscar el pedido.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">4</span><p class="text-sm leading-relaxed text-gray-700">Al entregar, tocá <strong class="text-gray-900">"Finalizar"</strong>: pedís nombre de quien recibe, una foto, y a veces firma digital (si está activada).</p></div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-emerald-50 text-emerald-700">
          <span>💡</span>
          <span>Si se corta internet justo al finalizar, la app <strong class="text-emerald-800">lo encola solo</strong> y reintenta apenas vuelve la conexión — no se pierde el viaje.</span>
        </div>
      </section>

      <section id="no-entrega" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">6</span>
          <h2 class="text-lg font-extrabold text-gray-900">Si no podés entregar</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          Si el cliente no atiende o no podés completar la entrega, tocá <strong class="text-gray-900">"No se pudo
          entregar"</strong> en vez de forzar un "Finalizar". El pedido no se anula: queda visible para que el admin
          decida si te lo vuelve a asignar o lo reasigna a otro cadete.
        </p>
      </section>

      <section id="chat" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">7</span>
          <h2 class="text-lg font-extrabold text-gray-900">Chat con el admin</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          Un chat interno de texto <strong class="text-gray-900">y notas de voz</strong> para coordinar algo puntual —
          no es WhatsApp, es de la app. Mantené apretado el ícono del micrófono para grabar una nota de voz y soltalo
          para enviarla.
        </p>
      </section>

      <section id="perfil" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">8</span>
          <h2 class="text-lg font-extrabold text-gray-900">Mi perfil y cómo cobro</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">Tu ficha de Perfil te muestra exactamente cómo estás parado con la plata, según tu modalidad:</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[62ch] my-4">
          <div class="border border-gray-200 rounded-lg p-3.5 bg-white">
            <h3 class="text-sm font-extrabold mb-1.5 text-gray-900">💵 Semanal</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Te dice si podés recibir viajes esta semana, cuánto es la cuota, cuánto pagaste y cuánto te falta — con la fecha y hora límite si te habilitaron con un pago parcial.</p>
          </div>
          <div class="border border-gray-200 rounded-lg p-3.5 bg-white">
            <h3 class="text-sm font-extrabold mb-1.5 text-gray-900">% Porcentaje</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Te muestra tu saldo disponible y el % que te descuenta cada viaje al aceptarlo. Si el saldo llega a $0, no podés recibir más viajes hasta que te carguen crédito.</p>
          </div>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">También ves ahí tu calificación, horas conectado, y viajes/plata de la semana.</p>
      </section>

      <section id="avisos" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">9</span>
          <h2 class="text-lg font-extrabold text-gray-900">Avisos y Ayuda</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          "Avisos" guarda el historial de anuncios generales de la cadetería (antes uno leído desaparecía para
          siempre). "Ayuda" te da un botón para llamar directo a soporte, si está cargado.
        </p>
      </section>

      <section id="reglas" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">10</span>
          <h2 class="text-lg font-extrabold text-gray-900">Reglas del juego</h2>
        </div>
        <div class="flex flex-col gap-2 max-w-[62ch] mt-5">
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-brand-50 text-brand-700">Versión</span><span class="text-gray-700">Si tu app queda vieja, no te deja entrar hasta que te pasen la actualizada por Bluetooth.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-brand-50 text-brand-700">Un dispositivo</span><span class="text-gray-700">Loguearte en un celular nuevo cierra la sesión del anterior automáticamente.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-brand-50 text-brand-700">Documentación</span><span class="text-gray-700">Si está activado el checklist, no podés pasar a "Libre" sin tener carnet, tarjeta verde y foto del vehículo cargados.</span></div>
        </div>
      </section>
    </app-ayuda-shell>
  `,
})
export class AyudaAppComponent {
  readonly secciones = SECCIONES;
}
