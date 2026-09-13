import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { NuevoPedidoComponent } from './features/pedidos/nuevo-pedido.component';
import { CadetesComponent } from './features/cadetes/cadetes.component';
import { CadeteFormComponent } from './features/cadetes/cadete-form.component';
import { ZonasComponent } from './features/zonas/zonas.component';
import { ZonaFormComponent } from './features/zonas/zona-form.component';
import { PagosComponent } from './features/pagos/pagos.component';
import { ChatComponent } from './features/chat/chat.component';
import { MapaComponent } from './features/mapa/mapa.component';
import { ConfiguracionComponent } from './features/configuracion/configuracion.component';
import { MetricasComponent } from './features/metricas/metricas.component';
import { SeguimientoComponent } from './features/seguimiento/seguimiento.component';
import { ClientesComponent } from './features/clientes/clientes.component';
import { ClienteFichaComponent } from './features/clientes/cliente-ficha.component';
import { IncidenciasComponent } from './features/incidencias/incidencias.component';
import { HojaRutaComponent } from './features/hoja-ruta/hoja-ruta.component';
import { RegistroCadeteComponent } from './features/registro-cadete/registro-cadete.component';
import { SolicitudesCadeteComponent } from './features/registro-cadete/solicitudes-cadete.component';
import { PedirComponent } from './features/pedir/pedir.component';
import { ConfirmarPedidoComponent } from './features/pedir/confirmar-pedido.component';
import { SolicitudesPedidoComponent } from './features/pedir/solicitudes-pedido.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'seguimiento/:token', component: SeguimientoComponent },
  { path: 'registro-cadete/:token', component: RegistroCadeteComponent },
  { path: 'pedir', component: PedirComponent },
  { path: 'confirmar-pedido/:token', component: ConfirmarPedidoComponent },
  { path: 'hoja-ruta/:cadeteId', component: HojaRutaComponent, canActivate: [authGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardComponent },
      { path: 'pedidos/nuevo', component: NuevoPedidoComponent },
      { path: 'mapa', component: MapaComponent },
      { path: 'cadetes', component: CadetesComponent },
      { path: 'cadetes/nuevo', component: CadeteFormComponent },
      { path: 'cadetes/solicitudes', component: SolicitudesCadeteComponent },
      { path: 'solicitudes-pedido', component: SolicitudesPedidoComponent },
      { path: 'cadetes/:id', component: CadeteFormComponent },
      { path: 'zonas', component: ZonasComponent },
      { path: 'zonas/nueva', component: ZonaFormComponent },
      { path: 'zonas/:id', component: ZonaFormComponent },
      { path: 'clientes', component: ClientesComponent },
      { path: 'clientes/:telefono', component: ClienteFichaComponent },
      { path: 'pagos', component: PagosComponent },
      { path: 'chat', component: ChatComponent },
      { path: 'incidencias', component: IncidenciasComponent },
      { path: 'configuracion', component: ConfiguracionComponent },
      { path: 'metricas', component: MetricasComponent },
      { path: '**', redirectTo: '' },
    ],
  },
];
