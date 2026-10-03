export type Formato = '2d' | '3d' | '4d' | '5d';
export type Idioma = 'castellano' | 'subtitulada';

export default interface IFuncion {
    id: number;
    pelicula_id: number;
    sala_id: number;
    fecha_hora: string;
    formato: Formato;
    idioma: Idioma;
}

export interface IFuncionConSala extends IFuncion {
    salas: { nombre: string };
}

// Para la pantalla de admin "Funciones": con la película y cuántas
// entradas tiene (las funciones con entradas no se pueden borrar).
export interface IFuncionAdmin extends IFuncionConSala {
    peliculas: { nombre: string };
    entradas: { count: number }[];
}