import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import { Ordenes } from './ordenes';
import { Candy } from './candy';
import { Fidelizacion } from './fidelizacion';
import { Precios } from './precios';
import { Formato } from '../interfaces/funcion';
import IPerfil from '../interfaces/perfil';
import IOrden from '../interfaces/orden';
import ICanje from '../interfaces/canje';
import IPreciosEntradas, { COLUMNA_PRECIO } from '../interfaces/precios';
import { tipoDeButaca } from './butacas';

// Los precios por formato y el recargo VIP ya no están fijos acá: los
// configura el admin (pantalla "Precios", tabla precios_entradas) y se
// pasan como parámetro. La consigna sólo pide que las VIP sean "más
// caras"; el porcentaje lo elige el admin (arranca en 30%).

// Suma el recargo VIP (un porcentaje, ej. 30) a un valor en pesos o puntos.
export function conRecargoVip(valor: number, recargoVip: number): number {
  return Math.round(valor * (1 + recargoVip / 100));
}

// Tope de butacas que una misma persona puede comprar para UNA función
// (sumando todas sus compras de esa función, no sólo la actual). Como es
// por función, no hace falta "resetear" nada: la función de mañana es otra
// y arranca de cero.
export const MAX_BUTACAS_POR_FUNCION = 6;

// Código de Postgres para "duplicate key value violates unique constraint".
// En `entradas` la única restricción así es (funcion_id, fila, columna):
// o sea, la butaca ya tiene una entrada.
const CODIGO_DUPLICADO = '23505';

// Error propio para "esa butaca ya está vendida", así la pantalla de
// butacas lo puede distinguir de cualquier otro error y reaccionar
// (actualizar el mapa y sacarla de la selección) en vez de mostrar el
// mensaje crudo de la base de datos. `butacas` son los códigos en
// conflicto; viene vacío si no se pudo saber cuáles (dos personas
// comprando justo al mismo tiempo).
export class ButacasOcupadasError extends Error {
  constructor(public readonly butacas: string[]) {
    super(
      butacas.length === 1
        ? `La butaca ${butacas[0]} ya no está disponible. La sacamos de tu selección: elegí otra.`
        : butacas.length > 1
          ? `Las butacas ${butacas.join(', ')} ya no están disponibles. Las sacamos de tu selección: elegí otras.`
          : 'Alguna de las butacas que elegiste se acaba de ocupar. Actualizamos el mapa: revisá tu selección.',
    );
  }
}

@Service()
export class Entradas {
  private supabase = inject(Supabase);
  private ordenesService = inject(Ordenes);
  private candyService = inject(Candy);
  private fidelizacionService = inject(Fidelizacion);
  private preciosService = inject(Precios);

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

  // De las butacas pedidas, cuáles ya tienen una entrada vigente en esta
  // función. Las de compras canceladas no cuentan: al cancelar, un trigger
  // de la base marca sus entradas con cancelada = true, y la regla de "una
  // entrada por butaca" (índice único entradas_butaca_activa) sólo mira
  // las no canceladas. Así la butaca se puede volver a vender.
  private async butacasYaVendidas(funcion_id: number, butacas: string[]): Promise<string[]> {
    const filas = [...new Set(butacas.map((butaca) => butaca[0]))];
    const { data, error } = await this.supabase.Supabase.from('entradas')
      .select('fila, columna')
      .eq('funcion_id', funcion_id)
      .eq('cancelada', false)
      .in('fila', filas);

    if (error) throw error;
    const existentes = new Set(data.map((e) => `${e.fila}${e.columna}`));
    return butacas.filter((butaca) => existentes.has(butaca));
  }

  // Cuántas butacas ya tiene compradas esta persona para esta función. Las
  // de compras canceladas no cuentan: al cancelar recupera ese cupo.
  async butacasCompradasPorUsuario(funcion_id: number, usuario_id: string): Promise<number> {
    const { data, error } = await this.supabase.Supabase.from('entradas')
      .select('id, ordenes!inner(cancelada_en)')
      .eq('funcion_id', funcion_id)
      .eq('usuario_id', usuario_id)
      .is('ordenes.cancelada_en', null);

    if (error) throw error;
    return data.length;
  }

  // Precio de una butaca puntual: el precio base del formato, más el
  // recargo si esa butaca es VIP (filas R, S, T). Los dos valores salen de
  // `precios`, lo que configuró el admin.
  //
  // Preventa: si la película está en preventa, se pasa su precio especial
  // como tercer parámetro, y reemplaza al precio base del formato. Pero se
  // cobra el MENOR de los dos: la preventa es un beneficio, nunca puede
  // salir más cara que la entrada normal. Ejemplo con preventa a $24.000:
  //   - 2D (normal $18.800) → $18.800 (la preventa sería más cara)
  //   - 4D (normal $28.600) → $24.000
  //   - 4D VIP con recargo de 30% → $24.000 × 1,3 = $31.200 (el recargo
  //     VIP se suma encima)
  // Si no se pasa (null), es el precio normal del formato.
  precioPorButaca(
    precios: IPreciosEntradas,
    formato: Formato,
    codigo: string,
    precioPreventa: number | null = null,
  ): number {
    const normal = precios[COLUMNA_PRECIO[formato]];
    const base = precioPreventa !== null ? Math.min(precioPreventa, normal) : normal;
    return tipoDeButaca(codigo) === 'vip' ? conRecargoVip(base, precios.recargo_vip) : base;
  }

  // Lo mismo que precioPorButaca(), pero en puntos en vez de pesos — se
  // usa tanto acá adentro (al validar/descontar un canje) como desde la
  // pantalla de butacas (para mostrar el costo antes de confirmar), así
  // el recargo VIP no queda duplicado en dos archivos.
  costoEntradaEnPuntos(puntosPorEntradaGratis: number, codigo: string, recargoVip: number): number {
    return tipoDeButaca(codigo) === 'vip'
      ? conRecargoVip(puntosPorEntradaGratis, recargoVip)
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

    // 0. Antes de crear nada, chequeamos que ninguna de las butacas tenga
    // ya una entrada. El mapa puede estar desactualizado (otra pestaña, un
    // intento anterior que quedó a medias), y si recién nos enteráramos al
    // insertar ya habría quedado una orden vacía creada.
    const yaVendidas = await this.butacasYaVendidas(funcion_id, butacas);
    if (yaVendidas.length > 0) {
      throw new ButacasOcupadasError(yaVendidas);
    }

    // Límite por persona y por función. La pantalla ya no deja elegir de
    // más, pero se vuelve a chequear acá con el dato fresco de la base
    // (pudo haber comprado desde otra pestaña mientras tanto). En una
    // compra anónima no hay a quién sumarle las anteriores, así que el
    // tope vale sólo para esta compra.
    const yaCompradas = usuario
      ? await this.butacasCompradasPorUsuario(funcion_id, usuario.id)
      : 0;
    if (yaCompradas + butacas.length > MAX_BUTACAS_POR_FUNCION) {
      const restantes = Math.max(0, MAX_BUTACAS_POR_FUNCION - yaCompradas);
      throw new Error(
        restantes === 0
          ? `Ya compraste las ${MAX_BUTACAS_POR_FUNCION} butacas permitidas para esta función.`
          : `Se pueden comprar hasta ${MAX_BUTACAS_POR_FUNCION} butacas por función: te quedan ${restantes}.`,
      );
    }

    // 1. Cuánto cuesta en puntos lo que se quiere canjear. Se calcula acá
    // adentro con el valor que configuró el admin — no confiamos en un
    // total de puntos que mande el cliente (a diferencia del total en
    // pesos, que ya funcionaba así de antes). Las butacas VIP cuestan más
    // puntos, con el mismo recargo VIP que ya se les aplica en pesos — si
    // no, canjear una VIP "regalaría" ese recargo.
    const costoEnPuntosPorButaca = new Map<string, number>();
    let puntosGastados = 0;

    if (usuario && butacasCanjeadas.length > 0) {
      const [config, precios] = await Promise.all([
        this.fidelizacionService.obtenerConfig(),
        this.preciosService.obtener(),
      ]);

      for (const codigo of butacasCanjeadas) {
        const costo = this.costoEntradaEnPuntos(
          config.puntos_por_entrada_gratis,
          codigo,
          precios.recargo_vip,
        );

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
    // compra completa (entradas + candy). Su codigo_qr es el ÚNICO QR de
    // la compra: sirve tanto para entrar a la sala como para retirar el
    // candy bar (las entradas siguen guardando un codigo_qr propio porque
    // la tabla lo pide, pero ya no se imprime). Guarda el total real
    // pagado y cuánto de eso fue con crédito, para poder calcular bien
    // cuánto devolver si el día de mañana se cancela.
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

    if (error) {
      // No se guardó ninguna entrada, así que la orden recién creada quedó
      // vacía: la borramos para que no aparezca en "Mis compras". Si el
      // borrado no se puede hacer, no tapamos el error original.
      await this.supabase.Supabase.from('ordenes').delete().eq('id', orden.id);

      // Pasó el chequeo del paso 0 pero otra persona compró la misma
      // butaca en el medio.
      if (error.code === CODIGO_DUPLICADO) throw new ButacasOcupadasError([]);
      throw error;
    }

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

  // Marca como validadas todas las entradas de una compra (el QR es uno
  // solo por orden, así que entran todas juntas). Devuelve las que se
  // validaron AHORA: si viene vacío es que ya estaban todas usadas (el
  // .is('validada_en', null) hace que el update no toque esas filas, en
  // vez de tener que consultar y actualizar por separado).
  async validarDeOrden(orden_id: number): Promise<{ fila: string; columna: number }[]> {
    const { data, error } = await this.supabase.Supabase.from('entradas')
      .update({ validada_en: new Date().toISOString() })
      .eq('orden_id', orden_id)
      .is('validada_en', null)
      .select('fila, columna');

    if (error) throw error;
    return data ?? [];
  }
}