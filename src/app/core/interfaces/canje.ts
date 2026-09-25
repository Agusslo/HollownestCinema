// Fila única (id=1) con el valor que el admin configura: cuántos puntos
// vale canjear 1 entrada gratis. Mismo patrón que ya usás en `cupones`
// (fila fija editable), en vez de un ABM completo para un solo número.
export interface IFidelizacionConfig {
    id: number;
    puntos_por_entrada_gratis: number;
}

export type TipoCanje = 'entrada' | 'candy';

// Un renglón del historial de canjes de un usuario. `entrada_id` o
// `candy_producto_id` está seteado según el `tipo` (nunca los dos a la vez).
export default interface ICanje {
    id: number;
    usuario_id: string;
    orden_id: number;
    tipo: TipoCanje;
    entrada_id: number | null;
    candy_producto_id: number | null;
    cantidad: number;
    puntos_gastados: number;
    creado_en: string;
}

// Con el nombre de la película o del producto embebido (join), para
// mostrar el historial directo en la pantalla sin pedir cada entidad aparte.
export interface ICanjeConDetalle extends ICanje {
    entradas: { funciones: { peliculas: { nombre: string } } } | null;
    candy_productos: { nombre: string } | null;
}