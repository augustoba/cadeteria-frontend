import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';

/**
 * Resultado de pedir el código (spec-antiabuso Fase 2): CODIGO_WHATSAPP / CODIGO_SMS = hay que
 * cargar el código; YA_VALIDADO / SIN_VERIFICAR = viene `token` listo para enviar el pedido.
 */
export interface EnviarCodigoResponse {
  resultado: 'CODIGO_WHATSAPP' | 'CODIGO_SMS' | 'YA_VALIDADO' | 'SIN_VERIFICAR';
  token: string | null;
}

/** Confirma el teléfono de quien carga un pedido en "/pedir" sin login (mejora 2026-09-17). */
@Injectable({ providedIn: 'root' })
export class VerificacionTelefonoService {
  private readonly http = inject(HttpClient);

  enviarCodigo(telefono: string) {
    return this.http.post<EnviarCodigoResponse>(apiUrl('/publico/verificacion-telefono/enviar'), { telefono });
  }

  verificarCodigo(telefono: string, codigo: string) {
    return this.http.post<{ token: string }>(apiUrl('/publico/verificacion-telefono/verificar'), { telefono, codigo });
  }
}
