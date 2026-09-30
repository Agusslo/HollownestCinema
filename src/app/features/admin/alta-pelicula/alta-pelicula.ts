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
import { Generos } from '../../../core/services/generos';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import IGenero from '../../../core/interfaces/genero';
import IPerfil from '../../../core/interfaces/perfil';
import { GlowHover } from '../../../shared/directives/glow-hover';

// Validador del grupo entero porque cruza dos campos: un precio de
// preventa sin fecha de estreno antes se descartaba en silencio al
// guardar; ahora se avisa para que el admin cargue la fecha o borre el precio.
function validarPreventa(grupo: AbstractControl): ValidationErrors | null {
  const fecha = grupo.get('fecha_estreno')?.value;
  const precio = grupo.get('precio_preventa')?.value;
  return precio != null && !fecha ? { preventaSinFecha: true } : null;
}

@Component({
  selector: 'app-alta-pelicula',
  imports: [ReactiveFormsModule, GlowHover],
  templateUrl: './alta-pelicula.html',
  styleUrl: './alta-pelicula.css',
})
export class AltaPelicula {
  private peliculasService = inject(Peliculas);
  private generosService = inject(Generos);
  private authService = inject(Auth);
  private logsService = inject(Logs);

  // Mismo criterio que ya usa AltaFuncion: el guard de la ruta ya garantiza
  // que quien está acá es admin, esto sólo lo necesitamos para saber DE
  // QUIÉN es la acción, para el log de actividad.
  private usuario: IPerfil | null = null;

  protected generosDisponibles = signal<IGenero[]>([]);
  protected generosSeleccionados = signal<Set<number>>(new Set());

  protected guardando = signal(false);
  protected error = signal<string | null>(null);
  protected mensaje = signal<string | null>(null);
  // Los géneros no son un FormControl (son checkboxes sueltos), así que su
  // error recién se muestra después del primer intento de guardar.
  protected intentoGuardar = signal(false);

  protected formulario = new FormGroup(
    {
      // /\S/ = al menos un caracter que no sea espacio: required solo no
      // frena un nombre escrito con puros espacios.
      nombre: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)],
      }),
      sinopsis: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/\S/), Validators.minLength(10)],
      }),
      imagen_url: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^https?:\/\/\S+$/)],
      }),
      duracion_minutos: new FormControl(0, {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.min(1),
          Validators.max(600),
          Validators.pattern(/^\d+$/),
        ],
      }),
      // El <select> del HTML maneja strings ('', '13', '18'); se convierte
      // a number | null recién al guardar, más abajo.
      restriccion_edad: new FormControl('', { nonNullable: true }),
      // Próximamente y preventa — los dos son opcionales. El <input
      // type="date"> devuelve 'YYYY-MM-DD' (o '' si está vacío), que es
      // justo el formato que espera la columna date de Supabase.
      fecha_estreno: new FormControl('', { nonNullable: true }),
      // <input type="number"> vacío = null. min(1) evita un precio 0 o
      // negativo (una entrada de preventa gratis no tiene sentido).
      precio_preventa: new FormControl<number | null>(null, { validators: [Validators.min(1)] }),
    },
    { validators: validarPreventa },
  );

  constructor() {
    this.cargarGeneros();
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
  }

  private async cargarGeneros() {
    const generos = await this.generosService.obtenerTodos();
    const recomendados = ['Drama', 'Aventuras', 'Acción', 'Terror', 'Ciencia Ficción', 'Comedia', 'Romance', 'Thriller', 'Animación', 'Documental',];
    const existentes = new Set(generos.map((genero) => genero.nombre.toLowerCase()));

    for (const nombre of recomendados) {
      if (!existentes.has(nombre.toLowerCase())) {
        generos.push(await this.generosService.crear(nombre));
      }
    }

    this.generosDisponibles.set(generos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
  }

  protected toggleGenero(id: number) {
    const actuales = new Set(this.generosSeleccionados());
    if (actuales.has(id)) {
      actuales.delete(id);
    } else {
      actuales.add(id);
    }
    this.generosSeleccionados.set(actuales);
  }

  protected async guardar() {
    this.error.set(null);
    this.mensaje.set(null);
    this.intentoGuardar.set(true);

    if (this.formulario.invalid || this.generosSeleccionados().size === 0) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    try {
      const valores = this.formulario.getRawValue();
      // '' (input de fecha vacío) → null, que para la app significa
      // "ya está en cartelera normal".
      const fechaEstreno = valores.fecha_estreno || null;

      const pelicula = await this.peliculasService.crear({
        ...valores,
        nombre: valores.nombre.trim(),
        sinopsis: valores.sinopsis.trim(),
        imagen_url: valores.imagen_url.trim(),
        restriccion_edad: valores.restriccion_edad ? Number(valores.restriccion_edad) : null,
        fecha_estreno: fechaEstreno,
        // validarPreventa ya garantiza que no hay precio sin fecha.
        precio_preventa: valores.precio_preventa,
      });
      await this.generosService.asignarAPelicula(pelicula.id, [...this.generosSeleccionados()]);

      // Antes esta creación no quedaba registrada en el Log de actividad —
      // faltaba este llamado, a diferencia de AltaFuncion y Cupones que sí
      // lo tenían desde el principio.
      //
      // La consigna pide registrar "quién modificó un precio": si la
      // película tiene preventa, el log también dice la fecha y el precio.
      if (this.usuario) {
        let detalle = '';
        if (pelicula.fecha_estreno) {
          // "2026-10-15" → "15/10/2026", sin pasar por new Date() (mismo
          // motivo que en ExportacionReportes: evitar el corrimiento de un
          // día por la zona horaria).
          const fecha = pelicula.fecha_estreno.split('-').reverse().join('/');
          detalle = pelicula.precio_preventa
            ? ` (estreno ${fecha}, preventa a $${pelicula.precio_preventa.toLocaleString('es-AR')})`
            : ` (estreno ${fecha}, preventa a precio normal)`;
        }
        await this.logsService.registrar(
          this.usuario.id,
          `Creó la película "${pelicula.nombre}"${detalle}`,
        );
      }

      this.mensaje.set(`"${pelicula.nombre}" se agregó a la cartelera.`);
      this.formulario.reset();
      this.generosSeleccionados.set(new Set());
      this.intentoGuardar.set(false);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}
