import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IOrden, { IOrdenConDetalle, IOrdenValidacion } from '../interfaces/orden';

// Hasta cuántas horas antes de la función se puede cancelar una compra.
const HORAS_LIMITE_CANCELACION = 2;

// Todo lo que necesita ver el empleado al escanear el QR de una compra.
const SELECT_VALIDACION = `id, cancelada_en, candy_entregado_en,
    entradas ( id, fila, columna, validada_en,
        funciones ( fecha_hora, formato, idioma,
            peliculas ( nombre ),
            salas ( nombre ) ) ),
    orden_candy_items ( cantidad, candy_productos ( nombre ) )`;

@Service()
export class Ordenes {
    private supabase = inject(Supabase);

    // total y credito_usado quedan guardados en la orden para siempre —
    // los necesitamos después, el día que se cancele, para saber cuánto
    // acreditar de vuelta (ver cancelar() más abajo).
    async crear(usuario_id: string | null, total: number, credito_usado = 0): Promise<IOrden> {
        const { data, error } = await this.supabase.Supabase.from('ordenes')
            .insert({ usuario_id, codigo_qr: crypto.randomUUID(), total, credito_usado })
            .select()
            .single();

        if (error) throw error;
        return data as IOrden;
    }

    // Busca la compra por su código de QR (o el que se escribió a mano) y
    // trae sus entradas y su candy embebidos, sin modificar nada todavía.
    async buscarPorCodigo(codigo_qr: string): Promise<IOrdenValidacion | null> {
        const { data, error } = await this.supabase.Supabase.from('ordenes')
            .select(SELECT_VALIDACION)
            .eq('codigo_qr', codigo_qr)
            .maybeSingle();

        if (error) throw error;
        if (data) return data as unknown as IOrdenValidacion;

        // Los PDF anteriores al QR único traían un QR por butaca (el de la
        // entrada). Para que sigan sirviendo, si el código no es de una
        // orden probamos si es de una entrada y devolvemos su compra.
        const { data: entrada, error: errorEntrada } = await this.supabase.Supabase.from('entradas')
            .select('orden_id')
            .eq('codigo_qr', codigo_qr)
            .maybeSingle();

        if (errorEntrada) throw errorEntrada;
        if (!entrada) return null;

        const { data: orden, error: errorOrden } = await this.supabase.Supabase.from('ordenes')
            .select(SELECT_VALIDACION)
            .eq('id', entrada.orden_id)
            .maybeSingle();

        if (errorOrden) throw errorOrden;
        return orden as unknown as IOrdenValidacion | null;
    }

    // Igual que Entradas.validarDeOrden: el .is(...) evita marcar como
    // entregado un candy que ya se había entregado antes.
    async marcarCandyEntregado(id: number): Promise<boolean> {
        const { data, error } = await this.supabase.Supabase.from('ordenes')
            .update({ candy_entregado_en: new Date().toISOString() })
            .eq('id', id)
            .is('candy_entregado_en', null)
            .select('id');

        if (error) throw error;
        return (data?.length ?? 0) > 0;
    }

    // Todas las compras del usuario logueado, más nuevas primero, con todo
    // lo necesario para mostrarlas y decidir si se pueden cancelar.
    async obtenerMisCompras(usuario_id: string): Promise<IOrdenConDetalle[]> {
        const { data, error } = await this.supabase.Supabase.from('ordenes')
            .select(
                `id, creado_en, total, credito_usado, cancelada_en,
                entradas ( id, fila, columna, validada_en,
                    funciones ( fecha_hora, formato, idioma,
                        peliculas ( id, nombre, imagen_url ),
                        salas ( nombre ) ) ),
                orden_candy_items ( cantidad, candy_productos ( nombre ) ),
                canjes ( tipo, entrada_id, puntos_gastados )`,
            )
            .eq('usuario_id', usuario_id)
            .order('creado_en', { ascending: false });

        if (error) throw error;
        return data as unknown as IOrdenConDetalle[];
    }

    // Cancela una compra: valida que sea del dueño, que falten más de 2hs
    // para la función, y que ninguna entrada ya se haya usado. Si todo
    // está en orden, invalida las entradas, marca la orden cancelada y le
    // acredita al usuario "total - credito_usado" (lo que pagó por afuera
    // del crédito) — nunca el total entero, porque si no cada cancelación
    // generaría crédito de la nada cuando ya se había pagado parte con
    // crédito de una cancelación anterior.
    async cancelar(ordenId: number, usuarioId: string): Promise<void> {
        const { data: orden, error: errorOrden } = await this.supabase.Supabase.from('ordenes')
            .select(
                `id, usuario_id, total, credito_usado, cancelada_en,
                entradas ( id, validada_en, funciones ( fecha_hora ) ),
                canjes ( puntos_gastados )`,
            )
            .eq('id', ordenId)
            .single();

        if (errorOrden) throw errorOrden;
        const ordenData = orden as unknown as {
            usuario_id: string | null;
            total: number;
            credito_usado: number;
            cancelada_en: string | null;
            entradas: { validada_en: string | null; funciones: { fecha_hora: string } }[];
            canjes: { puntos_gastados: number }[];
        };

        if (ordenData.usuario_id !== usuarioId) {
            throw new Error('Esta compra no te pertenece.');
        }
        if (ordenData.cancelada_en) {
            throw new Error('Esta compra ya estaba cancelada.');
        }
        if (ordenData.entradas.length === 0) {
            throw new Error('Esta orden no tiene entradas asociadas.');
        }
        if (ordenData.entradas.some((e) => e.validada_en)) {
            throw new Error('No se puede cancelar: ya se usó al menos una entrada de esta compra.');
        }

        const fechaFuncion = new Date(ordenData.entradas[0].funciones.fecha_hora);
        const limite = new Date(fechaFuncion.getTime() - HORAS_LIMITE_CANCELACION * 60 * 60 * 1000);
        if (new Date() > limite) {
            throw new Error(
                `Ya no se puede cancelar: tiene que faltar más de ${HORAS_LIMITE_CANCELACION}hs para la función.`,
            );
        }

        const montoACreditar = ordenData.total - ordenData.credito_usado;
        // Fidelización: si esta orden tenía algo canjeado con puntos (una
        // entrada gratis, candy, o las dos cosas), al cancelar se los
        // devolvemos igual que hacemos con el crédito — mismo criterio:
        // no le tiene que quedar debiendo nada a la persona porque canceló
        // a tiempo.
        const puntosADevolver = ordenData.canjes.reduce(
            (acumulado, canje) => acumulado + canje.puntos_gastados,
            0,
        );

        const { error: errorCancelar } = await this.supabase.Supabase.from('ordenes')
            .update({ cancelada_en: new Date().toISOString() })
            .eq('id', ordenId);
        if (errorCancelar) throw errorCancelar;

        // Invalidamos todas las entradas de la orden reusando el mismo
        // campo validada_en que ya usa el empleado en la puerta — así no
        // hace falta que Validar sepa nada nuevo sobre cancelaciones, para
        // él una entrada cancelada ya es indistinguible de "usada" (en los
        // dos casos, ese QR no tiene que dejar pasar a nadie).
        const { error: errorEntradas } = await this.supabase.Supabase.from('entradas')
            .update({ validada_en: new Date().toISOString() })
            .eq('orden_id', ordenId);
        if (errorEntradas) throw errorEntradas;

        if (montoACreditar > 0 || puntosADevolver > 0) {
            const { data: perfil, error: errorGet } = await this.supabase.Supabase.from('perfiles')
                .select('credito, puntos')
                .eq('id', usuarioId)
                .single();
            if (errorGet) throw errorGet;

            const perfilData = perfil as { credito: number; puntos: number };
            const cambios: { credito?: number; puntos?: number } = {};

            if (montoACreditar > 0) {
                cambios.credito = perfilData.credito + montoACreditar;
            }
            if (puntosADevolver > 0) {
                cambios.puntos = perfilData.puntos + puntosADevolver;
            }

            const { error: errorUpdate } = await this.supabase.Supabase.from('perfiles')
                .update(cambios)
                .eq('id', usuarioId);
            if (errorUpdate) throw errorUpdate;
        }
    }
}