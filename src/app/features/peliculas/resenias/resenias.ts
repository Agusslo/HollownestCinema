import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Resenias as ReseniasService } from '../../../core/services/resenias';
import { Auth } from '../../../core/services/auth';
import { IReseniaConAutor } from '../../../core/interfaces/resenia';
import IPerfil from '../../../core/interfaces/perfil';

@Component({
  selector: 'app-resenias',
  imports: [ReactiveFormsModule],
  templateUrl: './resenias.html',
  styleUrl: './resenias.css',
})
export class Resenias {
  private reseniasService = inject(ReseniasService);
  private authService = inject(Auth);

  // El componente padre (Detalle) nos va a pasar el id de la película con
  // [peliculaId]="pelicula.id" en su HTML.
  peliculaId = input.required<number>();

  protected resenias = signal<IReseniaConAutor[]>([]);
  protected cargando = signal(true);
  protected usuarioActual = signal<IPerfil | null>(null);
  protected error = signal<string | null>(null);
  protected enviando = signal(false);

  protected promedio = computed(() => this.reseniasService.calcularPromedio(this.resenias()));

  protected yaReseno = computed(() =>
    this.resenias().some((r) => r.usuario_id === this.usuarioActual()?.id),
  );

  protected hoverEstrellas = signal(0);

  protected etiquetaCalificacion = computed(() => {
    const estrellas = this.hoverEstrellas() || (this.formulario.value.estrellas ?? 0);
    switch (estrellas) {
      case 1:
        return 'Frágil';
      case 2:
        return 'Pasable';
      case 3:
        return 'Honorable';
      case 4:
        return 'Sublime';
      case 5:
        return 'Obra Maestra';
      default:
        return 'Elegí tu calificación';
    }
  });

  protected formulario = new FormGroup({
    estrellas: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(5)],
    }),
    comentario: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(500)],
    }),
  });

  constructor() {
    effect(() => {
      this.cargar(this.peliculaId());
    });
  }

  private async cargar(peliculaId: number) {
    this.cargando.set(true);
    this.error.set(null);

    const [resultadoResenias, resultadoUsuario] = await Promise.allSettled([
      this.reseniasService.obtenerPorPelicula(peliculaId),
      this.authService.usuarioActual(),
    ]);

    if (resultadoResenias.status === 'fulfilled') {
      this.resenias.set(resultadoResenias.value);
    } else {
      this.resenias.set([]);
      this.error.set('No se pudieron cargar las reseñas. Intentá nuevamente más tarde.');
    }

    if (resultadoUsuario.status === 'fulfilled') {
      this.usuarioActual.set(resultadoUsuario.value);
    } else {
      this.usuarioActual.set(null);
    }

    this.cargando.set(false);
  }

  protected async enviar() {
    this.error.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const usuario = this.usuarioActual();
    if (!usuario) {
      this.error.set('Tenés que iniciar sesión para dejar una reseña.');
      return;
    }

    this.enviando.set(true);
    try {
      const datos = this.formulario.getRawValue();
      await this.reseniasService.crear({
        pelicula_id: this.peliculaId(),
        usuario_id: usuario.id,
        estrellas: datos.estrellas,
        comentario: datos.comentario.trim(),
      });
      this.formulario.reset({ estrellas: 0, comentario: '' });
      await this.cargar(this.peliculaId());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.enviando.set(false);
    }
  }
}
