import { Service, inject } from '@angular/core';
    import { Supabase } from './supabase';
    import IFacturacionDiaria, {
    IPeliculaMasVista,
    IReporteMasVistas,
    ICandyMasVendido,
    } from '../interfaces/reporte';

    @Service()
    export class Reportes {
    private supabase = inject(Supabase);

    // Reporte de facturación diaria: por cada día, cuánto se facturó (en
    // pesos) y cuántas entradas se vendieron.
    //
    // Decisión importante: las órdenes CANCELADAS quedan afuera del reporte
    // por completo (ni suman monto ni suman entradas). El criterio es que
    // una entrada de una orden cancelada termina invalidada (no sirve para
    // entrar al cine), así que no se la puede seguir contando como
    // "vendida" en el reporte final — si en algún momento se quiere que la
    // cancelación se refleje aparte (ej. una columna de "cancelaciones del
    // día"), este es el lugar para agregarla, pero hoy no está pedido.
    async obtenerFacturacionDiaria(): Promise<IFacturacionDiaria[]> {
        // `entradas(count)` le pide a PostgREST que, junto con cada orden,
        // nos devuelva cuántas filas de "entradas" tiene esa orden — así no
        // hace falta traer entrada por entrada solo para contarlas.
        const { data, error } = await this.supabase.Supabase.from('ordenes')
        .select('creado_en, total, entradas(count)')
        .is('cancelada_en', null);

        if (error) throw error;

        const filas = data as unknown as {
        creado_en: string;
        total: number;
        entradas: { count: number }[];
        }[];

        // Agrupamos por día, en hora LOCAL (Argentina). Antes usábamos los
        // primeros 10 caracteres del timestamp ("2026-09-26T01:30:00+00:00"
        // → "2026-09-26"), pero Supabase lo guarda en UTC: una compra del
        // 25/09 a las 22:30 en Argentina es el 26/09 01:30 en UTC, y caía
        // en el día siguiente. new Date() lo pasa a la hora de la compu.
        const porDia = new Map<string, IFacturacionDiaria>();

        for (const fila of filas) {
        const dia = this.diaLocal(fila.creado_en);
        const cantidadEntradas = fila.entradas[0]?.count ?? 0;

        const existente = porDia.get(dia);
        if (existente) {
            existente.montoFacturado += fila.total;
            existente.entradasVendidas += cantidadEntradas;
        } else {
            porDia.set(dia, {
            fecha: dia,
            montoFacturado: fila.total,
            entradasVendidas: cantidadEntradas,
            });
        }
        }

        // Más reciente primero, como en el resto de los historiales de la app.
        return [...porDia.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
    }

    // "2026-09-26T01:30:00+00:00" → "2026-09-25" (el día en hora local).
    // Se arma a mano porque toISOString() devolvería otra vez el día en UTC.
    private diaLocal(timestamp: string): string {
        const fecha = new Date(timestamp);
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        return `${fecha.getFullYear()}-${mes}-${dia}`;
    }

    // Reporte de "películas más vistas": top 5 de la última semana (últimos
    // 7 días) y top 5 del último mes (últimos 30 días) — dos ventanas
    // móviles, no semana/mes calendario (ver la explicación que le di al
    // usuario: así el reporte no "reinicia" de golpe el día 1 de cada mes).
    //
    // Mismo criterio que en obtenerFacturacionDiaria: las entradas de
    // órdenes CANCELADAS no cuentan. A diferencia de Peliculas.obtenerMasVendidas()
    // (la del Top 3 de la home, que hoy NO filtra canceladas), acá sí lo
    // hacemos bien desde el principio.
    async obtenerMasVistas(): Promise<IReporteMasVistas> {
        const hace30dias = new Date();
        hace30dias.setDate(hace30dias.getDate() - 30);

        // Traemos en una sola consulta todas las entradas "vendidas de
        // verdad" (orden no cancelada) de los últimos 30 días — ese rango
        // ya cubre también los últimos 7, así que alcanza con una sola
        // consulta para armar los dos rankings.
        //
        // `ordenes!inner(...)` (mismo patrón que ya usa
        // Entradas.obtenerButacasOcupadas) es necesario para poder
        // filtrar por campos de la tabla relacionada "ordenes" — con un
        // join normal, Supabase no te deja usar `.is()`/`.gte()` sobre
        // columnas de la tabla embebida.
        const { data, error } = await this.supabase.Supabase.from('entradas')
        .select('funciones(pelicula_id, peliculas(nombre)), ordenes!inner(creado_en, cancelada_en)')
        .is('ordenes.cancelada_en', null)
        .gte('ordenes.creado_en', hace30dias.toISOString());

        if (error) throw error;

        const filas = data as unknown as {
        funciones: { pelicula_id: number; peliculas: { nombre: string } };
        ordenes: { creado_en: string };
        }[];

        const hace7dias = new Date();
        hace7dias.setDate(hace7dias.getDate() - 7);

        return {
        semana: this.contarYRankear(filas.filter((f) => new Date(f.ordenes.creado_en) >= hace7dias)),
        mes: this.contarYRankear(filas),
        };
    }

    // Cuenta cuántas entradas tiene cada película en la lista que le pasan,
    // y devuelve el top 5 ordenado de mayor a menor. La separé en un método
    // aparte porque la usamos dos veces (una para la semana, otra para el
    // mes) con exactamente la misma lógica de conteo — solo cambia QUÉ
    // filas le mandamos.
    private contarYRankear(
        filas: { funciones: { pelicula_id: number; peliculas: { nombre: string } } }[],
    ): IPeliculaMasVista[] {
        const conteo = new Map<number, IPeliculaMasVista>();

        for (const fila of filas) {
        const id = fila.funciones.pelicula_id;
        const existente = conteo.get(id);

        if (existente) {
            existente.cantidad++;
        } else {
            conteo.set(id, {
            pelicula_id: id,
            nombre: fila.funciones.peliculas.nombre,
            cantidad: 1,
            });
        }
        }

        return [...conteo.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
    }

    // Reporte de "candy más vendido": ranking de todos los productos de
    // candy por cantidad de unidades vendidas, de siempre (sin ventana de
    // tiempo — a diferencia de obtenerMasVistas, acá no hace falta
    // semana/mes porque el catálogo de candy es chico y lo que importa es
    // el acumulado histórico). Mismo criterio de siempre: las órdenes
    // CANCELADAS no cuentan.
    //
    // Ojo con una diferencia importante respecto a contarYRankear() de
    // arriba: ahí cada FILA de "entradas" es una sola entrada, entonces
    // alcanza con sumar 1 por fila (existente.cantidad++). Acá cada fila
    // de "orden_candy_items" YA trae su propia cantidad adentro (comprar 3
    // pochoclos en el mismo carrito es una sola fila con cantidad: 3), así
    // que hay que sumar fila.cantidad, no contar filas.
    async obtenerCandyMasVendido(): Promise<ICandyMasVendido[]> {
        // `ordenes!inner(cancelada_en)` es el mismo patrón de siempre para
        // poder filtrar por un campo de la tabla relacionada.
        const { data, error } = await this.supabase.Supabase.from('orden_candy_items')
        .select('producto_id, cantidad, candy_productos(nombre), ordenes!inner(cancelada_en)')
        .is('ordenes.cancelada_en', null);

        if (error) throw error;

        const filas = data as unknown as {
        producto_id: number;
        cantidad: number;
        candy_productos: { nombre: string };
        }[];

        const conteo = new Map<number, ICandyMasVendido>();

        for (const fila of filas) {
        const existente = conteo.get(fila.producto_id);

        if (existente) {
            existente.cantidad += fila.cantidad;
        } else {
            conteo.set(fila.producto_id, {
            producto_id: fila.producto_id,
            nombre: fila.candy_productos.nombre,
            cantidad: fila.cantidad,
            });
        }
        }

        return [...conteo.values()].sort((a, b) => b.cantidad - a.cantidad);
    }
    }