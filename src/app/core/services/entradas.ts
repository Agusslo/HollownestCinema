import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import { Ordenes } from './ordenes';
import { Candy } from './candy';
import { Fidelizacion } from './fidelizacion';
import { Formato } from '../interfaces/funcion';
import IPerfil from '../interfaces/perfil';
import IOrden from '../interfaces/orden';
import { IEntradaValidacion } from '../interfaces/entrada';
import ICanje from '../interfaces/canje';
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
  private fidelizacionService = inject(Fidelizacion);

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

  // Lo mismo que precioPorButaca(), pero en puntos en vez de pesos — se
  // usa tanto acá adentro (al validar/descontar un canje) como desde la
  // pantalla de butacas (para mostrar el costo antes de confirmar), así
  // el recargo VIP no queda duplicado en dos archivos.
  costoEntradaEnPuntos(puntosPorEntradaGratis: number, codigo: string): number {
    return tipoDeButaca(codigo) === 'vip'
      ? Math.round(puntosPorEntradaGratis * RECARGO_VIP)
      : puntosPorEntradaGratis;
  }

  async comprar(
    funcion_id: number,
    butacas: string[],
    usuario: IPerfil | null,
    candyItems: { producto_id: number; cantidad: number }[] = [],
    total: number = 0,
    creditoAUsar: number = 0,
    // Fidelización — canje: `butacasCanjeadas` es el subconjunto de
    // `butacas` que se paga con puntos en vez de plata (entrada gratis).
    // `candyCanjeado` es candy pagado con puntos — aparte de `candyItems`
    // (el candy pagado con plata), con `puntos` ya siendo el costo total
    // de esa línea (cantidad × puntos que vale 1 unidad).
    butacasCanjeadas: string[] = [],
    candyCanjeado: { producto_id: number; cantidad: number; puntos: number }[] = [],
  ): Promise<{
    orden: IOrden;
    entradas: { id: number; fila: string; columna: number; codigo_qr: string }[];
  }> {
    const aplicaCupon = usuario !== null && !usuario.cupon_primera_compra_usado;

    // 1. Cuánto cuesta en puntos lo que se quiere canjear. Se calcula acá
    // adentro con el valor que configuró el admin — no confiamos en un
    // total de puntos que mande el cliente (a diferencia del total en
    // pesos, que ya funcionaba así de antes). Las butacas VIP cuestan más
    // puntos, con el mismo recargo (RECARGO_VIP) que ya se les aplica en
    // pesos — si no, canjear una VIP "regalaría" ese recargo.
    const costoEnPuntosPorButaca = new Map<string, number>();
    let puntosGastados = 0;

    if (usuario && butacasCanjeadas.length > 0) {
      const config = await this.fidelizacionService.obtenerConfig();

      for (const codigo of butacasCanjeadas) {
        const costo = this.costoEntradaEnPuntos(config.puntos_por_entrada_gratis, codigo);

        costoEnPuntosPorButaca.set(codigo, costo);
        puntosGastados += costo;
      }
    }
    for (const item of candyCanjeado) {
      puntosGastados += item.puntos;
    }

    if (usuario && puntosGastados > usuario.puntos) {
      throw new Error('No tenés suficientes puntos para este canje.');
    }

    // 2. Creamos la orden primero — es el contenedor que agrupa esta
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
      .select('id, fila, columna, codigo_qr');

    if (error) throw error;

    // 3. Si eligió candy (pagado con plata, canjeado con puntos, o las
    // dos cosas), lo vinculamos a la misma orden — todo junto, porque
    // para retirarlo en el candy bar da igual cómo se pagó.
    if (candyItems.length > 0 || candyCanjeado.length > 0) {
      await this.candyService.agregarItems(orden.id, [
        ...candyItems,
        ...candyCanjeado.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })),
      ]);
    }

    // 4. Actualizaciones al perfil del comprador — todas juntas en un
    // solo update (cupón usado, crédito descontado, puntos ganados,
    // puntos gastados en el canje).
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
      // puntos sobre la parte cubierta con crédito ni sobre la pagada con
      // puntos — en ninguna de las dos salió plata de verdad, y sumar ahí
      // sería un loop infinito de puntos.
      const montoPagado = total - creditoAUsar;
      let puntosNuevos = usuario.puntos;
      if (montoPagado > 0) {
        puntosNuevos += Math.floor(montoPagado);
      }
      puntosNuevos -= puntosGastados;

      if (puntosNuevos !== usuario.puntos) {
        cambiosPerfil.puntos = puntosNuevos;
      }

      if (Object.keys(cambiosPerfil).length > 0) {
        const { error: errorPerfil } = await this.supabase.Supabase.from('perfiles')
          .update(cambiosPerfil)
          .eq('id', usuario.id);

        if (errorPerfil) throw errorPerfil;
      }
    }

    // 5. Recién con las entradas ya insertadas (necesitamos sus id) y el
    // perfil ya actualizado, guardamos el historial de canjes.
    if (usuario && puntosGastados > 0) {
      const canjes: Omit<ICanje, 'id' | 'creado_en'>[] = [];

      for (const entrada of data) {
        const codigo = `${entrada.fila}${entrada.columna}`;
        const costo = costoEnPuntosPorButaca.get(codigo);
        if (costo === undefined) continue; // esta butaca no se canjeó, se pagó normal

        canjes.push({
          usuario_id: usuario.id,
          orden_id: orden.id,
          tipo: 'entrada',
          entrada_id: entrada.id,
          candy_producto_id: null,
          cantidad: 1,
          puntos_gastados: costo,
        });
      }

      for (const item of candyCanjeado) {
        canjes.push({
          usuario_id: usuario.id,
          orden_id: orden.id,
          tipo: 'candy',
          entrada_id: null,
          candy_producto_id: item.producto_id,
          cantidad: item.cantidad,
          puntos_gastados: item.puntos,
        });
      }

      // Este insert es sólo el historial (para que lo veas en tu perfil) —
      // la compra en sí ya quedó confirmada arriba (entradas creadas,
      // puntos ya descontados del perfil). Si esto falla por lo que sea
      // (ej. la tabla `canjes` recién creada y la cache de Supabase
      // todavía no se enteró), no tiene que arruinar la compra que la
      // persona ya pagó: sólo avisamos por consola y seguimos.
      try {
        await this.fidelizacionService.registrarCanjes(canjes);
      } catch (e) {
        console.warn('No se pudo guardar el historial de canjes (la compra sí se realizó):', e);
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