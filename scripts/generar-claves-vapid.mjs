    // Genera el par de claves VAPID para las notificaciones push.
    // Se corre UNA sola vez, desde la raíz del proyecto:
    //
    //   node scripts/generar-claves-vapid.mjs
    //
    // VAPID = la "firma" del servidor que manda las notificaciones. El navegador
    // guarda la clave PÚBLICA al suscribirse, y después sólo acepta mensajes
    // firmados con la clave PRIVADA que le corresponde. Así nadie más puede
    // mandarles notificaciones a nuestros usuarios.
    //
    // Usa la Web Crypto API que ya trae Node, así que no hace falta instalar nada.

    const { subtle } = globalThis.crypto;

    // Curva P-256 con ECDSA: el algoritmo que pide el estándar (RFC 8292).
    const claves = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
    ]);

    // 1) Para Supabase (la Edge Function): las dos claves en formato JWK, que es
    //    el que lee la librería @negrel/webpush con importVapidKeys().
    const paraSupabase = {
    publicKey: await subtle.exportKey('jwk', claves.publicKey),
    privateKey: await subtle.exportKey('jwk', claves.privateKey),
    };

    // 2) Para Angular: sólo la pública, en base64url, que es el formato que
    //    pide SwPush.requestSubscription({ serverPublicKey }).
    const publicaCruda = new Uint8Array(await subtle.exportKey('raw', claves.publicKey));
    const paraAngular = Buffer.from(publicaCruda).toString('base64url');

    console.log(
    '\n1) Clave PÚBLICA → environment.ts y environment.development.ts (VAPID_PUBLIC_KEY):\n',
    );
    console.log(paraAngular);
    console.log(
    '\n2) Las DOS claves → Supabase → Edge Functions → Secrets, con el nombre VAPID_KEYS:\n',
    );
    console.log(JSON.stringify(paraSupabase));
    console.log(
    '\nLa del punto 2 tiene la clave privada: no la pegues en el código ni la subas a git.\n',
    );