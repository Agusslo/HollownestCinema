export default interface IPelicula {
  id: number;
  nombre: string;
  sinopsis: string;
  imagen_url: string;
  duracion_minutos: number;
  restriccion_edad: number | null; // 13, 18, o null si no tiene restricción
  // Próximamente y preventa. null = película en cartelera normal (así
  // quedan todas las que ya estaban cargadas antes de esta función).
  // Viene de Supabase como texto 'YYYY-MM-DD' (columna date, sin hora).
  fecha_estreno: string | null;
  // Precio fijo de la entrada común durante los 7 días de preventa (el
  // recargo VIP se aplica encima). null = preventa a precio normal.
  precio_preventa: number | null;
}
// Extiende IPelicula con los géneros asignados, vía el join embebido de la
// tabla intermedia peliculas_generos -> generos (mismo patrón que
// IFuncionConSala con salas en funcion.ts, pero acá es muchos-a-muchos)
export interface IPeliculaConGeneros extends IPelicula {
  peliculas_generos: { generos: { id: number; nombre: string } }[];
}