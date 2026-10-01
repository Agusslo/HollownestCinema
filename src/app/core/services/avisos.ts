import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import { IAvisoConPelicula } from '../interfaces/aviso';

// El botón "Avisame" de Próximamente. Todas las consultas filtran por
// usuario_id, y además las policies de RLS de la tabla `avisos` impiden
// leer, crear o borrar avisos de otro usuario aunque alguien lo intente.
@Service()
export class Avisos {
  private supabase = inject(Supabase);

  // Los ids de las películas de las que este usuario ya pidió aviso. Con
  // un Set alcanza para saber qué botón mostrar en cada tarjeta:
  // avisosPedidos.has(pelicula.id) → "Te vamos a avisar"; si no → "Avisame".
  async obtenerIdsPeliculas(usuario_id: string): Promise<Set<number>> {
    const { data, error } = await this.supabase.Supabase.from('avisos')
      .select('pelicula_id')
      .eq('usuario_id', usuario_id);

    if (error) throw error;
    return new Set((data as { pelicula_id: number }[]).map((fila) => fila.pelicula_id));
  }

  async crear(usuario_id: string, pelicula_id: number): Promise<void> {
    const { error } = await this.supabase.Supabase.from('avisos').insert({
      usuario_id,
      pelicula_id,
    });

    // 23505 = violación de unique (mismo código que ya manejás en
    // Resenias.crear): el aviso ya existía — por ejemplo, un doble click
    // rápido. No es un error para el usuario: el aviso quedó pedido igual.
    if (error && error.code !== '23505') throw error;
  }

  // Los avisos de este usuario que todavía no se le mostraron (avisado_en
  // en null), con la película embebida. Después, quien llama decide cuáles
  // ya corresponde mostrar (los de películas que ya abrieron la venta).
  async obtenerPendientes(usuario_id: string): Promise<IAvisoConPelicula[]> {
    const { data, error } = await this.supabase.Supabase.from('avisos')
      .select('*, peliculas(*)')
      .eq('usuario_id', usuario_id)
      .is('avisado_en', null);

    if (error) throw error;
    return data as unknown as IAvisoConPelicula[];
  }

  // Marca como "ya mostrados" varios avisos de una (.in = "el id está en
  // esta lista"), para que no se repitan la próxima vez que entre a la app.
  async marcarAvisados(ids: number[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await this.supabase.Supabase.from('avisos')
      .update({ avisado_en: new Date().toISOString() })
      .in('id', ids);

    if (error) throw error;
  }

  // Tocar el botón de nuevo cancela el aviso.
  async borrar(usuario_id: string, pelicula_id: number): Promise<void> {
    const { error } = await this.supabase.Supabase.from('avisos')
      .delete()
      .eq('usuario_id', usuario_id)
      .eq('pelicula_id', pelicula_id);

    if (error) throw error;
  }
}