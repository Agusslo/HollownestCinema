import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Peliculas } from '../../core/services/peliculas';
import IPelicula from '../../core/interfaces/pelicula';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private peliculasService = inject(Peliculas);
  protected destacadas = signal<IPelicula[]>([]);
  protected peliculas = signal<IPelicula[]>([]);
  protected cargando = signal(true);

  constructor() {
    this.cargarPeliculas();
  }

  protected generarSlug(nombre: string): string {
    return this.peliculasService.generarSlug(nombre);
  }

  private async cargarPeliculas() {
       // Pedimos las dos listas en paralelo con Promise.all, en vez de una
    // después de la otra: son dos consultas independientes, no tiene
    // sentido esperar a que termine una para arrancar la otra.
    const [masVendidas, todas] = await Promise.all([
      this.peliculasService.obtenerMasVendidas(3),
      this.peliculasService.obtenerTodas(),
    ]);

    // Sacamos de "todas" las que ya aparecen en masVendidas, para no
    // mostrar una película dos veces en la cartelera.
    const idsTop = new Set(masVendidas.map((p) => p.id));
    const resto = todas.filter((p) => !idsTop.has(p.id));

    this.destacadas.set(masVendidas);
    this.peliculas.set(resto);
    this.cargando.set(false);
  }
}