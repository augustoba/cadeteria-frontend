import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { SeguridadService } from '../../core/services/seguridad.service';
import { SaludService, Salud } from '../../core/services/salud.service';
import { AuthService } from '../../core/services/auth.service';
import { AccesoLog } from '../../core/models/acceso-log.model';

/** Pantalla de parametros globales editables (diseno-tecnico.md sección 3/7/8). */
@Component({
  selector: 'app-configuracion',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h1 class="font-semibold text-gray-700">Configuración</h1>
        <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="guardando()" (click)="guardar()">
          💾 Guardar cambios
        </button>
      </div>

      <div class="p-4 flex flex-col gap-6 max-w-2xl">
        @if (mensaje(); as m) {
          <div
            class="rounded text-sm px-3 py-2"
            [class]="huboError() ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'"
          >
            {{ m }}
          </div>
        }

        <section class="flex flex-col gap-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pedidos y ubicación</h2>
          <div class="grid sm:grid-cols-2 gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Tiempo límite para aceptar un pedido (segundos)</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="tiempoLimiteAceptacionSeg" name="tiempoLimite" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Frecuencia de envío de ubicación del cadete (segundos)</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="frecuenciaUbicacionSeg" name="frecuenciaUbicacion" />
            </label>
          </div>
          <label class="flex items-center gap-2">
            <input type="checkbox" [(ngModel)]="asignacionAutomatica" name="asignacionAutomatica" />
            <span class="text-sm text-gray-700">Asignación automática de pedidos</span>
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Prendida: cuando entra un pedido sin asignar, el sistema le ofrece solo al mejor candidato (misma
            lógica que el botón "Asignar" del dashboard) sin esperar a que lo confirmes. Apagada (default): asignar
            sigue siendo 100% manual.
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Reglas de asignación</h2>
          <div class="grid sm:grid-cols-2 gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Máx. viajes sin terminar por cadete (asignación automática/sugerida)</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="asignacionAutomaticaMaxViajesCadete" name="asignacionMaxViajes" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Rechazos antes de excluir al cadete de ESE pedido</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="maxRechazosPorPedido" name="maxRechazos" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Reintentar con cualquiera igual pasados (minutos)</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="minutosPedidoUrgenteReintentar" name="minutosUrgente" />
            </label>
          </div>
          <p class="text-xs text-gray-400 -mt-2">
            El primer campo limita cuántos viajes sin terminar le puede dar de una la asignación automática/sugerida a
            un mismo cadete, sin importar cuánto soporte él mismo (eso lo define "Máx. viajes simultáneos" en su
            ficha). Los otros dos son sobre reintentos: a un cadete que rechaza el mismo pedido puntual esa cantidad
            de veces se lo deja de ofertar — salvo que ese pedido ya lleve tantos minutos sin poder asignarse, en cuyo
            caso se lo vuelve a ofrecer a cualquiera para que no quede sin nadie para siempre. Una oferta vencida sin
            respuesta no cuenta como rechazo.
          </p>
          <label class="flex items-center gap-2">
            <input type="checkbox" [(ngModel)]="asignacionPriorizaRankingAceptacion" name="asignacionRanking" />
            <span class="text-sm text-gray-700">Priorizar por ranking de aceptación</span>
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Apagado (default): a igualdad de disponibilidad, se ofrece al que está libre hace más tiempo (FIFO).
            Prendido: entre cadetes igual de disponibles, se prioriza al que históricamente rechaza menos ofertas —
            útil en horas flojas, para no ofrecerle siempre primero al que suele rechazar casi todo solo porque
            quedó libre antes.
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Avisos de demora al cadete</h2>
          <div class="grid sm:grid-cols-2 gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Avisar si no retiró (minutos)</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="alertaDemoraRetiroMin" name="alertaDemoraRetiro" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Avisar si no finalizó (minutos)</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="alertaDemoraFinalizacionMin" name="alertaDemoraFinalizacion" />
            </label>
          </div>
          <p class="text-xs text-gray-400 -mt-2">
            Pasado este tiempo desde que aceptó el viaje, la app del cadete le manda un recordatorio (una sola vez
            por pedido).
          </p>
          <label class="flex flex-col gap-1 max-w-xs">
            <span class="text-sm font-medium text-gray-700">Alertarme si un cadete "en curso" no manda ubicación (minutos)</span>
            <input type="number" min="1" step="1" class="input" [(ngModel)]="alertaInactividadMin" name="alertaInactividad" />
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Posible batería muerta, zona sin señal, o que abandonó el pedido sin avisar. Aparece como alerta en el
            dashboard (una sola vez por pedido).
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">App de cadetes</h2>
          <label class="flex flex-col gap-1 max-w-xs">
            <span class="text-sm font-medium text-gray-700">Versión mínima requerida (código de versión)</span>
            <input type="number" min="1" step="1" class="input" [(ngModel)]="versionMinimaApp" name="versionMinimaApp" />
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Como la app se distribuye por Bluetooth (sin Play Store), un cadete puede quedar con una versión
            vieja sin darse cuenta. Si el código de versión de su APK es menor a este número, no lo deja
            iniciar sesión y le pide que le pidas el APK actualizado.
          </p>
          <label class="flex items-center gap-2">
            <input type="checkbox" [(ngModel)]="firmaReceptorObligatoria" name="firmaReceptorObligatoria" />
            <span class="text-sm text-gray-700">Exigir firma digital del receptor para poder finalizar</span>
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Apagado (default): la firma es opcional, además de la foto y el nombre que ya se piden siempre.
            Prendido: no deja finalizar sin ella.
          </p>
          <label class="flex items-center gap-2">
            <input type="checkbox" [(ngModel)]="checklistDocumentacionObligatorio" name="checklistDocumentacionObligatorio" />
            <span class="text-sm text-gray-700">Exigir carnet + tarjeta verde + foto del vehículo cargados para poder activarse</span>
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Apagado (default): un cadete se puede activar aunque le falte cargar documentación. Prendido: si le
            falta algo, la app le avisa qué le falta y no lo deja pasar de "Desconectado" a "Libre".
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Seguridad de inicio de sesión</h2>
          <div class="grid sm:grid-cols-2 gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Intentos fallidos antes de bloquear</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="maxIntentosLogin" name="maxIntentosLogin" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Minutos de bloqueo</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="bloqueoLoginMin" name="bloqueoLoginMin" />
            </label>
          </div>
          <p class="text-xs text-gray-400 -mt-2">
            Aplica tanto a admins como a cadetes. Al superar los intentos fallidos, la cuenta queda bloqueada por
            este tiempo antes de poder volver a intentar.
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Cobro a cadetes</h2>
          <div class="grid sm:grid-cols-3 gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Cuota semanal ($)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="pagoSemanalMonto" name="pagoSemanalMonto" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Comisión por viaje (%)</span>
              <input type="number" min="0" max="100" step="0.5" class="input" [(ngModel)]="comisionPorcentaje" name="comisionPorcentaje" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Avisar cadete si su crédito baja de ($)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="creditoBajoAlertaUmbral" name="creditoBajoAlertaUmbral" />
            </label>
          </div>
          <p class="text-xs text-gray-400 -mt-2">
            Cada cadete elige uno de los dos modelos en su ficha: <strong>Semanal</strong> (paga esta cuota fija,
            el admin lo habilita a mano cada semana) o <strong>Porcentaje</strong> (carga crédito y se le descuenta
            este % de cada viaje al aceptarlo).
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Marca</h2>
          <label class="flex flex-col gap-1 max-w-xs">
            <span class="text-sm font-medium text-gray-700">Nombre de la cadetería</span>
            <input class="input" [(ngModel)]="nombreCadeteria" name="nombreCadeteria" placeholder="Ej: Cadetería Rápida" />
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Se muestra en el header de la página pública de seguimiento (el link que le llega al cliente por SMS).
          </p>
          <label class="flex flex-col gap-1 max-w-xs">
            <span class="text-sm font-medium text-gray-700">Teléfono de soporte para cadetes</span>
            <input class="input" [(ngModel)]="telefonoSoporte" name="telefonoSoporte" placeholder="Ej: 3814000000" />
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Se muestra en la pantalla de Ayuda de la app del cadete, con un botón para llamar directo. Vacío = esa
            pantalla no muestra botón de llamar.
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Horario de atención</h2>
          <label class="flex items-center gap-2">
            <input type="checkbox" [(ngModel)]="horarioAtencionActivo" name="horarioAtencionActivo" />
            <span class="text-sm text-gray-700">Solo tomar pedidos de "/pedir" dentro de este horario</span>
          </label>
          @if (horarioAtencionActivo) {
            <div class="grid sm:grid-cols-2 gap-4 max-w-sm">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Desde</span>
                <input type="time" class="input" [(ngModel)]="horarioAtencionDesde" name="horarioAtencionDesde" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Hasta</span>
                <input type="time" class="input" [(ngModel)]="horarioAtencionHasta" name="horarioAtencionHasta" />
              </label>
            </div>
          }
          <p class="text-xs text-gray-400 -mt-2">
            Fuera de este horario, la página pública "/pedir" muestra un aviso en vez del formulario — el cliente
            no puede cargar el pedido. En el panel (Nuevo Pedido) nunca bloquea, solo avisa: vos siempre podés
            cargar a mano si corresponde.
          </p>

          <label class="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input type="checkbox" [(ngModel)]="pedidosPausados" name="pedidosPausados" />
            <span class="text-sm text-gray-700">Pausar "/pedir" ahora mismo (por ejemplo, falta de cadetes)</span>
          </label>
          @if (pedidosPausados) {
            <label class="flex flex-col gap-1 max-w-sm">
              <span class="text-sm font-medium text-gray-700">Mensaje para el cliente</span>
              <textarea class="input" rows="2" [(ngModel)]="pedidosPausadosMensaje" name="pedidosPausadosMensaje"></textarea>
            </label>
          }
          <p class="text-xs text-gray-400 -mt-2">
            Corta la toma de pedidos nuevos al toque, sin importar el horario configurado arriba — para cuando
            hay que frenar por falta de cadetes libres o cualquier otro motivo puntual. No afecta el seguimiento
            de pedidos ya cargados.
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tarifas — cotización automática</h2>
          <p class="text-xs text-gray-400">
            Cuando se carga un pedido nuevo (desde el panel o desde "/pedir"), el sistema sugiere un precio solo:
            si el origen cae dentro de una Zona con "precio sugerido" cargado, usa ese precio fijo; si no, calcula
            distancia real origen→destino y cobra la base más el valor del km. Siempre es editable, nunca obliga.
          </p>
          <label class="flex flex-col gap-1 max-w-xs">
            <span class="text-sm font-medium text-gray-700">Método de cotización</span>
            <select class="input" [(ngModel)]="metodoCotizacion" name="metodoCotizacion">
              <option value="AUTOMATICO">Automático (zona si tiene precio, si no por km)</option>
              <option value="ZONA">Siempre por zona</option>
              <option value="DISTANCIA">Siempre por km</option>
            </select>
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            "Siempre por zona" nunca calcula por distancia aunque haya "precio por km" cargado — si ninguna de las
            dos zonas (origen/destino) tiene precio, no hay sugerencia. "Siempre por km" ignora el precio de zona
            por completo.
          </p>
          <div class="grid sm:grid-cols-3 gap-4 max-w-lg">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Monto mínimo del viaje ($)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="precioBaseViaje" name="precioBaseViaje" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Ese mínimo cubre hasta (km)</span>
              <input type="number" min="0" step="0.1" class="input" [(ngModel)]="distanciaMinimaKm" name="distanciaMinimaKm" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Precio por km adicional ($)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="precioPorKm" name="precioPorKm" />
            </label>
          </div>
          <p class="text-xs text-gray-400 -mt-2">
            Cotización por distancia: hasta "Ese mínimo cubre hasta" km se cobra el monto mínimo fijo; a partir de
            ahí se suma "Precio por km adicional" solo por los km que superen ese umbral (ej. mínimo $2000 hasta 2
            km, con $150/km: un viaje de 5 km cobra $2000 + 3 km × $150 = $2450). Dejá "Precio por km adicional" en
            0 para desactivar la cotización por distancia (solo va a sugerir precio cuando el origen caiga dentro de
            una Zona con precio cargado). El precio sugerido por Zona siempre tiene prioridad sobre el cálculo por
            distancia — configurá el precio de cada Zona desde "Zonas".
          </p>
          <div class="grid sm:grid-cols-2 gap-4 max-w-sm">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Recargo cada ($ de dinero declarado)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="recargoDineroUmbral" name="recargoDineroUmbral" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Monto del recargo ($)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="recargoDineroMonto" name="recargoDineroMonto" />
            </label>
          </div>
          <p class="text-xs text-gray-400 -mt-2">
            Recargo por el dinero/valores que declara el cliente (mayor riesgo para el cadete): por cada tramo
            completo del primer monto, se suma el segundo al precio sugerido (por Zona o por distancia, cualquiera
            sea). Ej. con 10.000 y 100: declarar $25.000 suma $200 (el tramo incompleto de $5.000 no cuenta). Dejá
            "Recargo cada" en 0 para desactivarlo.
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rutas — distancia real por calle</h2>
          <p class="text-xs text-gray-400">
            Para que "Precio por km" cotice con la distancia real (no en línea recta) se prueban, en este orden:
            <strong>OSRM</strong> (gratis, sin API key, siempre disponible), después <strong>GraphHopper</strong> (gratis
            con key propia, 500 consultas/día) y por último <strong>OpenRouteService</strong> (gratis con key propia,
            2500 consultas/día — también se usa para la ruta sugerida al cadete al aceptar un viaje). Si ninguna
            responde, se sigue usando la línea recta como respaldo. Las keys son gratuitas y propias de cada
            cadetería, por eso se cargan acá y no vienen precargadas.
          </p>
          <div class="grid sm:grid-cols-2 gap-4 max-w-xl">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">GraphHopper — API key</span>
              <input type="text" class="input" [(ngModel)]="graphhopperKey" name="graphhopperKey" placeholder="Sacala gratis en graphhopper.com" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">OpenRouteService — API key</span>
              <input type="text" class="input" [(ngModel)]="openRouteServiceKey" name="openRouteServiceKey" placeholder="Sacala gratis en openrouteservice.org" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">OpenRouteService — URL (opcional)</span>
              <input type="text" class="input" [(ngModel)]="openRouteServiceUrl" name="openRouteServiceUrl" placeholder="https://api.heigit.org/openrouteservice" />
            </label>
          </div>
          <p class="text-xs text-gray-400 -mt-2">
            Dejá la URL en blanco para usar la de siempre (https://api.heigit.org/openrouteservice). Solo cambiala si
            en tu cuenta de OpenRouteService figura otro host (revisá el ejemplo de request en su panel de API docs).
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Metas</h2>
          <label class="flex flex-col gap-1 max-w-xs">
            <span class="text-sm font-medium text-gray-700">Meta mensual de facturación ($)</span>
            <input type="number" min="0" step="1" class="input" [(ngModel)]="metaMensualFacturacion" name="metaMensualFacturacion" />
          </label>
          <p class="text-xs text-gray-400 -mt-2">
            Se muestra como barra de progreso en Métricas contra lo facturado en lo que va del mes. Dejalo en 0 para
            ocultar la barra.
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Plantillas de SMS</h2>
          <p class="text-xs text-gray-400 -mt-2">
            Usá <code>{{ '{link}' }}</code> donde quieras que aparezca el link de seguimiento del pedido.
          </p>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Al aceptar el viaje</span>
            <textarea class="input" rows="2" [(ngModel)]="smsTemplateAceptado" name="smsTemplateAceptado"></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Al finalizar el viaje</span>
            <textarea class="input" rows="2" [(ngModel)]="smsTemplateFinalizado" name="smsTemplateFinalizado"></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Al reenviar a mano (botón del dashboard)</span>
            <textarea class="input" rows="2" [(ngModel)]="smsTemplateReenvio" name="smsTemplateReenvio"></textarea>
          </label>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Cloudinary (subida de imágenes)</h2>
          <div class="grid sm:grid-cols-2 gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Cloud name</span>
              <input class="input" [(ngModel)]="cloudinaryCloudName" name="cloudName" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Upload preset (unsigned)</span>
              <input class="input" [(ngModel)]="cloudinaryUploadPreset" name="uploadPreset" />
            </label>
          </div>
          <p class="text-xs text-gray-400">
            No son datos secretos: se usan desde el front para subir imágenes directo a Cloudinary con un preset unsigned.
          </p>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Salud del sistema</h2>
            <button type="button" class="text-xs text-brand-600 hover:underline" (click)="cargarSalud()">↻ Actualizar</button>
          </div>
          @if (salud(); as s) {
            <div class="grid sm:grid-cols-2 gap-2 text-sm">
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>{{ s.dbOk ? '🟢' : '🔴' }}</span>
                <span class="text-gray-700">Base de datos</span>
              </div>
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>{{ s.smsGatewayConfigurado ? '🟢' : '🟡' }}</span>
                <span class="text-gray-700">Gateway de SMS {{ s.smsGatewayConfigurado ? '' : '(sin configurar)' }}</span>
              </div>
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>{{ s.pushConfigurado ? '🟢' : '🟡' }}</span>
                <span class="text-gray-700">Push a la app {{ s.pushConfigurado ? '' : '(sin configurar)' }}</span>
              </div>
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>{{ s.emailConfigurado ? '🟢' : '🟡' }}</span>
                <span class="text-gray-700">Email {{ s.emailConfigurado ? '' : '(sin configurar)' }}</span>
              </div>
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>{{ s.webPushConfigurado ? '🟢' : '🟡' }}</span>
                <span class="text-gray-700">Web Push en seguimiento {{ s.webPushConfigurado ? '' : '(sin configurar)' }}</span>
              </div>
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>{{ s.geocodingOk ? '🟢' : '🔴' }}</span>
                <span class="text-gray-700">Geocoding (Nominatim) {{ s.geocodingOk ? '' : '(última consulta falló)' }}</span>
              </div>
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>{{ s.whatsappGatewayConectado ? '🟢' : '🔴' }}</span>
                <span class="text-gray-700">Gateway de WhatsApp {{ s.whatsappGatewayConectado ? '' : '(desconectado)' }}</span>
              </div>
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>{{ s.smsFallidosPendientes > 0 ? '🟡' : '🟢' }}</span>
                <span class="text-gray-700">{{ s.smsFallidosPendientes }} SMS sin poder enviar</span>
              </div>
              <div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span>📦</span>
                <span class="text-gray-700">{{ s.pedidosActivos }} pedidos activos ahora</span>
              </div>
            </div>
            <p class="text-xs text-gray-400 -mt-1">
              Último pedido creado: {{ s.ultimoPedidoCreadoEn ? (s.ultimoPedidoCreadoEn | date: 'short') : 'nunca' }} · Consultado
              {{ s.consultadoEn | date: 'short' }}
            </p>
          } @else {
            <p class="text-xs text-gray-400">Cargando…</p>
          }
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Accesos al panel</h2>
          <div class="overflow-x-auto max-h-64 border border-gray-200 rounded">
            <table class="w-full text-sm border-collapse">
              <thead class="sticky top-0 bg-gray-50">
                <tr class="text-left text-gray-500 border-b border-gray-200">
                  <th class="py-2 px-3 font-medium">Usuario</th>
                  <th class="py-2 px-3 font-medium">Ingresó</th>
                  <th class="py-2 px-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                @for (a of accesos(); track a.id) {
                  <tr class="border-b border-gray-100">
                    <td class="py-1.5 px-3">{{ a.username }}</td>
                    <td class="py-1.5 px-3 whitespace-nowrap">{{ a.ingresoEn | date: 'short' }}</td>
                    <td class="py-1.5 px-3 text-gray-500">{{ a.ip ?? '—' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" class="py-4 text-center text-gray-400">Todavía no hay accesos registrados.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Retención de datos</h2>
          <p class="text-xs text-gray-400">
            0 = nunca borrar (comportamiento de siempre). Con un número, un job diario borra los mensajes más
            viejos que eso. Nunca borra un WhatsApp ligado a un pedido que todavía no terminó, aunque sea viejo.
          </p>
          <div class="grid sm:grid-cols-2 gap-4 max-w-sm">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Historial de WhatsApp (días)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="retencionWhatsappDias" name="retencionWhatsappDias" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Chat interno con cadetes (días)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="retencionChatDias" name="retencionChatDias" />
            </label>
          </div>
        </section>

        <section class="flex flex-col gap-3 border-t border-gray-200 pt-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Zona de emergencia</h2>
          <p class="text-xs text-gray-500 max-w-lg">
            Si sospechás que un usuario o contraseña se filtró, esto invalida de una todas las sesiones activas
            (admins y cadetes) sin tener que resetear contraseñas una por una. Vos también vas a quedar
            desconectado y vas a tener que volver a entrar.
          </p>
          <button
            type="button"
            class="btn bg-red-600 hover:bg-red-700 self-start"
            [disabled]="cerrandoSesiones()"
            (click)="confirmarCerrarSesiones()"
          >
            🚨 Cerrar todas las sesiones
          </button>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
      }
      .input:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-brand-400);
      }
      textarea.input {
        font-family: inherit;
        resize: vertical;
      }
      .btn {
        color: white;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
      }
      .btn:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class ConfiguracionComponent implements OnInit {
  private readonly config = inject(ConfiguracionService);
  private readonly seguridad = inject(SeguridadService);
  private readonly saludSvc = inject(SaludService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly accesos = signal<AccesoLog[]>([]);
  readonly salud = signal<Salud | null>(null);
  readonly cerrandoSesiones = signal(false);

  tiempoLimiteAceptacionSeg: number | null = null;
  frecuenciaUbicacionSeg: number | null = null;
  asignacionAutomatica = false;
  asignacionAutomaticaMaxViajesCadete: number | null = null;
  maxRechazosPorPedido: number | null = null;
  minutosPedidoUrgenteReintentar: number | null = null;
  asignacionPriorizaRankingAceptacion = false;
  alertaDemoraRetiroMin: number | null = null;
  alertaDemoraFinalizacionMin: number | null = null;
  alertaInactividadMin: number | null = null;
  cloudinaryCloudName = '';
  cloudinaryUploadPreset = '';
  versionMinimaApp: number | null = null;
  firmaReceptorObligatoria = false;
  checklistDocumentacionObligatorio = false;
  telefonoSoporte = '';
  metaMensualFacturacion: number | null = null;
  metodoCotizacion = 'AUTOMATICO';
  precioBaseViaje: number | null = null;
  distanciaMinimaKm: number | null = null;
  precioPorKm: number | null = null;
  recargoDineroUmbral: number | null = null;
  recargoDineroMonto: number | null = null;
  graphhopperKey = '';
  openRouteServiceKey = '';
  openRouteServiceUrl = '';
  maxIntentosLogin: number | null = null;
  bloqueoLoginMin: number | null = null;
  pagoSemanalMonto: number | null = null;
  comisionPorcentaje: number | null = null;
  creditoBajoAlertaUmbral: number | null = null;
  smsTemplateAceptado = '';
  smsTemplateFinalizado = '';
  smsTemplateReenvio = '';
  nombreCadeteria = '';
  horarioAtencionActivo = false;
  horarioAtencionDesde = '08:00';
  horarioAtencionHasta = '22:00';
  pedidosPausados = false;
  pedidosPausadosMensaje = '';
  retencionWhatsappDias: number | null = null;
  retencionChatDias: number | null = null;

  readonly guardando = signal(false);
  readonly mensaje = signal<string | null>(null);
  readonly huboError = signal(false);

  private inicializado = false;

  constructor() {
    effect(() => {
      const v = this.config.valores();
      if (this.inicializado || !Object.keys(v).length) return;
      this.inicializado = true;
      this.tiempoLimiteAceptacionSeg = Number(v['tiempo_limite_aceptacion_seg'] ?? 120);
      this.frecuenciaUbicacionSeg = Number(v['frecuencia_ubicacion_seg'] ?? 45);
      this.asignacionAutomatica = (v['asignacion_automatica'] ?? 'false') === 'true';
      this.asignacionAutomaticaMaxViajesCadete = Number(v['asignacion_automatica_max_viajes_cadete'] ?? 1);
      this.maxRechazosPorPedido = Number(v['max_rechazos_por_pedido'] ?? 3);
      this.minutosPedidoUrgenteReintentar = Number(v['minutos_pedido_urgente_reintentar'] ?? 30);
      this.asignacionPriorizaRankingAceptacion = (v['asignacion_prioriza_ranking_aceptacion'] ?? 'false') === 'true';
      this.alertaDemoraRetiroMin = Number(v['alerta_demora_retiro_min'] ?? 30);
      this.alertaDemoraFinalizacionMin = Number(v['alerta_demora_finalizacion_min'] ?? 60);
      this.alertaInactividadMin = Number(v['alerta_inactividad_min'] ?? 20);
      this.cloudinaryCloudName = v['cloudinary_cloud_name'] ?? '';
      this.cloudinaryUploadPreset = v['cloudinary_upload_preset'] ?? '';
      this.versionMinimaApp = Number(v['version_minima_app'] ?? 1);
      this.firmaReceptorObligatoria = (v['firma_receptor_obligatoria'] ?? 'false') === 'true';
      this.checklistDocumentacionObligatorio = (v['checklist_documentacion_obligatorio'] ?? 'false') === 'true';
      this.telefonoSoporte = v['telefono_soporte'] ?? '';
      this.metaMensualFacturacion = Number(v['meta_mensual_facturacion'] ?? 0);
      this.metodoCotizacion = v['metodo_cotizacion'] ?? 'AUTOMATICO';
      this.precioBaseViaje = Number(v['precio_base_viaje'] ?? 0);
      this.distanciaMinimaKm = Number(v['distancia_minima_km'] ?? 2);
      this.precioPorKm = Number(v['precio_por_km'] ?? 0);
      this.recargoDineroUmbral = Number(v['recargo_dinero_transportado_umbral'] ?? 0);
      this.recargoDineroMonto = Number(v['recargo_dinero_transportado_monto'] ?? 0);
      this.graphhopperKey = v['graphhopper_key'] ?? '';
      this.openRouteServiceKey = v['open_route_service_key'] ?? '';
      this.openRouteServiceUrl = v['open_route_service_url'] ?? '';
      this.maxIntentosLogin = Number(v['max_intentos_login'] ?? 5);
      this.bloqueoLoginMin = Number(v['bloqueo_login_min'] ?? 15);
      this.pagoSemanalMonto = Number(v['pago_semanal_monto'] ?? 5000);
      this.comisionPorcentaje = Number(v['comision_porcentaje'] ?? 10);
      this.creditoBajoAlertaUmbral = Number(v['credito_bajo_alerta_umbral'] ?? 500);
      this.smsTemplateAceptado = v['sms_template_aceptado'] ?? 'Tu pedido esta en camino, seguilo aca: {link}';
      this.smsTemplateFinalizado = v['sms_template_finalizado'] ?? 'Tu pedido fue entregado. Mira el detalle, descarga el comprobante y calificanos aca: {link}';
      this.smsTemplateReenvio = v['sms_template_reenvio'] ?? 'Seguí tu pedido acá: {link}';
      this.nombreCadeteria = v['nombre_cadeteria'] ?? '';
      this.horarioAtencionActivo = (v['horario_atencion_activo'] ?? 'false') === 'true';
      this.horarioAtencionDesde = v['horario_atencion_desde'] ?? '08:00';
      this.horarioAtencionHasta = v['horario_atencion_hasta'] ?? '22:00';
      this.pedidosPausados = (v['pedidos_pausados'] ?? 'false') === 'true';
      this.pedidosPausadosMensaje = v['pedidos_pausados_mensaje'] ?? 'Estamos pausados temporalmente, disculpá las molestias.';
      this.retencionWhatsappDias = Number(v['retencion_whatsapp_dias'] ?? 0);
      this.retencionChatDias = Number(v['retencion_chat_dias'] ?? 0);
    });
  }

  ngOnInit(): void {
    this.config.ensureLoaded();
    this.seguridad.accesos().subscribe((a) => this.accesos.set(a));
    this.cargarSalud();
  }

  cargarSalud(): void {
    this.saludSvc.obtener().subscribe((s) => this.salud.set(s));
  }

  confirmarCerrarSesiones(): void {
    if (!confirm('¿Cerrar todas las sesiones? Vos también vas a quedar desconectado.')) return;
    this.cerrandoSesiones.set(true);
    this.seguridad.cerrarTodasLasSesiones().subscribe({
      next: () => {
        this.auth.logout();
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.cerrandoSesiones.set(false);
        this.huboError.set(true);
        this.mensaje.set('No se pudieron cerrar las sesiones.');
      },
    });
  }

  guardar(): void {
    this.mensaje.set(null);
    this.huboError.set(false);

    const v = this.config.valores();
    const cambios: Array<[string, string]> = [];
    const agregarSiCambio = (clave: string, valorNuevo: string) => {
      if (valorNuevo !== (v[clave] ?? '')) cambios.push([clave, valorNuevo]);
    };

    agregarSiCambio('tiempo_limite_aceptacion_seg', String(this.tiempoLimiteAceptacionSeg ?? ''));
    agregarSiCambio('frecuencia_ubicacion_seg', String(this.frecuenciaUbicacionSeg ?? ''));
    agregarSiCambio('asignacion_automatica', String(this.asignacionAutomatica));
    agregarSiCambio('asignacion_automatica_max_viajes_cadete', String(this.asignacionAutomaticaMaxViajesCadete ?? ''));
    agregarSiCambio('max_rechazos_por_pedido', String(this.maxRechazosPorPedido ?? ''));
    agregarSiCambio('minutos_pedido_urgente_reintentar', String(this.minutosPedidoUrgenteReintentar ?? ''));
    agregarSiCambio('asignacion_prioriza_ranking_aceptacion', String(this.asignacionPriorizaRankingAceptacion));
    agregarSiCambio('alerta_demora_retiro_min', String(this.alertaDemoraRetiroMin ?? ''));
    agregarSiCambio('alerta_demora_finalizacion_min', String(this.alertaDemoraFinalizacionMin ?? ''));
    agregarSiCambio('alerta_inactividad_min', String(this.alertaInactividadMin ?? ''));
    agregarSiCambio('cloudinary_cloud_name', this.cloudinaryCloudName);
    agregarSiCambio('cloudinary_upload_preset', this.cloudinaryUploadPreset);
    agregarSiCambio('version_minima_app', String(this.versionMinimaApp ?? ''));
    agregarSiCambio('firma_receptor_obligatoria', String(this.firmaReceptorObligatoria));
    agregarSiCambio('checklist_documentacion_obligatorio', String(this.checklistDocumentacionObligatorio));
    agregarSiCambio('telefono_soporte', this.telefonoSoporte);
    agregarSiCambio('meta_mensual_facturacion', String(this.metaMensualFacturacion ?? 0));
    agregarSiCambio('metodo_cotizacion', this.metodoCotizacion);
    agregarSiCambio('precio_base_viaje', String(this.precioBaseViaje ?? 0));
    agregarSiCambio('distancia_minima_km', String(this.distanciaMinimaKm ?? 2));
    agregarSiCambio('precio_por_km', String(this.precioPorKm ?? 0));
    agregarSiCambio('recargo_dinero_transportado_umbral', String(this.recargoDineroUmbral ?? 0));
    agregarSiCambio('recargo_dinero_transportado_monto', String(this.recargoDineroMonto ?? 0));
    agregarSiCambio('graphhopper_key', this.graphhopperKey);
    agregarSiCambio('open_route_service_key', this.openRouteServiceKey);
    agregarSiCambio('open_route_service_url', this.openRouteServiceUrl);
    agregarSiCambio('max_intentos_login', String(this.maxIntentosLogin ?? ''));
    agregarSiCambio('bloqueo_login_min', String(this.bloqueoLoginMin ?? ''));
    agregarSiCambio('pago_semanal_monto', String(this.pagoSemanalMonto ?? ''));
    agregarSiCambio('comision_porcentaje', String(this.comisionPorcentaje ?? ''));
    agregarSiCambio('credito_bajo_alerta_umbral', String(this.creditoBajoAlertaUmbral ?? ''));
    agregarSiCambio('sms_template_aceptado', this.smsTemplateAceptado);
    agregarSiCambio('sms_template_finalizado', this.smsTemplateFinalizado);
    agregarSiCambio('sms_template_reenvio', this.smsTemplateReenvio);
    agregarSiCambio('nombre_cadeteria', this.nombreCadeteria);
    agregarSiCambio('horario_atencion_activo', String(this.horarioAtencionActivo));
    agregarSiCambio('horario_atencion_desde', this.horarioAtencionDesde);
    agregarSiCambio('horario_atencion_hasta', this.horarioAtencionHasta);
    agregarSiCambio('pedidos_pausados', String(this.pedidosPausados));
    agregarSiCambio('pedidos_pausados_mensaje', this.pedidosPausadosMensaje);
    agregarSiCambio('retencion_whatsapp_dias', String(this.retencionWhatsappDias ?? 0));
    agregarSiCambio('retencion_chat_dias', String(this.retencionChatDias ?? 0));

    if (!cambios.length) {
      this.mensaje.set('No hay cambios para guardar.');
      return;
    }

    this.guardando.set(true);
    this.guardarSecuencial(cambios, 0);
  }

  private guardarSecuencial(cambios: Array<[string, string]>, i: number): void {
    if (i >= cambios.length) {
      this.guardando.set(false);
      this.mensaje.set('Cambios guardados.');
      return;
    }
    const [clave, valor] = cambios[i];
    this.config.guardar(
      clave,
      valor,
      () => this.guardarSecuencial(cambios, i + 1),
      () => {
        this.guardando.set(false);
        this.huboError.set(true);
        this.mensaje.set('No se pudieron guardar todos los cambios.');
      }
    );
  }
}
