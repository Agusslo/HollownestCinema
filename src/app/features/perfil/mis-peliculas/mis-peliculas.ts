import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Ordenes } from '../../../core/services/ordenes';
import { Resenias } from '../../../core/services/resenias';
import { Peliculas } from '../../../core/services/peliculas';
import { GlowHover } from '../../../shared/directives/glow-hover';

// Una tarjeta de "Mis películas": una película que el usuario efectivamente
// vio (entrada validada en la puerta, de una orden no cancelada), con
// todas las fechas en que la vio y su propia calificación si dejó una.
interface IPeliculaVista {
  id: number;
  nombre: string;
  imagen_url: string;
  fechas: string[]; // ordenadas, más nueva primero
  miCalificacion: number | null; // null = todavía no la calificó
}

@Component({
  selector: 'app-mis-peliculas',
  imports: [DatePipe, RouterLink, GlowHover],
  templateUrl: './mis-peliculas.html',
  styleUrl: './mis-peliculas.css',
})
export class MisPeliculas {
  private authService = inject(Auth);
  private ordenesService = inject(Ordenes);
  private reseniasService = inject(Resenias);
  private peliculasService = inject(Peliculas);
  private router = inject(Router);

  protected peliculasVistas = signal<IPeliculaVista[]>([]);
  protected cargando = signal(true);
  protected error = signal<string | null>(null);

  // Números del encabezado: cuántas películas distintas, cuántas
  // funciones en total y el promedio de las que ya calificó.
  protected totalFunciones = computed(() =>
    this.peliculasVistas().reduce((total, p) => total + p.fechas.length, 0),
  );
  protected promedioCalificacion = computed(() => {
    const calificadas = this.peliculasVistas().filter((p) => p.miCalificacion !== null);
    if (calificadas.length === 0) return null;
    const suma = calificadas.reduce((total, p) => total + (p.miCalificacion ?? 0), 0);
    return Math.round((suma / calificadas.length) * 10) / 10;
  });

  // Para dibujar las 5 estrellas (con medias) de cada tarjeta
  protected tipoEstrella(n: number, calificacion: number): 'llena' | 'media' | 'vacia' {
    if (n <= calificacion) return 'llena';
    if (n - 0.5 === calificacion) return 'media';
    return 'vacia';
  }

  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const usuario = await this.authService.usuarioActual();
      if (!usuario) {
        this.router.navigateByUrl('/login');
        return;
      }

      // Traemos las compras (para saber qué vio y cuándo) y las reseñas
      // propias (para saber cómo la calificó) en paralelo — son dos
      // consultas independientes entre sí.
      const [compras, resenias] = await Promise.all([
        this.ordenesService.obtenerMisCompras(usuario.id),
        this.reseniasService.obtenerPorUsuario(usuario.id),
      ]);

      const calificacionPorPelicula = new Map<number, number>();
      for (const resenia of resenias) {
        calificacionPorPelicula.set(resenia.pelicula_id, resenia.estrellas);
      }

      // Agrupamos por película, juntando todas las fechas en que la vio en
      // un Set (para no repetir la misma fecha dos veces si compró más de
      // una butaca para la misma función).
      const porPelicula = new Map<
        number,
        { id: number; nombre: string; imagen_url: string; fechas: Set<string> }
      >();

      for (const orden of compras) {
        // Una compra cancelada marca sus entradas como "validada_en" para
        // invalidar el QR — eso NO significa que la persona la haya visto,
        // así que las órdenes canceladas quedan afuera por completo.
        if (orden.cancelada_en) continue;

        for (const entrada of orden.entradas) {
          if (!entrada.validada_en) continue; // compró la entrada pero todavía no fue

          const pelicula = entrada.funciones.peliculas;
          const existente = porPelicula.get(pelicula.id);

          if (existente) {
            existente.fechas.add(entrada.funciones.fecha_hora);
          } else {
            porPelicula.set(pelicula.id, {
              id: pelicula.id,
              nombre: pelicula.nombre,
              imagen_url: pelicula.imagen_url,
              fechas: new Set([entrada.funciones.fecha_hora]),
            });
          }
        }
      }

      // Pasamos de Set a array ordenado (más nueva primero) por cada
      // película, y después ordenamos las tarjetas entre sí por la vista
      // más reciente primero.
      const lista: IPeliculaVista[] = [...porPelicula.values()].map((item) => ({
        id: item.id,
        nombre: item.nombre,
        imagen_url: item.imagen_url,
        fechas: [...item.fechas].sort((a, b) => new Date(b).getTime() - new Date(a).getTime()),
        miCalificacion: calificacionPorPelicula.get(item.id) ?? null,
      }));

      lista.sort((a, b) => new Date(b.fechas[0]).getTime() - new Date(a.fechas[0]).getTime());

      this.peliculasVistas.set(lista);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  // Mismo patrón que ya usa Home: delegamos en el service para no
  // duplicar la lógica de armar el slug acá.
  protected generarSlug(nombre: string): string {
    return this.peliculasService.generarSlug(nombre);
  }
}