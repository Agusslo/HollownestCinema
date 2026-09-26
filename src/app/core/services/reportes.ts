    import { Service, inject } from '@angular/core';
    import { Supabase } from './supabase';
    import IFacturacionDiaria from '../interfaces/reporte';

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
    }