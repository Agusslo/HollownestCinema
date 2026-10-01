import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

// El inverso de sesionGuard: login y registro son sólo para quien todavía
// NO inició sesión. Si ya hay un usuario logueado y escribe /login a mano
// (o vuelve con el botón "atrás"), lo mandamos a la cartelera.
export const invitadoGuard: CanActivateFn = async () => {
  const authService = inject(Auth);
  const router = inject(Router);

  const usuario = await authService.usuarioActual();
  return usuario ? router.parseUrl('/') : true;
};
