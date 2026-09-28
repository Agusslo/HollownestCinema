// Una fila del reporte de facturación diaria: un día puntual, cuánto se
// facturó ese día (en pesos, solo lo pagado de verdad, sin contar lo
// canjeado con puntos) y cuántas entradas se vendieron.
export default interface IFacturacionDiaria {
    fecha: string; // 'YYYY-MM-DD'
    montoFacturado: number;
    entradasVendidas: number;
}

// Una fila del ranking de "películas más vistas": la película y cuántas
// entradas vendió dentro de la ventana de tiempo que se esté mirando
// (última semana o último mes).
export interface IPeliculaMasVista {
    pelicula_id: number;
    nombre: string;
    cantidad: number;
}

// Lo que devuelve el reporte completo: los dos rankings ya armados y
// ordenados, listos para dibujar.
export interface IReporteMasVistas {
    semana: IPeliculaMasVista[];
    mes: IPeliculaMasVista[];
}