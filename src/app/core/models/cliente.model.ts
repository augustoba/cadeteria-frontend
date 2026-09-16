export interface Cliente {
  telefono: string;
  nombreContacto: string | null;
  empresa: string | null;
  tarifaEspecial: number | null;
  problematico: boolean;
  notasProblematico: string | null;
  activo: boolean;
  cantidadPedidos: number;
  montoTotal: number;
  ultimoPedidoEn: string | null;
  /** "CONTADO" | "CUENTA_CORRIENTE" (ronda 10, punto 100). */
  modalidadFacturacion: 'CONTADO' | 'CUENTA_CORRIENTE';
  /** Solo tiene sentido con modalidadFacturacion=CUENTA_CORRIENTE. */
  saldoPendiente: number;
}

export interface ClienteInput {
  nombreContacto: string | null;
  empresa: string | null;
  tarifaEspecial: number | null;
  problematico: boolean;
  notasProblematico: string | null;
  activo: boolean;
  modalidadFacturacion: 'CONTADO' | 'CUENTA_CORRIENTE';
}

export interface PedidoResumenCliente {
  id: string;
  numero: number;
  creadoEn: string;
  precio: number;
  estadoId: string;
}

export interface ClienteFicha {
  cliente: Cliente;
  pedidosRecientes: PedidoResumenCliente[];
}

/** Aviso rápido al cargar un pedido nuevo (ronda 4, puntos 44/58). */
export interface ClienteAviso {
  problematico: boolean;
  notasProblematico: string | null;
  tarifaEspecial: number | null;
}

/** Listado paginado (mejora 2026-09-16) — antes `/admin/clientes` devolvía un array plano sin paginar. */
export interface ClientesPagina {
  items: Cliente[];
  total: number;
  pagina: number;
  totalPaginas: number;
}
