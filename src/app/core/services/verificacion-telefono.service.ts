import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';

/** Confirma el teléfono de quien carga un pedido en "/pedir" sin login (mejora 2026-09-17). */
@Injectable({ providedIn: 'root' })
export class VerificacionTelefonoService {
  private readonly http = inject(HttpClient);

  enviarCodigo(telefono: string) {
    return this.http.post<void>(apiUrl('/publico/verificacion-telefono/enviar'), { telefono });
  }

  verificarCodigo(telefono: string, codigo: string) {
    return this.http.post<{ token: string }>(apiUrl('/publico/verificacion-telefono/verificar'), { telefono, codigo });
  }
}
