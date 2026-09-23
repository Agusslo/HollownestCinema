import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import ICombo, { IComboConItems } from '../interfaces/combo';

@Service()
export class Combos {
    private supabase = inject(Supabase);

    // Sólo los combos activos, con sus items — esto es lo que se muestra
    // "destacado" en la página de compra.
    async obtenerActivos(): Promise<IComboConItems[]> {
        const { data, error } = await this.supabase.Supabase.from('combos')
            .select('*, combo_items ( cantidad, producto_id, candy_productos ( nombre ) )')
            .eq('activo', true)
            .order('precio');

        if (error) throw error;
        return data as unknown as IComboConItems[];
    }

    // Para la pantalla de admin: todos, activos o no.
    async obtenerTodos(): Promise<IComboConItems[]> {
        const { data, error } = await this.supabase.Supabase.from('combos')
            .select('*, combo_items ( cantidad, producto_id, candy_productos ( nombre ) )')
            .order('nombre');

        if (error) throw error;
        return data as unknown as IComboConItems[];
    }

    async crear(
        combo: Omit<ICombo, 'id'>,
        items: { producto_id: number; cantidad: number }[],
    ): Promise<ICombo> {
        const { data: comboCreado, error: errorCombo } = await this.supabase.Supabase.from(
            'combos',
        )
            .insert(combo)
            .select()
            .single();

        if (errorCombo) throw errorCombo;

        if (items.length > 0) {
            const filas = items.map((item) => ({ combo_id: comboCreado.id, ...item }));
            const { error: errorItems } = await this.supabase.Supabase.from('combo_items').insert(
                filas,
            );
            if (errorItems) throw errorItems;
        }

        return comboCreado as ICombo;
    }
}