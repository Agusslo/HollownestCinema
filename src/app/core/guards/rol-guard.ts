import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { Rol } from '../interfaces/perfil';

// Guard "fábrica": se le pasan los roles permitidos y devuelve el guard ya armado.
// Así se puede reusar tanto para rutas de admin como de empleado.
export function rolGuard(rolesPermitidos: Rol[]): CanActivateFn {
    return async () => {
    const authService = inject(Auth);
    const router = inject(Router);

    const usuario = await authService.usuarioActual();

    if (!usuario) {
      // No hay sesión iniciada
        return router.parseUrl('/login');
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      // Está logueado pero no tiene el rol que la ruta pide
        return router.parseUrl('/');
    }

    return true;
};
}