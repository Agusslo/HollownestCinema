import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'admin/peliculas/nueva',
    loadComponent: () =>
      import('./features/admin/alta-pelicula/alta-pelicula').then((m) => m.AltaPelicula),
  },
  {
    path: 'admin/funciones/nueva',
    loadComponent: () =>
      import('./features/admin/alta-funcion/alta-funcion').then((m) => m.AltaFuncion),
  },
  {
    path: 'peliculas/:nombre',
    loadComponent: () => import('./features/peliculas/detalle/detalle').then((m) => m.Detalle),
  },
  {
    path: 'pelicula/:nombre/butacas',
    loadComponent: () => import('./features/funciones/butacas/butacas').then((m) => m.Butacas),
  },
];
