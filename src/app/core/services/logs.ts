import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import { ILogActividadConUsuario } from '../interfaces/log-actividad';

@Service()
export class Logs {
    private supabase = inject(Supabase);

    // usuario_id lo tiene que traer quien llama (ya lo tienen cargado en
    // pantalla, por venir de una ruta protegida por rol) — este servicio
    // no adivina quién está logueado, sólo guarda lo que le pasan.
    async registrar(usuario_id: string, accion: string): Promise<void> {
        const { error } = await this.supabase.Supabase.from('log_actividad').insert({
            usuario_id,
            accion,
        });
        if (error) throw error;
    }

    async obtenerTodo(): Promise<ILogActividadConUsuario[]> {
        const { data, error } = await this.supabase.Supabase.from('log_actividad')
            .select('*, perfiles ( nombre, apellido )')
            .order('creado_en', { ascending: false });

        if (error) throw error;
        return data as unknown as ILogActividadConUsuario[];
    }
}