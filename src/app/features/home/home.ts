import { Component, inject, signal } from '@angular/core';
import { Peliculas } from '../../core/services/peliculas';
import IPelicula from '../../core/interfaces/pelicula';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private peliculasService = inject(Peliculas);
  protected peliculas = signal<IPelicula[]>([]);
  protected cargando = signal(true);

  constructor() {
    this.cargarPeliculas();
  }

  private async cargarPeliculas() {
    this.peliculas.set(await this.peliculasService.obtenerTodas());
    this.cargando.set(false);
  }
}