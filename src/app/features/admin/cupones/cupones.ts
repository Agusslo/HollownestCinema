import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Cupones as CuponesService } from '../../../core/services/cupones';
import ICupon from '../../../core/interfaces/cupon';

@Component({
  selector: 'app-cupones',
  imports: [ReactiveFormsModule],
  templateUrl: './cupones.html',
  styleUrl: './cupones.css',
})
export class Cupones {
  private cuponesService = inject(CuponesService);

  protected cargando = signal(true);
  protected guardando = signal(false);
  protected mensaje = signal<string | null>(null);

  protected formulario = new FormGroup({
    primeraCompra: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
    mayor50: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
  });

  constructor() {
    this.cargarCupones();
  }

  private async cargarCupones() {
    const cupones = await this.cuponesService.obtenerTodos();
    this.aplicarAlFormulario(cupones);
    this.cargando.set(false);
  }

  private aplicarAlFormulario(cupones: ICupon[]) {
    const primeraCompra = cupones.find((c) => c.tipo === 'primera_compra');
    const mayor50 = cupones.find((c) => c.tipo === 'mayor_50');

    this.formulario.patchValue({
      primeraCompra: primeraCompra?.porcentaje ?? 0,
      mayor50: mayor50?.porcentaje ?? 0,
    });
  }

  protected async guardar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.mensaje.set(null);
    this.guardando.set(true);

    try {
      const { primeraCompra, mayor50 } = this.formulario.getRawValue();

      // Actualizamos los dos tipos de cupón en paralelo, ya que son dos
      // filas independientes en la base — no hace falta esperar a que
      // termine una para arrancar la otra.
      await Promise.all([
        this.cuponesService.actualizarPorcentaje('primera_compra', primeraCompra),
        this.cuponesService.actualizarPorcentaje('mayor_50', mayor50),
      ]);

      this.mensaje.set('Porcentajes actualizados correctamente.');
    } catch (e) {
      this.mensaje.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}