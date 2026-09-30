import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Peliculas } from '../../../core/services/peliculas';
import { Funciones } from '../../../core/services/funciones';
import { IPeliculaConGeneros } from '../../../core/interfaces/pelicula';
import { IFuncionConSala } from '../../../core/interfaces/funcion';
import { Resenias } from '../resenias/resenias';
import { DuracionPipe } from '../../../core/pipes/duracion-pipe';
import { LoadingComponent } from '../../../shared/components/loading/loading';
import { GlowHover } from '../../../shared/directives/glow-hover';

@Component({
  selector: 'app-detalle',
  imports: [RouterLink, DatePipe, DecimalPipe, Resenias, DuracionPipe, LoadingComponent, GlowHover],
  templateUrl: './detalle.html',
  styleUrl: './detalle.css',
})
export class Detalle {
  private route = inject(ActivatedRoute);
  protected peliculasService = inject(Peliculas);
  private funcionesService = inject(Funciones);

  protected pelicula = signal<IPeliculaConGeneros | null>(null);
  protected funciones = signal<IFuncionConSala[]>([]);
  protected cargando = signal(true);

  // ── Próximamente y preventa ──
  // Todo se calcula a partir de la película con Peliculas.estadoVenta():
  // 'proximamente' (no se vende todavía), 'preventa' (se vende a precio de
  // preventa) o 'cartelera' (lo normal).
  protected estado = computed(() => {
    const pelicula = this.pelicula();
    return pelicula ? this.peliculasService.estadoVenta(pelicula) : 'cartelera';
  });

  // En Próximamente las funciones se ven pero no se pueden comprar.
  protected puedeComprar = computed(() => this.estado() !== 'proximamente');

  // Se le pasa a <app-resenias>: la fecha de estreno mientras la película
  // no se estrenó (y entonces no se puede reseñar), o null si ya salió.
  protected estrenoPendiente = computed(() =>
    this.estado() === 'cartelera' ? null : (this.pelicula()?.fecha_estreno ?? null),
  );

  // '2026-12-12' → '12/12', partiendo el texto (sin new Date(), para que la
  // zona horaria no corra el día).
  protected fechaCorta(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const [, mes, dia] = fecha.split('-');
    return `${dia}/${mes}`;
  }

  // Desde cuándo se va a poder abrir la preventa (7 días antes del estreno).
  protected inicioPreventa = computed(() => {
    const fecha = this.pelicula()?.fecha_estreno;
    return fecha ? this.fechaCorta(this.peliculasService.inicioPreventa(fecha)) : '';
  });

  protected generarSlug(nombre: string): string {
    return this.peliculasService.generarSlug(nombre);
  }

  protected generarSlugFuncion(funcion: IFuncionConSala): string {
    return this.funcionesService.generarSlug(funcion);
  }

  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    const slug = this.route.snapshot.paramMap.get('nombre') ?? ''; // Obtiene el slug de la película desde la URL
    const pelicula = await this.peliculasService.obtenerPorSlug(slug); // Obtiene la película correspondiente al slug
    this.pelicula.set(pelicula);
    this.funciones.set(await this.funcionesService.obtenerPorPelicula(pelicula.id));
    this.cargando.set(false);
  }
}