/** Roles con permisos configurables (mejora 2026-09-16 — reemplaza el DUEÑO/OPERADOR fijo de antes). */

export interface Permiso {
  id: string;
  nombre: string;
  categoria: string | null;
}

export interface Rol {
  id: string;
  nombre: string;
  esSistema: boolean;
  permisos: Permiso[];
}

export interface RolInput {
  nombre: string;
  permisos: string[];
}
