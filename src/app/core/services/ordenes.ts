import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IOrden from '../interfaces/orden';

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
}