import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { Archivos, IArchivoSubido } from '../../../core/services/archivos';
import IGenero from '../../../core/interfaces/genero';
import IPerfil from '../../../core/interfaces/perfil';
import { GlowHover } from '../../../shared/directives/glow-hover';
import { IPosterPelicula, PosterCard } from '../../../shared/components/poster-card/poster-card';

// Bucket de Supabase Storage donde se guardan los pósters.
const BUCKET_POSTERS = 'posters';

// Los mismos formatos y tamaño máximo que tiene configurados el bucket: si
// el archivo no cumple, se avisa antes de subirlo (si no, Supabase lo
// rechazaría igual, pero con un error menos claro).
const FORMATOS_POSTER = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANIO_MAXIMO_MB = 5;

// Imagen de la vista previa mientras todavía no se eligió ningún archivo.
const POSTER_VACIO =
  'https://placehold.co/260x380/0a0a12/4fc4e3?text=Eleg%C3%AD+un+p%C3%B3ster&font=playfair-display';

// Validador propio para el archivo del póster. Si no hay archivo devuelve
// null y de ese caso se encarga Validators.required.
function validarPoster(control: AbstractControl<File | null>): ValidationErrors | null {
  const archivo = control.value;
  if (!archivo) return null;
  if (!FORMATOS_POSTER.includes(archivo.type)) return { formatoPoster: true };
  if (archivo.size > TAMANIO_MAXIMO_MB * 1024 * 1024) return { tamanioPoster: true };
  return null;
}

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
  imports: [ReactiveFormsModule, GlowHover, PosterCard],
  templateUrl: './alta-pelicula.html',
  styleUrl: './alta-pelicula.css',
})
export class AltaPelicula {
  private peliculasService = inject(Peliculas);
  private generosService = inject(Generos);
  private authService = inject(Auth);
  private logsService = inject(Logs);
  private archivosService = inject(Archivos);

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
      // El póster es un archivo (File), no texto. Un <input type="file">
      // no se puede conectar con formControlName (Angular le pondría el
      // texto "C:\fakepath\..."), así que el archivo se carga a mano en
      // cargarPoster(), igual que en la clase de Storage.
      poster: new FormControl<File | null>(null, {
        validators: [Validators.required, validarPoster],
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

  // ── Vista previa ──
  // El <input type="file"> del HTML, para poder vaciarlo después de guardar.
  private inputPoster = viewChild.required<ElementRef<HTMLInputElement>>('inputPoster');

  // URL temporal del archivo elegido (blob:...), para mostrarlo en la vista
  // previa ANTES de subirlo: el navegador la arma con el archivo que ya
  // tiene en memoria, sin pasar por Supabase.
  protected posterLocal = signal<string | null>(null);

  // valueChanges es un Observable que avisa cada vez que cambia algún campo;
  // toSignal lo convierte en signal para poder usarlo dentro de computed().
  private valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.value,
  });

  // Los datos que recibe <app-poster-card> en la vista previa: lo que el
  // admin va escribiendo, o un texto de ejemplo si el campo está vacío.
  protected vistaPrevia = computed<IPosterPelicula>(() => {
    const valores = this.valores();
    return {
      nombre: valores.nombre?.trim() || 'Nombre de la película',
      imagen_url: this.posterLocal() ?? POSTER_VACIO,
      duracion_minutos: Number(valores.duracion_minutos) || 0,
    };
  });

  protected tieneEstreno = computed(() => !!this.valores().fecha_estreno);

  constructor() {
    this.cargarGeneros();
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
    // La URL temporal ocupa memoria hasta que se libera: al salir de la
    // pantalla se libera la que haya quedado.
    inject(DestroyRef).onDestroy(() => this.liberarPosterLocal());
  }

  protected cargarPoster(evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
    const control = this.formulario.controls.poster;
    control.setValue(archivo);
    control.markAsTouched();

    this.liberarPosterLocal();
    // Sólo se previsualiza si es una imagen válida (formato y tamaño).
    if (archivo && control.valid) {
      this.posterLocal.set(URL.createObjectURL(archivo));
    }
  }

  private liberarPosterLocal() {
    const url = this.posterLocal();
    if (url) URL.revokeObjectURL(url);
    this.posterLocal.set(null);
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
    // Si el póster ya se subió pero después falla el alta, se borra del
    // bucket (en el catch) para no dejar imágenes que no usa nadie.
    let posterSubido: IArchivoSubido | null = null;
    try {
      // El póster se separa del resto: no es una columna de la tabla. Lo
      // que se guarda en la película es la URL pública que devuelve Storage.
      const { poster, ...valores } = this.formulario.getRawValue();
      posterSubido = await this.archivosService.subirImagen(BUCKET_POSTERS, poster!);

      // '' (input de fecha vacío) → null, que para la app significa
      // "ya está en cartelera normal".
      const fechaEstreno = valores.fecha_estreno || null;

      const pelicula = await this.peliculasService.crear({
        ...valores,
        nombre: valores.nombre.trim(),
        sinopsis: valores.sinopsis.trim(),
        imagen_url: posterSubido.url,
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
      this.inputPoster().nativeElement.value = '';
      this.liberarPosterLocal();
      this.generosSeleccionados.set(new Set());
      this.intentoGuardar.set(false);
    } catch (e) {
      if (posterSubido) {
        // Si esto también falla, no tapamos el error original.
        this.archivosService.borrar(BUCKET_POSTERS, posterSubido.ruta).catch(() => {});
      }
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}