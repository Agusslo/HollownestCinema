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
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Candy } from '../../../core/services/candy';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import {
  Archivos,
  BUCKET_IMAGENES,
  IArchivoSubido,
  validarImagen,
} from '../../../core/services/archivos';
import ICandyCategoria from '../../../core/interfaces/candy-categoria';
import IPerfil from '../../../core/interfaces/perfil';
import { GlowHover } from '../../../shared/directives/glow-hover';
import { CandyCard, ICandyCardProducto } from '../../../shared/components/candy-card/candy-card';

// Las fotos de los productos van al mismo bucket que los pósters, en su
// propia carpeta: así usan las mismas reglas (sólo el admin sube y borra).
const CARPETA_PRODUCTOS = 'productos';

// Imagen de la vista previa mientras todavía no se eligió ningún archivo.
const IMAGEN_VACIA =
  'https://placehold.co/200x150/0a0a12/4fc4e3?text=Eleg%C3%AD+una+imagen&font=playfair-display';

// Entero mayor a 0: los precios y los puntos se manejan sin decimales.
const ENTERO_POSITIVO = /^[1-9]\d*$/;

@Component({
  selector: 'app-alta-candy',
  imports: [ReactiveFormsModule, GlowHover, CandyCard],
  templateUrl: './alta-candy.html',
  styleUrl: './alta-candy.css',
})
export class AltaCandy {
  private candyService = inject(Candy);
  private authService = inject(Auth);
  private logsService = inject(Logs);
  private archivosService = inject(Archivos);

  // Igual que en AltaFuncion/AltaPelicula: sólo para saber DE QUIÉN es la
  // acción a la hora de loguearla.
  private usuario: IPerfil | null = null;

  protected categorias = signal<ICandyCategoria[]>([]);
  protected guardando = signal(false);
  protected error = signal<string | null>(null);
  protected mensaje = signal<string | null>(null);

  protected formulario = new FormGroup({
    // /\S/: que no sea un nombre de puros espacios (required solo lo deja pasar).
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(60)],
    }),
    // Arranca vacío (null) y no en 0, así el admin tiene que escribirlo: un
    // producto gratis no tiene sentido.
    precio: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.pattern(ENTERO_POSITIVO)],
    }),
    categoria_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    // La foto es un archivo (File), igual que el póster de AltaPelicula: un
    // <input type="file"> no se conecta con formControlName, así que el
    // archivo se carga a mano en cargarImagen().
    imagen: new FormControl<File | null>(null, {
      validators: [Validators.required, validarImagen],
    }),
    // Opcional a propósito: vacío significa que el producto no se puede
    // canjear con puntos, sólo comprar (igual que en la pantalla Productos).
    // Si se carga, tiene que ser un entero mayor a 0: canjear por 0 puntos
    // sería regalarlo.
    puntos_canje: new FormControl<number | null>(null, {
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
  });

  // ── Vista previa ──
  // El <input type="file"> del HTML, para poder vaciarlo después de guardar.
  private inputImagen = viewChild.required<ElementRef<HTMLInputElement>>('inputImagen');

  // URL temporal del archivo elegido (blob:...), para mostrarlo en la vista
  // previa ANTES de subirlo (mismo recurso que en AltaPelicula).
  protected imagenLocal = signal<string | null>(null);

  // El formulario como signal, para poder usarlo dentro de computed().
  private valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.value,
  });

  // Los datos que recibe <app-candy-card>: lo que el admin va escribiendo, o
  // un texto de ejemplo si el campo está vacío.
  protected vistaPrevia = computed<ICandyCardProducto>(() => {
    const valores = this.valores();
    return {
      nombre: valores.nombre?.trim() || 'Nombre del producto',
      precio: Number(valores.precio) || 0,
      imagen_url: this.imagenLocal() ?? IMAGEN_VACIA,
      puntos_canje: Number(valores.puntos_canje) || null,
    };
  });

  // Nombre del archivo elegido, para mostrarlo al lado del botón.
  protected nombreImagen = computed(() => this.valores().imagen?.name ?? null);

  // En qué pestaña del candy bar va a aparecer, para mostrarlo debajo de la
  // vista previa.
  protected categoriaElegida = computed(() => {
    const id = this.valores().categoria_id;
    return this.categorias().find((categoria) => categoria.id === id)?.nombre ?? null;
  });

  constructor() {
    this.candyService.obtenerCategorias().then((categorias) => this.categorias.set(categorias));
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
    // La URL temporal ocupa memoria hasta que se libera.
    inject(DestroyRef).onDestroy(() => this.liberarImagenLocal());
  }

  protected cargarImagen(evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
    const control = this.formulario.controls.imagen;
    control.setValue(archivo);
    control.markAsTouched();

    this.liberarImagenLocal();
    // Sólo se previsualiza si es una imagen válida (formato y tamaño).
    if (archivo && control.valid) {
      this.imagenLocal.set(URL.createObjectURL(archivo));
    }
  }

  private liberarImagenLocal() {
    const url = this.imagenLocal();
    if (url) URL.revokeObjectURL(url);
    this.imagenLocal.set(null);
  }

  protected async guardar() {
    this.error.set(null);
    this.mensaje.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    // Si la foto ya se subió pero después falla el alta, se borra del
    // bucket (en el catch) para no dejar imágenes que no usa nadie.
    let imagenSubida: IArchivoSubido | null = null;
    try {
      // La foto se separa del resto: no es una columna de la tabla. Lo que
      // se guarda en el producto es la URL pública que devuelve Storage.
      const { imagen, ...datos } = this.formulario.getRawValue();
      imagenSubida = await this.archivosService.subirImagen(
        BUCKET_IMAGENES,
        imagen!,
        CARPETA_PRODUCTOS,
      );

      const nombre = datos.nombre.trim();
      // El form es inválido si precio o categoría son null, así que acá
      // ya sabemos que tienen valor.
      const precio = Number(datos.precio);
      await this.candyService.crearProducto({
        nombre,
        precio,
        categoria_id: datos.categoria_id!,
        imagen_url: imagenSubida.url,
        puntos_canje: datos.puntos_canje ? Number(datos.puntos_canje) : null,
      });

      // Este llamado faltaba antes — la creación de un producto de candy
      // no quedaba registrada en el Log de actividad.
      if (this.usuario) {
        await this.logsService.registrar(
          this.usuario.id,
          `Creó el producto de candy "${nombre}" ($${precio})`,
        );
      }

      this.mensaje.set(`"${nombre}" se agregó al candy bar.`);
      this.formulario.reset();
      this.inputImagen().nativeElement.value = '';
      this.liberarImagenLocal();
    } catch (e) {
      if (imagenSubida) {
        // Si esto también falla, no tapamos el error original.
        this.archivosService.borrar(BUCKET_IMAGENES, imagenSubida.ruta).catch(() => {});
      }
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}
