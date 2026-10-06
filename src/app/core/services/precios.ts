    import { Service, inject } from '@angular/core';
    import { Supabase } from './supabase';
    import IPreciosEntradas from '../interfaces/precios';

    // Precios de las entradas por formato y recargo VIP. Antes estaban fijos
    // en el código (entradas.ts); ahora viven en la tabla precios_entradas
    // para que el admin los pueda cambiar sin tocar el código.
    @Service()
    export class Precios {
    private supabase = inject(Supabase);

    async obtener(): Promise<IPreciosEntradas> {
        const { data, error } = await this.supabase.Supabase.from('precios_entradas')
        .select('*')
        .eq('id', 1)
        .single();

        if (error) throw error;
        return data as IPreciosEntradas;
    }

    // `count: 'exact'` para enterarnos si el update no tocó ninguna fila:
    // con RLS, alguien que no es admin no recibe un error, sino 0 filas
    // modificadas. Sin este chequeo la pantalla diría "guardado" igual.
    async actualizar(cambios: Partial<Omit<IPreciosEntradas, 'id'>>): Promise<void> {
        const { error, count } = await this.supabase.Supabase.from('precios_entradas')
        .update(cambios, { count: 'exact' })
        .eq('id', 1);

        if (error) throw error;
        if (count === 0) throw new Error('No se pudieron guardar los precios.');
    }
    }