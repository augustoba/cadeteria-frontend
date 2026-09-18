/** Gateway propio de WhatsApp (Baileys + chips descartables, ver memoria del proyecto). */

export interface WhatsappChip {
  id: string;
  numero: string | null;
  estado: 'VINCULANDO' | 'CONECTADO' | 'DESCONECTADO' | 'BANEADO' | 'BAJA';
  pairingCodigo: string | null;
  ultimoCambioEstado: string | null;
  /** Últimas 24hs — para detectar "shadowban" (WhatsApp deja de entregar en silencio, sin desconectar el chip). */
  mensajesUltimas24h: number;
  entregadosUltimas24h: number;
}

export interface WhatsappMensaje {
  id: string;
  pedidoId: string | null;
  telefono: string;
  texto: string;
  estado: 'PENDIENTE' | 'ENVIADO' | 'FALLIDO';
  chipUsado: string | null;
  error: string | null;
  creadoEn: string;
  enviadoEn: string | null;
  entregadoEn: string | null;
  leidoEn: string | null;
}

export interface WhatsappRespuesta {
  id: string;
  telefono: string;
  chipId: string | null;
  texto: string;
  recibidoEn: string;
}

export interface WhatsappEstadoGateway {
  conectado: boolean;
  ultimoCambio: string | null;
}

export interface WhatsappMensajesPagina {
  items: WhatsappMensaje[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface WhatsappRespuestasPagina {
  items: WhatsappRespuesta[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

/** Filtro común a las pestañas Mensajes y Respuestas — desde/hasta son yyyy-MM-dd (input type=date). */
export interface WhatsappFiltro {
  telefono: string;
  desde: string;
  hasta: string;
  pagina: number;
}
