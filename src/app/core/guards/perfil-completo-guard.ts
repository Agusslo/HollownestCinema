    import { inject } from '@angular/core';
    import { CanActivateFn, Router } from '@angular/router';
    import { Auth } from '../services/auth';

// A diferencia de rolGuard, éste no bloquea por falta de permiso — bloquea
// TODA navegación (menos a completar-perfil, login y registro) mientras el
// usuario logueado tenga perfil_completo en false. Se ejecuta en cada
// intento de navegación, así que también agarra el botón "atrás" del
// navegador o cualquier link del menú, no sólo la carga inicial.
    export const perfilCompletoGuard: CanActivateFn = async () => {
    const authService = inject(Auth);
    const router = inject(Router);

    const usuario = await authService.usuarioActual();

    if (usuario && !usuario.perfil_completo) {
        return router.parseUrl('/completar-perfil');
    }

    return true;
    };