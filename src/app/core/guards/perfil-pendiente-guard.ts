import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

// Para /completar-perfil: esa pantalla sólo tiene sentido para quien
// inició sesión (con Google) y todavía tiene datos de relleno. Sin sesión
// va al login; con el perfil ya completo, a la cartelera. Es el
// complemento de perfilCompletoGuard, que manda HACIA esa pantalla.
export const perfilPendienteGuard: CanActivateFn = async () => {
  const authService = inject(Auth);
  const router = inject(Router);

  const usuario = await authService.usuarioActual();

  if (!usuario) {
    return router.parseUrl('/login');
  }
  if (usuario.perfil_completo) {
    return router.parseUrl('/');
  }

  return true;
};
