import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import { Ordenes } from './ordenes';
import { Candy } from './candy';
import { Formato } from '../interfaces/funcion';
import IPerfil from '../interfaces/perfil';
import IOrden from '../interfaces/orden';
import { IEntradaValidacion } from '../interfaces/entrada';
import { tipoDeButaca } from './butacas';

const PRECIOS_POR_FORMATO: Record<Formato, number> = {
  '2d': 18800,
  '3d': 24400,
  '4d': 28600,
  '5d': 33000,
};

// Recargo de las butacas VIP (últimas 3 filas de cada sala) sobre el
// precio base del formato. 30% es un valor elegido por nosotros — la
// consigna sólo pide que sean "más caras", no da un número.
const RECARGO_VIP = 1.3;

@Service()
export class Entradas {
  private supabase = inject(Supabase);
  private ordenesService = inject(Ordenes);
  private candyService = inject(Candy);

  // Trae las butacas ocupadas de esta función — pero si la orden a la que
  // pertenece una entrada está cancelada, esa butaca NO cuenta como
  // ocupada. Si no filtráramos esto, cancelar una compra nunca liberaría
  // el asiento para que otro lo compre.
  async obtenerButacasOcupadas(funcion_id: number): Promise<string[]> {
    const { data, error } = await this.supabase.Supabase.from('entradas')
      .select('fila, columna, ordenes!inner(cancelada_en)')
      .eq('funcion_id', funcion_id)
      .is('ordenes.cancelada_en', null);

    if (error) throw error;
    return data.map((e) => `${e.fila}${e.columna}`);
  }

  // Precio de una butaca puntual: el precio base del formato, más el
  // recargo si esa butaca es VIP (filas R, S, T).
  precioPorButaca(formato: Formato, codigo: string): number {
    const base = PRECIOS_POR_FORMATO[formato];
    return tipoDeButaca(codigo) === 'vip' ? Math.round(base * RECARGO_VIP) : base;
  }

  async comprar(
    funcion_id: number,
    butacas: string[],
    usuario: IPerfil | null,
    candyItems: { producto_id: number; cantidad: number }[] = [],
    total: number = 0,
    creditoAUsar: number = 0,
  ): Promise<{
    orden: IOrden;
    entradas: { fila: string; columna: number; codigo_qr: string }[];
  }> {
    const aplicaCupon = usuario !== null && !usuario.cupon_primera_compra_usado;

    // 1. Creamos la orden primero — es el contenedor que agrupa esta
    // compra completa (entradas + candy). Su codigo_qr es el que sirve
    // para retirar el candy bar, separado del QR de cada butaca. Guarda
    // el total real pagado y cuánto de eso fue con crédito, para poder
    // calcular bien cuánto devolver si el día de mañana se cancela.
    const orden = await this.ordenesService.crear(usuario?.id ?? null, total, creditoAUsar);

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

    // 3. Actualizaciones al perfil del comprador — todas juntas en un
    // solo update en vez de 3 llamadas separadas (cupón usado, crédito
    // descontado, puntos ganados).
    if (usuario) {
      const cambiosPerfil: Partial<
        Pick<IPerfil, 'cupon_primera_compra_usado' | 'credito' | 'puntos'>
      > = {};

      if (aplicaCupon) {
        cambiosPerfil.cupon_primera_compra_usado = true;
      }
      if (creditoAUsar > 0) {
        cambiosPerfil.credito = usuario.credito - creditoAUsar;
      }

      // Fidelización: 1 punto por cada peso REALMENTE pagado. No sumamos
      // puntos sobre la parte cubierta con crédito — ahí no salió plata
      // de verdad de ningún lado.
      const montoPagado = total - creditoAUsar;
      if (montoPagado > 0) {
        cambiosPerfil.puntos = usuario.puntos + Math.floor(montoPagado);
      }

      if (Object.keys(cambiosPerfil).length > 0) {
        const { error: errorPerfil } = await this.supabase.Supabase.from('perfiles')
          .update(cambiosPerfil)
          .eq('id', usuario.id);

        if (errorPerfil) throw errorPerfil;
      }
    }

    return { orden, entradas: data };
  }

  // Busca una entrada por su código de QR (o el que se escribió a mano) y
  // trae los datos de la función para que el empleado pueda verificar
  // antes de confirmar. No modifica nada.
  async buscarPorCodigo(codigo_qr: string): Promise<IEntradaValidacion | null> {
    const { data, error } = await this.supabase.Supabase.from('entradas')
      .select(
        `id, fila, columna, validada_en,
         funciones ( fecha_hora, formato, idioma,
           peliculas ( nombre ),
           salas ( nombre ) )`,
      )
      .eq('codigo_qr', codigo_qr)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as IEntradaValidacion | null;
  }

  // Marca la entrada como validada. Devuelve false si ya estaba validada
  // (el .is('validada_en', null) hace que el update no afecte ninguna fila
  // en ese caso, en vez de tener que consultar y actualizar por separado).
  async validar(id: number): Promise<boolean> {
    const { data, error } = await this.supabase.Supabase.from('entradas')
      .update({ validada_en: new Date().toISOString() })
      .eq('id', id)
      .is('validada_en', null)
      .select('id');

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
}