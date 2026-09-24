import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';

export interface Salud {
  dbOk: boolean;
  smsGatewayConfigurado: boolean;
  pushConfigurado: boolean;
  emailConfigurado: boolean;
  webPushConfigurado: boolean;
  geocodingOk: boolean;
  whatsappGatewayConectado: boolean;
  /** WHATSAPP_MODO_SIMULADO prendido: los códigos de /pedir no salen de verdad (solo desarrollo). */
  whatsappModoSimulado: boolean;
  smsFallidosPendientes: number;
  pedidosActivos: number;
  ultimoPedidoCreadoEn: string | null;
  consultadoEn: string;
}

/** Panel de salud del sistema (mejora 48). */
@Injectable({ providedIn: 'root' })
export class SaludService {
  private readonly http = inject(HttpClient);

  obtener() {
    return this.http.get<Salud>(apiUrl('/admin/salud'));
  }
}
