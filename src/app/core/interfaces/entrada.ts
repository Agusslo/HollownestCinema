export default interface IEntrada {
    id: number;
    funcion_id: number;
    usuario_id: string | null;
    orden_id: number;
    fila: string;
    columna: number;
    codigo_qr: string;
    validada_en: string | null;
}