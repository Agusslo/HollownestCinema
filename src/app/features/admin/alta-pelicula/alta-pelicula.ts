import { Component, inject } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Peliculas } from '../../../core/services/peliculas';

@Component({
  selector: 'app-alta-pelicula',
  imports: [ReactiveFormsModule],
  templateUrl: './alta-pelicula.html',
  styleUrl: './alta-pelicula.css',
})
export class AltaPelicula {
  private peliculasService = inject(Peliculas);

  protected formulario = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sinopsis: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    imagen_url: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    duracion_minutos: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
  });

  protected async guardar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    await this.peliculasService.crear(this.formulario.getRawValue());
    this.formulario.reset();
  }
}