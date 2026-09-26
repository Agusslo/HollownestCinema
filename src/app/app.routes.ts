import { Routes } from '@angular/router';
import { rolGuard } from './core/guards/rol-guard';
import { perfilCompletoGuard } from './core/guards/perfil-completo-guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [perfilCompletoGuard],
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'admin/peliculas/nueva',
    canActivate: [perfilCompletoGuard, rolGuard(['admin'])],
    loadComponent: () =>
      import('./features/admin/alta-pelicula/alta-pelicula').then((m) => m.AltaPelicula),
  },
  {
    path: 'admin/funciones/nueva',
    canActivate: [perfilCompletoGuard, rolGuard(['admin'])],
    loadComponent: () =>
      import('./features/admin/alta-funcion/alta-funcion').then((m) => m.AltaFuncion),
  },
  {
    path: 'admin/cupones',
    canActivate: [perfilCompletoGuard, rolGuard(['admin'])],
    loadComponent: () => import('./features/admin/cupones/cupones').then((m) => m.Cupones),
  },
  {
    path: 'admin/candy/nuevo',
    canActivate: [perfilCompletoGuard, rolGuard(['admin'])],
    loadComponent: () => import('./features/admin/alta-candy/alta-candy').then((m) => m.AltaCandy),
  },
  {
    path: 'admin/combos/nuevo',
    canActivate: [perfilCompletoGuard, rolGuard(['admin'])],
    loadComponent: () => import('./features/admin/alta-combo/alta-combo').then((m) => m.AltaCombo),
  },
  {
    path: 'admin/log-actividad',
    canActivate: [perfilCompletoGuard, rolGuard(['admin'])],
    loadComponent: () =>
      import('./features/admin/log-actividad/log-actividad').then((m) => m.LogActividad),
  },
  {
    path: 'empleado/validar',
    canActivate: [perfilCompletoGuard, rolGuard(['empleado', 'admin'])],
    loadComponent: () => import('./features/empleado/validar/validar').then((m) => m.Validar),
  },
  {
    path: 'peliculas/:nombre',
    canActivate: [perfilCompletoGuard],
    loadComponent: () => import('./features/peliculas/detalle/detalle').then((m) => m.Detalle),
  },
  {
    path: 'pelicula/:nombre/butacas/:funcion',
    canActivate: [perfilCompletoGuard],
    loadComponent: () => import('./features/funciones/butacas/butacas').then((m) => m.Butacas),
  },
  {
    path: 'pelicula/:nombre/butacas',
    canActivate: [perfilCompletoGuard],
    loadComponent: () => import('./features/funciones/butacas/butacas').then((m) => m.Butacas),
  },
  {
    path: 'peliculas/:nombre/butacas/:funcion',
    canActivate: [perfilCompletoGuard],
    loadComponent: () => import('./features/funciones/butacas/butacas').then((m) => m.Butacas),
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/auth/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'completar-perfil',
    loadComponent: () =>
      import('./features/auth/completar-perfil/completar-perfil').then((m) => m.CompletarPerfil),
  },
    {
    path: 'mis-compras',
    canActivate: [perfilCompletoGuard],
    loadComponent: () =>
      import('./features/perfil/mis-compras/mis-compras').then((m) => m.MisCompras),
  },
  {
    path: 'mis-puntos',
    canActivate: [perfilCompletoGuard],
    loadComponent: () =>
      import('./features/perfil/mis-puntos/mis-puntos').then((m) => m.MisPuntos),
  },
];