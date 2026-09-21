import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { CadeteService } from './cadete.service';
import { ZonaService } from './zona.service';
import { PedidoService } from './pedido.service';
import { ConfiguracionService } from './configuracion.service';

export interface Tarea {
  id: string;
  esencial: boolean;
  icon: string;
  titulo: string;
  desc: string;
  cta: string;
  link: string;
  hecha: boolean;
}

/**
 * Avance de la puesta en marcha de la cadetería: alimenta "Primeros pasos" y la píldora
 * "Configuración X%" del header. Cada tarea se marca sola contra datos reales — no hay
 * ningún estado propio para "hecha", así que nunca puede quedar desincronizada.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly auth = inject(AuthService);
  private readonly cadetesSvc = inject(CadeteService);
  private readonly zonasSvc = inject(ZonaService);
  private readonly pedidosSvc = inject(PedidoService);
  private readonly config = inject(ConfiguracionService);

  constructor() {
    // Se piden una vez al arrancar la sesión para que el % sea correcto ya en el Dashboard,
    // sin depender de que el admin haya visitado antes /cadetes o /zonas.
    this.cadetesSvc.reload();
    this.zonasSvc.reload();
    this.config.ensureLoaded();
  }

  readonly tareas = computed<Tarea[]>(() => {
    const v = this.config.valores();
    const datosCadeteria = !!(v['nombre_cadeteria']?.trim() || v['telefono_soporte']?.trim());
    const todas: Tarea[] = [
      {
        id: 'cadete',
        esencial: true,
        icon: '🏍️',
        titulo: 'Cargá tu primer cadete',
        desc: 'Alta manual, o generá un link para que se autoregistre él mismo.',
        cta: 'Ir a Cadetes',
        link: '/cadetes',
        hecha: this.cadetesSvc.cadetes().length > 0,
      },
      {
        id: 'zona',
        esencial: true,
        icon: '📍',
        titulo: 'Cargá tu primera Zona',
        desc: 'Sirve para sugerir precio y para decidir a qué cadetes ofrecerles un pedido primero.',
        cta: 'Ir a Zonas',
        link: '/zonas',
        hecha: this.zonasSvc.zonas().length > 0,
      },
      {
        id: 'pedido',
        esencial: false,
        icon: '📦',
        titulo: 'Cargá tu primer pedido',
        desc: 'Probá el flujo completo: cargarlo, asignarlo y verlo en el Dashboard.',
        cta: 'Cargar pedido',
        link: '/pedidos/nuevo',
        hecha: this.pedidosSvc.pedidos().length > 0,
      },
      {
        id: 'marca',
        esencial: false,
        icon: '🏬',
        titulo: 'Completá los datos de tu cadetería',
        desc: 'Nombre y teléfono de soporte — se ven en el SMS de seguimiento y en la app del cadete.',
        cta: 'Ir a Configuración',
        link: '/configuracion',
        hecha: datosCadeteria,
      },
    ];
    // Un Operador no tiene acceso a Configuración — no tiene sentido pedirle esa tarea.
    return todas.filter((t) => t.id !== 'marca' || this.auth.tienePermiso('configuracion'));
  });

  readonly esenciales = computed(() => this.tareas().filter((t) => t.esencial));
  readonly esencialesHechas = computed(() => this.esenciales().filter((t) => t.hecha).length);
  readonly hechas = computed(() => this.tareas().filter((t) => t.hecha).length);
  readonly porcentaje = computed(() => (this.tareas().length ? Math.round((this.hechas() / this.tareas().length) * 100) : 100));
}
