export interface AdminUsuario {
  id: string;
  username: string;
  rol: 'DUENO' | 'OPERADOR';
  enabled: boolean;
  createdAt: string;
}

export interface CrearAdminInput {
  username: string;
  rol: 'DUENO' | 'OPERADOR';
}

export interface CrearAdminResponse {
  admin: AdminUsuario;
  passwordTemporal: string;
}
