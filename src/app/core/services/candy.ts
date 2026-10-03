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

    // Por defecto sólo los que están a la venta (pantalla de compra y armado
    // de combos). La pantalla de admin "Productos" pide todos.
    async obtenerProductos(incluirInactivos = false): Promise<ICandyProductoConCategoria[]> {
        let consulta = this.supabase.Supabase.from('candy_productos')
            .select('*, candy_categorias(nombre)')
            .order('nombre');

        if (!incluirInactivos) {
            consulta = consulta.eq('activo', true);
        }

        const { data, error } = await consulta;
        if (error) throw error;
        return data as unknown as ICandyProductoConCategoria[];
    }

    // activo no se manda: la base lo crea a la venta (default true).
    async crearProducto(producto: Omit<ICandyProducto, 'id' | 'activo'>): Promise<ICandyProducto> {
        const { data, error } = await this.supabase.Supabase.from('candy_productos')
            .insert(producto)
            .select()
            .single();

        if (error) throw error;
        return data as ICandyProducto;
    }

    // Modificación: el admin cambia el precio y/o los puntos de canje.
    async actualizarProducto(
        id: number,
        cambios: Partial<Pick<ICandyProducto, 'precio' | 'puntos_canje' | 'activo'>>,
    ): Promise<void> {
        const { error } = await this.supabase.Supabase.from('candy_productos')
            .update(cambios)
            .eq('id', id);

        if (error) throw error;
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