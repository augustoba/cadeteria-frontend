export interface AdminUsuario {
  id: string;
  username: string;
  /** Id de un Rol (roles configurables, mejora 2026-09-16 — antes DUENO/OPERADOR fijo). */
  rol: string;
  enabled: boolean;
  createdAt: string;
}

export interface CrearAdminInput {
  username: string;
  rol: string;
}

export interface CrearAdminResponse {
  admin: AdminUsuario;
  passwordTemporal: string;
}
