import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private authService = inject(Auth);
  private router = inject(Router);

  protected error = signal<string | null>(null);

  protected formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apellido: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fecha_nacimiento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)],
    }),
    tipo_sangre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    color_ojos: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dias_vacaciones: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  });

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
        fecha_nacimiento: `${anio}-${mes}-${dia}`,
      });
      this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  protected formatearFecha(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitos = input.value.replace(/\D/g, '').slice(0, 8);
    const partes = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4, 8)].filter(Boolean);
    const fecha = partes.join('/');

    input.value = fecha;
    this.formulario.controls.fecha_nacimiento.setValue(fecha, { emitEvent: false });
  }
}
