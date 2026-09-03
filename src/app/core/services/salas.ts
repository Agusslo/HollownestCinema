import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import ISala from '../interfaces/sala';

@Service()
export class Salas {
    private supabase = inject(Supabase);

    async obtenerTodas(): Promise<ISala[]> {
    const { data, error } = await this.supabase.Supabase.from('salas').select('*');
    if (error) throw error;
    return data as ISala[];
    }
}