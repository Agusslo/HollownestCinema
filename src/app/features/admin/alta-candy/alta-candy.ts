import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Candy } from '../../../core/services/candy';
import ICandyCategoria from '../../../core/interfaces/candy-categoria';

@Component({
  selector: 'app-alta-candy',
  imports: [ReactiveFormsModule],
  templateUrl: './alta-candy.html',
  styleUrl: './alta-candy.css',
})
export class AltaCandy {
  private candyService = inject(Candy);

  protected categorias = signal<ICandyCategoria[]>([]);
  protected guardando = signal(false);
  protected mensaje = signal<string | null>(null);

  protected formulario = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    precio: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    categoria_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    imagen_url: new FormControl(''),
    // Opcional (sin required): si se deja vacío, este producto no se va a
    // poder canjear con puntos, sólo comprar con plata/crédito.
    puntos_canje: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
  });

  constructor() {
    this.candyService.obtenerCategorias().then((categorias) => this.categorias.set(categorias));
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