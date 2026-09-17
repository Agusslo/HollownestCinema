import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Peliculas } from '../../../core/services/peliculas';
import { Funciones } from '../../../core/services/funciones';
import IPelicula from '../../../core/interfaces/pelicula';
import { Formato, Idioma } from '../../../core/interfaces/funcion';

@Component({
  selector: 'app-alta-funcion',
  imports: [ReactiveFormsModule],
  templateUrl: './alta-funcion.html',
  styleUrl: './alta-funcion.css',
})
export class AltaFuncion {
  private peliculasService = inject(Peliculas);
  private funcionesService = inject(Funciones);

  protected peliculas = signal<IPelicula[]>([]);
  protected error = signal<string | null>(null);
  protected mensaje = signal<string | null>(null);

  protected formulario = new FormGroup({
    pelicula_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    fecha_hora: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    formato: new FormControl<Formato>('2d', { nonNullable: true, validators: [Validators.required] }),
    idioma: new FormControl<Idioma>('castellano', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.cargarOpciones();
  }

  private async cargarOpciones() {
    this.peliculas.set(await this.peliculasService.obtenerTodas()); //trae todas las peliculas y las setea en el signal de peliculas
  }

  protected async guardar() {
      this.error.set(null);
      this.mensaje.set(null);

      if (this.formulario.invalid) {
        this.formulario.markAllAsTouched();
        return;
      }

      const valores = this.formulario.getRawValue();
      const fechaHoraISO = new Date(valores.fecha_hora).toISOString(); //tenia problema con la hora

      try {
        const { sala_nombre } = await this.funcionesService.crear({
          pelicula_id: valores.pelicula_id!,
          fecha_hora: fechaHoraISO,
          formato: valores.formato,
          idioma: valores.idioma,
        });
        this.mensaje.set(`Función creada en ${sala_nombre}.`);
        this.formulario.reset({ formato: '2d', idioma: 'castellano' });
      } catch (e) {
        this.error.set((e as Error).message);
      }
  }
}