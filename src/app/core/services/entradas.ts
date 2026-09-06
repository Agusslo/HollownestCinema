import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';

@Service()
export class Entradas {
    private supabase = inject(Supabase);

    async obtenerButacasOcupadas(funcion_id: number): Promise<string[]> {
    const { data, error } = await this.supabase.Supabase
        . from('entradas')
        .select('fila, columna')
        .eq('funcion_id', funcion_id);

    if (error) throw error;
    return data.map((e) => `${e.fila}${e.columna}`);
    }
}