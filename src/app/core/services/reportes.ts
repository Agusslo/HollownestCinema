import { Service, inject } from '@angular/core';
    import { Supabase } from './supabase';
    import IFacturacionDiaria, { IPeliculaMasVista, IReporteMasVistas } from '../interfaces/reporte';

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

        // Agrupamos por día. Los primeros 10 caracteres de un timestamp ISO
        // (ej: "2026-09-26T14:30:00+00:00") son "2026-09-26" — nos alcanza
        // con eso para agrupar por día, sin importarnos la hora exacta.
        const porDia = new Map<string, IFacturacionDiaria>();

        for (const fila of filas) {
        const dia = fila.creado_en.slice(0, 10);
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
    }