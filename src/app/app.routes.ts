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
  path: 'admin/cupones',
  loadComponent: () => import('./features/admin/cupones/cupones').then((m) => m.Cupones),
  },
  {
  path: 'admin/candy/nuevo',
  loadComponent: () => import('./features/admin/alta-candy/alta-candy').then((m) => m.AltaCandy),
},
  {
    path: 'peliculas/:nombre',
    loadComponent: () => import('./features/peliculas/detalle/detalle').then((m) => m.Detalle),
  },
  {
    path: 'pelicula/:nombre/butacas',
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
];
