export default interface IPelicula {
  id: number;
  nombre: string;
  sinopsis: string;
  imagen_url: string;
  duracion_minutos: number;
  restriccion_edad: number | null; // 13, 18, o null si no tiene restricción
}
// Extiende IPelicula con los géneros asignados, vía el join embebido de la
// tabla intermedia peliculas_generos -> generos (mismo patrón que
// IFuncionConSala con salas en funcion.ts, pero acá es muchos-a-muchos)
export interface IPeliculaConGeneros extends IPelicula {
  peliculas_generos: { generos: { id: number; nombre: string } }[];
}