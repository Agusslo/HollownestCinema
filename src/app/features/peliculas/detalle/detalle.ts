import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Peliculas } from '../../../core/services/peliculas';
import { Funciones } from '../../../core/services/funciones';
import IPelicula from '../../../core/interfaces/pelicula';
import { IFuncionConSala } from '../../../core/interfaces/funcion';

@Component({
  selector: 'app-detalle',
  imports: [RouterLink, DatePipe],
  templateUrl: './detalle.html',
  styleUrl: './detalle.css',
})
export class Detalle {
  private route = inject(ActivatedRoute);
  private peliculasService = inject(Peliculas);
  private funcionesService = inject(Funciones);

  protected pelicula = signal<IPelicula | null>(null);
  protected funciones = signal<IFuncionConSala[]>([]);
  protected cargando = signal(true);

  protected generarSlug(nombre: string): string {
    return this.peliculasService.generarSlug(nombre);
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
