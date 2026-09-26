import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Peliculas } from '../../../core/services/peliculas';
import { Generos } from '../../../core/services/generos';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import IGenero from '../../../core/interfaces/genero';
import IPerfil from '../../../core/interfaces/perfil';

@Component({
  selector: 'app-alta-pelicula',
  imports: [ReactiveFormsModule],
  templateUrl: './alta-pelicula.html',
  styleUrl: './alta-pelicula.css',
})
export class AltaPelicula {
  private peliculasService = inject(Peliculas);
  private generosService = inject(Generos);
  private authService = inject(Auth);
  private logsService = inject(Logs);

  // Mismo criterio que ya usa AltaFuncion: el guard de la ruta ya garantiza
  // que quien está acá es admin, esto sólo lo necesitamos para saber DE
  // QUIÉN es la acción, para el log de actividad.
  private usuario: IPerfil | null = null;

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
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
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

    // Antes esta creación no quedaba registrada en el Log de actividad —
    // faltaba este llamado, a diferencia de AltaFuncion y Cupones que sí
    // lo tenían desde el principio.
    if (this.usuario) {
      await this.logsService.registrar(this.usuario.id, `Creó la película "${pelicula.nombre}"`);
    }

    this.formulario.reset();
    this.generosSeleccionados.set(new Set());
  }
}