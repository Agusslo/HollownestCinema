export default interface ICandyProducto {
    id: number;
    nombre: string;
    precio: number;
    categoria_id: number;
    imagen_url: string | null;
}

// Con la categoría embebida (join), para mostrar en la grilla del candy bar
export interface ICandyProductoConCategoria extends ICandyProducto {
    candy_categorias: { nombre: string };
}