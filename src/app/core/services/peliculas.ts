import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IPelicula from '../interfaces/pelicula';

@Service()
export class Peliculas {
  private supabase = inject(Supabase);

  async obtenerTodas(): Promise<IPelicula[]> {
    const { data, error } = await this.supabase.Supabase
      .from('peliculas')
      .select('*');

    if (error) throw error;
    return data as IPelicula[];
  }

  async crear(pelicula: Omit<IPelicula, 'id'>): Promise<void> { 
    //omit es una utilidad de typescript que permite omitir una propiedad de un tipo, en este caso omitimos la propiedad id de la interfaz IPelicula
  const { error } = await this.supabase.Supabase
    .from('peliculas')
    .insert(pelicula);

  if (error) throw error;
}

async obtenerPorId(id: number): Promise<IPelicula> {
  const { data, error } = await this.supabase.Supabase
    .from('peliculas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as IPelicula;
}
}