import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import ICandyCategoria from '../interfaces/candy-categoria';
import ICandyProducto, { ICandyProductoConCategoria } from '../interfaces/candy-producto';

@Service()
export class Candy {
    // Inyectamos el servicio de Supabase para poder usarlo en los métodos de la clase
    // Esto nos permite acceder a la instancia de Supabase y realizar consultas a la base de datos
    private supabase = inject(Supabase);

    async obtenerCategorias(): Promise<ICandyCategoria[]> {
        const { data, error } = await this.supabase.Supabase.from('candy_categorias')
        .select('*')
        .order('nombre');

        if (error) throw error;
        return data as ICandyCategoria[];
    }

    async obtenerProductos(): Promise<ICandyProductoConCategoria[]> {
        const { data, error } = await this.supabase.Supabase.from('candy_productos')
        .select('*, candy_categorias(nombre)')
        .order('nombre');

        if (error) throw error;
        return data as unknown as ICandyProductoConCategoria[];
    }

    async crearProducto(producto: Omit<ICandyProducto, 'id'>): Promise<ICandyProducto> { //abm
        const { data, error } = await this.supabase.Supabase.from('candy_productos')
            .insert(producto)
            .select()
            .single();

        if (error) throw error;
        return data as ICandyProducto;
    }

    async agregarItems(
        orden_id: number,
        items: { producto_id: number; cantidad: number }[],
        ): Promise<void> {
        if (items.length === 0) return;

        const filas = items.map((item) => ({ orden_id, ...item }));
        const { error } = await this.supabase.Supabase.from('orden_candy_items').insert(filas);
        if (error) throw error;
    }
}