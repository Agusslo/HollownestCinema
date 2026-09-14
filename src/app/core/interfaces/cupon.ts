export type TipoCupon = 'primera_compra' | 'mayor_50';

export default interface ICupon {
    id: number;
    tipo: TipoCupon;
    porcentaje: number;
}