    import { Service, inject } from '@angular/core';
    import { Supabase } from './supabase';
    import ICanje, { ICanjeConDetalle, IFidelizacionConfig } from '../interfaces/canje';

    @Service()
    export class Fidelizacion {
    private supabase = inject(Supabase);

    async obtenerConfig(): Promise<IFidelizacionConfig> {
        const { data, error } = await this.supabase.Supabase.from('fidelizacion_config')
        .select('*')
        .eq('id', 1)
        .single();

        if (error) throw error;
        return data as IFidelizacionConfig;
    }

    async actualizarPuntosPorEntrada(puntos: number): Promise<void> {
        const { error } = await this.supabase.Supabase.from('fidelizacion_config')
        .update({ puntos_por_entrada_gratis: puntos })
        .eq('id', 1);

        if (error) throw error;
    }

    // Historial completo del usuario, más nuevo primero — con el nombre de
    // la película (si el canje fue una entrada) o del producto (si fue candy).
    async obtenerHistorial(usuario_id: string): Promise<ICanjeConDetalle[]> {
        const { data, error } = await this.supabase.Supabase.from('canjes')
        .select(`*, entradas ( funciones ( peliculas ( nombre ) ) ), candy_productos ( nombre )`)
        .eq('usuario_id', usuario_id)
        .order('creado_en', { ascending: false });

        if (error) throw error;
        return data as unknown as ICanjeConDetalle[];
    }

    // Registra las filas de canje de una compra. Se llama desde
    // Entradas.comprar() en el mismo momento en que se descuentan los
    // puntos del perfil — así el historial y el saldo nunca quedan
    // desincronizados entre sí.
    async registrarCanjes(canjes: Omit<ICanje, 'id' | 'creado_en'>[]): Promise<void> {
        if (canjes.length === 0) return;

        const { error } = await this.supabase.Supabase.from('canjes').insert(canjes);
        if (error) throw error;
    }
    }
