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
];