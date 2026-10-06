import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import ICupon, { TipoCupon } from '../interfaces/cupon';
import IPerfil from '../interfaces/perfil';

@Service()
export class Cupones {
    private supabase = inject(Supabase);

    async obtenerTodos(): Promise<ICupon[]> {
        const { data, error } = await this.supabase.Supabase.from('cupones').select('*');
        if (error) throw error;
        return data as ICupon[];
    }

    async actualizarPorcentaje(tipo: TipoCupon, porcentaje: number): Promise<void> {
        const { error } = await this.supabase.Supabase.from('cupones')
            .update({ porcentaje })
            .eq('tipo', tipo);

        if (error) throw error;
    }

    // Dado el usuario y la lista de cupones, calcula qué porcentaje de descuento corresponde aplicar — el mayor entre los que apliquen, sin acumular. Devuelve 0 si no aplica ninguno.
    calcularDescuento(usuario: IPerfil | null, cupones: ICupon[]): number {
        if (!usuario) return 0;

        const aplicables: number[] = [];

        const cuponPrimeraCompra = cupones.find((c) => c.tipo === 'primera_compra');
        if (cuponPrimeraCompra && !usuario.cupon_primera_compra_usado) {
            aplicables.push(cuponPrimeraCompra.porcentaje);
        }

        // "Mayores de 50": con 50 años justos todavía no aplica (> 50, no >= 50).
        const cuponMayor50 = cupones.find((c) => c.tipo === 'mayor_50');
        if (cuponMayor50 && this.calcularEdad(usuario.fecha_nacimiento) > 50) {
            aplicables.push(cuponMayor50.porcentaje);
        }

    return aplicables.length > 0 ? Math.max(...aplicables) : 0;
    }

    private calcularEdad(fechaNacimiento: string): number {
        const hoy = new Date();
        // "T00:00:00" para que la fecha se lea en hora LOCAL: new Date('1975-10-06')
        // la toma como medianoche UTC, que en Argentina es el día anterior a las
        // 21 h, y el cumpleaños se contaría un día antes.
        const nacimiento = new Date(`${fechaNacimiento.slice(0, 10)}T00:00:00`);
        let edad = hoy.getFullYear() - nacimiento.getFullYear();

        // Si todavía no pasó el cumpleaños este año, restamos 1 —
        // sin esto, alguien que nació el 31/12 ya contaría como "un año
        // más grande" desde el 1/1, aunque falten 364 días para su cumpleaños.
        const noLlegoElCumple =
            hoy.getMonth() < nacimiento.getMonth() ||
            (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
        if (noLlegoElCumple) edad--;

        return edad;
    }
}