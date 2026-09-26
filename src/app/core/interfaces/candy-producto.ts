export default interface ICandyProducto {
    id: number;
    nombre: string;
    precio: number;
    categoria_id: number;
    imagen_url: string | null;
    // Fidelización: en cuántos puntos se puede canjear 1 unidad de este
    // producto. null = este producto no se puede canjear con puntos,
    // sólo se compra con plata/crédito.
    puntos_canje: number | null;
}

// Con la categoría embebida (join), para mostrar en la grilla del candy bar
export interface ICandyProductoConCategoria extends ICandyProducto {
    candy_categorias: { nombre: string };
}