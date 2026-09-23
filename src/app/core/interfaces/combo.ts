export default interface ICombo {
    id: number;
    nombre: string;
    precio: number;
    activo: boolean;
}

// Un combo "con sus items": trae qué productos de candy incluye y en qué
// cantidad, con el nombre del producto ya resuelto (join), para poder
// mostrar "Incluye: 2 Pochoclos grandes + 1 Gaseosa" sin otra consulta.
export interface IComboConItems extends ICombo {
    combo_items: {
        cantidad: number;
        producto_id: number;
        candy_productos: { nombre: string };
    }[];
}