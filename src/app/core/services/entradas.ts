import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import { Ordenes } from './ordenes';
import { Candy } from './candy';
import { Formato } from '../interfaces/funcion';
import IPerfil from '../interfaces/perfil';
import IOrden from '../interfaces/orden';

const PRECIOS_POR_FORMATO: Record<Formato, number> = {
  '2d': 18800,
  '3d': 24400,
  '4d': 28600,
  '5d': 33000,
};

@Service()
export class Entradas {
  private supabase = inject(Supabase);
  private ordenesService = inject(Ordenes);
  private candyService = inject(Candy);

  async obtenerButacasOcupadas(funcion_id: number): Promise<string[]> {
    const { data, error } = await this.supabase.Supabase.from('entradas')
      .select('fila, columna')
      .eq('funcion_id', funcion_id);

    if (error) throw error;
    return data.map((e) => `${e.fila}${e.columna}`);
  }

  precioPorFormato(formato: Formato): number {
    return PRECIOS_POR_FORMATO[formato];
  }

  async comprar(
    funcion_id: number,
    butacas: string[],
    usuario: IPerfil | null,
    candyItems: { producto_id: number; cantidad: number }[] = [],
  ): Promise<{
    orden: IOrden;
    entradas: { fila: string; columna: number; codigo_qr: string }[];
  }> {
    const aplicaCupon = usuario !== null && !usuario.cupon_primera_compra_usado;

    // 1. Creamos la orden primero — es el contenedor que agrupa esta
    // compra completa (entradas + candy). Su codigo_qr es el que sirve
    // para retirar el candy bar, separado del QR de cada butaca.
    const orden = await this.ordenesService.crear(usuario?.id ?? null);

    const nuevasEntradas = butacas.map((butaca) => ({
      funcion_id,
      usuario_id: usuario?.id ?? null,
      orden_id: orden.id,
      fila: butaca[0],
      columna: Number(butaca.slice(1)),
      codigo_qr: crypto.randomUUID(),
    }));

    const { data, error } = await this.supabase.Supabase.from('entradas')
      .insert(nuevasEntradas)
      .select('fila, columna, codigo_qr');

    if (error) throw error;

    // 2. Si eligió candy, lo vinculamos a la misma orden
    if (candyItems.length > 0) {
      await this.candyService.agregarItems(orden.id, candyItems);
    }

    if (aplicaCupon) {
      const { error: errorPerfil } = await this.supabase.Supabase.from('perfiles')
        .update({ cupon_primera_compra_usado: true })
        .eq('id', usuario!.id);

      if (errorPerfil) throw errorPerfil;
    }

    return { orden, entradas: data };
  }
}