import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Candy } from '../../../core/services/candy';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import ICandyCategoria from '../../../core/interfaces/candy-categoria';
import IPerfil from '../../../core/interfaces/perfil';
import { GlowHover } from '../../../shared/directives/glow-hover';

@Component({
  selector: 'app-alta-candy',
  imports: [ReactiveFormsModule, GlowHover],
  templateUrl: './alta-candy.html',
  styleUrl: './alta-candy.css',
})
export class AltaCandy {
  private candyService = inject(Candy);
  private authService = inject(Auth);
  private logsService = inject(Logs);

  // Igual que en AltaFuncion/AltaPelicula: sólo para saber DE QUIÉN es la
  // acción a la hora de loguearla.
  private usuario: IPerfil | null = null;

  protected categorias = signal<ICandyCategoria[]>([]);
  protected guardando = signal(false);
  protected mensaje = signal<string | null>(null);

  protected formulario = new FormGroup({
    // /\S/: que no sea un nombre de puros espacios (required solo lo deja pasar).
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    precio: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    categoria_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    // Opcional, pero si se carga tiene que ser un link.
    imagen_url: new FormControl('', { validators: [Validators.pattern(/^https?:\/\/\S+$/)] }),
    // Opcional (sin required): si se deja vacío, este producto no se va a
    // poder canjear con puntos, sólo comprar con plata/crédito.
    puntos_canje: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
  });

  constructor() {
    this.candyService.obtenerCategorias().then((categorias) => this.categorias.set(categorias));
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
  }

  protected async guardar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.mensaje.set(null);
    this.guardando.set(true);

    try {
      const datos = this.formulario.getRawValue();
      await this.candyService.crearProducto({
        nombre: datos.nombre,
        precio: datos.precio,
        categoria_id: datos.categoria_id!, // ya sabemos que no es null: el form es invalido si lo es
        imagen_url: datos.imagen_url || null,
        puntos_canje: datos.puntos_canje ?? null,
      });

      // Este llamado faltaba antes — la creación de un producto de candy
      // no quedaba registrada en el Log de actividad.
      if (this.usuario) {
        await this.logsService.registrar(
          this.usuario.id,
          `Creó el producto de candy "${datos.nombre}" ($${datos.precio})`,
        );
      }

      this.mensaje.set(`"${datos.nombre}" se agregó al candy bar.`);
      this.formulario.reset({
        nombre: '',
        precio: 0,
        categoria_id: null,
        imagen_url: '',
        puntos_canje: null,
      });
    } catch (e) {
      this.mensaje.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}