import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { IPeliculaConGeneros } from '../../../core/interfaces/pelicula';
import IPerfil from '../../../core/interfaces/perfil';
import { Peliculas } from '../../../core/services/peliculas';
import { Avisos } from '../../../core/services/avisos';
import { Auth } from '../../../core/services/auth';
import { Toasts } from '../../../core/services/toasts';
import { Notificaciones } from '../../../core/services/notificaciones';
import { GlowHover } from '../../../shared/directives/glow-hover';

// Sección "Próximamente" de la Home: las películas que todavía no se
// estrenaron. La Home decide CUÁLES son (con Peliculas.estadoVenta) y se
// las pasa por el input; este componente se ocupa de mostrarlas y del
// botón "Avisame".
@Component({
  selector: 'app-proximamente',
  imports: [RouterLink, DecimalPipe, GlowHover],
  templateUrl: './proximamente.html',
  styleUrl: './proximamente.css',
})
export class Proximamente {
  private peliculasService = inject(Peliculas);
  private avisosService = inject(Avisos);
  private authService = inject(Auth);
  private toasts = inject(Toasts);
  private notificaciones = inject(Notificaciones);

  // input(): el mismo patrón de la clase 3, pero con signals. La Home hace
  // <app-proximamente [peliculas]="proximas()" />.
  peliculas = input.required<IPeliculaConGeneros[]>();

  private usuario: IPerfil | null = null;

  // Ids de las películas de las que este usuario ya pidió aviso. Con esto
  // cada botón sabe si mostrar "Avisame" o "Te vamos a avisar".
  protected avisosPedidos = signal<Set<number>>(new Set());

  // Ids de las películas cuyo botón está esperando respuesta de Supabase:
  // mientras tanto el botón queda deshabilitado, así un doble click rápido
  // no manda dos pedidos.
  protected procesando = signal<Set<number>>(new Set());

  constructor() {
    this.cargarAvisos();
  }

  private async cargarAvisos() {
    this.usuario = await this.authService.usuarioActual();
    if (!this.usuario) return;

    try {
      this.avisosPedidos.set(await this.avisosService.obtenerIdsPeliculas(this.usuario.id));
    } catch {
      // Si falla, no pasa nada grave: los botones quedan en "Avisame".
    }
  }

  protected estado(pelicula: IPeliculaConGeneros) {
    return this.peliculasService.estadoVenta(pelicula);
  }

  protected generarSlug(nombre: string): string {
    return this.peliculasService.generarSlug(nombre);
  }

  // '2026-12-12' → '12/12'. Partiendo el texto, sin new Date(), por el
  // mismo motivo de siempre: que la zona horaria no corra el día.
  protected fechaCorta(fecha: string | null): string {
    if (!fecha) return '';
    const [, mes, dia] = fecha.split('-');
    return `${dia}/${mes}`;
  }

  // El día en que se va a poder abrir la preventa (7 días antes del estreno).
  protected inicioPreventa(pelicula: IPeliculaConGeneros): string {
    return this.fechaCorta(this.peliculasService.inicioPreventa(pelicula.fecha_estreno!));
  }

  // Tocar "Avisame" pide el aviso; tocarlo de nuevo lo cancela.
  protected async alternarAviso(pelicula: IPeliculaConGeneros) {
    // Si el usuario todavía no terminó de cargar (tocó muy rápido), lo
    // volvemos a pedir antes de decidir que no inició sesión.
    const usuario = this.usuario ?? (await this.authService.usuarioActual());

    if (!usuario) {
      this.toasts.info(
        'Iniciá sesión',
        'Para que te avisemos cuando abra la venta, primero ingresá a tu cuenta.',
        { enlace: { texto: 'Ingresar', ruta: '/login' } },
      );
      return;
    }

    const id = pelicula.id;
    if (this.procesando().has(id)) return;
    this.procesando.update((actuales) => new Set(actuales).add(id));

    try {
      if (this.avisosPedidos().has(id)) {
        await this.avisosService.borrar(usuario.id, id);
        this.avisosPedidos.update((actuales) => {
          const nuevos = new Set(actuales);
          nuevos.delete(id);
          return nuevos;
        });
        this.toasts.info('Aviso cancelado', `Ya no te vamos a avisar de ${pelicula.nombre}.`);
      } else {
        // El permiso de notificaciones se pide YA, antes de cualquier
        // await: algunos navegadores sólo muestran el cartel si se pide
        // en el mismo momento del click. Mientras tanto se guarda el aviso.
        const suscripcion = this.notificaciones.suscribir(usuario.id);

        await this.avisosService.crear(usuario.id, id);
        this.avisosPedidos.update((actuales) => new Set(actuales).add(id));

        // Con permiso: le llega una notificación aunque tenga la app
        // cerrada. Sin permiso: igual ve el aviso al entrar a la app.
        const conNotificacion = await suscripcion;
        this.toasts.exito(
          'Listo',
          conNotificacion
            ? `Te vamos a mandar una notificación cuando abra la venta de ${pelicula.nombre}.`
            : `Te vamos a avisar cuando abra la venta de ${pelicula.nombre}.`,
        );
      }
    } catch {
      this.toasts.error('No se pudo guardar el aviso', 'Probá de nuevo en un momento.');
    } finally {
      this.procesando.update((actuales) => {
        const nuevos = new Set(actuales);
        nuevos.delete(id);
        return nuevos;
      });
    }
  }
}