import { Cadete } from '../../core/models/cadete.model';

export type FiltroEstado = 'TODOS' | 'LIBRE' | 'OCUPADO';
export type FiltroVehiculo = 'TODOS' | 'MOTO' | 'BICI';

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function tieneUbicacion(c: Cadete): boolean {
  return c.lat != null && c.lng != null;
}

/** Desconectados y otros vehículos solo se ven con el grupo en Todos. */
export function pasaFiltros(c: Cadete, estado: FiltroEstado, vehiculo: FiltroVehiculo): boolean {
  return (estado === 'TODOS' || c.estado.id === estado) && (vehiculo === 'TODOS' || c.tipoVehiculo.id === vehiculo);
}

/** Activos ordenados por apellido; busca por "apellido nombre" o "nombre apellido", sin mayúsculas ni tildes. */
export function buscarCadetes(cadetes: Cadete[], texto: string): Cadete[] {
  const buscado = normalizar(texto);
  return cadetes
    .filter((c) => c.activo)
    .filter(
      (c) =>
        normalizar(`${c.apellido} ${c.nombre}`).includes(buscado) ||
        normalizar(`${c.nombre} ${c.apellido}`).includes(buscado),
    )
    .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'));
}
