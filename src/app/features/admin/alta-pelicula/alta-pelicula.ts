import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Peliculas } from '../../../core/services/peliculas';
import { Generos } from '../../../core/services/generos';
import IGenero from '../../../core/interfaces/genero';

@Component({
  selector: 'app-alta-pelicula',
  imports: [ReactiveFormsModule],
  templateUrl: './alta-pelicula.html',
  styleUrl: './alta-pelicula.css',
})
export class AltaPelicula {
  private peliculasService = inject(Peliculas);
  private generosService = inject(Generos);

  protected generosDisponibles = signal<IGenero[]>([]);
  protected generosSeleccionados = signal<Set<number>>(new Set());

  protected formulario = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sinopsis: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    imagen_url: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    duracion_minutos: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    // El <select> del HTML maneja strings ('', '13', '18'); se convierte
    // a number | null recién al guardar, más abajo.
    restriccion_edad: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.cargarGeneros();
  }

  private async cargarGeneros() {
    const generos = await this.generosService.obtenerTodos();
    const recomendados = ['Drama', 'Aventuras', 'Acción', 'Terror', 'Ciencia Ficción', 'Comedia', 'Romance', 'Thriller', 'Animación', 'Documental',];
    const existentes = new Set(generos.map((genero) => genero.nombre.toLowerCase()));

    for (const nombre of recomendados) {
      if (!existentes.has(nombre.toLowerCase())) {
        generos.push(await this.generosService.crear(nombre));
      }
    }

    this.generosDisponibles.set(generos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
  }

  protected toggleGenero(id: number) {
    const actuales = new Set(this.generosSeleccionados());
    if (actuales.has(id)) {
      actuales.delete(id);
    } else {
      actuales.add(id);
    }
    this.generosSeleccionados.set(actuales);
  }

  protected async guardar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    const pelicula = await this.peliculasService.crear({
      ...valores,
      restriccion_edad: valores.restriccion_edad ? Number(valores.restriccion_edad) : null,
    });
    await this.generosService.asignarAPelicula(pelicula.id, [...this.generosSeleccionados()]);

    this.formulario.reset();
    this.generosSeleccionados.set(new Set());
  }
}