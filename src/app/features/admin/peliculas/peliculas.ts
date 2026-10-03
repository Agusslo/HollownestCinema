import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Peliculas } from '../../../core/services/peliculas';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import { Toasts } from '../../../core/services/toasts';
import { IPeliculaConGeneros } from '../../../core/interfaces/pelicula';
import IPerfil from '../../../core/interfaces/perfil';
import { DuracionPipe } from '../../../core/pipes/duracion-pipe';
import { LoadingComponent } from '../../../shared/components/loading/loading';

// Pantalla de admin "Películas": la lista de todas las películas cargadas,
// con el botón Mostrar / Ocultar. Es lo que pide la consigna con "poder
// elegir qué películas aparecen cuando se entra a la página": una película
// oculta no aparece en la Home, pero no se borra (sus funciones, entradas
// y reseñas siguen intactas, y se puede volver a mostrar).
@Component({
  selector: 'app-peliculas-admin',
  imports: [RouterLink, DuracionPipe, LoadingComponent],
  templateUrl: './peliculas.html',
  styleUrl: './peliculas.css',
})
export class PeliculasAdmin {
  private peliculasService = inject(Peliculas);
  private authService = inject(Auth);
  private logsService = inject(Logs);
  private toasts = inject(Toasts);

  // Mismo criterio que el resto de las pantallas de admin: el guard de la
  // ruta ya garantiza que es admin; esto es para saber QUIÉN, para el log.
  private usuario: IPerfil | null = null;

  protected peliculas = signal<IPeliculaConGeneros[]>([]);
  protected cargando = signal(true);
  // Id de la película cuyo botón está esperando respuesta: mientras tanto
  // queda deshabilitado, así un doble click no manda dos pedidos.
  protected procesando = signal<number | null>(null);

  protected cantidadVisibles = computed(() => this.peliculas().filter((p) => p.visible).length);

  constructor() {
    this.cargar();
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
  }

  private async cargar() {
    try {
      const todas = await this.peliculasService.obtenerTodas();
      // Orden alfabético, para encontrar rápido una película.
      this.peliculas.set(todas.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      this.toasts.error('No se pudieron cargar las películas', 'Probá recargar la página.');
    } finally {
      this.cargando.set(false);
    }
  }

  // Texto del estado de venta, para que el admin sepa en qué sección de la
  // Home aparece cada una cuando está visible.
  protected seccion(pelicula: IPeliculaConGeneros): string {
    switch (this.peliculasService.estadoVenta(pelicula)) {
      case 'cartelera':
        return 'Cartelera';
      case 'preventa':
        return 'Próximamente · preventa abierta';
      default:
        return 'Próximamente';
    }
  }

  protected async alternarVisibilidad(pelicula: IPeliculaConGeneros) {
    if (this.procesando() !== null) return;
    this.procesando.set(pelicula.id);
    const visible = !pelicula.visible;

    try {
      await this.peliculasService.cambiarVisibilidad(pelicula.id, visible);

      // Se actualiza sólo esa película en la lista (sin volver a pedir
      // todo a Supabase): map devuelve una lista nueva, así el signal
      // avisa del cambio y la pantalla se redibuja.
      this.peliculas.update((lista) =>
        lista.map((p) => (p.id === pelicula.id ? { ...p, visible } : p)),
      );

      if (this.usuario) {
        await this.logsService.registrar(
          this.usuario.id,
          `${visible ? 'Mostró' : 'Ocultó'} la película "${pelicula.nombre}" en la página`,
        );
      }

      this.toasts.exito(
        visible ? 'Película visible' : 'Película oculta',
        visible
          ? `${pelicula.nombre} ya aparece en la página.`
          : `${pelicula.nombre} ya no aparece en la página.`,
      );
    } catch {
      this.toasts.error('No se pudo guardar el cambio', 'Probá de nuevo en un momento.');
    } finally {
      this.procesando.set(null);
    }
  }
}