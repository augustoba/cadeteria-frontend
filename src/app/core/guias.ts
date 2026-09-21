import { TourStep } from '../shared/tour.component';

/**
 * Guía de la primera visita a cada pantalla del menú (la ruta es la clave, '' = Dashboard).
 * Se muestra una sola vez y se puede repetir con el botón "?" del header o desde "Primeros
 * pasos". Los selectores son de clases reales del propio componente — si el elemento no
 * está en pantalla (ej. lista vacía), el paso se muestra centrado.
 */
export const GUIAS: Record<string, TourStep[]> = {
  '': [
    { titulo: 'Tu Dashboard', texto: 'Todos los pedidos activos, en tiempo real — se actualiza solo apenas pasa algo, no hace falta recargar.' },
    { titulo: 'Buscador', texto: 'Filtrá por número de pedido, cliente o teléfono al toque.', selector: 'input[placeholder*="Buscar por número"]' },
    { titulo: 'Lista o Kanban', texto: 'Elegí cómo mirar los pedidos: tabla con todo el detalle, o columnas por estado.', selector: '.view-toggle, [class*="Lista"]' },
    { titulo: 'El menú "⋯" de cada pedido', texto: 'Ahí adentro están Detalle, Imprimir, Reasignar, Quitar cadete, Crear incidencia y Anular.', selector: '.kebab' },
  ],
  cadetes: [
    { titulo: 'Tus cadetes', texto: 'Alta manual o por link de autoregistro, ficha completa de cada uno, y el botón "Asignar viaje" para los que están libres.' },
    { titulo: 'Ficha de cadete', texto: 'Tocá el nombre para ver su historial completo: viajes, calificación, incidencias y estadísticas.' },
  ],
  zonas: [
    { titulo: 'Zonas', texto: 'Dibujá áreas sobre el mapa (círculo o polígono libre) para sugerir un precio fijo y priorizar a qué cadetes ofrecerles un pedido primero.' },
  ],
  clientes: [
    { titulo: 'Clientes', texto: 'Se arma solo con los teléfonos que ya pidieron. Podés cargarle nombre, tarifa especial, y marcarlo si es un cliente problemático.' },
  ],
  'pagos': [
    { titulo: 'Pagos', texto: 'Cada cadete cobra Semanal (cuota fija) o Porcentaje (crédito + comisión por viaje) — elegido en su ficha.' },
    { titulo: 'Elegí un cadete', texto: 'De la lista de la izquierda, para cargarle el pago semanal o acreditarle crédito.', selector: 'aside' },
  ],
  chat: [
    { titulo: 'Chat con cadetes', texto: 'Un chat interno (no WhatsApp) para coordinar algo puntual de un viaje con cada cadete — texto y notas de voz.' },
  ],
  incidencias: [
    { titulo: 'Incidencias', texto: 'Tickets para lo que no es un pedido puntual, o ligados a uno específico desde su detalle. Se abren y se cierran.' },
  ],
  metricas: [
    { titulo: 'Métricas', texto: 'Gráficos de pedidos por hora y por zona, ranking de cadetes, y la comparación contra el período anterior.' },
    { titulo: 'Ficha individual', texto: 'Elegí un cadete del ranking para ver su historial completo de rendimiento.' },
  ],
  configuracion: [
    { titulo: 'Configuración', texto: 'Todos los parámetros del sistema, ordenados por tema. Cada campo tiene su propia ayuda debajo explicando qué hace.' },
    { titulo: 'Pestañas por tema', texto: 'Pedidos, Cadetes, Integraciones, Marca, Sistema, y "Gateway WhatsApp" que te lleva a su propia pantalla.', selector: '.config-tabs' },
  ],
  whatsapp: [
    { titulo: 'Gateway de WhatsApp', texto: 'Manda los WhatsApp automáticos con chips descartables en vez de la API paga de Meta.' },
    { titulo: 'Cargar un chip', texto: '"+ Cargar chip nuevo" y seguís los pasos para vincular un WhatsApp real desde otro celular.' },
  ],
  usuarios: [
    { titulo: 'Usuarios', texto: 'Cuentas de acceso al panel. Un Operador hace el día a día pero no puede tocar Configuración, Métricas ni Pagos.' },
  ],
  roles: [
    { titulo: 'Roles', texto: 'Qué puede ver y hacer cada tipo de cuenta — se lo asignás a cada usuario desde "Usuarios".' },
  ],
  'solicitudes-pedido': [
    { titulo: 'Pedidos web', texto: 'Los pedidos que un cliente cargó solo desde "/pedir", tu página pública, sin que vos lo hicieras a mano.' },
  ],
};

const prefijo = 'cadeteria-guia-';

export const guiaVista = (ruta: string): boolean => {
  try {
    return localStorage.getItem(prefijo + ruta) === '1';
  } catch {
    return true;
  }
};

export const marcarGuiaVista = (ruta: string): void => {
  try {
    localStorage.setItem(prefijo + ruta, '1');
  } catch {
    /* sin storage */
  }
};

/** "Ver de nuevo las guías": borra las marcas de visto. */
export const reiniciarGuias = (): void => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefijo))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* sin storage */
  }
};
