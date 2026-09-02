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