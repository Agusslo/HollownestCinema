import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IGenero from '../interfaces/genero';

@Service()
export class Generos {
    private supabase = inject(Supabase);
    // Obtiene todos los géneros ordenados alfabéticamente
    
    

    async obtenerTodos(): Promise<IGenero[]> {
        const { data, error } = await this.supabase.Supabase.from('generos')
        .select('*')
        .order('nombre');

        if (error) throw error;
        return data as IGenero[];
    }

    async crear(nombre: string): Promise<IGenero> {
        const { data, error } = await this.supabase.Supabase.from('generos')
        .insert({ nombre })
        .select()
        .single();

        if (error) throw error;
        return data as IGenero;
    }

    async asignarAPelicula(pelicula_id: number, generoIds: number[]): Promise<void> {
        // Método que asigna géneros a una película en la tabla intermedia peliculas_generos.
        if (generoIds.length === 0) return;

        // Insertamos una fila por cada género elegido, todas de una sola vez
        const filas = generoIds.map((genero_id) => ({ pelicula_id, genero_id }));
        const { error } = await this.supabase.Supabase.from('peliculas_generos').insert(filas);
        if (error) throw error;
    }
}