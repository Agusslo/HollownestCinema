import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from './core/services/auth';
import IPerfil from './core/interfaces/perfil';
import { Supabase } from './core/services/supabase';
import { BlobatarComponent } from './shared/components/blobatar/blobatar';
import { GlowHover } from './shared/directives/glow-hover';
import { ToastComponent } from './shared/components/toast/toast';
import { Avisos } from './core/services/avisos';
import { Peliculas } from './core/services/peliculas';
import { Toasts } from './core/services/toasts';
import { ModoInvitado } from './core/services/modo-invitado';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BlobatarComponent, GlowHover, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:click)': 'cerrarMenuSiClickAfuera($event)',
    '(document:keydown.escape)': 'cerrarMenus()',
    // El navegador avisa cuando se pierde o vuelve la conexión.
    '(window:offline)': 'sinConexion.set(true)',
    '(window:online)': 'sinConexion.set(false)',
  },
})
export class App {
  private authService = inject(Auth);
  private supabaseService = inject(Supabase);
  private avisosService = inject(Avisos);
  private peliculasService = inject(Peliculas);
  private toasts = inject(Toasts);
  // protected: el header lo usa para mostrar la "Sombra" sólo a quien
  // eligió comprar como invitado (sin sesión y sin elegir, no se muestra nada).
  protected modoInvitado = inject(ModoInvitado);

  // Para qué usuario ya se revisaron los avisos en esta visita. cargarUsuario()
  // corre dos veces al abrir la app (en el constructor y en
  // onAuthStateChange): sin esto, los toasts saldrían repetidos.
  private avisosRevisadosPara: string | null = null;

  protected usuario = signal<IPerfil | null>(null);
  protected cargandoAuth = signal(true);
  protected temaClaro = signal(false);
  protected menuAdminAbierto = signal(false);
  // Menú hamburguesa: sólo tiene efecto en el celular (ver app.css)
  protected menuMovilAbierto = signal(false);
  // PWA: sin internet, el service worker muestra la última cartelera
  // guardada. Este aviso deja claro que es información guardada y que para
  // comprar hace falta conexión.
  protected sinConexion = signal(!navigator.onLine);

  constructor() {
    this.temaClaro.set(localStorage.getItem('tema-hk') === 'claro');
    this.aplicarTema();
    this.cargarUsuario();

    // Escucha cambios de sesión (login, logout, etc.) y actualiza el header automáticamente
    this.supabaseService.Supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        this.cargarUsuario();
      } else {
        this.usuario.set(null);
      }
    });

    // Al guardar Mi perfil, el header muestra el nombre nuevo sin recargar
    effect(() => {
      const perfil = this.authService.perfilEditado();
      if (perfil) this.usuario.set(perfil);
    });
  }

  // Cierra el menú del Panel cuando se hace click en cualquier lugar que
  // no sea el propio menú (otro link del header, la página, etc.).
  protected cerrarMenuSiClickAfuera(evento: MouseEvent): void {
    if (!this.menuAdminAbierto()) return;
    const dentroDelMenu = (evento.target as HTMLElement).closest('.admin-menu');
    if (!dentroDelMenu) this.menuAdminAbierto.set(false);
  }

  // En el celular, al tocar cualquier link del menú se navega y el menú se
  // cierra solo. Los botones (Panel, tema) no lo cierran.
  protected cerrarMenuMovilSiEsLink(evento: MouseEvent): void {
    if ((evento.target as HTMLElement).closest('a')) this.menuMovilAbierto.set(false);
  }

  protected cerrarMenus(): void {
    this.menuAdminAbierto.set(false);
    this.menuMovilAbierto.set(false);
  }

  private async cargarUsuario() {
    try {
      const usuario = await this.authService.usuarioActual();
      this.usuario.set(usuario);
      // Sin await: los avisos se buscan "en segundo plano", así el header
      // no espera a que terminen para mostrarse.
      if (usuario) this.mostrarAvisosPendientes(usuario);
    } catch {
      this.usuario.set(null);
    } finally {
      this.cargandoAuth.set(false);
    }
  }

  // ── Alerta de Próximamente ──
  // Al entrar a la app, si el usuario había tocado "Avisame" en una película
  // que ya abrió la venta, le mostramos un toast con un enlace para comprar,
  // y marcamos el aviso como mostrado para no repetirlo. Funciona aunque no
  // haya aceptado las notificaciones del navegador.
  private async mostrarAvisosPendientes(usuario: IPerfil) {
    if (this.avisosRevisadosPara === usuario.id) return;
    this.avisosRevisadosPara = usuario.id;

    try {
      const pendientes = await this.avisosService.obtenerPendientes(usuario.id);

      // Sólo los de películas que ya se pueden comprar: en preventa (el
      // admin abrió la venta) o ya estrenadas. Los de películas que siguen
      // en Próximamente quedan pendientes para otra visita.
      const listos = pendientes.filter(
        (aviso) => this.peliculasService.estadoVenta(aviso.peliculas) !== 'proximamente',
      );

      for (const aviso of listos) {
        const pelicula = aviso.peliculas;
        const enPreventa = this.peliculasService.estadoVenta(pelicula) === 'preventa';
        this.toasts.exito(
          '¡Ya podés comprar!',
          enPreventa
            ? `Abrió la preventa de ${pelicula.nombre}.`
            : `${pelicula.nombre} ya está en cartelera.`,
          {
            // duracion: 0 → no se va solo: es un aviso que el usuario pidió,
            // no queremos que se lo pierda si mira para otro lado.
            duracion: 0,
            enlace: {
              texto: 'Ir a comprar',
              ruta: `/peliculas/${this.peliculasService.generarSlug(pelicula.nombre)}`,
            },
          },
        );
      }

      await this.avisosService.marcarAvisados(listos.map((aviso) => aviso.id));
    } catch {
      // Si algo falla, no se marcó nada: se vuelve a intentar la próxima vez.
      this.avisosRevisadosPara = null;
    }
  }

  protected async cerrarSesion() {
    await this.authService.logout();
    this.usuario.set(null);
    this.cerrarMenus();
  }

  protected alternarTema() {
    this.temaClaro.update((temaClaro) => !temaClaro);
    localStorage.setItem('tema-hk', this.temaClaro() ? 'claro' : 'oscuro');
    this.aplicarTema();
  }

  private aplicarTema() {
    document.documentElement.classList.toggle('tema-claro', this.temaClaro());
  }
}