import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IPelicula from '../interfaces/pelicula';

@Service()
export class Peliculas {
  private supabase = inject(Supabase);

  async obtenerTodas(): Promise<IPelicula[]> {
    const { data, error } = await this.supabase.Supabase.from('peliculas').select('*');

    if (error) throw error;
    return data as IPelicula[];
  }

  async crear(pelicula: Omit<IPelicula, 'id'>): Promise<void> {
    //omit es una utilidad de typescript que permite omitir una propiedad de un tipo, en este caso omitimos la propiedad id de la interfaz IPelicula
    const { error } = await this.supabase.Supabase.from('peliculas').insert(pelicula);

    if (error) throw error;
  }

  async obtenerPorId(id: number): Promise<IPelicula> {
    const { data, error } = await this.supabase.Supabase.from('peliculas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as IPelicula;
  }

  generarSlug(nombre: string): string { //esta función genera un slug a partir del nombre de la película, para poder usarlo en la URL
    return nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') 
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  async obtenerPorSlug(slug: string): Promise<IPelicula> { //esta función obtiene una película a partir de su slug, para poder usarlo en la URL
    const peliculas = await this.obtenerTodas();
    const pelicula = peliculas.find((item) => this.generarSlug(item.nombre) === slug);

    if (!pelicula) throw new Error(`No se encontró la película: ${slug}`);
    return pelicula;
  }
}
