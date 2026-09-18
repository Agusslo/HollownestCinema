export default interface IResenia {
  id: number;
  pelicula_id: number;
  usuario_id: string;
  estrellas: number;
  comentario: string;
  creado_en: string;
}

// Extiende IResenia agregando los datos del perfil del autor, que vienen del join embebido con la tabla `perfiles` (mismo patrón que IFuncionConSala con `salas` en funcion.ts)
export interface IReseniaConAutor extends IResenia {
  perfiles?: { nombre: string; apellido?: string } | null;
}
