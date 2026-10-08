import { Service, inject, signal } from '@angular/core';
import { Supabase } from './supabase';
import IPerfil from '../interfaces/perfil';

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

// Lo que se puede cambiar desde Mi perfil. El email no (es el usuario de
// Supabase Auth) y la fecha de nacimiento tampoco: de ella dependen la
// edad mínima de las películas y el cupón de mayores de 50.
export interface DatosEditablesPerfil {
  nombre: string;
  apellido: string;
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
}

@Service()
export class Auth {
  private supabase = inject(Supabase);

  // El header (App) muestra el nombre del usuario. Cuando se edita el
  // perfil se avisa por acá, así el nombre nuevo aparece sin recargar.
  private perfilEditadoSignal = signal<IPerfil | null>(null);
  readonly perfilEditado = this.perfilEditadoSignal.asReadonly();

  async registrar(datos: DatosRegistro): Promise<void> {
    // Registra un nuevo usuario y crea su perfil en la base de datos
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
      perfil_completo: true, // se registró a mano, ya tiene todos sus datos reales
    });

    if (errorPerfil) throw errorPerfil;
  }

  async login(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.Supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async loginConGoogle(): Promise<void> {
    const { error } = await this.supabase.Supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  }

  async usuarioActual(): Promise<IPerfil | null> {
    const {
      data: { user },
    } = await this.supabase.Supabase.auth.getUser(); // Obtiene el usuario actualmente autenticado
    if (!user) return null;

    const { data, error } = await this.supabase.Supabase.from('perfiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Si el usuario ingresó mediante Google y aún no tiene registro en perfiles
      const meta = user.user_metadata || {};
      const nombreCompleto =
        meta['full_name'] || meta['name'] || user.email?.split('@')[0] || 'Aventurero';
      const partes = String(nombreCompleto).trim().split(' ');
      const nombre = meta['given_name'] || partes[0] || 'Aventurero';
      const apellido = meta['family_name'] || partes.slice(1).join(' ') || 'Hollow';

      const nuevoPerfil = {
        id: user.id,
        nombre,
        apellido,
        fecha_nacimiento: '2000-01-01',
        tipo_sangre: 'O+',
        color_ojos: 'Negro',
        dias_vacaciones: 15,
        rol: 'cliente' as const,
        cupon_primera_compra_usado: false,
        // Estos datos son inventados como placeholder — todavía no sabemos
        // la fecha de nacimiento real de esta persona. Con esto en false,
        // App redirige a completar-perfil antes de dejarlo hacer nada que
        // dependa de un dato real (comprar algo con restricción de edad,
        // el cupón de mayores de 50, etc.)
        perfil_completo: false,
      };

      const { data: creado, error: errorCrear } = await this.supabase.Supabase.from('perfiles')
        .insert(nuevoPerfil)
        .select()
        .single();

      if (!errorCrear && creado) {
        return creado as IPerfil;
      }
      return nuevoPerfil as IPerfil;
    }

    return data as IPerfil;
  }

  async logout(): Promise<void> {
    await this.supabase.Supabase.auth.signOut();
  }

  // Llena los datos reales que faltaban (los que Google no entrega) y
  // marca el perfil como completo, para que App deje de redirigir acá.
  async completarPerfil(datos: {
    fecha_nacimiento: string;
    tipo_sangre: string;
    color_ojos: string;
    dias_vacaciones: number;
  }): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.Supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión iniciada.');

    const { error } = await this.supabase.Supabase.from('perfiles')
      .update({ ...datos, perfil_completo: true })
      .eq('id', user.id);

    if (error) throw error;
  }

  async emailActual(): Promise<string | null> {
    const {
      data: { user },
    } = await this.supabase.Supabase.auth.getUser();
    return user?.email ?? null;
  }

  async actualizarPerfil(datos: DatosEditablesPerfil): Promise<IPerfil> {
    const {
      data: { user },
    } = await this.supabase.Supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión iniciada.');

    const { data, error } = await this.supabase.Supabase.from('perfiles')
      .update(datos)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    this.perfilEditadoSignal.set(data as IPerfil);
    return data as IPerfil;
  }
}
