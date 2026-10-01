    import { Service, inject } from '@angular/core';
    import { SwPush } from '@angular/service-worker';
    import { Supabase } from './supabase';
    import { environment } from '../../../environments/environment';

    // Notificaciones push (mismo esquema que la clase de notificaciones): el
    // navegador del usuario se suscribe con SwPush y la suscripción se guarda
    // en la tabla push_subscriptions. Después, cuando el admin abre la venta de
    // una película, la Edge Function "avisar-preventa" de Supabase le manda la
    // notificación a esa suscripción, aunque la app esté cerrada.
    @Service()
    export class Notificaciones {
    private swPush = inject(SwPush);
    private supabase = inject(Supabase);

    // Pide permiso para mandar notificaciones y guarda la suscripción.
    // Devuelve true si quedó suscripto. Nunca tira error: si no se puede, el
    // usuario igual recibe el aviso dentro de la app (el toast al entrar).
    async suscribir(usuario_id: string): Promise<boolean> {
        // SwPush necesita el service worker, que sólo está activo en el build
        // de producción (Vercel), no en ng serve. Algunos navegadores (Safari
        // en iPhone fuera de la app instalada) directamente no tienen Notification.
        if (!this.swPush.isEnabled || typeof Notification === 'undefined') return false;

        // Si el usuario ya las bloqueó, el navegador no vuelve a preguntar.
        if (Notification.permission === 'denied') return false;

        try {
        // Acá el navegador muestra el cartel "¿Permitir notificaciones?". La
        // clave pública VAPID identifica a nuestro servidor: el navegador sólo
        // va a aceptar mensajes firmados con su clave privada.
        const suscripcion = await this.swPush.requestSubscription({
            serverPublicKey: environment.VAPID_PUBLIC_KEY,
        });

        // toJSON() deja la suscripción en texto: endpoint (la dirección del
        // servicio de push de este navegador) y las dos claves para cifrar.
        const { endpoint, keys } = suscripcion.toJSON();

        // upsert con ignoreDuplicates: si este navegador ya estaba guardado
        // para este usuario (pidió aviso de otra película), no se repite.
        const { error } = await this.supabase.Supabase.from('push_subscriptions').upsert(
            { usuario_id, endpoint, auth: keys?.['auth'], p256dh: keys?.['p256dh'] },
            { onConflict: 'usuario_id,endpoint', ignoreDuplicates: true },
        );

        if (error) throw error;
        return true;
        } catch {
        // El usuario tocó "Bloquear" o falló el guardado.
        return false;
        }
    }
    }