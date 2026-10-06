    import { Formato } from './funcion';

    // Fila única (id = 1) de la tabla precios_entradas: lo que el admin
    // configura en la pantalla "Precios". Mismo patrón que fidelizacion_config.
    export default interface IPreciosEntradas {
    id: number;
    precio_2d: number;
    precio_3d: number;
    precio_4d: number;
    precio_5d: number;
    // Porcentaje que se suma en las butacas VIP: 30 = un 30% más caras
    // (en pesos y también en puntos si se canjean).
    recargo_vip: number;
    }

    // Para recorrer los formatos en orden (pantalla de admin, vista previa) y
    // saber en qué columna de la tabla está el precio de cada uno.
    export const COLUMNA_PRECIO: Record<Formato, 'precio_2d' | 'precio_3d' | 'precio_4d' | 'precio_5d'> = {
    '2d': 'precio_2d',
    '3d': 'precio_3d',
    '4d': 'precio_4d',
    '5d': 'precio_5d',
    };