import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../config/site-config';
import { AccesoLog } from '../models/acceso-log.model';

/** Registro de accesos (ronda 5, punto 50) y botón de emergencia (ronda 6, punto 64). */
@Injectable({ providedIn: 'root' })
export class SeguridadService {
  private readonly http = inject(HttpClient);

  accesos(cantidad = 200) {
    return this.http.get<AccesoLog[]>(apiUrl('/admin/seguridad/accesos'), { params: { cantidad } });
  }

  /** Invalida de una todos los tokens ya emitidos (admins y cadetes) — el propio admin también queda deslogueado. */
  cerrarTodasLasSesiones() {
    return this.http.post<{ sesionesInvalidadas: number }>(apiUrl('/admin/seguridad/cerrar-sesiones'), {});
  }
}
