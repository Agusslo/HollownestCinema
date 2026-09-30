    import { Service, signal } from '@angular/core';
    import IToast, { TipoToast } from '../interfaces/toast';

    // Cuánto tiempo queda un toast en pantalla si no se aclara otra cosa.
    const DURACION_POR_DEFECTO = 4000; // 4 segundos

    // Opciones que se pueden pasar al mostrar un toast. duracion: 0 = no se
    // va solo, queda hasta que el usuario lo cierre con la ×.
    interface IOpcionesToast {
    duracion?: number;
    enlace?: { texto: string; ruta: string };
    }

    // Basado en el toast genérico que armó un compañero que ya cursó la
    // materia, adaptado a las convenciones del proyecto (@Service, carpetas
    // core/services y core/interfaces, nombres en castellano).
    //
    // Idea general: el service guarda la LISTA de toasts visibles en un signal.
    // Cualquier pantalla puede agregar uno (toasts.exito(...)), y el componente
    // <app-toast>, que está una sola vez en app.html, recorre esa lista y los
    // dibuja. Como es un signal, cuando la lista cambia la pantalla se
    // actualiza sola.
    @Service()
    export class Toasts {
    // El signal "de verdad" es privado: sólo este service lo puede modificar.
    private lista = signal<IToast[]>([]);

    // Hacia afuera exponemos una versión de sólo lectura: el componente
    // puede leer toasts(), pero no puede hacer toasts.set(...) por su
    // cuenta. Así la única forma de agregar o sacar toasts es a través de
    // los métodos de acá abajo.
    readonly toasts = this.lista.asReadonly();

    exito(titulo: string, mensaje: string, opciones?: IOpcionesToast): void {
        this.mostrar('exito', titulo, mensaje, opciones);
    }

    error(titulo: string, mensaje: string, opciones?: IOpcionesToast): void {
        this.mostrar('error', titulo, mensaje, opciones);
    }

    advertencia(titulo: string, mensaje: string, opciones?: IOpcionesToast): void {
        this.mostrar('advertencia', titulo, mensaje, opciones);
    }

    info(titulo: string, mensaje: string, opciones?: IOpcionesToast): void {
        this.mostrar('info', titulo, mensaje, opciones);
    }

    cerrar(id: string): void {
        this.lista.update((actuales) => actuales.filter((toast) => toast.id !== id));
    }

    private mostrar(
        tipo: TipoToast,
        titulo: string,
        mensaje: string,
        opciones: IOpcionesToast = {},
    ): void {
        // crypto.randomUUID() genera un id único, el mismo que ya usás en
        // Ordenes.crear() para el código QR.
        const id = crypto.randomUUID();
        const duracion = opciones.duracion ?? DURACION_POR_DEFECTO;

        // update() recibe la lista actual y devuelve una NUEVA con el toast
        // agregado al final (no se modifica el array original: así el signal
        // detecta el cambio).
        this.lista.update((actuales) => [
        ...actuales,
        { id, tipo, titulo, mensaje, enlace: opciones.enlace },
        ]);

        // Si tiene duración, se programa su cierre. Si el usuario ya lo cerró
        // antes con la ×, cerrar() no encuentra ese id y no pasa nada.
        if (duracion > 0) {
        setTimeout(() => this.cerrar(id), duracion);
        }
    }
    }