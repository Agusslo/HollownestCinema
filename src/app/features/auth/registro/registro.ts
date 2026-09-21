import { Component, inject, signal } from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';

const SOLO_LETRAS_REGEX = /^(?=.*[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
const ENTERO_POSITIVO_REGEX = /^(0|[1-9]\d*)$/;

function validarFechaNacimiento(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (!valor) return null;

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor);
  if (!match) {
    return { formatoInvalido: true };
  }

  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  const anio = parseInt(match[3], 10);

  if (mes < 1 || mes > 12) {
    return { mesInvalido: true };
  }

  if (dia < 1 || dia > 31) {
    return { diaInvalido: true };
  }

  const diasEnMes = new Date(anio, mes, 0).getDate();
  if (dia > diasEnMes) {
    return { diaInvalido: true };
  }

  const hoy = new Date();
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha > hoy) {
    return { fechaFutura: true };
  }

  if (anio < 1900) {
    return { anioInvalido: true };
  }

  return null;
}

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private authService = inject(Auth);
  private router = inject(Router);

  protected error = signal<string | null>(null);
  protected mostrarPassword = signal(false);

  protected formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.pattern(EMAIL_REGEX)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(100)],
    }),
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(SOLO_LETRAS_REGEX),
      ],
    }),
    apellido: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(SOLO_LETRAS_REGEX),
      ],
    }),
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

  protected togglePassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  protected async registrar() {
    this.error.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    try {
      const datos = this.formulario.getRawValue();
      const [dia, mes, anio] = datos.fecha_nacimiento.split('/');
      await this.authService.registrar({
        ...datos,
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        email: datos.email.trim(),
        dias_vacaciones: Number(datos.dias_vacaciones),
        fecha_nacimiento: `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`,
      });
      this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  protected async loginConGoogle() {
    this.error.set(null);
    try {
      await this.authService.loginConGoogle();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

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
    const fecha = partes.join('/');

    input.value = fecha;
    this.formulario.controls.fecha_nacimiento.setValue(fecha);
  }
}
