// Una fila del reporte de facturación diaria: un día puntual, cuánto se
// facturó ese día (en pesos, solo lo pagado de verdad, sin contar lo
// canjeado con puntos) y cuántas entradas se vendieron.
export default interface IFacturacionDiaria {
    fecha: string; // 'YYYY-MM-DD'
    montoFacturado: number;
    entradasVendidas: number;
}