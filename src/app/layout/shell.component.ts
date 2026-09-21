import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { CadeteService } from '../core/services/cadete.service';
import { ChatService } from '../core/services/chat.service';
import { PedidoService } from '../core/services/pedido.service';
import { RealtimeService } from '../core/services/realtime.service';
import { ThemeService } from '../core/services/theme.service';
import { ToastService } from '../core/services/toast.service';
import { OnboardingService } from '../core/services/onboarding.service';
import { GUIAS, guiaVista, marcarGuiaVista } from '../core/guias';
import { TourComponent, TourStep } from '../shared/tour.component';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  /** Si está, el ítem solo aparece si el admin tiene este permiso (roles configurables, mejora 2026-09-16). */
  permisoRequerido?: string;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: '🏠' },
  { label: 'Mapa', path: '/mapa', icon: '🗺️' },
  { label: 'Cadetes', path: '/cadetes', icon: '🏍️' },
  { label: 'Zonas', path: '/zonas', icon: '📍' },
  { label: 'Clientes', path: '/clientes', icon: '👤' },
  { label: 'Pedidos web', path: '/solicitudes-pedido', icon: '📩' },
  { label: 'Pagos', path: '/pagos', icon: '💵', permisoRequerido: 'pagos' },
  { label: 'Chat', path: '/chat', icon: '💬' },
  { label: 'Incidencias', path: '/incidencias', icon: '🎫' },
  { label: 'Métricas', path: '/metricas', icon: '📊', permisoRequerido: 'metricas' },
  { label: 'Configuración', path: '/configuracion', icon: '⚙️', permisoRequerido: 'configuracion' },
  { label: 'Usuarios', path: '/usuarios', icon: '👥', permisoRequerido: 'usuarios' },
  { label: 'Roles', path: '/roles', icon: '🔑', permisoRequerido: 'roles' },
  { label: 'Ayuda', path: '/ayuda', icon: '❓' },
];

interface AlertaAdminWs {
  tipo: string;
  cadeteNombre?: string;
  cadeteApellido?: string;
  pedido?: { numero: number; origenDireccion: string };
  minutosSinUbicacion?: number;
  /** Solo para tipo === 'SOLICITUD_PEDIDO_NUEVA'. */
  solicitudId?: string;
  clienteNombre?: string;
  origenDireccion?: string;
  /** Solo para tipo === 'WHATSAPP_CHIP_BANEADO'. */
  chipId?: string;
  numero?: string;
  /** Solo para tipo === 'API_KEY_POOL_AGOTADO' | 'API_KEY_POOL_BAJO'. */
  proveedor?: string;
  /** Solo para tipo === 'API_KEY_POOL_BAJO'. */
  restante?: number;
}

interface MensajeChatWs {
  cadeteId: string;
  autor: string;
}

interface AlertaSesion {
  id: number;
  mensaje: string;
  ts: number;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, TourComponent],
  template: `
    <div class="min-h-screen flex flex-col">
      <header class="h-14 bg-brand-600 text-white flex items-center justify-between px-4 shrink-0 z-10 gap-3">
        <div class="flex items-center gap-3 shrink-0">
          <button
            type="button"
            class="md:hidden text-2xl leading-none px-1 -ml-1"
            (click)="mobileOpen.set(true)"
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <img src="/assets/logo.jpg" alt="Logo" class="w-9 h-9 rounded-full object-cover" />
          <span class="font-semibold hidden md:inline">Panel de control</span>
        </div>

        <div class="relative flex-1 max-w-sm hidden sm:block">
          <input
            type="search"
            class="w-full rounded px-3 py-1.5 text-sm text-gray-800 focus:outline-none"
            placeholder="Buscar cadete, cliente o pedido…"
            [ngModel]="busquedaGlobal()"
            (ngModelChange)="busquedaGlobal.set($event)"
            (keydown.enter)="buscarPedidoGlobal()"
            name="busquedaGlobal"
          />
          @if (busquedaGlobal().trim().length >= 2) {
            <div class="absolute left-0 right-0 mt-1 bg-white text-gray-800 rounded shadow-lg border border-gray-200 overflow-hidden z-30 max-h-72 overflow-y-auto">
              @for (c of cadetesEncontrados(); track c.id) {
                <a
                  [routerLink]="['/cadetes', c.id]"
                  (click)="busquedaGlobal.set('')"
                  class="block px-3 py-2 text-sm border-b border-gray-100 hover:bg-gray-50"
                >
                  🏍 {{ c.nombre }} {{ c.apellido }} <span class="text-xs text-gray-400">({{ c.username }})</span>
                </a>
              }
              @if (pareceTelefono()) {
                <a
                  [routerLink]="['/clientes', busquedaGlobal().trim()]"
                  (click)="busquedaGlobal.set('')"
                  class="block px-3 py-2 text-sm border-b border-gray-100 hover:bg-gray-50"
                >
                  👤 Ver ficha de cliente "{{ busquedaGlobal().trim() }}"
                </a>
              }
              <a
                [routerLink]="['/']"
                [queryParams]="{ buscar: busquedaGlobal().trim() }"
                (click)="busquedaGlobal.set('')"
                class="block px-3 py-2 text-sm hover:bg-gray-50"
              >
                📦 Buscar "{{ busquedaGlobal().trim() }}" en pedidos
              </a>
            </div>
          }
        </div>

        <div class="flex items-center gap-4 text-sm shrink-0">
          <button
            type="button"
            class="text-lg leading-none hover:opacity-80"
            (click)="theme.alternar()"
            [title]="theme.oscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          >
            {{ theme.oscuro() ? '☀️' : '🌙' }}
          </button>
          <div class="relative">
            <button
              type="button"
              class="relative text-lg leading-none hover:opacity-80"
              (click)="mostrarAlertas.set(!mostrarAlertas())"
              title="Alertas"
            >
              🔔
              @if (totalAlertas() > 0) {
                <span
                  class="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
                >
                  {{ totalAlertas() > 99 ? '99+' : totalAlertas() }}
                </span>
              }
            </button>
            @if (mostrarAlertas()) {
              <div
                class="absolute right-0 mt-2 w-80 bg-white text-gray-800 rounded shadow-lg border border-gray-200 overflow-hidden z-20"
              >
                <div class="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span class="text-sm font-semibold">Alertas</span>
                  @if (alertasSesion().length > 0) {
                    <button type="button" class="text-xs text-brand-600 hover:underline" (click)="alertasSesion.set([])">
                      Marcar todo como visto
                    </button>
                  }
                </div>
                <div class="max-h-72 overflow-y-auto">
                  @if (smsFallidosCount() > 0) {
                    <a
                      routerLink="/"
                      (click)="mostrarAlertas.set(false)"
                      class="block px-3 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 text-amber-700"
                    >
                      📵 {{ smsFallidosCount() }} pedido(s) con SMS sin poder enviar al cliente
                    </a>
                  }
                  @for (a of alertasSesion(); track a.id) {
                    <div class="px-3 py-2 text-sm border-b border-gray-100 last:border-0">{{ a.mensaje }}</div>
                  } @empty {
                    @if (smsFallidosCount() === 0) {
                      <p class="text-xs text-gray-400 text-center py-4">Sin alertas por ahora.</p>
                    }
                  }
                </div>
              </div>
            }
          </div>
          @if (ob.porcentaje() < 100) {
            <a
              routerLink="/primeros-pasos"
              class="hidden sm:flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-full px-3 py-1 text-xs font-semibold"
              title="Terminá de configurar tu cadetería"
            >
              🚀 Configuración {{ ob.porcentaje() }}%
            </a>
          }
          <button
            type="button"
            class="hidden sm:inline text-lg leading-none px-1"
            title="Ver de nuevo la guía de esta pantalla"
            (click)="abrirGuia()"
          >
            ❓
          </button>
          <a
            routerLink="/ayuda/panel"
            target="_blank"
            class="hover:underline hidden sm:inline"
            title="Manual completo del panel"
          >
            Manual
          </a>
          <span class="hidden sm:inline">{{ auth.username() }}</span>
          <button type="button" class="hover:underline" (click)="logout()">Cerrar sesión</button>
        </div>
      </header>

      <div class="flex flex-1 min-h-0 relative">
        @if (mobileOpen()) {
          <div class="fixed inset-0 bg-black/40 z-30 md:hidden" (click)="mobileOpen.set(false)"></div>
        }

        <aside
          class="bg-sidebar text-slate-200 w-64 shrink-0 flex flex-col py-3 fixed inset-y-0 left-0 z-40 -translate-x-full transition-transform duration-200 md:static md:translate-x-0 md:transition-all"
          [class.translate-x-0]="mobileOpen()"
          [class.md:w-16]="collapsed()"
        >
          @for (item of nav(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-sidebar-hover text-white"
              [routerLinkActiveOptions]="{ exact: item.path === '/' }"
              (click)="mobileOpen.set(false)"
              class="flex items-center gap-3 px-4 py-3.5 text-base font-medium hover:bg-sidebar-hover hover:text-white transition-colors relative"
            >
              <span class="w-6 text-center text-lg">{{ item.icon }}</span>
              @if (!sidebarIconOnly()) {
                <span>{{ item.label }}</span>
              }
              @if (item.path === '/chat' && chat.noLeidos() > 0) {
                <span
                  class="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
                  [class.absolute]="sidebarIconOnly()"
                  [class.top-2]="sidebarIconOnly()"
                  [class.right-2]="sidebarIconOnly()"
                  [class.ml-auto]="!sidebarIconOnly()"
                >
                  {{ chat.noLeidos() > 99 ? '99+' : chat.noLeidos() }}
                </span>
              }
            </a>
          }
          <button
            type="button"
            class="hidden md:block mt-auto mx-4 mb-1 text-sm text-slate-400 hover:text-white text-left"
            (click)="collapsed.set(!collapsed())"
          >
            {{ collapsed() ? '»' : '« Colapsar' }}
          </button>
        </aside>

        <main class="flex-1 min-w-0 bg-gray-100 overflow-auto p-4">
          <router-outlet />
        </main>
      </div>

      @if (guia(); as steps) {
        <app-tour [steps]="steps" (closed)="cerrarGuia()" />
      }
    </div>
  `,
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cadetes = inject(CadeteService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly pedidos = inject(PedidoService);
  readonly chat = inject(ChatService);
  readonly theme = inject(ThemeService);
  readonly ob = inject(OnboardingService);

  readonly guia = signal<TourStep[] | null>(null);
  private ruta = '';

  readonly nav = computed(() => NAV.filter((n) => !n.permisoRequerido || this.auth.tienePermiso(n.permisoRequerido)));
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly sidebarIconOnly = computed(() => this.collapsed() && !this.mobileOpen());

  readonly mostrarAlertas = signal(false);
  readonly alertasSesion = signal<AlertaSesion[]>([]);
  readonly smsFallidosCount = signal(0);
  readonly totalAlertas = computed(() => this.alertasSesion().length + this.smsFallidosCount());
  private seqAlerta = 0;

  /** Búsqueda global desde el header (ronda 10, punto 107) — antes había 3 buscadores separados y ciegos entre sí. */
  readonly busquedaGlobal = signal('');
  readonly cadetesEncontrados = computed(() => {
    const q = this.busquedaGlobal().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.cadetes
      .cadetes()
      .filter((c) => `${c.nombre} ${c.apellido} ${c.username}`.toLowerCase().includes(q))
      .slice(0, 5);
  });
  readonly pareceTelefono = computed(() => /^\d{6,}$/.test(this.busquedaGlobal().trim()));

  ngOnInit(): void {
    this.cadetes.ensureLoaded();
    this.chat.iniciar();
    this.cargarSmsFallidos();
    this.escucharAlertas();
    this.escucharCambiosDeRuta();
  }

  /** ruta actual sin query params ni barra inicial ('' = Dashboard) — misma clave que usa GUIAS. */
  private claveActual(): string {
    return this.router.url.split('?')[0].replace(/^\//, '');
  }

  private escucharCambiosDeRuta(): void {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      const k = this.claveActual();
      this.ruta = k;
      this.guia.set(null);
      // Primera visita a la pantalla: aparece la guía, una sola vez.
      if (GUIAS[k] && !guiaVista(k)) {
        setTimeout(() => {
          if (this.claveActual() === k) this.guia.set(GUIAS[k]);
        }, 700);
      }
    });
  }

  cerrarGuia(): void {
    marcarGuiaVista(this.ruta);
    this.guia.set(null);
  }

  /** Botón "?" del header: repite la guía de la pantalla actual; si no tiene, lleva a Primeros pasos. */
  abrirGuia(): void {
    const k = this.claveActual();
    this.ruta = k;
    if (GUIAS[k]) this.guia.set(GUIAS[k]);
    else this.router.navigateByUrl('/primeros-pasos');
  }

  /**
   * Avisos que no dependen de estar en la pantalla de Chat/Dashboard — corren acá
   * porque el shell está montado en toda la app autenticada (spec: "que salga una
   * ventana emergente avisando").
   */
  private escucharAlertas(): void {
    this.realtime.subscribe('/queue/admin/chat', (body) => {
      const msj = body as MensajeChatWs;
      if (msj.autor !== 'CADETE') return;
      this.reproducirBeep();
      this.toast.info(`💬 Nuevo mensaje de ${this.cadetes.nombreDe(msj.cadeteId)}`);
    });

    // Cualquier cambio de pedido puede afectar el conteo de SMS fallidos (ronda 4, punto 18).
    this.realtime.subscribe('/topic/admin/pedidos', () => this.cargarSmsFallidos());

    this.realtime.subscribe('/topic/admin/alertas', (body) => {
      const alerta = body as AlertaAdminWs;
      if (alerta.tipo === 'RECHAZO' && alerta.pedido) {
        const mensaje =
          `${alerta.cadeteNombre} ${alerta.cadeteApellido} rechazó el pedido ${alerta.pedido.numero} ` +
          `(origen: ${alerta.pedido.origenDireccion})`;
        this.toast.error(mensaje);
        this.agregarAlertaSesion(mensaje);
      } else if (alerta.tipo === 'INACTIVIDAD_SOSPECHOSA' && alerta.pedido) {
        const mensaje =
          `⚠️ ${alerta.cadeteNombre} ${alerta.cadeteApellido} no manda ubicación hace ${alerta.minutosSinUbicacion} ` +
          `min en el pedido ${alerta.pedido.numero} — puede que se haya quedado sin batería o abandonó el viaje.`;
        this.toast.error(mensaje);
        this.agregarAlertaSesion(mensaje);
      } else if (alerta.tipo === 'PEDIDO_NUEVO' && alerta.pedido) {
        this.reproducirBeep();
        this.toast.info(`🆕 Pedido nuevo Nº ${alerta.pedido.numero} sin asignar (${alerta.pedido.origenDireccion})`);
      } else if (alerta.tipo === 'SOLICITUD_PEDIDO_NUEVA') {
        this.reproducirBeep();
        const mensaje = `📩 ${alerta.clienteNombre} cargó un pedido desde /pedir (origen: ${alerta.origenDireccion}) — revisalo en "Pedidos web".`;
        this.toast.info(mensaje);
        this.agregarAlertaSesion(mensaje);
      } else if (alerta.tipo === 'WHATSAPP_CHIP_BANEADO') {
        const mensaje = `🚫 El chip de WhatsApp ${alerta.chipId} (${alerta.numero || 'sin número'}) fue baneado — revisalo en Configuración → "Gateway WhatsApp".`;
        this.toast.error(mensaje);
        this.agregarAlertaSesion(mensaje);
      } else if (alerta.tipo === 'API_KEY_POOL_AGOTADO' && alerta.proveedor) {
        const mensaje =
          `🚫 Se quedaron sin cupo todas las cuentas cargadas de ${this.nombreProveedor(alerta.proveedor)} — ` +
          `revisalo en Configuración y agregá una cuenta nueva.`;
        this.toast.error(mensaje);
        this.agregarAlertaSesion(mensaje);
      } else if (alerta.tipo === 'API_KEY_POOL_BAJO' && alerta.proveedor) {
        const mensaje =
          `⚠️ A la última cuenta con cupo de ${this.nombreProveedor(alerta.proveedor)} le quedan ${alerta.restante} ` +
          `consultas — conviene cargar otra cuenta antes de que se corte.`;
        this.toast.info(mensaje);
        this.agregarAlertaSesion(mensaje);
      } else if (alerta.tipo === 'SMS_GATEWAY_CAIDO') {
        const mensaje = '📵 El gateway de SMS no está respondiendo hace varios envíos seguidos — revisá que el celular/servicio esté funcionando.';
        this.toast.error(mensaje);
        this.agregarAlertaSesion(mensaje);
      }
    });
  }

  /** Mismos nombres que ConfiguracionComponent.nombreProveedor — para que la alerta y la tabla de Configuración digan lo mismo. */
  private nombreProveedor(proveedor: string): string {
    const nombres: Record<string, string> = {
      geoapify: 'Geoapify (direcciones)',
      graphhopper: 'GraphHopper (distancia)',
      openrouteservice: 'OpenRouteService (distancia)',
    };
    return nombres[proveedor] ?? proveedor;
  }

  private agregarAlertaSesion(mensaje: string): void {
    this.alertasSesion.update((lista) => [{ id: ++this.seqAlerta, mensaje, ts: Date.now() }, ...lista].slice(0, 30));
  }

  private cargarSmsFallidos(): void {
    this.pedidos.smsFallidos().subscribe((r) => this.smsFallidosCount.set(r.cantidad));
  }

  /** Beep corto vía Web Audio — no depende de ningún archivo de sonido (spec: aviso sonoro de pedido nuevo). */
  private reproducirBeep(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Autoplay bloqueado u otro error de audio — no es crítico, ya se ve el toast.
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  buscarPedidoGlobal(): void {
    const q = this.busquedaGlobal().trim();
    if (!q) return;
    this.router.navigate(['/'], { queryParams: { buscar: q } });
    this.busquedaGlobal.set('');
  }
}
