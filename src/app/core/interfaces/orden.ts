export default interface IOrden {
    id: number;
    usuario_id: string | null;
    codigo_qr: string;
    creado_en: string;
    candy_entregado_en: string | null;
}

export interface IOrdenConCandy {
    id: number;
    candy_entregado_en: string | null;
    orden_candy_items: { cantidad: number; candy_productos: { nombre: string } }[];
}