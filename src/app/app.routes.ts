import { Routes } from '@angular/router';
import { authGuard, permisoGuard } from './core/guards/auth.guard';
import { ShellComponent } from './layout/shell.component';

/**
 * Lazy-loading por ruta (mejora 2026-09-16) — antes cada pantalla se importaba directo
 * acá arriba, así que TODO terminaba en el bundle inicial (991KB contra un budget de
 * 500KB, según el propio warning de `ng build`) aunque el admin nunca abriera, por
 * ejemplo, "Mapa" (que carga Leaflet + clustering + heatmap, bastante peso). Cada
 * `loadComponent` pasa a ser su propio chunk, descargado recién cuando se navega ahí.
 */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent) },
  {
    path: 'seguimiento/:token',
    loadComponent: () => import('./features/seguimiento/seguimiento.component').then((m) => m.SeguimientoComponent),
  },
  {
    path: 'registro-cadete/:token',
    loadComponent: () =>
      import('./features/registro-cadete/registro-cadete.component').then((m) => m.RegistroCadeteComponent),
  },
  { path: 'pedir', loadComponent: () => import('./features/pedir/pedir.component').then((m) => m.PedirComponent) },
  {
    path: 'confirmar-pedido/:token',
    loadComponent: () => import('./features/pedir/confirmar-pedido.component').then((m) => m.ConfirmarPedidoComponent),
  },
  {
    path: 'hoja-ruta/:cadeteId',
    loadComponent: () => import('./features/hoja-ruta/hoja-ruta.component').then((m) => m.HojaRutaComponent),
    canActivate: [authGuard],
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      {
        path: 'pedidos/nuevo',
        loadComponent: () => import('./features/pedidos/nuevo-pedido.component').then((m) => m.NuevoPedidoComponent),
      },
      { path: 'mapa', loadComponent: () => import('./features/mapa/mapa.component').then((m) => m.MapaComponent) },
      { path: 'cadetes', loadComponent: () => import('./features/cadetes/cadetes.component').then((m) => m.CadetesComponent) },
      {
        path: 'cadetes/nuevo',
        loadComponent: () => import('./features/cadetes/cadete-form.component').then((m) => m.CadeteFormComponent),
      },
      {
        path: 'cadetes/solicitudes',
        loadComponent: () =>
          import('./features/registro-cadete/solicitudes-cadete.component').then((m) => m.SolicitudesCadeteComponent),
      },
      {
        path: 'solicitudes-pedido',
        loadComponent: () => import('./features/pedir/solicitudes-pedido.component').then((m) => m.SolicitudesPedidoComponent),
      },
      {
        path: 'cadetes/:id',
        loadComponent: () => import('./features/cadetes/cadete-form.component').then((m) => m.CadeteFormComponent),
      },
      {
        path: 'cadetes/:id/ficha',
        loadComponent: () => import('./features/cadetes/cadete-ficha.component').then((m) => m.CadeteFichaComponent),
      },
      { path: 'zonas', loadComponent: () => import('./features/zonas/zonas.component').then((m) => m.ZonasComponent) },
      {
        path: 'zonas/nueva',
        loadComponent: () => import('./features/zonas/zona-form.component').then((m) => m.ZonaFormComponent),
      },
      {
        path: 'zonas/:id',
        loadComponent: () => import('./features/zonas/zona-form.component').then((m) => m.ZonaFormComponent),
      },
      { path: 'clientes', loadComponent: () => import('./features/clientes/clientes.component').then((m) => m.ClientesComponent) },
      {
        path: 'clientes/:telefono',
        loadComponent: () => import('./features/clientes/cliente-ficha.component').then((m) => m.ClienteFichaComponent),
      },
      {
        path: 'pagos',
        loadComponent: () => import('./features/pagos/pagos.component').then((m) => m.PagosComponent),
        canActivate: [permisoGuard('pagos')],
      },
      { path: 'chat', loadComponent: () => import('./features/chat/chat.component').then((m) => m.ChatComponent) },
      {
        path: 'whatsapp',
        loadComponent: () => import('./features/whatsapp/whatsapp.component').then((m) => m.WhatsappComponent),
        canActivate: [permisoGuard('whatsapp')],
      },
      {
        path: 'incidencias',
        loadComponent: () => import('./features/incidencias/incidencias.component').then((m) => m.IncidenciasComponent),
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./features/configuracion/configuracion.component').then((m) => m.ConfiguracionComponent),
        canActivate: [permisoGuard('configuracion')],
      },
      {
        path: 'metricas',
        loadComponent: () => import('./features/metricas/metricas.component').then((m) => m.MetricasComponent),
        canActivate: [permisoGuard('metricas')],
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
        canActivate: [permisoGuard('usuarios')],
      },
      {
        path: 'roles',
        loadComponent: () => import('./features/roles/roles.component').then((m) => m.RolesComponent),
        canActivate: [permisoGuard('roles')],
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
