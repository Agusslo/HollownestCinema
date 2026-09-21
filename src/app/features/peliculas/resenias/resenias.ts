import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Resenias as ReseniasService } from '../../../core/services/resenias';
import { Auth } from '../../../core/services/auth';
import { IReseniaConAutor } from '../../../core/interfaces/resenia';
import IPerfil from '../../../core/interfaces/perfil';
import { BlobatarComponent } from '../../../shared/components/blobatar/blobatar';
import { LoadingComponent } from '../../../shared/components/loading/loading';

@Component({
  selector: 'app-resenias',
  imports: [ReactiveFormsModule, BlobatarComponent, LoadingComponent],
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

  protected obtenerNombreAutor(resenia: IReseniaConAutor): string {
    if (this.usuarioActual() && this.usuarioActual()?.id === resenia.usuario_id) {
      return `${this.usuarioActual()!.nombre} ${this.usuarioActual()!.apellido || ''}`.trim();
    }
    if (resenia.perfiles?.nombre) {
      return `${resenia.perfiles.nombre} ${resenia.perfiles.apellido || ''}`.trim();
    }
    return 'Viajero de Hallownest';
  }

  protected obtenerNombreBlobatar(resenia: IReseniaConAutor): string {
    if (this.usuarioActual() && this.usuarioActual()?.id === resenia.usuario_id) {
      return this.usuarioActual()!.nombre;
    }
    return resenia.perfiles?.nombre || 'Sombra';
  }

  protected hoverEstrellas = signal(0);

  protected valorActualEstrellas = computed(() => {
    return this.hoverEstrellas() || (this.formulario.value.estrellas ?? 0);
  });

  protected esHoverTarget(n: number): boolean {
    return this.hoverEstrellas() > 0 && Math.ceil(this.hoverEstrellas()) === n;
  }

  protected etiquetaCalificacion = computed(() => {
    const estrellas = this.valorActualEstrellas();
    switch (estrellas) {
      case 0.5:
        return 'Pésima';
      case 1:
        return 'Frágil';
      case 1.5:
        return 'Incierta';
      case 2:
        return 'Pasable';
      case 2.5:
        return 'Aceptable';
      case 3:
        return 'Honorable';
      case 3.5:
        return 'Notable';
      case 4:
        return 'Sublime';
      case 4.5:
        return 'Magnífica';
      case 5:
        return 'Obra Maestra';
      default:
        return 'Elegí tu calificación';
    }
  });

  protected formulario = new FormGroup({
    estrellas: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.5), Validators.max(5)],
    }),
    comentario: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
    }),
  });

  constructor() {
    effect(() => {
      this.cargar(this.peliculaId());
    });
  }

  private async cargar(peliculaId: number) {
    this.cargando.set(true);
    const [resenias, usuario] = await Promise.all([
      this.reseniasService.obtenerPorPelicula(peliculaId),
      this.authService.usuarioActual(),
    ]);
    this.resenias.set(resenias);
    this.usuarioActual.set(usuario);
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
