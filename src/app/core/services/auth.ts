import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';

export interface DatosRegistro {
email: string;
password: string;
nombre: string;
apellido: string;
fecha_nacimiento: string;
tipo_sangre: string;
color_ojos: string;
dias_vacaciones: number;
}

@Service()
export class Auth {
private supabase = inject(Supabase);

async registrar(datos: DatosRegistro): Promise<void> { // Registra un nuevo usuario y crea su perfil en la base de datos
    const { data, error } = await this.supabase.Supabase.auth.signUp({
    email: datos.email,
    password: datos.password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No se pudo crear el usuario.');

    const { error: errorPerfil } = await this.supabase.Supabase.from('perfiles').insert({
    id: data.user.id,
    nombre: datos.nombre,
    apellido: datos.apellido,
    fecha_nacimiento: datos.fecha_nacimiento,
    tipo_sangre: datos.tipo_sangre,
    color_ojos: datos.color_ojos,
    dias_vacaciones: datos.dias_vacaciones,
    });

    if (errorPerfil) throw errorPerfil;
}

async login(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.Supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
}
}