import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Cupones as CuponesService } from '../../../core/services/cupones';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import ICupon from '../../../core/interfaces/cupon';
import IPerfil from '../../../core/interfaces/perfil';
import { LoadingComponent } from '../../../shared/components/loading/loading';
import { GlowHover } from '../../../shared/directives/glow-hover';

@Component({
  selector: 'app-cupones',
  imports: [ReactiveFormsModule, LoadingComponent, GlowHover],
  templateUrl: './cupones.html',
  styleUrl: './cupones.css',
})
export class Cupones {
  private cuponesService = inject(CuponesService);
  private authService = inject(Auth);
  private logsService = inject(Logs);

  private usuario: IPerfil | null = null;
  // Los valores con los que arrancó el formulario, para poder comparar en
  // guardar() y loguear SÓLO el/los porcentaje/s que realmente cambió —
  // no tiene sentido loguear "modificó un precio" si no lo tocó.
  private valoresOriginales = { primeraCompra: 0, mayor50: 0 };

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
    this.usuario = await this.authService.usuarioActual();
    this.cargando.set(false);
  }

  private aplicarAlFormulario(cupones: ICupon[]) {
    const primeraCompra = cupones.find((c) => c.tipo === 'primera_compra');
    const mayor50 = cupones.find((c) => c.tipo === 'mayor_50');

    this.valoresOriginales = {
      primeraCompra: primeraCompra?.porcentaje ?? 0,
      mayor50: mayor50?.porcentaje ?? 0,
    };

    this.formulario.patchValue(this.valoresOriginales);
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

      if (this.usuario) {
        const cambios: string[] = [];
        if (primeraCompra !== this.valoresOriginales.primeraCompra) {
          cambios.push(
            `cupón de primera compra: ${this.valoresOriginales.primeraCompra}% → ${primeraCompra}%`,
          );
        }
        if (mayor50 !== this.valoresOriginales.mayor50) {
          cambios.push(`cupón de mayores de 50: ${this.valoresOriginales.mayor50}% → ${mayor50}%`);
        }
        for (const cambio of cambios) {
          await this.logsService.registrar(this.usuario.id, `Modificó el ${cambio}`);
        }
      }

      this.valoresOriginales = { primeraCompra, mayor50 };
      this.mensaje.set('Porcentajes actualizados correctamente.');
    } catch (e) {
      this.mensaje.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}