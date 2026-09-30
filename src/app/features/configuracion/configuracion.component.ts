import { SonidosService } from '../../core/services/sonidos.service';
import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfiguracionService, EstadoApiKey, SimulacionTarifa } from '../../core/services/configuracion.service';
import { SeguridadService } from '../../core/services/seguridad.service';
import { SaludService, Salud } from '../../core/services/salud.service';
import { AuthService } from '../../core/services/auth.service';
import { AccesoLog } from '../../core/models/acceso-log.model';
import { ApkCadetesComponent } from './apk-cadetes.component';
import { AvisoEnCaminoEditorComponent } from './aviso-en-camino-editor.component';

type Categoria = 'pedidos' | 'cadetes' | 'integraciones' | 'marca' | 'sistema';

const CATEGORIAS: Array<{ id: Categoria; label: string }> = [
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'cadetes', label: 'Cadetes' },
  { id: 'integraciones', label: 'Integraciones' },
  { id: 'marca', label: 'Marca' },
  { id: 'sistema', label: 'Sistema' },
];

/**
 * Pantalla de parametros globales editables (diseno-tecnico.md sección 3/7/8).
 *
 * Reorganizada en pestañas por tema (2026-09-21, a pedido del dueño): antes eran 17
 * secciones apiladas una atrás de otra sin ninguna categoría, todas con el mismo peso
 * visual — "mezcla todo". Se agrupan en 5 pestañas y se suma una ayuda corta debajo de
 * cada campo explicando qué hace y qué pasa al cambiarlo. Ninguna clave de configuración
 * ni la lógica de guardado cambia — es reorganización visual + texto.
 */
/** Espejo de ConfiguracionSistema (backend): solo el superadmin las ve y las cambia. */
/** Cartel "Antes de arrancar" de la app (2026-09-29): los de siempre, iguales a los del backend. */
const RECORDATORIOS_TITULO_DEFECTO = 'Antes de arrancar';
const RECORDATORIOS_DEFECTO = [
  'Llevá toda la documentación en regla (DNI, licencia, cédula del vehículo, seguro).',
  'No te olvides los elementos de seguridad: casco, cadena y mochila.',
  'Marcá cada viaje como "Retirado" al levantar el pedido, y "Finalizado" con los datos correspondientes al entregarlo.',
];
const RECORDATORIOS_MAX_RENGLONES = 6;
const RECORDATORIOS_MAX_CARACTERES = 150;

const CLAVES_SISTEMA = new Set([
  'cloudinary_cloud_name', 'cloudinary_upload_preset', 'open_route_service_url',
  'google_cache_pausar_borrado', 'google_cache_dias', 'google_link_vence',
  'frecuencia_ubicacion_seg', 'mapeo_calles_cadetes_intervalo_seg',
  'aprender_gps_precision_max_m', 'aprender_geocoder_precision_max_m', 'reverse_respaldo_max_dia',
  'version_minima_app', 'retencion_imagenes_pedido_dias', 'rate_limit_publico_max', 'rate_limit_publico_ventana_seg',
  'vapid_public_key', 'vapid_private_key', 'proximo_numero_pedido',
  'geoapify_keys', 'locationiq_keys', 'google_geocoding_keys', 'graphhopper_key', 'open_route_service_key',
]);

/** Listas de API keys por proveedor; la de la cadetería es la misma clave + "_cliente". */
const PROVEEDORES_KEYS = [
  { clave: 'geoapify_keys', nombre: 'Geoapify (direcciones)' },
  { clave: 'locationiq_keys', nombre: 'LocationIQ (direcciones)' },
  { clave: 'google_geocoding_keys', nombre: 'Google Geocoding ("buscar de nuevo")' },
  { clave: 'graphhopper_key', nombre: 'GraphHopper (distancia)' },
  { clave: 'open_route_service_key', nombre: 'OpenRouteService (distancia)' },
];

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule, DatePipe, DecimalPipe, RouterLink, AvisoEnCaminoEditorComponent, ApkCadetesComponent],
  template: `
    <div class="bg-white rounded shadow-sm">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h1 class="font-semibold text-gray-700">Configuración</h1>
        <button type="button" class="btn bg-emerald-600 hover:bg-emerald-700" [disabled]="guardando()" (click)="guardar()">
          💾 Guardar cambios
        </button>
      </div>

      <div class="config-tabs border-b border-gray-200 px-4 flex items-center gap-4 text-sm overflow-x-auto">
        @for (cat of categorias; track cat.id) {
          <button
            type="button"
            class="py-3 border-b-2 -mb-px transition-colors whitespace-nowrap"
            [class.border-brand-600]="cat.id === categoriaActiva()"
            [class.text-brand-600]="cat.id === categoriaActiva()"
            [class.border-transparent]="cat.id !== categoriaActiva()"
            [class.text-gray-500]="cat.id !== categoriaActiva()"
            (click)="categoriaActiva.set(cat.id)"
          >
            {{ cat.label }}
          </button>
        }
        <a
          routerLink="/whatsapp"
          class="py-3 border-b-2 border-transparent text-gray-500 transition-colors whitespace-nowrap no-underline"
          title="Chips, números y plantillas del gateway — pantalla propia"
        >
          Gateway WhatsApp ↗
        </a>
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

        @if (categoriaActiva() === 'pedidos') {
          <section class="flex flex-col gap-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pedidos y ubicación</h2>
            <div class="grid sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Tiempo límite para aceptar un pedido (segundos)</span>
                <input type="number" min="1" step="1" class="input" [(ngModel)]="tiempoLimiteAceptacionSeg" name="tiempoLimite" />
                <span class="text-xs text-gray-400">
                  Cuánto tiempo tiene el cadete para aceptar o rechazar una oferta antes de que se le venza y el
                  sistema se la ofrezca a otro.
                </span>
              </label>
              @if (esSuperadmin) {
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Frecuencia de envío de ubicación del cadete (segundos)</span>
                <input type="number" min="1" step="1" class="input" [(ngModel)]="frecuenciaUbicacionSeg" name="frecuenciaUbicacion" />
                <span class="text-xs text-gray-400">
                  Cada cuánto la app manda la posición del cadete mientras tiene un viaje en curso — más seguido es
                  más preciso en el mapa, pero gasta más batería y datos móviles.
                </span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Mapeo de calles con el GPS de los cadetes (segundos)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="mapeoCallesCadetesIntervaloSeg" name="mapeoCallesCadetesIntervaloSeg" />
                <span class="text-xs text-gray-400">
                  Cada cuántos segundos se aprovecha la última ubicación de los cadetes activos para ir completando
                  la cache de direcciones (gratis, vía Nominatim). <strong>0 = desactivado.</strong> Default de
                  producción: 1200 (20 min) — solo bajalo (ej. 30) para "sembrar" la cache probando vos con pocas
                  cuentas conectadas a la vez; subilo de nuevo antes de tener muchos cadetes reales conectados.
                </span>
              </label>
              }
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
                <span class="text-xs text-gray-400">
                  Cuántos viajes sin terminar le puede dar de una la asignación automática/sugerida a un mismo
                  cadete, sin importar cuánto soporte él (eso lo define "Máx. viajes simultáneos" en su ficha).
                </span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Rechazos antes de excluir al cadete de ESE pedido</span>
                <input type="number" min="1" step="1" class="input" [(ngModel)]="maxRechazosPorPedido" name="maxRechazos" />
                <span class="text-xs text-gray-400">
                  A un cadete que rechaza el mismo pedido puntual esta cantidad de veces se lo deja de ofertar —
                  para ese pedido en particular, no para los demás.
                </span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Reintentar con cualquiera igual pasados (minutos)</span>
                <input type="number" min="1" step="1" class="input" [(ngModel)]="minutosPedidoUrgenteReintentar" name="minutosUrgente" />
                <span class="text-xs text-gray-400">
                  Pasado este tiempo sin poder asignarse, el pedido se considera urgente y se lo vuelve a ofrecer a
                  cualquiera (incluso a quien ya lo rechazó), para que no quede sin nadie para siempre. Una oferta
                  vencida sin respuesta no cuenta como rechazo.
                </span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Distancia máxima de viaje para BICI (km)</span>
                <input type="number" min="0" step="0.5" class="input" [(ngModel)]="distanciaMaximaBiciKm" name="distanciaMaximaBiciKm" placeholder="0 = sin límite" />
                <span class="text-xs text-gray-400">
                  Si un cadete en BICI es candidato y el viaje (origen→destino) supera esta distancia, la
                  asignación automática/sugerida no se lo ofrece a él (sí puede seguir ofreciéndose a una moto) —
                  0 = sin límite. Vos podés seguir asignando a mano igual si te parece razonable en un caso puntual.
                </span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Distancia máxima del cadete al retiro (BICI, km)</span>
                <input type="number" min="0" step="0.5" class="input" [(ngModel)]="distanciaMaximaBiciRetiroKm" name="distanciaMaximaBiciRetiroKm" placeholder="0 = sin límite" />
                <span class="text-xs text-gray-400">
                  Si un cadete en BICI está más lejos que esto del punto de retiro del pedido, la asignación
                  automática/sugerida no se lo ofrece — 0 = sin límite.
                </span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Distancia máxima entre orígenes para agrupar en un lote (km)</span>
                <input type="number" min="0" step="0.5" class="input" [(ngModel)]="distanciaMaximaLoteKm" name="distanciaMaximaLoteKm" />
                <span class="text-xs text-gray-400">
                  Al agrupar varios pedidos en una sola tanda de ofertas a un cadete ("Asignar viaje" desde
                  Cadetes libres), todos los orígenes tienen que estar a esta distancia o menos entre sí.
                </span>
              </label>
            </div>
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
                <span class="text-xs text-gray-400">
                  Pasado este tiempo desde que aceptó el viaje sin marcar "Retirado", la app le manda un
                  recordatorio (una sola vez por pedido).
                </span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Avisar si no finalizó (minutos)</span>
                <input type="number" min="1" step="1" class="input" [(ngModel)]="alertaDemoraFinalizacionMin" name="alertaDemoraFinalizacion" />
                <span class="text-xs text-gray-400">
                  El mismo recordatorio, pero contado desde que aceptó hasta que finaliza el viaje.
                </span>
              </label>
            </div>
            <label class="flex flex-col gap-1 max-w-xs">
              <span class="text-sm font-medium text-gray-700">Alertarme si un cadete "en curso" no manda ubicación (minutos)</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="alertaInactividadMin" name="alertaInactividad" />
              <span class="text-xs text-gray-400">
                Posible batería muerta, zona sin señal, o que abandonó el pedido sin avisar. Aparece como alerta en
                el dashboard (una sola vez por pedido).
              </span>
            </label>
          </section>

          <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tarifas — cotización automática</h2>
            <p class="text-xs text-gray-400">
              Cuando se carga un pedido nuevo (desde el panel o desde "/pedir"), el sistema sugiere un precio solo, por
              la distancia real por calle entre origen y destino. Siempre es editable, nunca obliga.
            </p>
            <div class="grid sm:grid-cols-3 gap-4 max-w-lg">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Monto mínimo del viaje ($)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="precioBaseViaje" name="precioBaseViaje" />
                <span class="text-xs text-gray-400">Piso del precio sugerido por distancia: nunca sugiere menos que esto.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Ese mínimo cubre hasta (km)</span>
                <input type="number" min="0" step="0.1" class="input" [(ngModel)]="distanciaMinimaKm" name="distanciaMinimaKm" />
                <span class="text-xs text-gray-400">Hasta esta distancia se cobra el monto mínimo fijo, sin sumar nada más.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Precio por km adicional ($)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="precioPorKm" name="precioPorKm" />
                <span class="text-xs text-gray-400">Se suma por cada km que supere el umbral de arriba. En 0, desactiva la cotización por distancia.</span>
              </label>
            </div>
            <label class="flex flex-col gap-1 max-w-xs">
              <span class="text-sm font-medium text-gray-700">Si no se puede calcular la ruta: línea recta ×</span>
              <input type="number" min="1" step="0.05" class="input" [(ngModel)]="factorLineaRecta" name="factorLineaRecta" />
              <span class="text-xs text-gray-400">
                Respaldo cuando fallan los servicios de rutas. Las calles no van derecho: en Tucumán la distancia
                real es en promedio 1,38 veces la recta (medido en 12 viajes), por eso el default es 1,4.
              </span>
            </label>

            <!-- Simulador (2026-09-24): elegir el factor comparando contra lo que se cobraba, no a ojo. -->
            <div class="rounded border border-gray-200 p-3 flex flex-col gap-3 max-w-3xl">
              <div class="flex flex-wrap items-end gap-3">
                <div class="text-sm font-medium text-gray-700 w-full">Probar el factor contra lo que se cobraba antes</div>
                <label class="flex flex-col gap-1">
                  <span class="text-xs text-gray-500">Factor a probar</span>
                  <input type="number" min="1" step="0.05" class="input w-24" [(ngModel)]="factorAProbar" name="factorAProbar" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs text-gray-500">Pedidos de los últimos</span>
                  <select class="input" [(ngModel)]="diasSimulacion" name="diasSimulacion">
                    <option [ngValue]="30">30 días</option>
                    <option [ngValue]="90">90 días</option>
                    <option [ngValue]="180">180 días</option>
                    <option [ngValue]="365">1 año</option>
                  </select>
                </label>
                <button type="button" class="btn bg-brand-600 hover:bg-brand-700" (click)="simularTarifa()" [disabled]="simulando()">
                  {{ simulando() ? 'Calculando…' : 'Probar' }}
                </button>
              </div>
              <p class="text-xs text-gray-400 -mt-1">
                Calcula cuánto habría cobrado la fórmula en cada pedido finalizado usando la línea recta × el factor, y
                lo compara con lo que realmente se cobró. Usa el mínimo, los km y el precio por km de arriba tal como
                están guardados.
              </p>
              @if (simulacion(); as s) {
                @if (s.pedidosAnalizados === 0) {
                  <p class="text-sm text-gray-500">No hay pedidos finalizados con precio en ese período.</p>
                } @else {
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div class="rounded bg-gray-50 px-3 py-2">
                      <div class="text-xs text-gray-500">Pedidos</div>
                      <div class="font-semibold">{{ s.pedidosAnalizados }}</div>
                    </div>
                    <div class="rounded bg-gray-50 px-3 py-2">
                      <div class="text-xs text-gray-500">Parecidos (±5%)</div>
                      <div class="font-semibold text-emerald-700">{{ s.parecidos }}</div>
                    </div>
                    <div class="rounded bg-gray-50 px-3 py-2">
                      <div class="text-xs text-gray-500">La fórmula cobra más</div>
                      <div class="font-semibold text-amber-700">{{ s.formulaMasCara }}</div>
                    </div>
                    <div class="rounded bg-gray-50 px-3 py-2">
                      <div class="text-xs text-gray-500">La fórmula cobra menos</div>
                      <div class="font-semibold text-red-700">{{ s.formulaMasBarata }}</div>
                    </div>
                  </div>
                  <p class="text-sm text-gray-700">
                    Con factor {{ s.factor }}: se cobró $ {{ s.totalCobrado | number: '1.0-0' }} y la fórmula habría
                    cobrado $ {{ s.totalConFormula | number: '1.0-0' }}; en promedio
                    <strong>{{ s.diferenciaPromedio >= 0 ? '+' : '' }}$ {{ s.diferenciaPromedio | number: '1.0-0' }}</strong>
                    por pedido ({{ s.diferenciaPromedioPct >= 0 ? '+' : '' }}{{ s.diferenciaPromedioPct | number: '1.0-1' }}%).
                  </p>
                  @if (s.factorSugerido != null) {
                    <div class="flex flex-wrap items-center gap-2 rounded bg-brand-50 border border-brand-200 px-3 py-2 text-sm">
                      <span>
                        El factor que mejor coincide con lo que se cobraba es <strong>{{ s.factorSugerido }}</strong>
                        <span class="text-xs text-gray-500">(sale de {{ s.pedidosParaSugerencia }} pedidos cobrados por encima del mínimo)</span>
                      </span>
                      <button
                        type="button"
                        class="bg-brand-600 hover:bg-brand-700 text-white px-2 py-1 rounded text-xs font-medium"
                        (click)="usarFactorSugerido(s.factorSugerido)"
                      >
                        Usar {{ s.factorSugerido }}
                      </button>
                    </div>
                  } @else {
                    <p class="text-xs text-gray-500">
                      No hay pedidos cobrados por encima del mínimo en ese período: no se puede sugerir un factor.
                    </p>
                  }
                  @if (s.mayoresDiferencias.length) {
                    <details class="text-sm">
                      <summary class="cursor-pointer text-brand-700">Ver los pedidos que más se alejan</summary>
                      <div class="overflow-x-auto mt-2">
                        <table class="w-full text-xs">
                          <thead>
                            <tr class="text-left text-gray-500 border-b border-gray-200">
                              <th class="py-1 pr-2">#</th>
                              <th class="py-1 pr-2">Origen → destino</th>
                              <th class="py-1 pr-2 text-right">Recta</th>
                              <th class="py-1 pr-2 text-right">Cobrado</th>
                              <th class="py-1 text-right">Fórmula</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (f of s.mayoresDiferencias; track f.numero) {
                              <tr class="border-b border-gray-100">
                                <td class="py-1 pr-2 whitespace-nowrap">{{ f.numero }}</td>
                                <td class="py-1 pr-2">{{ f.origen }} → {{ f.destino }}</td>
                                <td class="py-1 pr-2 text-right whitespace-nowrap">{{ f.lineaRectaKm | number: '1.1-1' }} km</td>
                                <td class="py-1 pr-2 text-right whitespace-nowrap">$ {{ f.cobrado | number: '1.0-0' }}</td>
                                <td class="py-1 text-right whitespace-nowrap">$ {{ f.conFormula | number: '1.0-0' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </details>
                  }
                }
              }
            </div>
            <p class="text-xs text-gray-400 -mt-2">
              Ejemplo con mínimo $2000 hasta 2 km y $320/km: un viaje de 5 km cobra $2000 + 3 km × $320 = $2960.
            </p>
            <div class="grid sm:grid-cols-2 gap-4 max-w-sm">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Recargo cada ($ de dinero u objetos de valor declarados)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="recargoDineroUmbral" name="recargoDineroUmbral" />
                <span class="text-xs text-gray-400">Tramo de dinero declarado por el cliente que dispara un recargo. En 0, lo desactiva.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Monto del recargo ($)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="recargoDineroMonto" name="recargoDineroMonto" />
                <span class="text-xs text-gray-400">Lo que se suma al precio sugerido por cada tramo completo de arriba.</span>
              </label>
            </div>
            <p class="text-xs text-gray-400 -mt-2">
              Es un recargo por el riesgo que corre el cadete al llevar más valores: por cada tramo COMPLETO del
              primer monto, se suma el segundo. Ej. con 10.000 y 100: declarar $25.000 suma $200 (el tramo incompleto
              de $5.000 no cuenta).
            </p>
            <label class="flex flex-col gap-1 max-w-xs">
              <span class="text-sm font-medium text-gray-700">Recargo por volver al origen (%)</span>
              <input type="number" min="0" max="200" step="1" class="input" [(ngModel)]="recargoRetornoOrigen" name="recargoRetornoOrigen" />
              <span class="text-xs text-gray-400">
                Porcentaje del precio del viaje que se suma cuando el cliente pide que el cadete vuelva al origen (no se
                aplica sobre el recargo por dinero). Ej. con 50%: un viaje de $2960 con vuelta sale $4440. En 0, sin recargo.
              </span>
            </label>
          </section>

          <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Metas</h2>
            <label class="flex flex-col gap-1 max-w-xs">
              <span class="text-sm font-medium text-gray-700">Meta mensual de facturación ($)</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="metaMensualFacturacion" name="metaMensualFacturacion" />
              <span class="text-xs text-gray-400">
                Se muestra como barra de progreso en Métricas contra lo facturado en lo que va del mes. Dejalo en 0
                para ocultar la barra.
              </span>
            </label>
          </section>
        }

        @if (categoriaActiva() === 'cadetes') {
          <section class="flex flex-col gap-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">App de cadetes</h2>
            @if (esSuperadmin) {
            <label class="flex flex-col gap-1 max-w-xs">
              <span class="text-sm font-medium text-gray-700">Versión mínima requerida (código de versión)</span>
              <input type="number" min="1" step="1" class="input" [(ngModel)]="versionMinimaApp" name="versionMinimaApp" />
              <span class="text-xs text-gray-400">
                Como la app se distribuye por Bluetooth (sin Play Store), un cadete puede quedar con una versión
                vieja sin darse cuenta. Si el código de versión de su APK es menor a este número, no lo deja
                iniciar sesión y le pide que le pidas el APK actualizado.
              </span>
            </label>
            }
            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="fotoRetiroObligatoria" name="fotoRetiroObligatoria" />
              <span class="text-sm text-gray-700">Exigir foto del pedido al marcar "Retirado"</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="fotoEntregaObligatoria" name="fotoEntregaObligatoria" />
              <span class="text-sm text-gray-700">Exigir foto de la entrega para poder finalizar</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="firmaReceptorObligatoria" name="firmaReceptorObligatoria" />
              <span class="text-sm text-gray-700">Exigir firma digital del receptor para poder finalizar</span>
            </label>
            <p class="text-xs text-gray-400 -mt-2">
              El nombre de quien recibió se pide siempre. La app pide la foto o la firma antes de intentar, así el
              cadete no se entera por un error. Si el cadete estaba sin señal y la foto se le borró del teléfono antes
              de subirse, el viaje se registra igual y queda un comentario automático en el pedido.
            </p>
            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="enLugarControlActivo" name="enLugarControlActivo" />
              <span class="text-sm text-gray-700">Controlar que "Retirado" y "Entregado" se marquen en el lugar</span>
            </label>
            <p class="text-xs text-gray-400 -mt-2">
              Prendido, el cadete tiene que estar a menos de 150 m del retiro, la parada o el destino (si la dirección
              está mal ubicada puede marcar con "Estoy en el lugar" y una foto), y no puede marcar con GPS falso.
              Apagado, marca desde donde sea: solo queda anotado a qué distancia lo hizo. En los dos casos tiene que
              marcar "Retirado" antes de poder entregar. Los cadetes lo toman al abrir el viaje.
            </p>
            <label class="flex flex-col gap-1 max-w-sm">
              <span class="text-sm font-medium text-gray-700">Minutos mínimos entre "Retirado" y "Finalizar"</span>
              <input type="number" min="0" step="1" class="input" [(ngModel)]="minutosMinimosRetiroEntrega" name="minutosMinimosRetiroEntrega" />
              <span class="text-xs text-gray-400">
                El botón "Finalizar" de la app queda apagado con una cuenta regresiva hasta que pasen estos minutos
                desde el retiro (también si lo marca sin señal: cuenta la hora en que tocó). 0 = sin espera. Desde el
                panel el admin puede finalizar igual.
              </span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="celularUnicoActivo" name="celularUnicoActivo" />
              <span class="text-sm text-gray-700">Un celular por cadete (no puede entrar desde otro celular)</span>
            </label>
            <p class="text-xs text-gray-400 -mt-2">
              El primer celular con el que entra queda vinculado; desde otro no puede entrar y el intento queda en su
              ficha. Si cambia de celular, en su ficha → Datos personales → "Habilitar nuevo celular". Apagado, entra
              desde cualquiera pero los intentos igual quedan anotados.
            </p>
            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="checklistDocumentacionObligatorio" name="checklistDocumentacionObligatorio" />
              <span class="text-sm text-gray-700">Exigir carnet + tarjeta verde + foto del vehículo cargados para poder activarse</span>
            </label>
            <p class="text-xs text-gray-400 -mt-2">
              Apagado (default): un cadete se puede activar aunque le falte cargar documentación. Prendido: si le
              falta algo, la app le avisa qué le falta y no lo deja pasar de "Desconectado" a "Libre".
            </p>

            <div class="border-t border-gray-100 pt-3 flex flex-col gap-3">
              <label class="flex items-center gap-2">
                <input type="checkbox" [(ngModel)]="recordatoriosActivo" name="recordatoriosActivo" />
                <span class="text-sm font-medium text-gray-700">Cartel de recordatorios al entrar a la app</span>
              </label>
              <p class="text-xs text-gray-400 -mt-2">
                Le sale al cadete cada vez que inicia sesión y se cierra solo con "Entendido", que queda registrado en su
                ficha con lo que decía el cartel. Sin renglones no sale. Si es largo, en el celular se desliza.
              </p>
              <div class="grid md:grid-cols-2 gap-4" [class.opacity-50]="!recordatoriosActivo">
                <div class="flex flex-col gap-2">
                  <label class="flex flex-col gap-1">
                    <span class="text-sm text-gray-700">Título</span>
                    <input class="input" maxlength="60" [(ngModel)]="recordatoriosTitulo" name="recordatoriosTitulo" />
                  </label>
                  @for (r of recordatorios; track $index) {
                    <div class="flex gap-1 items-start">
                      <div class="flex-1 flex flex-col">
                        <textarea class="input text-sm" rows="2" [maxLength]="maxCaracteresRecordatorio" [value]="r"
                          (input)="cambiarRecordatorio($index, $any($event.target).value)"></textarea>
                        <span class="text-xs text-right" [class]="r.length >= maxCaracteresRecordatorio ? 'text-amber-600' : 'text-gray-400'">
                          {{ r.length }}/{{ maxCaracteresRecordatorio }}
                        </span>
                      </div>
                      <button type="button" class="px-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30" title="Subir"
                        [disabled]="$index === 0" (click)="moverRecordatorio($index, -1)">↑</button>
                      <button type="button" class="px-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30" title="Bajar"
                        [disabled]="$index === recordatorios.length - 1" (click)="moverRecordatorio($index, 1)">↓</button>
                      <button type="button" class="px-1.5 text-red-500 hover:text-red-700" title="Quitar" (click)="quitarRecordatorio($index)">✕</button>
                    </div>
                  }
                  <div class="flex gap-3 text-sm">
                    <button type="button" class="text-emerald-700 hover:underline disabled:opacity-40 disabled:no-underline"
                      [disabled]="recordatorios.length >= maxRenglonesRecordatorio" (click)="agregarRecordatorio()">
                      + Agregar renglón ({{ recordatorios.length }}/{{ maxRenglonesRecordatorio }})
                    </button>
                    <button type="button" class="text-gray-500 hover:underline" (click)="recordatoriosDeSiempre()">Volver a los de siempre</button>
                  </div>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <span class="text-xs text-gray-400">Así lo ve el cadete</span>
                  <div class="w-[260px] rounded-[28px] border-[6px] border-gray-800 bg-gray-500/60 p-3 h-[360px] flex items-center">
                    <div class="bg-orange-50 rounded-2xl p-4 w-full flex flex-col max-h-full">
                      <div class="text-lg text-gray-900 mb-2">{{ recordatoriosTitulo.trim() || tituloRecordatoriosDefecto }}</div>
                      <div class="overflow-y-auto flex flex-col gap-2 text-[13px] text-gray-800 min-h-0">
                        @for (r of recordatoriosVisibles(); track $index) {
                          <div>• {{ r }}</div>
                        } @empty {
                          <div class="text-gray-400 italic">Sin renglones: no sale el cartel.</div>
                        }
                      </div>
                      <div class="flex justify-end mt-3">
                        <span class="bg-orange-500 text-white text-sm rounded-full px-4 py-1.5">Entendido</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Cobro a cadetes</h2>
            <p class="text-xs text-gray-400">
              Cada cadete elige uno de los dos modelos en su ficha: <strong>Semanal</strong> (paga esta cuota fija,
              el admin lo habilita a mano cada semana desde Pagos) o <strong>Porcentaje</strong> (carga crédito y se
              le descuenta este % de cada viaje al aceptarlo — se le devuelve si después no llega a completarlo).
            </p>
            <div class="grid sm:grid-cols-3 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Cuota semanal ($)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="pagoSemanalMonto" name="pagoSemanalMonto" />
                <span class="text-xs text-gray-400">Valor sugerido al cargar el pago semanal de un cadete Semanal desde Pagos.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Comisión por viaje (%)</span>
                <input type="number" min="0" max="100" step="0.5" class="input" [(ngModel)]="comisionPorcentaje" name="comisionPorcentaje" />
                <span class="text-xs text-gray-400">% que se descuenta del crédito de un cadete Porcentaje apenas acepta un viaje.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Avisar cadete si su crédito baja de ($)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="creditoBajoAlertaUmbral" name="creditoBajoAlertaUmbral" />
                <span class="text-xs text-gray-400">Push una sola vez cuando el saldo cruza este umbral hacia abajo.</span>
              </label>
            </div>
          </section>

          <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Seguridad de inicio de sesión</h2>
            <div class="grid sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Intentos fallidos antes de bloquear</span>
                <input type="number" min="1" step="1" class="input" [(ngModel)]="maxIntentosLogin" name="maxIntentosLogin" />
                <span class="text-xs text-gray-400">Cuántos intentos seguidos con contraseña incorrecta tolera antes de bloquear la cuenta.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Minutos de bloqueo</span>
                <input type="number" min="1" step="1" class="input" [(ngModel)]="bloqueoLoginMin" name="bloqueoLoginMin" />
                <span class="text-xs text-gray-400">Cuánto tiempo queda bloqueada la cuenta antes de poder reintentar.</span>
              </label>
            </div>
            <p class="text-xs text-gray-400 -mt-2">Aplica tanto a admins como a cadetes.</p>
          </section>
        }

        @if (categoriaActiva() === 'integraciones') {
          <section class="flex flex-col gap-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rutas y geocoding — cuentas gratuitas</h2>
            <p class="text-xs text-gray-400">
              Para que "Precio por km" cotice con la distancia real (no en línea recta) se prueban, en este orden:
              <strong>OSRM</strong> (gratis, sin API key, siempre disponible), después <strong>GraphHopper</strong> (gratis
              con key propia, 500 consultas/día) y por último <strong>OpenRouteService</strong> (gratis con key propia,
              2500 consultas/día — también se usa para la ruta sugerida al cadete al aceptar un viaje). Si ninguna
              responde, se sigue usando la línea recta como respaldo. <strong>Geoapify</strong> es la que busca
              direcciones en "Pedir online" (además de Nominatim, que no necesita key).
            </p>
            <p class="text-xs text-gray-400 -mt-2">
              Podés cargar <strong>más de una cuenta gratuita por proveedor</strong> — una key por línea (o separadas
              por coma). Apenas una se queda sin cupo del día, se pasa sola a la siguiente sin que tengas que hacer
              nada; el estado de cada una se ve en la tabla de abajo.
            </p>
            @if (esSuperadmin) {
            <div class="grid sm:grid-cols-2 gap-4 max-w-xl">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Geoapify — API keys (direcciones)</span>
                <textarea class="input" rows="2" [(ngModel)]="geoapifyKeys" name="geoapifyKeys" placeholder="Sacalas gratis en geoapify.com — una por línea"></textarea>
                <span class="text-xs text-gray-400">Se usan para autocompletar direcciones en la página pública "Pedir online".</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Google — API keys (direcciones, "buscar de nuevo")</span>
                <textarea
                  class="input"
                  rows="2"
                  [(ngModel)]="googleGeocodingKeys"
                  name="googleGeocodingKeys"
                  placeholder="Geocoding API de Google Cloud — una por línea"
                ></textarea>
                <span class="text-xs text-gray-400">
                  Solo se usa cuando el cliente toca "No está mi dirección — buscar de nuevo". Tope propio de 300
                  búsquedas por día por key (~9.000/mes, dentro del cupo sin cargo de Google). Vacío = ese segundo
                  intento vuelve a probar los servicios gratuitos.
                </span>
              </label>
              <!-- Ubicaciones de Google en la cache de direcciones (2026-09-25) -->
              <div class="sm:col-span-2 flex flex-col gap-2 rounded border border-gray-200 p-3">
                <span class="text-sm font-medium text-gray-700">Direcciones encontradas con Google</span>
                <label class="flex items-center gap-2">
                  <span class="text-sm text-gray-700">Borrarlas después de</span>
                  <input type="number" min="0" max="365" step="1" class="input w-20" [(ngModel)]="googleCacheDias" name="googleCacheDias" />
                  <span class="text-sm text-gray-700">días</span>
                </label>
                <span class="text-xs text-gray-400 -mt-1">
                  Las condiciones de Google permiten guardarlas hasta <strong>30 días</strong> (a septiembre de 2026);
                  si las cambian, se ajusta acá. En 0 no se guardan. Lo que ubica a mano el admin o un cadete no se
                  borra nunca, y si confirma una dirección que vino de Google, deja de vencer.
                </span>
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="googleLinkVence" name="googleLinkVence" />
                  <span class="text-sm text-gray-700">Borrar también las ubicadas con un link de Google Maps</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="googleCachePausarBorrado" name="googleCachePausarBorrado" />
                  <span class="text-sm text-amber-700">No borrar (solo para pruebas)</span>
                </label>
                @if (googleCachePausarBorrado) {
                  <span class="text-xs text-amber-700 -mt-1">
                    ⚠️ Mientras esté tildado no se borra nada y se siguen usando las vencidas. No dejarlo así en producción.
                  </span>
                }
              </div>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">GraphHopper — API keys (distancia)</span>
                <textarea class="input" rows="2" [(ngModel)]="graphhopperKey" name="graphhopperKey" placeholder="Sacalas gratis en graphhopper.com — una por línea"></textarea>
                <span class="text-xs text-gray-400">Segunda opción para calcular la distancia real, si OSRM no responde.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">OpenRouteService — API keys (distancia)</span>
                <textarea class="input" rows="2" [(ngModel)]="openRouteServiceKey" name="openRouteServiceKey" placeholder="Sacalas gratis en openrouteservice.org — una por línea"></textarea>
                <span class="text-xs text-gray-400">Tercera opción para distancia — además arma la ruta sugerida que ve el cadete al aceptar un viaje.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">OpenRouteService — URL (opcional)</span>
                <input type="text" class="input" [(ngModel)]="openRouteServiceUrl" name="openRouteServiceUrl" placeholder="https://api.heigit.org/openrouteservice" />
                <span class="text-xs text-gray-400">
                  Dejala en blanco para usar la de siempre. Solo cambiala si en tu cuenta figura otro host (revisá
                  el ejemplo de request en su panel de API docs).
                </span>
              </label>
            </div>
            }
            <!-- API keys de la cadetería (2026-09-26): el admin suma cupo pero no borra; las del sistema van primero. -->
            <div class="flex flex-col gap-3 max-w-xl rounded border border-gray-200 p-3">
              <span class="text-sm font-medium text-gray-700">API keys propias de la cadetería</span>
              <span class="text-xs text-gray-400 -mt-2">
                Se suman a las que carga el administrador del sistema (que se usan primero). Sirven para tener más
                cupo gratis: una key por línea. Una vez guardadas no se pueden quitar desde acá; si hace falta
                borrar alguna, pedíselo al administrador del sistema.
              </span>
              @for (p of proveedoresKeys; track p.clave) {
                <label class="flex flex-col gap-1">
                  <span class="text-sm text-gray-700">{{ p.nombre }}</span>
                  @if (esSuperadmin) {
                    <textarea class="input" rows="2" [(ngModel)]="keysCliente[p.clave]" [name]="'keysCliente_' + p.clave"></textarea>
                  } @else {
                    @for (k of separarKeys(keysCliente[p.clave]); track k) {
                      <code class="text-xs text-gray-600 break-all">{{ k }}</code>
                    }
                    <textarea
                      class="input"
                      rows="2"
                      [(ngModel)]="keysClienteNuevas[p.clave]"
                      [name]="'keysClienteNuevas_' + p.clave"
                      placeholder="Agregar keys nuevas — una por línea"
                    ></textarea>
                  }
                </label>
              }
            </div>

            <div class="flex flex-col gap-2 mt-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado de las cuentas cargadas</span>
                <button type="button" class="text-xs text-brand-600 hover:underline" (click)="cargarEstadoApiKeys()">
                  {{ cargandoEstadoApiKeys() ? 'Actualizando…' : '🔄 Actualizar' }}
                </button>
              </div>
              @if (estadoApiKeys().length === 0) {
                <p class="text-xs text-gray-400">Todavía no hay ninguna key cargada (guardá los cambios de arriba primero).</p>
              } @else {
                <table class="text-xs w-full max-w-xl">
                  <thead>
                    <tr class="text-left text-gray-400">
                      <th class="font-medium pb-1">Proveedor</th>
                      <th class="font-medium pb-1">Cuenta</th>
                      <th class="font-medium pb-1">Estado</th>
                      <th class="font-medium pb-1">Quedan hoy</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (e of estadoApiKeys(); track e.proveedor + e.claveEnmascarada) {
                      <tr class="border-t border-gray-100">
                        <td class="py-1">{{ nombreProveedor(e.proveedor) }}</td>
                        <td class="py-1 font-mono text-gray-600">{{ e.claveEnmascarada }}</td>
                        <td class="py-1">
                          <span
                            class="inline-block w-2 h-2 rounded-full mr-1"
                            [class.bg-emerald-500]="e.estado === 'OK'"
                            [class.bg-red-500]="e.estado !== 'OK'"
                          ></span>
                          {{ e.estado === 'OK' ? 'Con cupo' : e.estado === 'INVALIDA' ? 'Key inválida — revisala' : 'Sin cupo — probamos la siguiente' }}
                        </td>
                        <td class="py-1">
                          {{ e.restante == null ? '—' : (e.restanteEstimado ? '~' : '') + e.restante }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                <p class="text-xs text-gray-400">
                  El número con "~" es una estimación nuestra (límite diario conocido del plan gratuito menos las
                  consultas que ya hizo el sistema hoy con esa key) — puede no ser exacto si la usaste también fuera de
                  acá. Sin "~" es el dato real que devuelve el proveedor (hoy solo OpenRouteService lo informa). Una
                  cuenta "Sin cupo" se vuelve a probar sola a las 24hs.
                </p>
              }
            </div>
          </section>

          @if (esSuperadmin) {
          <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Cloudinary (subida de imágenes)</h2>
            <div class="grid sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Cloud name</span>
                <input class="input" [(ngModel)]="cloudinaryCloudName" name="cloudName" />
                <span class="text-xs text-gray-400">Identificador de tu cuenta de Cloudinary (lo ves en su dashboard, arriba a la izquierda).</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Upload preset (unsigned)</span>
                <input class="input" [(ngModel)]="cloudinaryUploadPreset" name="uploadPreset" />
                <span class="text-xs text-gray-400">
                  Nombre del preset "unsigned" que crees en Cloudinary → Settings → Upload. Sin esto, la app y el
                  panel no pueden subir fotos.
                </span>
              </label>
            </div>
            <p class="text-xs text-gray-400">
              No son datos secretos: se usan desde el front para subir imágenes directo a Cloudinary con un preset unsigned.
            </p>
          </section>
          }

          <section class="flex flex-col gap-4 border-t border-gray-200 pt-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Sonidos del panel</h2>
            <p class="text-xs text-gray-400 -mt-2">
              Cada aviso suena distinto, para saber qué pasó sin mirar la pantalla. Tocá para escucharlos.
            </p>
            <div class="flex flex-wrap gap-2">
              @for (t of sonidos.tipos; track t.tipo) {
                <button
                  type="button"
                  class="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
                  (click)="sonidos.reproducir(t.tipo)"
                >
                  ▶ {{ t.nombre }}
                </button>
              }
            </div>

            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-4">Reclamos de clientes</h2>
            <p class="text-xs text-gray-400 -mt-2">
              Cuando el cliente reporta un problema con la entrega, el cadete no recibe pedidos hasta que el reclamo se
              cierre. A los minutos de abajo se le escribe al cliente (WhatsApp, o SMS si el gateway no está) y, si no
              responde, se cierra solo. Los reclamos por demora se cierran cuando el cadete retira o entrega.
            </p>
            <div class="grid sm:grid-cols-3 gap-4 max-w-2xl">
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Escribirle al cliente a los (min)</span>
                <input type="number" min="1" max="240" class="input" [(ngModel)]="reclamoSeguimientoMin" name="reclamoSeguimientoMin" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Cerrar sin respuesta a los (min)</span>
                <input type="number" min="1" max="240" class="input" [(ngModel)]="reclamoCierreMin" name="reclamoCierreMin" />
                <span class="text-xs text-gray-400">Contados desde que se le escribió.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">WhatsApp de atención al cliente</span>
                <input class="input" [(ngModel)]="whatsappAtencionCliente" name="whatsappAtencionCliente" placeholder="Ej: 381 555 1234" />
                <span class="text-xs text-gray-400">Adonde escribe el cliente si sigue el problema (puede ser el celular del dueño).</span>
              </label>
            </div>

            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-4">Plantillas de SMS</h2>
            <p class="text-xs text-gray-400 -mt-2">
              Podés usar <code>{{ '{link}' }}</code> (link de seguimiento), <code>{{ '{numero}' }}</code> (número de
              pedido) y <code>{{ '{marca}' }}</code> (nombre de la cadetería). El link vale hasta las 23:59 del día en que
              terminó el pedido.
            </p>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Al aceptar el viaje</span>
              <textarea class="input" rows="2" [(ngModel)]="smsTemplateAceptado" name="smsTemplateAceptado"></textarea>
              <span class="text-xs text-gray-400">Se manda apenas el cadete acepta la oferta.</span>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Al finalizar el viaje</span>
              <textarea class="input" rows="2" [(ngModel)]="smsTemplateFinalizado" name="smsTemplateFinalizado"></textarea>
              <span class="text-xs text-gray-400">Se manda cuando el cadete marca el pedido como entregado.</span>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-gray-700">Al reenviar a mano (botón del dashboard)</span>
              <textarea class="input" rows="2" [(ngModel)]="smsTemplateReenvio" name="smsTemplateReenvio"></textarea>
              <span class="text-xs text-gray-400">
                Es el mensaje del botón "Reenviar SMS" del detalle de un pedido, para cuando el cliente dice que no
                le llegó.
              </span>
            </label>

            <app-aviso-en-camino-editor />
          </section>
        }

        @if (categoriaActiva() === 'marca') {
          <section class="flex flex-col gap-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Marca</h2>
            <label class="flex flex-col gap-1 max-w-xs">
              <span class="text-sm font-medium text-gray-700">Nombre de la cadetería</span>
              <input class="input" [(ngModel)]="nombreCadeteria" name="nombreCadeteria" placeholder="Ej: Cadetería Rápida" />
              <span class="text-xs text-gray-400">
                Se muestra en el header de la página pública de seguimiento (el link que le llega al cliente por SMS).
              </span>
            </label>
            <label class="flex flex-col gap-1 max-w-xs">
              <span class="text-sm font-medium text-gray-700">Teléfono de soporte para cadetes</span>
              <input class="input" [(ngModel)]="telefonoSoporte" name="telefonoSoporte" placeholder="Ej: 3814000000" />
              <span class="text-xs text-gray-400">
                Se muestra en la pantalla de Ayuda de la app del cadete, con un botón para llamar directo. Vacío =
                esa pantalla no muestra botón de llamar.
              </span>
            </label>
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
                <span class="text-xs text-gray-400">Texto que ve el cliente en "/pedir" mientras esté pausado.</span>
              </label>
            }
            <p class="text-xs text-gray-400 -mt-2">
              Corta la toma de pedidos nuevos al toque, sin importar el horario configurado arriba — para cuando
              hay que frenar por falta de cadetes libres o cualquier otro motivo puntual. No afecta el seguimiento
              de pedidos ya cargados.
            </p>

            <label class="flex items-center gap-2 pt-2 border-t border-gray-100">
              <input type="checkbox" [(ngModel)]="verificacionTelefonoActiva" name="verificacionTelefonoActiva" />
              <span class="text-sm text-gray-700">Pedir un código al teléfono del cliente antes de enviar el pedido</span>
            </label>
            <p class="text-xs text-gray-400 -mt-2">
              Evita pedidos a nombre de números ajenos. El código sale por WhatsApp (o SMS si el gateway no está
              conectado). Apagado: el cliente pide sin código y la solicitud igual la revisás vos antes de confirmarla.
            </p>

            <label class="flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="recordarTelefonos" name="recordarTelefonos" [disabled]="!verificacionTelefonoActiva" />
              <span class="text-sm text-gray-700">No volver a pedir el código a un teléfono que ya se verificó</span>
            </label>
            <p class="text-xs text-gray-400 -mt-2">
              Más cómodo para los clientes de siempre, pero cualquiera que sepa uno de esos números puede cargar un
              pedido a su nombre sin código. Apagalo si empiezan a llegar pedidos falsos con números conocidos.
            </p>
          </section>
        }

        @if (categoriaActiva() === 'sistema') {
          <section class="flex flex-col gap-4">
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
                @if (s.whatsappModoSimulado) {
                  <div class="flex items-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-2">
                    <span>🔴</span>
                    <span class="text-red-700">
                      WhatsApp en modo simulado: los códigos de /pedir no se mandan (apagar WHATSAPP_MODO_SIMULADO)
                    </span>
                  </div>
                }
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
                <span class="text-xs text-gray-400">Antigüedad máxima de los mensajes de WhatsApp antes de borrarlos.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Chat interno con cadetes (días)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="retencionChatDias" name="retencionChatDias" />
                <span class="text-xs text-gray-400">Lo mismo, para las conversaciones del chat interno del panel con cada cadete.</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Fotos y audios del chat (días)</span>
                <input type="number" min="0" step="1" class="input" [(ngModel)]="retencionChatArchivosDias" name="retencionChatArchivosDias" />
                <span class="text-xs text-gray-400">
                  Pasados estos días se borran de Cloudinary las fotos y notas de voz del chat (son lo que llena el plan
                  gratis); el mensaje queda con "Foto borrada". El texto sigue según el campo de arriba. 0 = nunca.
                </span>
              </label>
            </div>
          </section>

          <app-apk-cadetes />

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
        }
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
  readonly sonidos = inject(SonidosService);
  private readonly seguridad = inject(SeguridadService);
  private readonly saludSvc = inject(SaludService);
  private readonly auth = inject(AuthService);
  /** Superadmin (2026-09-26): ve y cambia lo técnico (servidores, Cloudinary, borrado de Google, frecuencias, API keys del sistema). */
  readonly esSuperadmin = this.auth.tienePermiso('sistema');
  readonly proveedoresKeys = PROVEEDORES_KEYS;
  /** Keys que agregó la cadetería, por proveedor (clave de Configuración + "_cliente"). */
  keysCliente: Record<string, string> = {};
  /** Lo que el admin tipea para agregar (se suma a las que ya tenía; no puede quitar). */
  keysClienteNuevas: Record<string, string> = {};
  private readonly router = inject(Router);

  readonly categorias = CATEGORIAS;
  readonly categoriaActiva = signal<Categoria>('pedidos');

  readonly accesos = signal<AccesoLog[]>([]);
  readonly salud = signal<Salud | null>(null);
  readonly cerrandoSesiones = signal(false);

  tiempoLimiteAceptacionSeg: number | null = null;
  frecuenciaUbicacionSeg: number | null = null;
  mapeoCallesCadetesIntervaloSeg: number | null = null;
  asignacionAutomatica = false;
  asignacionAutomaticaMaxViajesCadete: number | null = null;
  maxRechazosPorPedido: number | null = null;
  minutosPedidoUrgenteReintentar: number | null = null;
  distanciaMaximaBiciKm: number | null = null;
  distanciaMaximaBiciRetiroKm: number | null = null;
  distanciaMaximaLoteKm: number | null = null;
  asignacionPriorizaRankingAceptacion = false;
  alertaDemoraRetiroMin: number | null = null;
  alertaDemoraFinalizacionMin: number | null = null;
  alertaInactividadMin: number | null = null;
  cloudinaryCloudName = '';
  cloudinaryUploadPreset = '';
  versionMinimaApp: number | null = null;
  firmaReceptorObligatoria = false;
  fotoRetiroObligatoria = false;
  fotoEntregaObligatoria = true;
  /** Retirado/Entregado solo en el lugar (2026-09-28): interruptor por si en producción frena de más. */
  enLugarControlActivo = true;
  /** Espera mínima entre Retirado y Finalizar (2026-09-29); 0 = sin espera. */
  minutosMinimosRetiroEntrega: number | null = 10;
  /** Un celular por cadete (2026-09-29): interruptor por si en producción traba a alguien. */
  celularUnicoActivo = true;
  recordatoriosActivo = true;
  recordatoriosTitulo = RECORDATORIOS_TITULO_DEFECTO;
  recordatorios: string[] = [...RECORDATORIOS_DEFECTO];
  private recordatoriosIniciales = '';
  readonly tituloRecordatoriosDefecto = RECORDATORIOS_TITULO_DEFECTO;
  readonly maxRenglonesRecordatorio = RECORDATORIOS_MAX_RENGLONES;
  readonly maxCaracteresRecordatorio = RECORDATORIOS_MAX_CARACTERES;
  checklistDocumentacionObligatorio = false;
  telefonoSoporte = '';
  metaMensualFacturacion: number | null = null;
  precioBaseViaje: number | null = null;
  distanciaMinimaKm: number | null = null;
  precioPorKm: number | null = null;
  factorLineaRecta: number | null = 1.4;
  factorAProbar: number | null = 1.4;
  diasSimulacion = 90;
  readonly simulacion = signal<SimulacionTarifa | null>(null);
  readonly simulando = signal(false);
  recargoDineroUmbral: number | null = null;
  recargoDineroMonto: number | null = null;
  recargoRetornoOrigen: number | null = 50;
  geoapifyKeys = '';
  googleGeocodingKeys = '';
  googleCacheDias: number | null = 30;
  googleLinkVence = false;
  googleCachePausarBorrado = false;
  graphhopperKey = '';
  openRouteServiceKey = '';
  openRouteServiceUrl = '';
  readonly estadoApiKeys = signal<EstadoApiKey[]>([]);
  readonly cargandoEstadoApiKeys = signal(false);
  maxIntentosLogin: number | null = null;
  bloqueoLoginMin: number | null = null;
  pagoSemanalMonto: number | null = null;
  comisionPorcentaje: number | null = null;
  creditoBajoAlertaUmbral: number | null = null;
  smsTemplateAceptado = '';
  reclamoSeguimientoMin: number | null = 10;
  reclamoCierreMin: number | null = 10;
  whatsappAtencionCliente = '';
  smsTemplateFinalizado = '';
  smsTemplateReenvio = '';
  nombreCadeteria = '';
  horarioAtencionActivo = false;
  horarioAtencionDesde = '08:00';
  horarioAtencionHasta = '22:00';
  pedidosPausados = false;
  pedidosPausadosMensaje = '';
  recordarTelefonos = true;
  /** Apagado por default hasta probar el envío real del código (pendientes.md). */
  verificacionTelefonoActiva = false;
  retencionWhatsappDias: number | null = null;
  retencionChatDias: number | null = null;
  /** Fotos y audios del chat (2026-09-29): se borran de Cloudinary antes que el texto. */
  retencionChatArchivosDias: number | null = 30;

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
      this.mapeoCallesCadetesIntervaloSeg = Number(v['mapeo_calles_cadetes_intervalo_seg'] ?? 1200);
      this.asignacionAutomatica = (v['asignacion_automatica'] ?? 'false') === 'true';
      this.asignacionAutomaticaMaxViajesCadete = Number(v['asignacion_automatica_max_viajes_cadete'] ?? 1);
      this.maxRechazosPorPedido = Number(v['max_rechazos_por_pedido'] ?? 3);
      this.minutosPedidoUrgenteReintentar = Number(v['minutos_pedido_urgente_reintentar'] ?? 30);
      this.distanciaMaximaBiciKm = Number(v['distancia_maxima_bici_km'] ?? 0);
      this.distanciaMaximaBiciRetiroKm = Number(v['distancia_maxima_bici_retiro_km'] ?? 0);
      this.distanciaMaximaLoteKm = Number(v['distancia_maxima_lote_km'] ?? 3);
      this.asignacionPriorizaRankingAceptacion = (v['asignacion_prioriza_ranking_aceptacion'] ?? 'false') === 'true';
      this.alertaDemoraRetiroMin = Number(v['alerta_demora_retiro_min'] ?? 30);
      this.alertaDemoraFinalizacionMin = Number(v['alerta_demora_finalizacion_min'] ?? 60);
      this.alertaInactividadMin = Number(v['alerta_inactividad_min'] ?? 20);
      this.cloudinaryCloudName = v['cloudinary_cloud_name'] ?? '';
      this.cloudinaryUploadPreset = v['cloudinary_upload_preset'] ?? '';
      this.versionMinimaApp = Number(v['version_minima_app'] ?? 1);
      this.firmaReceptorObligatoria = (v['firma_receptor_obligatoria'] ?? 'false') === 'true';
      this.fotoRetiroObligatoria = (v['foto_retiro_obligatoria'] ?? 'false') === 'true';
      this.fotoEntregaObligatoria = (v['foto_entrega_obligatoria'] ?? 'true') === 'true';
      this.enLugarControlActivo = (v['en_lugar_control_activo'] ?? 'true') === 'true';
      this.minutosMinimosRetiroEntrega = Number(v['minutos_minimos_retiro_entrega'] ?? 10);
      this.celularUnicoActivo = (v['celular_unico_activo'] ?? 'true') === 'true';
      this.recordatoriosActivo = (v['recordatorios_entrar_activo'] ?? 'true') !== 'false';
      this.recordatoriosTitulo = (v['recordatorios_entrar_titulo'] ?? '').trim() || RECORDATORIOS_TITULO_DEFECTO;
      const numeros = Array.from({ length: RECORDATORIOS_MAX_RENGLONES }, (_, i) => i + 1);
      // Si nunca se editaron valen los de siempre; si se editaron y quedaron vacíos, no hay cartel.
      const editados = numeros.some((n) => v['recordatorio_entrar_' + n] !== undefined);
      this.recordatorios = editados
        ? numeros.map((n) => (v['recordatorio_entrar_' + n] ?? '').trim()).filter(Boolean)
        : [...RECORDATORIOS_DEFECTO];
      this.recordatoriosIniciales = this.firmaRecordatorios();
      this.checklistDocumentacionObligatorio = (v['checklist_documentacion_obligatorio'] ?? 'false') === 'true';
      this.telefonoSoporte = v['telefono_soporte'] ?? '';
      this.metaMensualFacturacion = Number(v['meta_mensual_facturacion'] ?? 0);
      this.precioBaseViaje = Number(v['precio_base_viaje'] ?? 0);
      this.distanciaMinimaKm = Number(v['distancia_minima_km'] ?? 2);
      this.precioPorKm = Number(v['precio_por_km'] ?? 0);
      this.factorLineaRecta = Number(v['factor_linea_recta'] ?? 1.4);
      this.factorAProbar = this.factorLineaRecta;
      this.recargoDineroUmbral = Number(v['recargo_dinero_transportado_umbral'] ?? 0);
      this.recargoDineroMonto = Number(v['recargo_dinero_transportado_monto'] ?? 0);
      this.recargoRetornoOrigen = Number(v['recargo_retorno_origen_porcentaje'] ?? 50);
      this.geoapifyKeys = v['geoapify_keys'] ?? '';
      this.cargarKeysCliente(v);
      this.googleGeocodingKeys = v['google_geocoding_keys'] ?? '';
      this.googleCacheDias = Number(v['google_cache_dias'] ?? 30);
      this.googleLinkVence = (v['google_link_vence'] ?? 'false') === 'true';
      this.googleCachePausarBorrado = (v['google_cache_pausar_borrado'] ?? 'false') === 'true';
      this.graphhopperKey = v['graphhopper_key'] ?? '';
      this.openRouteServiceKey = v['open_route_service_key'] ?? '';
      this.openRouteServiceUrl = v['open_route_service_url'] ?? '';
      this.maxIntentosLogin = Number(v['max_intentos_login'] ?? 5);
      this.bloqueoLoginMin = Number(v['bloqueo_login_min'] ?? 15);
      this.pagoSemanalMonto = Number(v['pago_semanal_monto'] ?? 5000);
      this.comisionPorcentaje = Number(v['comision_porcentaje'] ?? 10);
      this.creditoBajoAlertaUmbral = Number(v['credito_bajo_alerta_umbral'] ?? 500);
      this.smsTemplateAceptado = v['sms_template_aceptado'] ?? 'Tu pedido esta en camino, seguilo aca: {link}';
      this.reclamoSeguimientoMin = Number(v['reclamo_seguimiento_min'] ?? 10);
      this.reclamoCierreMin = Number(v['reclamo_cierre_min'] ?? 10);
      this.whatsappAtencionCliente = v['whatsapp_atencion_cliente'] ?? '';
      this.smsTemplateFinalizado = v['sms_template_finalizado'] ?? 'Tu pedido fue entregado. Mira el detalle, descarga el comprobante y calificanos aca: {link}';
      this.smsTemplateReenvio = v['sms_template_reenvio'] ?? 'Seguí tu pedido acá: {link}';
      this.nombreCadeteria = v['nombre_cadeteria'] ?? '';
      this.horarioAtencionActivo = (v['horario_atencion_activo'] ?? 'false') === 'true';
      this.horarioAtencionDesde = v['horario_atencion_desde'] ?? '08:00';
      this.horarioAtencionHasta = v['horario_atencion_hasta'] ?? '22:00';
      this.pedidosPausados = (v['pedidos_pausados'] ?? 'false') === 'true';
      this.pedidosPausadosMensaje = v['pedidos_pausados_mensaje'] ?? 'Estamos pausados temporalmente, disculpá las molestias.';
      this.recordarTelefonos = (v['verificacion_recordar_telefonos'] ?? 'true') === 'true';
      this.verificacionTelefonoActiva = (v['verificacion_telefono_activa'] ?? 'false') === 'true';
      this.retencionWhatsappDias = Number(v['retencion_whatsapp_dias'] ?? 0);
      this.retencionChatDias = Number(v['retencion_chat_dias'] ?? 0);
      this.retencionChatArchivosDias = Number(v['retencion_chat_archivos_dias'] ?? 30);
    });
  }

  ngOnInit(): void {
    this.config.ensureLoaded();
    this.seguridad.accesos().subscribe((a) => this.accesos.set(a));
    this.cargarSalud();
    this.cargarEstadoApiKeys();
  }

  private cargarKeysCliente(v: Record<string, string>): void {
    this.keysCliente = Object.fromEntries(PROVEEDORES_KEYS.map((p) => [p.clave, v[p.clave + '_cliente'] ?? '']));
  }

  separarKeys(texto: string | undefined): string[] {
    return (texto ?? '').split(/[,\n]/).map((k) => k.trim()).filter(Boolean);
  }

  cargarEstadoApiKeys(): void {
    this.cargandoEstadoApiKeys.set(true);
    this.config.estadoApiKeys().subscribe({
      next: (r) => {
        this.cargandoEstadoApiKeys.set(false);
        this.estadoApiKeys.set(r);
      },
      error: () => this.cargandoEstadoApiKeys.set(false),
    });
  }

  simularTarifa(): void {
    this.simulando.set(true);
    this.config.simularTarifa(this.factorAProbar, this.diasSimulacion).subscribe({
      next: (r) => {
        this.simulacion.set(r);
        this.simulando.set(false);
      },
      error: () => this.simulando.set(false),
    });
  }

  /** Lo copia al campo de arriba: se aplica recién al tocar "Guardar", como el resto de Configuración. */
  usarFactorSugerido(factor: number): void {
    this.factorLineaRecta = factor;
    this.factorAProbar = factor;
    this.simularTarifa();
  }

  nombreProveedor(proveedor: string): string {
    const nombres: Record<string, string> = {
      geoapify: 'Geoapify (direcciones)',
      google: 'Google (direcciones, búsqueda ampliada)',
      graphhopper: 'GraphHopper (distancia)',
      openrouteservice: 'OpenRouteService (distancia)',
    };
    return nombres[proveedor] ?? proveedor;
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

  recordatoriosVisibles(): string[] {
    return this.recordatorios.map((r) => r.trim()).filter(Boolean);
  }

  cambiarRecordatorio(i: number, valor: string): void {
    this.recordatorios[i] = valor;
  }

  moverRecordatorio(i: number, delta: number): void {
    const j = i + delta;
    if (j < 0 || j >= this.recordatorios.length) return;
    [this.recordatorios[i], this.recordatorios[j]] = [this.recordatorios[j], this.recordatorios[i]];
  }

  quitarRecordatorio(i: number): void {
    this.recordatorios.splice(i, 1);
  }

  agregarRecordatorio(): void {
    if (this.recordatorios.length < RECORDATORIOS_MAX_RENGLONES) this.recordatorios.push('');
  }

  recordatoriosDeSiempre(): void {
    this.recordatoriosTitulo = RECORDATORIOS_TITULO_DEFECTO;
    this.recordatorios = [...RECORDATORIOS_DEFECTO];
  }

  private firmaRecordatorios(): string {
    return JSON.stringify([this.recordatoriosTitulo.trim(), this.recordatoriosVisibles()]);
  }

  guardar(): void {
    this.mensaje.set(null);
    this.huboError.set(false);

    const v = this.config.valores();
    const cambios: Array<[string, string]> = [];
    const agregarSiCambio = (clave: string, valorNuevo: string) => {
      // Lo técnico no le llega a un admin (el backend lo filtra) y los defaults del form lo harían "cambiar".
      if (!this.esSuperadmin && CLAVES_SISTEMA.has(clave)) return;
      if (valorNuevo !== (v[clave] ?? '')) cambios.push([clave, valorNuevo]);
    };
    for (const p of PROVEEDORES_KEYS) {
      const claveCliente = p.clave + '_cliente';
      if (this.esSuperadmin) {
        agregarSiCambio(claveCliente, (this.keysCliente[p.clave] ?? '').trim());
      } else {
        const nuevas = (this.keysClienteNuevas[p.clave] ?? '').trim();
        if (nuevas) cambios.push([claveCliente, [(v[claveCliente] ?? '').trim(), nuevas].filter(Boolean).join('\n')]);
      }
    }

    agregarSiCambio('tiempo_limite_aceptacion_seg', String(this.tiempoLimiteAceptacionSeg ?? ''));
    agregarSiCambio('frecuencia_ubicacion_seg', String(this.frecuenciaUbicacionSeg ?? ''));
    agregarSiCambio('mapeo_calles_cadetes_intervalo_seg', String(this.mapeoCallesCadetesIntervaloSeg ?? ''));
    agregarSiCambio('asignacion_automatica', String(this.asignacionAutomatica));
    agregarSiCambio('asignacion_automatica_max_viajes_cadete', String(this.asignacionAutomaticaMaxViajesCadete ?? ''));
    agregarSiCambio('max_rechazos_por_pedido', String(this.maxRechazosPorPedido ?? ''));
    agregarSiCambio('minutos_pedido_urgente_reintentar', String(this.minutosPedidoUrgenteReintentar ?? ''));
    agregarSiCambio('distancia_maxima_bici_km', String(this.distanciaMaximaBiciKm ?? 0));
    agregarSiCambio('distancia_maxima_bici_retiro_km', String(this.distanciaMaximaBiciRetiroKm ?? 0));
    agregarSiCambio('distancia_maxima_lote_km', String(this.distanciaMaximaLoteKm ?? 3));
    agregarSiCambio('asignacion_prioriza_ranking_aceptacion', String(this.asignacionPriorizaRankingAceptacion));
    agregarSiCambio('alerta_demora_retiro_min', String(this.alertaDemoraRetiroMin ?? ''));
    agregarSiCambio('alerta_demora_finalizacion_min', String(this.alertaDemoraFinalizacionMin ?? ''));
    agregarSiCambio('alerta_inactividad_min', String(this.alertaInactividadMin ?? ''));
    agregarSiCambio('cloudinary_cloud_name', this.cloudinaryCloudName);
    agregarSiCambio('cloudinary_upload_preset', this.cloudinaryUploadPreset);
    agregarSiCambio('version_minima_app', String(this.versionMinimaApp ?? ''));
    agregarSiCambio('firma_receptor_obligatoria', String(this.firmaReceptorObligatoria));
    agregarSiCambio('foto_retiro_obligatoria', String(this.fotoRetiroObligatoria));
    agregarSiCambio('foto_entrega_obligatoria', String(this.fotoEntregaObligatoria));
    agregarSiCambio('en_lugar_control_activo', String(this.enLugarControlActivo));
    agregarSiCambio('minutos_minimos_retiro_entrega', String(this.minutosMinimosRetiroEntrega ?? 10));
    agregarSiCambio('celular_unico_activo', String(this.celularUnicoActivo));
    agregarSiCambio('checklist_documentacion_obligatorio', String(this.checklistDocumentacionObligatorio));
    agregarSiCambio('recordatorios_entrar_activo', String(this.recordatoriosActivo));
    // Título y los 6 renglones juntos, solo si se tocaron (cada renglón es una clave: el valor admite 500).
    if (this.firmaRecordatorios() !== this.recordatoriosIniciales) {
      cambios.push(['recordatorios_entrar_titulo', this.recordatoriosTitulo.trim()]);
      const textos = this.recordatoriosVisibles();
      for (let i = 0; i < RECORDATORIOS_MAX_RENGLONES; i++) {
        cambios.push(['recordatorio_entrar_' + (i + 1), textos[i] ?? '']);
      }
      this.recordatoriosIniciales = this.firmaRecordatorios();
    }
    agregarSiCambio('telefono_soporte', this.telefonoSoporte);
    agregarSiCambio('meta_mensual_facturacion', String(this.metaMensualFacturacion ?? 0));
    agregarSiCambio('precio_base_viaje', String(this.precioBaseViaje ?? 0));
    agregarSiCambio('distancia_minima_km', String(this.distanciaMinimaKm ?? 2));
    agregarSiCambio('precio_por_km', String(this.precioPorKm ?? 0));
    agregarSiCambio('factor_linea_recta', String(this.factorLineaRecta ?? 1.4));
    agregarSiCambio('recargo_dinero_transportado_umbral', String(this.recargoDineroUmbral ?? 0));
    agregarSiCambio('recargo_dinero_transportado_monto', String(this.recargoDineroMonto ?? 0));
    agregarSiCambio('recargo_retorno_origen_porcentaje', String(this.recargoRetornoOrigen ?? 0));
    agregarSiCambio('geoapify_keys', this.geoapifyKeys);
    agregarSiCambio('google_geocoding_keys', this.googleGeocodingKeys);
    agregarSiCambio('google_cache_dias', String(this.googleCacheDias ?? 30));
    agregarSiCambio('google_link_vence', String(this.googleLinkVence));
    agregarSiCambio('google_cache_pausar_borrado', String(this.googleCachePausarBorrado));
    agregarSiCambio('graphhopper_key', this.graphhopperKey);
    agregarSiCambio('open_route_service_key', this.openRouteServiceKey);
    agregarSiCambio('open_route_service_url', this.openRouteServiceUrl);
    agregarSiCambio('max_intentos_login', String(this.maxIntentosLogin ?? ''));
    agregarSiCambio('bloqueo_login_min', String(this.bloqueoLoginMin ?? ''));
    agregarSiCambio('pago_semanal_monto', String(this.pagoSemanalMonto ?? ''));
    agregarSiCambio('comision_porcentaje', String(this.comisionPorcentaje ?? ''));
    agregarSiCambio('credito_bajo_alerta_umbral', String(this.creditoBajoAlertaUmbral ?? ''));
    agregarSiCambio('sms_template_aceptado', this.smsTemplateAceptado);
    agregarSiCambio('reclamo_seguimiento_min', String(this.reclamoSeguimientoMin ?? 10));
    agregarSiCambio('reclamo_cierre_min', String(this.reclamoCierreMin ?? 10));
    agregarSiCambio('whatsapp_atencion_cliente', this.whatsappAtencionCliente.trim());
    agregarSiCambio('sms_template_finalizado', this.smsTemplateFinalizado);
    agregarSiCambio('sms_template_reenvio', this.smsTemplateReenvio);
    agregarSiCambio('nombre_cadeteria', this.nombreCadeteria);
    agregarSiCambio('horario_atencion_activo', String(this.horarioAtencionActivo));
    agregarSiCambio('horario_atencion_desde', this.horarioAtencionDesde);
    agregarSiCambio('horario_atencion_hasta', this.horarioAtencionHasta);
    agregarSiCambio('pedidos_pausados', String(this.pedidosPausados));
    agregarSiCambio('pedidos_pausados_mensaje', this.pedidosPausadosMensaje);
    agregarSiCambio('verificacion_recordar_telefonos', String(this.recordarTelefonos));
    agregarSiCambio('verificacion_telefono_activa', String(this.verificacionTelefonoActiva));
    agregarSiCambio('retencion_whatsapp_dias', String(this.retencionWhatsappDias ?? 0));
    agregarSiCambio('retencion_chat_dias', String(this.retencionChatDias ?? 0));
    agregarSiCambio('retencion_chat_archivos_dias', String(this.retencionChatArchivosDias ?? 30));

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
      this.keysClienteNuevas = {};
      this.cargarKeysCliente(this.config.valores());
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
