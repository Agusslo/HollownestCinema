import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IFuncion, { IFuncionConSala, Formato, Idioma } from '../interfaces/funcion';

const MARGEN_MINUTOS = 30;

@Service()
export class Funciones {
    private supabase = inject(Supabase);

async crear(funcion: Omit<IFuncion, 'id'>): Promise<void> {
    await this.validarDisponibilidad(funcion);

    const { error } = await this.supabase.Supabase.from('funciones').insert(funcion);
    if (error) throw error;
}

private async validarDisponibilidad(funcion: Omit<IFuncion, 'id'>): Promise<void> {
    // Validar que no haya otra función en la misma sala que se superponga con la nueva función
    const duracionNueva = await this.obtenerDuracion(funcion.pelicula_id);
    const inicioNueva = new Date(funcion.fecha_hora);
    const finNueva = this.sumarMinutos(inicioNueva, duracionNueva + MARGEN_MINUTOS);

    const { data, error } = await this.supabase.Supabase.from('funciones')
        .select('fecha_hora, peliculas(duracion_minutos)')
        .eq('sala_id', funcion.sala_id);

    if (error) throw error;


    for (const existente of data as any[])  {
        const inicioExistente = new Date(existente.fecha_hora);
        const finExistente = this.sumarMinutos(
        inicioExistente,
        existente.peliculas.duracion_minutos + MARGEN_MINUTOS,
        );

      const seSuperponen = inicioNueva < finExistente && inicioExistente < finNueva; // Verifica si los intervalos de tiempo se superponen
        if (seSuperponen) {
        throw new Error(
            'Ya hay una función en esa sala que choca con este horario (o con el margen de 30 min).',
        );
    }
    }
}

private async obtenerDuracion(pelicula_id: number): Promise<number> {
    const { data, error } = await this.supabase.Supabase.from('peliculas')
        .select('duracion_minutos')
        .eq('id', pelicula_id)
      .single(); // SINGLE ES PARA OBTENER UN SOLO REGISTRO, YA QUE EL ID ES ÚNICO

    if (error) throw error;
    return data.duracion_minutos;
}

private sumarMinutos(fecha: Date, minutos: number): Date {
    return new Date(fecha.getTime() + minutos * 60000);
    }

async obtenerPorId(id: number): Promise<IFuncion> {
const { data, error } = await this.supabase.Supabase
    .from('funciones')
    .select('*')
    .eq('id', id)
    .single();

if (error) throw error;
return data as IFuncion;
}


async obtenerPorPelicula(pelicula_id: number): Promise<IFuncionConSala[]> {
    const { data, error } = await this.supabase.Supabase
    .from('funciones')
    .select('*, salas(nombre)')
    .eq('pelicula_id', pelicula_id)
    .order('fecha_hora', { ascending: true });

    if (error) throw error;
    return data as unknown as IFuncionConSala[];
}

async obtenerDetalleCompra(id: number): Promise<{pelicula: string;sala: string;fecha_hora: string;formato: Formato;idioma: Idioma;}> {
    const { data, error } = await this.supabase.Supabase
        .from('funciones')
        .select('fecha_hora, formato, idioma, peliculas(nombre), salas(nombre)')
        .eq('id', id)
        .single();

    if (error) throw error;

    return {
        pelicula: (data as any).peliculas.nombre, //data as any porque no reconoce la relación con peliculas y salas, pero sabemos que existen
        sala: (data as any).salas.nombre,
        fecha_hora: data.fecha_hora,
        formato: data.formato,
        idioma: data.idioma,
    };
}

}

