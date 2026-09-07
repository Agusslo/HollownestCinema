import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import { Formato } from '../interfaces/funcion';
import IPerfil from '../interfaces/perfil';

const PRECIOS_POR_FORMATO: Record<Formato, number> = {
'2d': 18800,
'3d': 24400,
'4d': 28600,
'5d': 33000,
};

@Service()
export class Entradas {
private supabase = inject(Supabase);

async obtenerButacasOcupadas(funcion_id: number): Promise<string[]> {
    const { data, error } = await this.supabase.Supabase
    .from('entradas')
    .select('fila, columna')
    .eq('funcion_id', funcion_id);

    if (error) throw error;
    return data.map((e) => `${e.fila}${e.columna}`);
}

precioPorFormato(formato: Formato): number {
    return PRECIOS_POR_FORMATO[formato];
}


async comprar(funcion_id: number, butacas: string[], usuario: IPerfil | null,): Promise<{ fila: string; columna: number; codigo_qr: string }[]> {
    const aplicaCupon = usuario !== null && !usuario.cupon_primera_compra_usado;

    const nuevasEntradas = butacas.map((butaca) => ({
        funcion_id,
        usuario_id: usuario?.id ?? null,
        fila: butaca[0],
        columna: Number(butaca.slice(1)),
        codigo_qr: crypto.randomUUID(),
    }));

    const { data, error } = await this.supabase.Supabase
        .from('entradas')
        .insert(nuevasEntradas)
        .select('fila, columna, codigo_qr');

    if (error) throw error;

    if (aplicaCupon) {
        const { error: errorPerfil } = await this.supabase.Supabase
        .from('perfiles')
        .update({ cupon_primera_compra_usado: true })
        .eq('id', usuario!.id);

        if (errorPerfil) throw errorPerfil;
    }

    return data;
}
}