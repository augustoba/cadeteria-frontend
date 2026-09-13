/**
 * Configuracion del front que no puede venir del backend (hace falta saber a
 * donde llamar antes de poder pedirle nada). El resto de los parametros
 * (tiempo limite de aceptacion, Cloudinary, etc.) se edita desde el panel y
 * vive en el backend — ver ConfiguracionService.
 */
export const SITE_CONFIG = {
  /** Vacio = usa el proxy del dev-server (ng serve --proxy-config proxy.conf.json). */
  apiBaseUrl: '',
  wsBaseUrl: '',
};

/** apiUrl('/pedidos') -> '/api/pedidos' */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_CONFIG.apiBaseUrl}/api${p}`;
}

export function wsUrl(): string {
  return `${SITE_CONFIG.wsBaseUrl}/ws`;
}
