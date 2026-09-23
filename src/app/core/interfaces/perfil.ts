export type Rol = 'cliente' | 'empleado' | 'admin';

export default interface IPerfil {
    id: string;
    nombre: string;
    apellido: string;
    fecha_nacimiento: string;
    tipo_sangre: string;
    color_ojos: string;
    dias_vacaciones: number;
    cupon_primera_compra_usado: boolean;
    rol: Rol;
    perfil_completo: boolean;
    credito: number;
}