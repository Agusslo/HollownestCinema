    import { Service, inject, signal } from '@angular/core';
    import { Supabase } from './supabase';

    const CLAVE = 'hk-modo-invitado';

    // Comprar sin cuenta ("pueden comprar siendo anónimos") es una opción que
    // el usuario ELIGE: entrar a la página sin iniciar sesión no lo convierte
    // en invitado. Recién cuando toca "Continuar como invitado" (en el login o
    // en la pantalla de butacas) se activa este modo.
    //
    // Se guarda en sessionStorage: dura mientras la pestaña esté abierta (si
    // recarga la página no le volvemos a preguntar) y se olvida al cerrarla.
    @Service()
    export class ModoInvitado {
    private supabase = inject(Supabase);

    private estado = signal(this.leer());
    // Sólo lectura para el resto de la app: para cambiarlo están activar()
    // y desactivar() (mismo patrón que la lista del service de Toasts).
    readonly activo = this.estado.asReadonly();

    constructor() {
        // Si inicia sesión (con mail o con Google), deja de ser invitado. Así,
        // si después cierra sesión, se le vuelve a preguntar cómo quiere comprar.
        this.supabase.Supabase.auth.onAuthStateChange((_evento, sesion) => {
        if (sesion) this.desactivar();
        });
    }

    activar() {
        this.estado.set(true);
        this.guardar(true);
    }

    desactivar() {
        this.estado.set(false);
        this.guardar(false);
    }

    // try/catch: en una ventana privada o con el almacenamiento bloqueado,
    // sessionStorage puede tirar error. En ese caso el modo funciona igual,
    // sólo que no sobrevive a una recarga.
    private leer(): boolean {
        try {
        return sessionStorage.getItem(CLAVE) === 'si';
        } catch {
        return false;
        }
    }

    private guardar(activo: boolean) {
        try {
        if (activo) {
            sessionStorage.setItem(CLAVE, 'si');
        } else {
            sessionStorage.removeItem(CLAVE);
        }
        } catch {
        // Sin almacenamiento: queda sólo en memoria (el signal).
        }
    }
    }