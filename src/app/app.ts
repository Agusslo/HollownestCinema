import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Auth } from './core/services/auth';
import IPerfil from './core/interfaces/perfil';
import { Supabase } from './core/services/supabase';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private authService = inject(Auth);
  private supabaseService = inject(Supabase);

  protected usuario = signal<IPerfil | null>(null);
  protected cargandoAuth = signal(true);

  constructor() {
    this.cargarUsuario();

    // Escucha cambios de sesión (login, logout, etc.) y actualiza el header automáticamente
    this.supabaseService.Supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        this.cargarUsuario();
      } else {
        this.usuario.set(null);
      }
    });
  }

  private async cargarUsuario() {
    try {
      this.usuario.set(await this.authService.usuarioActual());
    } catch {
      this.usuario.set(null);
    } finally {
      this.cargandoAuth.set(false);
    }
  }

  protected async cerrarSesion() {
    await this.authService.logout();
    this.usuario.set(null);
  }
}
