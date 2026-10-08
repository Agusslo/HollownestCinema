import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Combos } from '../../../core/services/combos';
import { Candy } from '../../../core/services/candy';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import { ICandyProductoConCategoria } from '../../../core/interfaces/candy-producto';
import IPerfil from '../../../core/interfaces/perfil';
import { GlowHover } from '../../../shared/directives/glow-hover';

@Component({
  selector: 'app-alta-combo',
  imports: [ReactiveFormsModule, GlowHover],
  templateUrl: './alta-combo.html',
  styleUrl: './alta-combo.css',
})
export class AltaCombo {
  private combosService = inject(Combos);
  private candyService = inject(Candy);
  private authService = inject(Auth);
  private logsService = inject(Logs);

  // Igual que en el resto de las pantallas de admin: sólo para saber DE
  // QUIÉN es la acción a la hora de loguearla.
  private usuario: IPerfil | null = null;

  protected productos = signal<ICandyProductoConCategoria[]>([]);
  protected guardando = signal(false);
  protected error = signal<string | null>(null);
  protected mensaje = signal<string | null>(null);

  // producto_id -> cantidad elegida para el combo. Si un producto no está
  // acá, significa que no forma parte del combo (cantidad 0).
  protected cantidades = signal<Map<number, number>>(new Map());

  protected formulario = new FormGroup({
    // /\S/: que no sea un nombre de puros espacios (required solo lo deja pasar).
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(60)],
    }),
    // Arranca vacío (null) y no en 0, así el admin tiene que escribirlo.
    // Entero mayor a 0, igual que los precios de los productos.
    precio: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.pattern(/^[1-9]\d*$/)],
    }),
  });

  constructor() {
    this.candyService.obtenerProductos().then((productos) => this.productos.set(productos));
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
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
    this.error.set(null);
    this.mensaje.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    if (this.cantidades().size === 0) {
      this.error.set('Elegí al menos un producto de candy para incluir en el combo.');
      return;
    }

    this.guardando.set(true);
    try {
      const valores = this.formulario.getRawValue();
      // El form es inválido si el precio es null, así que acá ya tiene valor.
      const datos = { nombre: valores.nombre.trim(), precio: Number(valores.precio) };
      const items = Array.from(this.cantidades().entries()).map(([producto_id, cantidad]) => ({
        producto_id,
        cantidad,
      }));

      await this.combosService.crear({ ...datos, activo: true }, items);

      // Esto era justo lo que faltaba y encontraste probando: crear un
      // combo no quedaba registrado en el Log de actividad.
      if (this.usuario) {
        await this.logsService.registrar(
          this.usuario.id,
          `Creó el combo "${datos.nombre}" ($${datos.precio})`,
        );
      }

      this.mensaje.set(`Combo "${datos.nombre}" creado.`);
      this.formulario.reset();
      this.cantidades.set(new Map());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}