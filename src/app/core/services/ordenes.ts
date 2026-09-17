import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IOrden, { IOrdenConCandy } from '../interfaces/orden';

@Service()
export class Ordenes {
    private supabase = inject(Supabase);

    async crear(usuario_id: string | null): Promise<IOrden> {
        //contener para agrupar todas las entradas
        const { data, error } = await this.supabase.Supabase.from('ordenes')
            .insert({ usuario_id, codigo_qr: crypto.randomUUID() })
            .select()
            .single();

        if (error) throw error;
        return data as IOrden;
    }

    // Mismo patrón que Entradas.buscarPorCodigo: trae la orden con sus
    // items de candy embebidos, sin modificar nada todavía.
    async buscarPorCodigo(codigo_qr: string): Promise<IOrdenConCandy | null> {
        const { data, error } = await this.supabase.Supabase.from('ordenes')
            .select(
                `id, candy_entregado_en,
                orden_candy_items ( cantidad, candy_productos ( nombre ) )`,
            )
            .eq('codigo_qr', codigo_qr)
            .maybeSingle();

        if (error) throw error;
        return data as unknown as IOrdenConCandy | null;
    }

    // Igual que Entradas.validar: el .is(...) evita marcar como entregado
    // un candy que ya se había entregado antes.
    async marcarCandyEntregado(id: number): Promise<boolean> {
        const { data, error } = await this.supabase.Supabase.from('ordenes')
            .update({ candy_entregado_en: new Date().toISOString() })
            .eq('id', id)
            .is('candy_entregado_en', null)
            .select('id');

        if (error) throw error;
        return (data?.length ?? 0) > 0;
    }
}