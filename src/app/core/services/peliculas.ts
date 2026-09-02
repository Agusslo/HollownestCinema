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
}