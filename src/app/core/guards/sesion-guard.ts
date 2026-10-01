import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

// Para las pantallas que son "de alguien" (Mis compras, Mis puntos, Mis
// películas): sin sesión iniciada no hay nada que mostrar, así que manda
// al login. No mira el rol — para eso está rolGuard.
export const sesionGuard: CanActivateFn = async () => {
  const authService = inject(Auth);
  const router = inject(Router);

  const usuario = await authService.usuarioActual();
  return usuario ? true : router.parseUrl('/login');
};
