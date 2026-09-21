import { Component, inject, signal } from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';

const ENTERO_POSITIVO_REGEX = /^(0|[1-9]\d*)$/;

// Misma validación de fecha que usa registro.ts — la duplico acá en vez de
// compartirla porque son dos pantallas independientes y esto es chico;
// si mañana hay que tocar la regla de fechas, hay que tocarla en los dos
// lados (queda anotado).
function validarFechaNacimiento(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (!valor) return null;

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor);
  if (!match) return { formatoInvalido: true };

  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  const anio = parseInt(match[3], 10);

  if (mes < 1 || mes > 12) return { mesInvalido: true };
  if (dia < 1 || dia > 31) return { diaInvalido: true };

  const diasEnMes = new Date(anio, mes, 0).getDate();
  if (dia > diasEnMes) return { diaInvalido: true };

  const hoy = new Date();
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha > hoy) return { fechaFutura: true };
  if (anio < 1900) return { anioInvalido: true };

  return null;
}

@Component({
  selector: 'app-completar-perfil',
  imports: [ReactiveFormsModule],
  templateUrl: './completar-perfil.html',
  styleUrl: './completar-perfil.css',
})
export class CompletarPerfil {
  private authService = inject(Auth);
  private router = inject(Router);

  protected error = signal<string | null>(null);
  protected guardando = signal(false);

  protected formulario = new FormGroup({
    fecha_nacimiento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validarFechaNacimiento],
    }),
    tipo_sangre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    color_ojos: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dias_vacaciones: new FormControl(0, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(365),
        Validators.pattern(ENTERO_POSITIVO_REGEX),
      ],
    }),
  });

  protected formatearFecha(event: Event): void {
    const input = event.target as HTMLInputElement;
    let valor = input.value;

    if (valor.includes('/')) {
      const partesRaw = valor.split('/');
      if (partesRaw.length > 1 && partesRaw[0].length === 1 && /^\d$/.test(partesRaw[0])) {
        partesRaw[0] = '0' + partesRaw[0];
        valor = partesRaw.join('/');
      }
      if (partesRaw.length > 2 && partesRaw[1].length === 1 && /^\d$/.test(partesRaw[1])) {
        partesRaw[1] = '0' + partesRaw[1];
        valor = partesRaw.join('/');
      }
    }

    const digitos = valor.replace(/\D/g, '').slice(0, 8);
    const partes = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4, 8)].filter(Boolean);
    this.formulario.controls.fecha_nacimiento.setValue(partes.join('/'));
  }

  protected async guardar() {
    this.error.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    try {
      const valores = this.formulario.getRawValue();
      const [dia, mes, anio] = valores.fecha_nacimiento.split('/');

      await this.authService.completarPerfil({
        ...valores,
        dias_vacaciones: Number(valores.dias_vacaciones),
        fecha_nacimiento: `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`,
      });

      // Recargamos para que App vuelva a leer el perfil (ya con
      // perfil_completo:true) y no nos rebote para acá de nuevo.
      window.location.href = '/';
    } catch (e) {
      this.error.set((e as Error).message);
      this.guardando.set(false);
    }
  }
}