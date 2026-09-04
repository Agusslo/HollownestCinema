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
  private route = inject(ActivatedRoute); // Inyectamos ActivatedRoute para obtener el parámetro de la ruta (id de la película)
  private peliculasService = inject(Peliculas);
  private funcionesService = inject(Funciones);

  protected pelicula = signal<IPelicula | null>(null);
  protected funciones = signal<IFuncionConSala[]>([]);
  protected cargando = signal(true);

  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    const id = Number(this.route.snapshot.paramMap.get('id')); // Obtenemos el id de la película desde la ruta
    this.pelicula.set(await this.peliculasService.obtenerPorId(id));
    this.funciones.set(await this.funcionesService.obtenerPorPelicula(id));
    this.cargando.set(false);
  }
}