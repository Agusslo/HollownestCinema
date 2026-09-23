import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Combos } from '../../../core/services/combos';
import { Candy } from '../../../core/services/candy';
import { ICandyProductoConCategoria } from '../../../core/interfaces/candy-producto';

@Component({
  selector: 'app-alta-combo',
  imports: [ReactiveFormsModule],
  templateUrl: './alta-combo.html',
  styleUrl: './alta-combo.css',
})
export class AltaCombo {
  private combosService = inject(Combos);
  private candyService = inject(Candy);

  protected productos = signal<ICandyProductoConCategoria[]>([]);
  protected guardando = signal(false);
  protected mensaje = signal<string | null>(null);

  // producto_id -> cantidad elegida para el combo. Si un producto no está
  // acá, significa que no forma parte del combo (cantidad 0).
  protected cantidades = signal<Map<number, number>>(new Map());

  protected formulario = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    precio: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
  });

  constructor() {
    this.candyService.obtenerProductos().then((productos) => this.productos.set(productos));
  }

  protected cantidadDe(producto_id: number): number {
    return this.cantidades().get(producto_id) ?? 0;
  }

  protected cambiarCantidad(producto_id: number, delta: number) {
    const actuales = new Map(this.cantidades());
    const nueva = Math.max(0, (actuales.get(producto_id) ?? 0) + delta);

    if (nueva === 0) {
      actuales.delete(producto_id);
    } else {
      actuales.set(producto_id, nueva);
    }
    this.cantidades.set(actuales);
  }

  protected async guardar() {
    this.mensaje.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    if (this.cantidades().size === 0) {
      this.mensaje.set('Elegí al menos un producto de candy para incluir en el combo.');
      return;
    }

    this.guardando.set(true);
    try {
      const datos = this.formulario.getRawValue();
      const items = Array.from(this.cantidades().entries()).map(([producto_id, cantidad]) => ({
        producto_id,
        cantidad,
      }));

      await this.combosService.crear({ ...datos, activo: true }, items);

      this.mensaje.set(`Combo "${datos.nombre}" creado.`);
      this.formulario.reset({ nombre: '', precio: 0 });
      this.cantidades.set(new Map());
    } catch (e) {
      this.mensaje.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}