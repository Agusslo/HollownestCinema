export default interface IPelicula {
  id: number;
  nombre: string;
  sinopsis: string;
  imagen_url: string;
  duracion_minutos: number;
}
// Extiende IPelicula con los géneros asignados, vía el join embebido de la
// tabla intermedia peliculas_generos -> generos (mismo patrón que
// IFuncionConSala con salas en funcion.ts, pero acá es muchos-a-muchos)
export interface IPeliculaConGeneros extends IPelicula {
  peliculas_generos: { generos: { id: number; nombre: string } }[];
}