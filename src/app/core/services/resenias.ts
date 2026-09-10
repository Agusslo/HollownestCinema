import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IResenia, { IReseniaConAutor } from '../interfaces/resenia';

@Service()
export class Resenias {
    private supabase = inject(Supabase);

    async obtenerPorPelicula(pelicula_id: number): Promise<IReseniaConAutor[]> {
        // Join embebido: gracias a la FK usuario_id -> perfiles.id, Supabase
        // trae el nombre y apellido del autor de cada reseña sin que tengamos
        // que hacer una consulta aparte para cada una.
        const { data, error } = await this.supabase.Supabase.from('resenias')
        .select('*, perfiles(nombre, apellido)')
        .eq('pelicula_id', pelicula_id)
        .order('creado_en', { ascending: false }); // las más nuevas primero

        if (error) throw error;
        return data as unknown as IReseniaConAutor[];
    }

    async crear(resenia: Omit<IResenia, 'id' | 'creado_en'>): Promise<void> {
        const { error } = await this.supabase.Supabase.from('resenias').insert(resenia);

        if (error) {
            // 23505 = código estándar de Postgres para "violación de unique constraint"
            if (error.code === '23505') {
            throw new Error('Ya dejaste una reseña para esta película.');
            }
            throw error;
        }
    }

    calcularPromedio(resenias: IResenia[]): number {
        if (resenias.length === 0) return 0;
        const suma = resenias.reduce((acumulado, r) => acumulado + r.estrellas, 0);
        return Math.round((suma / resenias.length) * 10) / 10; // redondeado a 1 decimal (ej: 4.3)
    }
}