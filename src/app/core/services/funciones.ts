import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IFuncion from '../interfaces/funcion';

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

    console.log('funciones existentes en esa sala:', JSON.stringify(data, null, 2)); // <-- ACÁ

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
}
