import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';

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

  // Tocar el botón de nuevo cancela el aviso.
  async borrar(usuario_id: string, pelicula_id: number): Promise<void> {
    const { error } = await this.supabase.Supabase.from('avisos')
      .delete()
      .eq('usuario_id', usuario_id)
      .eq('pelicula_id', pelicula_id);

    if (error) throw error;
  }
}