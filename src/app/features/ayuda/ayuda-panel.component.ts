import { Component } from '@angular/core';
import { AyudaSeccion, AyudaShellComponent } from './ayuda-shell.component';

const SECCIONES: AyudaSeccion[] = [
  { id: 'ingresar', label: '1. Ingresar al panel' },
  { id: 'dashboard', label: '2. El Dashboard' },
  { id: 'nuevo-pedido', label: '3. Cargar un pedido' },
  { id: 'asignar', label: '4. Asignar un cadete' },
  { id: 'acciones', label: '5. Menú de acciones (⋯)' },
  { id: 'cadetes', label: '6. Cadetes' },
  { id: 'zonas', label: '7. Zonas' },
  { id: 'clientes', label: '8. Clientes' },
  { id: 'pagos', label: '9. Pagos' },
  { id: 'chat', label: '10. Chat con cadetes' },
  { id: 'incidencias', label: '11. Incidencias' },
  { id: 'metricas', label: '12. Métricas' },
  { id: 'configuracion', label: '13. Configuración' },
  { id: 'whatsapp', label: '14. WhatsApp (gateway)' },
  { id: 'usuarios', label: '15. Usuarios y roles' },
];

/** Guía del panel — manual de uso para quien maneja el día a día (pendiente #? del 2026-09-21). */
@Component({
  selector: 'app-ayuda-panel',
  imports: [AyudaShellComponent],
  template: `
    <app-ayuda-shell
      subtitulo="Guía del panel"
      eyebrow="Manual del panel"
      titulo="Cómo usar el panel de la cadetería"
      descripcion="Guía paso a paso de todo lo que se hace desde acá: cargar y asignar pedidos, dar de alta cadetes, cobrarles, configurar el sistema y más. Pensada para dársela a quien vaya a manejar el día a día — no hace falta saber nada técnico para seguirla."
      [secciones]="secciones"
      crosslinkPath="/ayuda/app"
      crosslinkLabel="Guía de la app del cadete"
      footer="Guía del panel — Cadetería. Cualquier duda que no esté acá, consultá con quien te entregó el sistema."
    >
      <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] mb-8 bg-emerald-50 text-emerald-700">
        <span>🚀</span>
        <span>
          <strong class="text-emerald-800">El panel también se explica solo.</strong> La primera vez que entrás a cada
          pantalla te va a aparecer una guía marcando qué es cada cosa (podés cerrarla con "Entendido" o la ✕). Arriba a
          la derecha, el botón <strong class="text-emerald-800">"❓"</strong> la repite cuando quieras, y la píldora
          "🚀 Configuración X%" te lleva a "Primeros pasos", un checklist de lo esencial para arrancar.
        </span>
      </div>

      <section id="ingresar" class="py-7 border-t border-gray-200 first:border-t-0 first:pt-0 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">1</span>
          <h2 class="text-lg font-extrabold text-gray-900">Ingresar al panel</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">
          El panel se abre desde cualquier navegador, en la computadora o el celular. Es la dirección que te pasamos al
          entregar el sistema.
        </p>
        <div class="flex flex-col gap-3.5 max-w-[62ch] mb-5">
          <div class="flex gap-3.5">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">1</span>
            <p class="text-sm leading-relaxed text-gray-700">Entrá a la dirección del panel y vas a ver la pantalla de login.</p>
          </div>
          <div class="flex gap-3.5">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">2</span>
            <p class="text-sm leading-relaxed text-gray-700">Cargá tu <strong class="text-gray-900">usuario</strong> y <strong class="text-gray-900">contraseña</strong> y tocá "Ingresar".</p>
          </div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-amber-50 text-amber-700">
          <span>⚠️</span>
          <span><strong class="text-amber-800">Guardá bien la contraseña.</strong> Si la perdés, alguien con acceso al servidor tiene que restablecerla — no hay un botón de "olvidé mi contraseña" para el panel.</span>
        </div>
      </section>

      <section id="dashboard" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">2</span>
          <h2 class="text-lg font-extrabold text-gray-900">El Dashboard</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">
          Es la pantalla principal: todos los pedidos activos, en tiempo real. Se actualiza sola apenas pasa algo (llega
          un pedido, un cadete lo acepta, lo entrega, etc.), no hace falta recargar la página.
        </p>
        <div class="flex flex-col gap-3.5 max-w-[62ch]">
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">1</span><p class="text-sm leading-relaxed text-gray-700"><strong class="text-gray-900">Tres pestañas arriba de la tabla:</strong> "Pedidos" (los de hoy, en curso), "Pedidos programados" (para más adelante) y "Pedidos finalizados" (el historial).</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">2</span><p class="text-sm leading-relaxed text-gray-700"><strong class="text-gray-900">Botón "Lista / Kanban"</strong> arriba a la derecha: cambia entre esta tabla y una vista de columnas por estado (Sin asignar / En curso / Entregado / Cancelado).</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">3</span><p class="text-sm leading-relaxed text-gray-700"><strong class="text-gray-900">El buscador</strong> de arriba filtra por número de pedido, nombre de cliente o teléfono, al toque.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">4</span><p class="text-sm leading-relaxed text-gray-700"><strong class="text-gray-900">La ⭐ de cada fila</strong> marca un pedido como prioritario — le pone un fondo amarillo tenue para que salte a la vista en el medio de la lista.</p></div>
        </div>
      </section>

      <section id="nuevo-pedido" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">3</span>
          <h2 class="text-lg font-extrabold text-gray-900">Cargar un pedido nuevo</h2>
        </div>
        <div class="flex flex-col gap-3.5 max-w-[62ch] mt-5 mb-5">
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">1</span><p class="text-sm leading-relaxed text-gray-700">Tocá <strong class="text-gray-900">"+ Nuevo pedido"</strong> arriba a la derecha del Dashboard.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">2</span><p class="text-sm leading-relaxed text-gray-700">Cargá teléfono y nombre del cliente — si ese teléfono ya pidió antes, el nombre se autocompleta solo.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">3</span><p class="text-sm leading-relaxed text-gray-700">Cargá <strong class="text-gray-900">origen y destino</strong> (con autocompletado de direcciones reales) y el resto de los datos: qué se lleva, si declara dinero/valores, y el precio.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">4</span><p class="text-sm leading-relaxed text-gray-700">El precio se <strong class="text-gray-900">sugiere solo</strong> apenas cargás el origen — según la Zona o la distancia real — pero siempre lo podés cambiar a mano antes de guardar.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">5</span><p class="text-sm leading-relaxed text-gray-700">Guardá. El pedido aparece al toque en el Dashboard, en "Sin asignar".</p></div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-emerald-50 text-emerald-700">
          <span>💡</span>
          <span><strong class="text-emerald-800">"Agregar otro pedido (mismo origen)"</strong>: si un mismo cliente hace varios envíos desde el mismo lugar, guarda el origen cargado y solo te pide el destino nuevo cada vez.</span>
        </div>
      </section>

      <section id="asignar" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">4</span>
          <h2 class="text-lg font-extrabold text-gray-900">Asignar un cadete</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">Dos formas de hacerlo, según cómo te resulte más cómodo:</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[62ch] my-4">
          <div class="border border-gray-200 rounded-lg p-3.5 bg-white">
            <h3 class="text-sm font-extrabold mb-1.5 text-gray-900">Desde el pedido</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Botón <strong>"Asignar"</strong> en la fila del pedido — te muestra los cadetes libres, ordenados por distancia, y elegís uno.</p>
          </div>
          <div class="border border-gray-200 rounded-lg p-3.5 bg-white">
            <h3 class="text-sm font-extrabold mb-1.5 text-gray-900">Desde "Cadetes libres"</h3>
            <p class="text-xs text-gray-500 leading-relaxed">En la lista de Cadetes, botón <strong>"Asignar viaje"</strong> junto a un cadete libre — te deja elegir uno o varios pedidos sin asignar de la misma zona para dárselos todos juntos.</p>
          </div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-emerald-50 text-emerald-700">
          <span>💡</span>
          <span>El cadete tiene un tiempo límite para aceptar (configurable, default 2 min). Si no responde a tiempo, el sistema se lo vuelve a ofrecer a otro solo — no hace falta que lo reasignes a mano.</span>
        </div>
      </section>

      <section id="acciones" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">5</span>
          <h2 class="text-lg font-extrabold text-gray-900">El menú de acciones (⋯)</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">
          Cada pedido tiene un botón principal (el más común según su estado: Asignar, Finalizar, etc.) y un botón
          <strong class="text-gray-900">"⋯"</strong> con el resto de las opciones.
        </p>
        <div class="flex flex-col gap-2 max-w-[62ch] my-4">
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-gray-100 text-gray-600">Detalle</span><span class="text-gray-700">Abre toda la info del pedido: timeline completo, fotos, firma, comentarios del cadete.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-gray-100 text-gray-600">Imprimir</span><span class="text-gray-700">Comprobante en PDF listo para imprimir o mandar.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-indigo-50 text-indigo-600">Reasignar</span><span class="text-gray-700">Cambia el cadete asignado con un clic, sin tener que "Quitar" primero.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-amber-50 text-amber-700">Quitar cadete</span><span class="text-gray-700">Lo desasigna sin anular el pedido — vuelve a "Sin asignar" para dárselo a otro. Si el cadete cobra por porcentaje, te pregunta si le devolvés la comisión ya descontada.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-gray-100 text-gray-600">Crear incidencia</span><span class="text-gray-700">Abre un ticket ligado a este pedido puntual (ver sección Incidencias).</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-red-50 text-red-700">Anular pedido</span><span class="text-gray-700">Cancela el pedido del todo. Pide el motivo (cliente canceló / otro) para las estadísticas.</span></div>
        </div>
      </section>

      <section id="cadetes" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">6</span>
          <h2 class="text-lg font-extrabold text-gray-900">Cadetes</h2>
        </div>
        <div class="flex flex-col gap-3.5 max-w-[62ch] mt-5">
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">1</span><p class="text-sm leading-relaxed text-gray-700"><strong class="text-gray-900">Alta manual</strong>: botón "+ Nuevo cadete" y cargás sus datos, o generás un <strong class="text-gray-900">link de alta</strong> para que él mismo cargue sus datos y fotos desde el celular sin necesitar cuenta — vos después lo aprobás.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">2</span><p class="text-sm leading-relaxed text-gray-700"><strong class="text-gray-900">La ficha de cada cadete</strong> tiene su historial completo: viajes, calificación, incidencias, y el botón "📊 Ficha" con estadísticas (tasa de aceptación de ofertas, $ por hora, etc.).</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">3</span><p class="text-sm leading-relaxed text-gray-700"><strong class="text-gray-900">Tope de viajes</strong>: podés limitar cuántos viajes simultáneos, o por día/semana, puede llevar cada cadete.</p></div>
        </div>
      </section>

      <section id="zonas" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">7</span>
          <h2 class="text-lg font-extrabold text-gray-900">Zonas</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          Dibujás áreas geográficas sobre el mapa (círculo o polígono libre, arrastrando los vértices) para dos cosas:
          sugerir un precio fijo a los pedidos que salen de ahí, y decidir a qué cadetes ofrecerles un pedido primero
          (los que están en esa zona o una vecina).
        </p>
      </section>

      <section id="clientes" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">8</span>
          <h2 class="text-lg font-extrabold text-gray-900">Clientes</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          Se arma solo con los teléfonos que ya pidieron alguna vez. Podés editar cada ficha para ponerle nombre de
          contacto, empresa, una <strong class="text-gray-900">tarifa especial</strong> que autocompleta el precio al
          cargarle un pedido nuevo, y marcarlo como "cliente problemático" con una nota si hace falta.
        </p>
      </section>

      <section id="pagos" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">9</span>
          <h2 class="text-lg font-extrabold text-gray-900">Pagos</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">Cada cadete cobra de una de dos formas, elegida en su ficha:</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[62ch] my-4">
          <div class="border border-gray-200 rounded-lg p-3.5 bg-white">
            <h3 class="text-sm font-extrabold mb-1.5 text-gray-900">💵 Semanal</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Paga una cuota fija por semana. Los lunes a la madrugada queda deshabilitado solo hasta que vos lo habilitás a mano acá, cargando el pago (total o parcial, con fecha límite para completar el resto).</p>
          </div>
          <div class="border border-gray-200 rounded-lg p-3.5 bg-white">
            <h3 class="text-sm font-extrabold mb-1.5 text-gray-900">% Porcentaje</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Carga crédito por adelantado (vos se lo acreditás al recibir la transferencia) y se le descuenta un % configurable de cada viaje al aceptarlo. Si el viaje no se concreta después, la comisión se le devuelve sola.</p>
          </div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-emerald-50 text-emerald-700">
          <span>💡</span>
          <span>"Monto cobrado por semana" (arriba de todo) es un resumen de cuánto entregó cada cadete en efectivo — para hacer el arqueo de caja de la semana.</span>
        </div>
      </section>

      <section id="chat" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">10</span>
          <h2 class="text-lg font-extrabold text-gray-900">Chat con cadetes</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          Un chat interno por cadete (no es WhatsApp): texto y notas de voz, para coordinar algo puntual de un viaje.
          Un badge rojo en el menú avisa cuántos mensajes sin leer hay.
        </p>
      </section>

      <section id="incidencias" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">11</span>
          <h2 class="text-lg font-extrabold text-gray-900">Incidencias</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          Tickets para lo que no es un pedido puntual (un problema con un cadete, un reclamo general) o ligados a un
          pedido específico desde su detalle. Se abren y se cierran, con filtro por estado.
        </p>
      </section>

      <section id="metricas" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">12</span>
          <h2 class="text-lg font-extrabold text-gray-900">Métricas</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          Gráficos de pedidos por hora y por zona, ranking de cadetes, comparación contra el período anterior, y la
          <strong class="text-gray-900">Ficha individual</strong> de cada cadete con su historial completo. La meta
          mensual de facturación (si la cargaste en Configuración) aparece acá como barra de progreso.
        </p>
      </section>

      <section id="configuracion" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">13</span>
          <h2 class="text-lg font-extrabold text-gray-900">Configuración</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">
          Todos los parámetros del sistema, ordenados en pestañas por tema — cada campo tiene una ayuda cortita debajo
          explicando qué hace.
        </p>
        <div class="flex flex-col gap-2 max-w-[62ch] my-4">
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-indigo-50 text-indigo-600">Pedidos</span><span class="text-gray-700">Tiempo para aceptar una oferta, reglas de reasignación automática, avisos de demora, tarifas y metas.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-indigo-50 text-indigo-600">Cadetes</span><span class="text-gray-700">Versión mínima de la app, checklist de documentación, cuota semanal / comisión, seguridad de login.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-indigo-50 text-indigo-600">Integraciones</span><span class="text-gray-700">Las cuentas gratis de mapas/direcciones, Cloudinary (fotos) y las plantillas de SMS.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-indigo-50 text-indigo-600">Marca</span><span class="text-gray-700">Nombre de la cadetería, teléfono de soporte, horario de atención y pausa de emergencia de "/pedir".</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-indigo-50 text-indigo-600">Sistema</span><span class="text-gray-700">Semáforo de salud (SMS, push, email, WhatsApp), accesos al panel, retención de datos y el botón de emergencia para cerrar todas las sesiones.</span></div>
        </div>
        <div class="rounded-lg px-3.5 py-3 text-sm leading-relaxed flex gap-2.5 max-w-[62ch] my-4 bg-emerald-50 text-emerald-700">
          <span>💡</span>
          <span>Hay una pestaña más al final, <strong class="text-emerald-800">"Gateway WhatsApp ↗"</strong>, que te lleva directo a esa pantalla (sección 14) — es una pantalla aparte, no un tab de esta misma página.</span>
        </div>
      </section>

      <section id="whatsapp" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">14</span>
          <h2 class="text-lg font-extrabold text-gray-900">WhatsApp (gateway)</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch] mb-5">
          Es el sistema propio que manda los WhatsApp automáticos (aviso de pedido en camino, etc.) usando chips
          descartables en vez de la API paga de Meta.
        </p>
        <div class="flex flex-col gap-3.5 max-w-[62ch] mb-5">
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">1</span><p class="text-sm leading-relaxed text-gray-700">Tocá <strong class="text-gray-900">"+ Cargar chip nuevo"</strong>, poné un nombre cualquiera y el número del WhatsApp (con código de país, sin "+") — tiene que ser un WhatsApp recién instalado, no el que ya usás vos.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">2</span><p class="text-sm leading-relaxed text-gray-700">Tocá "Pedir código". En el celular con ese chip: WhatsApp → los tres puntitos (⋮) → Dispositivos vinculados → Vincular con número de teléfono.</p></div>
          <div class="flex gap-3.5"><span class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">3</span><p class="text-sm leading-relaxed text-gray-700">Cargá en ese celular el código de 8 dígitos que aparece en el panel al lado del chip.</p></div>
        </div>
        <div class="flex flex-col gap-2 max-w-[62ch] my-4">
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-emerald-50 text-emerald-700">Conectado</span><span class="text-gray-700">Anda bien, mandando mensajes normalmente.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-gray-100 text-gray-600">Desconectado</span><span class="text-gray-700">Se cortó la conexión (sin internet, WhatsApp cerrado). Normalmente vuelve solo.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-red-50 text-red-700">Baneado</span><span class="text-gray-700">WhatsApp bloqueó ese número — dalo de baja y cargá uno nuevo con otro chip.</span></div>
          <div class="flex items-start gap-2.5 text-sm leading-relaxed"><span class="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 bg-amber-50 text-amber-700">Posible shadowban</span><span class="text-gray-700">Sigue diciendo "Conectado" pero casi no entrega mensajes — conviene darlo de baja antes de que termine baneado.</span></div>
        </div>
      </section>

      <section id="usuarios" class="py-7 border-t border-gray-200 scroll-mt-6">
        <div class="flex items-baseline gap-3 mb-1.5">
          <span class="text-xs font-bold text-brand-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">15</span>
          <h2 class="text-lg font-extrabold text-gray-900">Usuarios y roles</h2>
        </div>
        <p class="text-gray-500 text-sm leading-relaxed max-w-[62ch]">
          Si además de vos hay alguien más atendiendo el teléfono, podés darle una cuenta de tipo
          <strong class="text-gray-900">Operador</strong> — hace el día a día (pedidos, cadetes, chat, zonas, clientes,
          incidencias) pero no puede tocar Configuración, Métricas ni Pagos. El rol
          <strong class="text-gray-900">Dueño</strong> (el tuyo) tiene acceso a todo.
        </p>
      </section>
    </app-ayuda-shell>
  `,
})
export class AyudaPanelComponent {
  readonly secciones = SECCIONES;
}
