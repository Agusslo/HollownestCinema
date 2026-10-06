import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Precios } from '../../../core/services/precios';
import { conRecargoVip } from '../../../core/services/entradas';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import { Toasts } from '../../../core/services/toasts';
import IPreciosEntradas, { COLUMNA_PRECIO } from '../../../core/interfaces/precios';
import { Formato } from '../../../core/interfaces/funcion';
import IPerfil from '../../../core/interfaces/perfil';
import { LoadingComponent } from '../../../shared/components/loading/loading';
import { GlowHover } from '../../../shared/directives/glow-hover';

type CampoPrecio = Exclude<keyof IPreciosEntradas, 'id'>;

// Un precio en pesos: entero y mayor a 0.
const validadoresPrecio = [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)];

// Pantalla de admin para cambiar el precio de la entrada de cada formato y
// el recargo de las butacas VIP. Antes estaban fijos en el código; ahora
// se guardan en la tabla precios_entradas (una sola fila, id = 1), igual
// que la configuración de Fidelización.
@Component({
  selector: 'app-precios',
  imports: [ReactiveFormsModule, DecimalPipe, LoadingComponent, GlowHover],
  templateUrl: './precios.html',
  styleUrl: './precios.css',
})
export class PreciosAdmin {
  private preciosService = inject(Precios);
  private authService = inject(Auth);
  private logsService = inject(Logs);
  private toasts = inject(Toasts);

  private usuario: IPerfil | null = null;
  // Los valores con los que arrancó la pantalla: para guardar y loguear
  // SÓLO lo que el admin realmente cambió, mostrando "$18.800 → $20.000".
  private originales: IPreciosEntradas | null = null;

  protected cargando = signal(true);
  protected guardando = signal(false);
  protected error = signal<string | null>(null);

  // Para recorrer los formatos en el template (2D, 3D, 4D, 5D).
  protected formatos = Object.keys(COLUMNA_PRECIO) as Formato[];
  protected columna = COLUMNA_PRECIO;

  protected formulario = new FormGroup({
    precio_2d: new FormControl(0, { nonNullable: true, validators: validadoresPrecio }),
    precio_3d: new FormControl(0, { nonNullable: true, validators: validadoresPrecio }),
    precio_4d: new FormControl(0, { nonNullable: true, validators: validadoresPrecio }),
    precio_5d: new FormControl(0, { nonNullable: true, validators: validadoresPrecio }),
    // Porcentaje entero. Tope 200% para que un error de tipeo (ej. 3000)
    // no deje una VIP a 31 veces el precio. La base tiene el mismo tope.
    recargo_vip: new FormControl(0, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(200),
        Validators.pattern(/^\d+$/),
      ],
    }),
  });

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      this.originales = await this.preciosService.obtener();
      this.formulario.patchValue(this.originales);
      this.usuario = await this.authService.usuarioActual();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  // Vista previa con lo que está escrito ahora (antes de guardar): cuánto
  // sale la butaca VIP de cada formato. Misma cuenta que al comprar.
  protected precioVip(formato: Formato): number {
    const valores = this.formulario.getRawValue();
    return conRecargoVip(valores[COLUMNA_PRECIO[formato]], valores.recargo_vip);
  }

  protected async guardar() {
    this.error.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const originales = this.originales;
    if (!originales) return;

    // Sólo los campos que cambiaron.
    const nuevos = this.formulario.getRawValue();
    const cambiados = (Object.keys(nuevos) as CampoPrecio[]).filter(
      (campo) => nuevos[campo] !== originales[campo],
    );

    if (cambiados.length === 0) {
      this.toasts.info('Sin cambios', 'No modificaste ningún precio.');
      return;
    }

    const cambios: Partial<Omit<IPreciosEntradas, 'id'>> = {};
    for (const campo of cambiados) cambios[campo] = nuevos[campo];

    this.guardando.set(true);
    try {
      await this.preciosService.actualizar(cambios);

      // La consigna pide registrar "quién modificó un precio": una entrada
      // por cada valor que cambió, con el antes y el después.
      if (this.usuario) {
        for (const campo of cambiados) {
          await this.logsService.registrar(
            this.usuario.id,
            this.textoDelCambio(campo, originales[campo], nuevos[campo]),
          );
        }
      }

      this.originales = { ...originales, ...cambios };
      this.toasts.exito('Precios actualizados', 'Las próximas compras ya usan los valores nuevos.');
    } catch (e) {
      this.error.set((e as Error).message);
      this.toasts.error('No se pudo guardar', 'Probá de nuevo en un momento.');
    } finally {
      this.guardando.set(false);
    }
  }

  // "Modificó el precio de la entrada 2D: $18.800 → $20.000"
  // "Modificó el recargo de las butacas VIP: 30% → 35%"
  private textoDelCambio(campo: CampoPrecio, antes: number, despues: number): string {
    if (campo === 'recargo_vip') {
      return `Modificó el recargo de las butacas VIP: ${antes}% → ${despues}%`;
    }
    const formato = campo.replace('precio_', '').toUpperCase();
    const pesos = (valor: number) => `$${valor.toLocaleString('es-AR')}`;
    return `Modificó el precio de la entrada ${formato}: ${pesos(antes)} → ${pesos(despues)}`;
  }
}