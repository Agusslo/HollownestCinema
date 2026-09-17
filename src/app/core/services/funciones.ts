import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IFuncion, { IFuncionConSala, Formato, Idioma } from '../interfaces/funcion';
import ISala from '../interfaces/sala';

const MARGEN_MINUTOS = 30;

@Service()
export class Funciones {
    private supabase = inject(Supabase);

// Ya no recibe sala_id: la elige sola, probando las salas en orden y
// devolviendo la primera que esté libre en ese horario (con el margen).
async crear(funcion: Omit<IFuncion, 'id' | 'sala_id'>): Promise<{ sala_id: number; sala_nombre: string }> {
    const duracion = await this.obtenerDuracion(funcion.pelicula_id);
    const inicioNueva = new Date(funcion.fecha_hora);
    const finNueva = this.sumarMinutos(inicioNueva, duracion + MARGEN_MINUTOS);

    const { data: salas, error: errorSalas } = await this.supabase.Supabase.from('salas').select('*');
    if (errorSalas) throw errorSalas;

    for (const sala of salas as ISala[]) {
        if (await this.estaLibre(sala.id, inicioNueva, finNueva)) {
            const { error } = await this.supabase.Supabase.from('funciones')
                .insert({ ...funcion, sala_id: sala.id });
            if (error) throw error;
            return { sala_id: sala.id, sala_nombre: sala.nombre };
        }
    }

    throw new Error(
        'No hay ninguna sala disponible en ese horario (contando el margen de 30 min). Probá con otro horario.',
    );
}

// Devuelve true si esa sala puntual no tiene ninguna función que se
// superponga con el rango [inicioNueva, finNueva). Mismo cálculo de
// superposición que antes, pero ahora reutilizable sala por sala.
private async estaLibre(sala_id: number, inicioNueva: Date, finNueva: Date): Promise<boolean> {
    const { data, error } = await this.supabase.Supabase.from('funciones')
        .select('fecha_hora, peliculas(duracion_minutos)')
        .eq('sala_id', sala_id);

    if (error) throw error;

    for (const existente of data as any[]) {
        const inicioExistente = new Date(existente.fecha_hora);
        const finExistente = this.sumarMinutos(
            inicioExistente,
            existente.peliculas.duracion_minutos + MARGEN_MINUTOS,
        );

        const seSuperponen = inicioNueva < finExistente && inicioExistente < finNueva;
        if (seSuperponen) return false;
    }

    return true;
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