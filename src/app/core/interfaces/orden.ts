export default interface IOrden {
    id: number;
    usuario_id: string | null;
    codigo_qr: string;
    creado_en: string;
    candy_entregado_en: string | null;
    total: number;
    credito_usado: number;
    cancelada_en: string | null;
}

// Vista para la pantalla de validación del empleado: trae los items de
// candy de esta orden (con el nombre del producto) para poder mostrar
// qué hay que entregar antes de confirmar.
export interface IOrdenConCandy {
    id: number;
    candy_entregado_en: string | null;
    orden_candy_items: { cantidad: number; candy_productos: { nombre: string } }[];
}

// Vista para "Mis compras": trae todo lo necesario para mostrar y
// eventualmente cancelar una compra — función, entradas y candy.
export interface IOrdenConDetalle {
    id: number;
    creado_en: string;
    total: number;
    credito_usado: number;
    cancelada_en: string | null;
    entradas: {
        id: number;
        fila: string;
        columna: number;
        validada_en: string | null;
        funciones: {
            fecha_hora: string;
            formato: string;
            idioma: string;
            // id e imagen_url se agregaron para "Mis películas": ahí
            // necesitamos poder agrupar por película y mostrar su póster,
            // cosa que "Mis compras" no necesitaba antes (por eso no
            // estaban acá).
            peliculas: { id: number; nombre: string; imagen_url: string };
            salas: { nombre: string };
        };
    }[];
    orden_candy_items: { cantidad: number; candy_productos: { nombre: string } }[];
    // Qué de esta orden se pagó con puntos (Fidelización) — vacío si la
    // orden se pagó entera con plata/crédito. `entrada_id` identifica cuál
    // entrada puntual fue, para poder aclararlo butaca por butaca.
    canjes: { tipo: 'entrada' | 'candy'; entrada_id: number | null; puntos_gastados: number }[];
}