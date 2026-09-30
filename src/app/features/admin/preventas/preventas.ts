import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Peliculas } from '../../../core/services/peliculas';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import { Toasts } from '../../../core/services/toasts';
import { IPeliculaConGeneros } from '../../../core/interfaces/pelicula';
import IPerfil from '../../../core/interfaces/perfil';
import { LoadingComponent } from '../../../shared/components/loading/loading';
import { GlowHover } from '../../../shared/directives/glow-hover';

// Pantalla de admin "Preventas": la lista de películas que todavía no se
// estrenaron, con el botón "Abrir venta". Programar funciones y abrir la
// venta son cosas separadas (como en un cine real): el admin puede cargar
// funciones cuando quiera, pero recién se pueden comprar cuando abre la
// venta acá, desde 7 días antes del estreno.
@Component({
  selector: 'app-preventas',
  imports: [DecimalPipe, LoadingComponent, GlowHover],
  templateUrl: './preventas.html',
  styleUrl: './preventas.css',
})
export class Preventas {
  private peliculasService = inject(Peliculas);
  private authService = inject(Auth);
  private logsService = inject(Logs);
  private toasts = inject(Toasts);

  // Mismo criterio que el resto de las pantallas de admin: el guard de la
  // ruta ya garantiza que es admin; esto es para saber QUIÉN, para el log.
  private usuario: IPerfil | null = null;

  protected peliculas = signal<IPeliculaConGeneros[]>([]);
  protected cargando = signal(true);
  // Id de la película cuyo botón está esperando respuesta (o null): mientras
  // tanto ese botón queda deshabilitado, para que un doble click no mande
  // dos pedidos.
  protected procesando = signal<number | null>(null);

  constructor() {
    this.cargar();
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
  }

  private async cargar() {
    try {
      const todas = await this.peliculasService.obtenerTodas();
      // Sólo las que todavía no se estrenaron (próximamente o en preventa),
      // la más cercana primero. Mismo filtro y orden que la sección
      // Próximamente de la Home.
      this.peliculas.set(
        todas
          .filter((p) => this.peliculasService.estadoVenta(p) !== 'cartelera')
          .sort((a, b) => a.fecha_estreno!.localeCompare(b.fecha_estreno!)),
      );
    } catch {
      this.toasts.error('No se pudieron cargar las películas', 'Probá recargar la página.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected estado(pelicula: IPeliculaConGeneros) {
    return this.peliculasService.estadoVenta(pelicula);
  }

  // true desde 7 días antes del estreno (y mientras no esté abierta ya).
  protected puedeAbrir(pelicula: IPeliculaConGeneros): boolean {
    return this.peliculasService.puedeAbrirVenta(pelicula);
  }

  // '2026-12-12' → '12/12', partiendo el texto (sin new Date()).
  protected fechaCorta(fecha: string | null): string {
    if (!fecha) return '';
    const [, mes, dia] = fecha.split('-');
    return `${dia}/${mes}`;
  }

  protected inicioPreventa(pelicula: IPeliculaConGeneros): string {
    return this.fechaCorta(this.peliculasService.inicioPreventa(pelicula.fecha_estreno!));
  }

  protected async abrirVenta(pelicula: IPeliculaConGeneros) {
    if (this.procesando() !== null) return;
    this.procesando.set(pelicula.id);

    try {
      const abierta = await this.peliculasService.abrirVenta(pelicula.id);

      if (!abierta) {
        this.toasts.advertencia(
          'No se pudo abrir la venta',
          'Puede que ya estuviera abierta. Recargá la página para ver el estado actual.',
        );
        return;
      }

      // La consigna pide registrar lo que hace el admin en el log.
      if (this.usuario) {
        await this.logsService.registrar(
          this.usuario.id,
          `Abrió la preventa de "${pelicula.nombre}"`,
        );
      }

      this.toasts.exito(
        'Preventa abierta',
        `Ya se pueden comprar entradas de ${pelicula.nombre} a precio de preventa.`,
      );
      // Volvemos a pedir la lista para que la película aparezca como
      // "Venta abierta" (ahora tiene venta_abierta_en cargado).
      await this.cargar();
    } catch {
      this.toasts.error('No se pudo abrir la venta', 'Probá de nuevo en un momento.');
    } finally {
      this.procesando.set(null);
    }
  }
}