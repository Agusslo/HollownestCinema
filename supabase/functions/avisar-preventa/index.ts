    // Edge Function "avisar-preventa" (corre en los servidores de Supabase, con
    // Deno, no en Angular). Mismo esquema que vimos en la clase de
    // notificaciones: un Database Webhook la llama cada vez que se modifica una
    // fila de la tabla `peliculas`, y ella manda las notificaciones push con la
    // librería @negrel/webpush.
    //
    // Cuándo manda: cuando el admin toca "Abrir venta" (venta_abierta_en pasa de
    // null a una fecha). A quién: a los usuarios que tocaron "Avisame" en esa
    // película, en todos los navegadores donde aceptaron recibir notificaciones.

    import { createClient } from 'npm:@supabase/supabase-js@2';
    import * as webpush from 'jsr:@negrel/webpush@0.5.0';

    interface IPeliculaFila {
    id: number;
    nombre: string;
    venta_abierta_en: string | null;
    notificacion_preventa_enviada: boolean | null;
    }

    // Lo que manda el Database Webhook: el tipo de cambio y la fila antes
    // (old_record) y después (record) del cambio.
    interface IWebhook {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    record: IPeliculaFila;
    old_record: IPeliculaFila | null;
    }

    interface ISuscripcion {
    endpoint: string;
    auth: string;
    p256dh: string;
    }

    // Cliente con la clave service_role (Supabase la pone sola en las Edge
    // Functions): saltea RLS, porque acá hay que leer los avisos y las
    // suscripciones de TODOS los usuarios. Esta clave nunca va en Angular.
    const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Las claves VAPID (pública y privada) se cargan como secreto en Supabase,
    // no en el código: la privada es la que "firma" cada notificación.
    const vapidKeys = await webpush.importVapidKeys(JSON.parse(Deno.env.get('VAPID_KEYS')!), {
    extractable: false,
    });

    const servidorPush = await webpush.ApplicationServer.new({
    // Contacto para los servicios de push (Google, Mozilla) si hay problemas.
    contactInformation: 'https://hollownestcinema.vercel.app',
    vapidKeys,
    });

    // La misma función que Peliculas.generarSlug() en Angular, para que el
    // click en la notificación abra la página de la película.
    function generarSlug(nombre: string): string {
    return nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function responder(datos: object, status = 200): Response {
    return new Response(JSON.stringify(datos), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
    }

    Deno.serve(async (req) => {
    const { type, record, old_record } = (await req.json()) as IWebhook;

    // El webhook avisa de CUALQUIER cambio en peliculas. Sólo seguimos si es
    // justo el momento en que se abrió la venta, y si todavía no se avisó.
    const seAbrioLaVenta =
        type === 'UPDATE' && !!record.venta_abierta_en && !old_record?.venta_abierta_en;

    if (!seAbrioLaVenta || record.notificacion_preventa_enviada) {
        return responder({ enviadas: 0, motivo: 'No es una apertura de venta' });
    }

    // 1) Quiénes pidieron aviso de esta película.
    const { data: avisos, error: errorAvisos } = await supabase
        .from('avisos')
        .select('usuario_id')
        .eq('pelicula_id', record.id);

    if (errorAvisos) return responder({ error: errorAvisos.message }, 500);
    const usuarios = avisos.map((aviso) => aviso.usuario_id);

    // 2) En qué navegadores aceptaron recibir notificaciones esos usuarios.
    let suscripciones: ISuscripcion[] = [];
    if (usuarios.length > 0) {
        const { data, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, auth, p256dh')
        .in('usuario_id', usuarios);

        if (error) return responder({ error: error.message }, 500);
        suscripciones = data;
    }

    // 3) La notificación. Este formato ({ notification: {...} }) es el que
    //    entiende el service worker de Angular: él mismo la muestra, y con
    //    onActionClick abre la película cuando el usuario la toca.
    const mensaje = JSON.stringify({
        notification: {
        title: '¡Abrió la preventa!',
        body: `Ya podés comprar entradas de ${record.nombre} a precio de preventa.`,
        icon: '/icons/knight-192x192.png',
        data: {
            onActionClick: {
            default: {
                operation: 'navigateLastFocusedOrOpen',
                url: `/peliculas/${generarSlug(record.nombre)}`,
            },
            },
        },
        },
    });

    // 4) Se manda a todos a la vez. allSettled (y no all) para que, si falla
    //    un navegador, igual les llegue al resto.
    const resultados = await Promise.allSettled(
        suscripciones.map((suscripcion) =>
        servidorPush
            .subscribe({
            endpoint: suscripcion.endpoint,
            keys: { auth: suscripcion.auth, p256dh: suscripcion.p256dh },
            })
            .pushTextMessage(mensaje, { urgency: webpush.Urgency.High }),
        ),
    );

    // 5) Si el servicio de push responde 410 (isGone), el usuario desinstaló
    //    la app o revocó el permiso: esa suscripción ya no sirve y se borra.
    const vencidas = suscripciones
        .filter((_, i) => {
        const resultado = resultados[i];
        return (
            resultado.status === 'rejected' &&
            resultado.reason instanceof webpush.PushMessageError &&
            resultado.reason.isGone()
        );
        })
        .map((suscripcion) => suscripcion.endpoint);

    if (vencidas.length > 0) {
        await supabase.from('push_subscriptions').delete().in('endpoint', vencidas);
    }

    // 6) Se marca la película como avisada, para no mandar dos veces. Este
    //    update vuelve a disparar el webhook, pero ahí old_record ya tiene
    //    venta_abierta_en, así que el chequeo del principio lo corta.
    await supabase
        .from('peliculas')
        .update({ notificacion_preventa_enviada: true })
        .eq('id', record.id);

    const enviadas = resultados.filter((resultado) => resultado.status === 'fulfilled').length;
    return responder({ enviadas, fallidas: resultados.length - enviadas, vencidas: vencidas.length });
    });