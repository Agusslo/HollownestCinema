import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IGenero from '../interfaces/genero';
import IPelicula, { IPeliculaConGeneros } from '../interfaces/pelicula';

@Service()
export class Peliculas {
  private supabase = inject(Supabase);

  async obtenerTodas(): Promise<IPeliculaConGeneros[]> {
    const { data, error } = await this.supabase.Supabase.from('peliculas').select(
      '*, peliculas_generos(generos(id, nombre))',
    );

    if (error) throw error;
    return data as unknown as IPeliculaConGeneros[];
  }

  async crear(pelicula: Omit<IPelicula, 'id'>): Promise<IPelicula> {
    //omit es una utilidad de typescript que permite omitir una propiedad de un tipo, en este caso omitimos la propiedad id de la interfaz IPelicula
    const { data, error } = await this.supabase.Supabase.from('peliculas')
      .insert(pelicula)
      .select()
      .single();

    if (error) throw error;
    return data as IPelicula;
  }

  async obtenerPorId(id: number): Promise<IPelicula> {
    const { data, error } = await this.supabase.Supabase.from('peliculas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as IPelicula;
  }

  generarSlug(nombre: string): string {
    //esta función genera un slug a partir del nombre de la película, para poder usarlo en la URL
    return nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async obtenerPorSlug(slug: string): Promise<IPeliculaConGeneros> {
    //esta función obtiene una película a partir de su slug, para poder usarlo en la URL
    const peliculas = await this.obtenerTodas();
    const pelicula = peliculas.find((item) => this.generarSlug(item.nombre) === slug);

    if (!pelicula) throw new Error(`No se encontró la película: ${slug}`);
    return pelicula;
  }

  async obtenerMasVendidas(cantidad: number): Promise<IPeliculaConGeneros[]> {
    // Traemos cada entrada junto con la película de su función, vía doble
    // join embebido: entradas -> funciones -> peliculas
    const { data, error } = await this.supabase.Supabase.from('entradas').select(
      'funciones(pelicula_id)',
    );

    if (error) throw error;

    // Contamos ocurrencias de cada pelicula_id
    const conteo = new Map<number, number>();
    for (const fila of data as unknown as { funciones: { pelicula_id: number } }[]) {
      const id = fila.funciones.pelicula_id;
      conteo.set(id, (conteo.get(id) ?? 0) + 1);
    }

    // Ordenamos los ids de mayor a menor cantidad de ventas
    const idsOrdenados = [...conteo.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, cantidad);

    const todas = await this.obtenerTodas();
    // Reordenamos "todas" según idsOrdenados, para respetar el ranking
    return idsOrdenados
      .map((id) => todas.find((p) => p.id === id))
      .filter((p): p is IPeliculaConGeneros => p !== undefined);
  }

  // Aplana la estructura anidada que devuelve Supabase (un array de filas de
  // peliculas_generos, cada una con su género adentro) a un array simple de
  // géneros, más cómodo para usar en los templates.
  generosDe(pelicula: IPeliculaConGeneros): IGenero[] {
    return pelicula.peliculas_generos.map((pg) => pg.generos);
  }
}