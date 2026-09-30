import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  FormControl,
  ValidationErrors,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Peliculas } from '../../../core/services/peliculas';
import { Funciones } from '../../../core/services/funciones';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import IPelicula from '../../../core/interfaces/pelicula';
import IPerfil from '../../../core/interfaces/perfil';
import { Formato, Idioma } from '../../../core/interfaces/funcion';
import { GlowHover } from '../../../shared/directives/glow-hover';

// El <input type="datetime-local"> deja elegir cualquier fecha: sin esto se
// podía programar una función que ya pasó y nadie iba a poder comprar.
function validarFechaFutura(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return new Date(control.value).getTime() <= Date.now() ? { fechaPasada: true } : null;
}

@Component({
  selector: 'app-alta-funcion',
  imports: [ReactiveFormsModule, GlowHover],
  templateUrl: './alta-funcion.html',
  styleUrl: './alta-funcion.css',
})
export class AltaFuncion {
  private peliculasService = inject(Peliculas);
  private funcionesService = inject(Funciones);
  private authService = inject(Auth);
  private logsService = inject(Logs);

  // El guard de la ruta ya garantiza que quien esté acá es admin — esto
  // sólo lo necesitamos para saber DE QUIÉN es la acción, para el log.
  private usuario: IPerfil | null = null;

  protected peliculas = signal<IPelicula[]>([]);
  protected error = signal<string | null>(null);
  protected mensaje = signal<string | null>(null);

  protected formulario = new FormGroup({
    pelicula_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    fecha_hora: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validarFechaFutura],
    }),
    formato: new FormControl<Formato>('2d', { nonNullable: true, validators: [Validators.required] }),
    idioma: new FormControl<Idioma>('castellano', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.cargarOpciones();
  }

  private async cargarOpciones() {
    this.peliculas.set(await this.peliculasService.obtenerTodas()); //trae todas las peliculas y las setea en el signal de peliculas
    this.usuario = await this.authService.usuarioActual();
  }

  protected async guardar() {
      this.error.set(null);
      this.mensaje.set(null);

      if (this.formulario.invalid) {
        this.formulario.markAllAsTouched();
        return;
      }

      const valores = this.formulario.getRawValue();
      const fechaHoraISO = new Date(valores.fecha_hora).toISOString(); //tenia problema con la hora

      try {
        const { sala_nombre } = await this.funcionesService.crear({
          pelicula_id: valores.pelicula_id!,
          fecha_hora: fechaHoraISO,
          formato: valores.formato,
          idioma: valores.idioma,
        });
        this.mensaje.set(`Función creada en ${sala_nombre}.`);

        if (this.usuario) {
          const pelicula = this.peliculas().find((p) => p.id === valores.pelicula_id);
          await this.logsService.registrar(
            this.usuario.id,
            `Creó una función de "${pelicula?.nombre ?? 'película'}" en ${sala_nombre}`,
          );
        }

        this.formulario.reset({ formato: '2d', idioma: 'castellano' });
      } catch (e) {
        this.error.set((e as Error).message);
      }
  }
}