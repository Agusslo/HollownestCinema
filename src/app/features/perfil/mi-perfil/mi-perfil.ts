import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/services/auth';
import { Toasts } from '../../../core/services/toasts';
import IPerfil, { Rol } from '../../../core/interfaces/perfil';
import { BlobatarComponent } from '../../../shared/components/blobatar/blobatar';
import { LoadingComponent } from '../../../shared/components/loading/loading';

// Mismas reglas que en el registro, para que un nombre editado no pueda
// quedar distinto de lo que se acepta al crear la cuenta.
const SOLO_LETRAS_REGEX = /^(?=.*[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const ENTERO_POSITIVO_REGEX = /^(0|[1-9]\d*)$/;

const ETIQUETAS_ROL: Record<Rol, string> = {
  cliente: 'Viajero',
  empleado: 'Guardián de la puerta',
  admin: 'Soberano de Hallownest',
};

@Component({
  selector: 'app-mi-perfil',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, BlobatarComponent, LoadingComponent],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.css',
})
export class MiPerfil {
  private authService = inject(Auth);
  private toasts = inject(Toasts);

  protected usuario = signal<IPerfil | null>(null);
  protected email = signal<string | null>(null);
  protected cargando = signal(true);
  protected guardando = signal(false);
  protected error = signal<string | null>(null);

  protected formulario = new FormGroup({
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

  // El avatar sale del nombre: lo leemos como signal para que la vista
  // previa cambie mientras se escribe, antes de guardar.
  private nombreEscrito = toSignal(this.formulario.controls.nombre.valueChanges, {
    initialValue: '',
  });
  protected nombreAvatar = computed(
    () => this.nombreEscrito().trim() || this.usuario()?.nombre || 'Sombra',
  );
  protected etiquetaRol = computed(() => ETIQUETAS_ROL[this.usuario()?.rol ?? 'cliente']);

  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    try {
      const [usuario, email] = await Promise.all([
        this.authService.usuarioActual(),
        this.authService.emailActual(),
      ]);
      this.usuario.set(usuario);
      this.email.set(email);
      if (usuario) this.rellenarFormulario(usuario);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  private rellenarFormulario(perfil: IPerfil) {
    this.formulario.reset({
      nombre: perfil.nombre,
      apellido: perfil.apellido,
      tipo_sangre: perfil.tipo_sangre,
      color_ojos: perfil.color_ojos,
      dias_vacaciones: perfil.dias_vacaciones,
    });
  }

  protected descartarCambios() {
    const perfil = this.usuario();
    if (perfil) this.rellenarFormulario(perfil);
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
      const actualizado = await this.authService.actualizarPerfil({
        ...valores,
        nombre: valores.nombre.trim(),
        apellido: valores.apellido.trim(),
        dias_vacaciones: Number(valores.dias_vacaciones),
      });

      this.usuario.set(actualizado);
      this.rellenarFormulario(actualizado);
      this.toasts.exito('Perfil guardado', 'Tus datos quedaron grabados en la piedra.');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}
