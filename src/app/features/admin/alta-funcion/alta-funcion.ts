import { Component, computed, inject, signal } from '@angular/core';
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
import { Funciones } from '../../../core/services/funciones';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import IPelicula from '../../../core/interfaces/pelicula';
import IPerfil from '../../../core/interfaces/perfil';
import { Formato, Idioma } from '../../../core/interfaces/funcion';
import { GlowHover } from '../../../shared/directives/glow-hover';

// Cómo se carga la función: una sola vez (fecha y hora puntual) o varios
// días de la semana a la misma hora. La consigna da justo ese ejemplo:
// "quiero que una película se proyecte los lunes, martes y viernes a las 18hs".
type Modo = 'unica' | 'semanal';

// Tope de funciones por carga, para que un rango largo por error no
// llene la cartelera de golpe (12 semanas de un día por semana, por ejemplo).
const MAX_FUNCIONES_POR_CARGA = 60;

// Días en el orden en que se muestran (lunes primero). El número es el de
// Date.getDay(): 0 = domingo, 1 = lunes ... 6 = sábado.
const DIAS_SEMANA = [
  { numero: 1, nombre: 'Lunes', corto: 'Lun' },
  { numero: 2, nombre: 'Martes', corto: 'Mar' },
  { numero: 3, nombre: 'Miércoles', corto: 'Mié' },
  { numero: 4, nombre: 'Jueves', corto: 'Jue' },
  { numero: 5, nombre: 'Viernes', corto: 'Vie' },
  { numero: 6, nombre: 'Sábado', corto: 'Sáb' },
  { numero: 0, nombre: 'Domingo', corto: 'Dom' },
];

// El <input type="datetime-local"> deja elegir cualquier fecha: sin esto se
// podía programar una función que ya pasó y nadie iba a poder comprar.
function validarFechaFutura(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return new Date(control.value).getTime() <= Date.now() ? { fechaPasada: true } : null;
}

// Al menos un día tildado (el control guarda la lista de días elegidos).
function validarDias(control: AbstractControl<number[]>): ValidationErrors | null {
  return control.value.length === 0 ? { sinDias: true } : null;
}

// Validador del grupo "semanal": cruza las dos fechas del rango. Las
// fechas son texto 'YYYY-MM-DD', que se compara bien como texto.
function validarRango(grupo: AbstractControl): ValidationErrors | null {
  const desde = grupo.get('desde')?.value;
  const hasta = grupo.get('hasta')?.value;
  if (!desde || !hasta) return null;
  return hasta < desde ? { rangoInvertido: true } : null;
}

// 'YYYY-MM-DD' → Date de ese día a las 00:00 en hora LOCAL. Con
// new Date('2026-10-05') JavaScript lo toma como UTC y en Argentina daría
// el día anterior a las 21:00; armándolo con (año, mes, día) no pasa.
function fechaLocal(texto: string): Date {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

// Todas las fechas y horas que salen de "estos días de la semana, a esta
// hora, entre estas dos fechas". Recorre el rango día por día y se queda
// con los que caen en un día elegido. Las que ya pasaron (por ejemplo, hoy
// a una hora que ya fue) se descartan.
function generarFechas(dias: number[], hora: string, desde: string, hasta: string): Date[] {
  if (dias.length === 0 || !hora || !desde || !hasta || hasta < desde) return [];

  const [horas, minutos] = hora.split(':').map(Number);
  const fin = fechaLocal(hasta);
  const ahora = Date.now();
  const fechas: Date[] = [];

  for (const dia = fechaLocal(desde); dia <= fin; dia.setDate(dia.getDate() + 1)) {
    if (!dias.includes(dia.getDay())) continue;
    const funcion = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), horas, minutos);
    if (funcion.getTime() > ahora) fechas.push(funcion);
  }

  return fechas;
}

// Para mostrar al admin: Date → 'lun 05/10 18:00'.
function fechaCorta(fecha: Date): string {
  const dia = DIAS_SEMANA.find((d) => d.numero === fecha.getDay())!.corto.toLowerCase();
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const hh = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `${dia} ${dd}/${mm} ${hh}:${min}`;
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

  protected readonly diasSemana = DIAS_SEMANA;
  protected readonly maxFunciones = MAX_FUNCIONES_POR_CARGA;

  protected peliculas = signal<IPelicula[]>([]);
  protected error = signal<string | null>(null);
  protected mensaje = signal<string | null>(null);
  // Resultado de una carga semanal: qué funciones se crearon (con su sala)
  // y cuáles no se pudieron (por ejemplo, ninguna sala libre ese día).
  protected creadas = signal<string[]>([]);
  protected fallidas = signal<string[]>([]);
  protected guardando = signal(false);

  protected formulario = new FormGroup(
    {
      pelicula_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
      modo: new FormControl<Modo>('unica', { nonNullable: true }),
      fecha_hora: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, validarFechaFutura],
      }),
      // Sólo se usa en modo semanal. Arranca deshabilitado: un control
      // deshabilitado no se valida, así sus campos vacíos no frenan una
      // carga de "una sola vez" (y al revés con fecha_hora).
      semanal: new FormGroup(
        {
          dias: new FormControl<number[]>([], { nonNullable: true, validators: [validarDias] }),
          // <input type="time"> devuelve 'HH:mm', por ejemplo '18:00'.
          hora: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
          desde: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
          hasta: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        },
        { validators: validarRango },
      ),
      formato: new FormControl<Formato>('2d', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      idioma: new FormControl<Idioma>('castellano', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    // Validador del grupo entero (como validarPreventa en AltaPelicula),
    // porque cruza dos campos: la película elegida y la fecha de la función.
    // Es una arrow function y no una función suelta porque necesita leer
    // this.peliculas() para saber la fecha de estreno de la elegida.
    { validators: (grupo) => this.validarFechaEstreno(grupo) },
  );

  // valueChanges es un Observable; toSignal lo convierte en signal para
  // poder usarlo en los computed de abajo (getRawValue incluye los
  // controles deshabilitados, por eso se usa en vez de value).
  private valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  protected modo = computed(() => this.valores().modo ?? 'unica');

  // Vista previa de la carga semanal: las fechas que se van a crear, que
  // se actualizan solas mientras el admin elige días, hora y rango.
  protected fechasSemanales = computed(() => {
    const semanal = this.formulario.controls.semanal.getRawValue();
    this.valores(); // dependencia: recalcula cuando cambia cualquier campo
    return generarFechas(semanal.dias, semanal.hora, semanal.desde, semanal.hasta);
  });

  protected vistaPrevia = computed(() => this.fechasSemanales().map(fechaCorta));

  constructor() {
    this.cargarOpciones();
    this.formulario.controls.semanal.disable();

    // Al cambiar de modo se habilita la parte del formulario que se usa y
    // se deshabilita la otra (así sólo se valida la que corresponde).
    this.formulario.controls.modo.valueChanges.subscribe((modo) => {
      const { fecha_hora, semanal } = this.formulario.controls;
      if (modo === 'semanal') {
        fecha_hora.disable();
        semanal.enable();
      } else {
        semanal.disable();
        fecha_hora.enable();
      }
    });
  }

  // Una película de Próximamente/preventa no puede tener funciones antes de
  // su estreno: la preventa vende entradas para las funciones del día del
  // estreno en adelante, no para antes. Ejemplo, Dune 3 (estreno 12/12):
  // una función el 10/12 da error; el 12/12 o después, está bien.
  //
  // Las dos fechas se comparan como texto 'YYYY-MM-DD' (mismo criterio que
  // en Peliculas.estadoVenta): los primeros 10 caracteres del
  // datetime-local ('2026-12-10T20:00') son justo el día elegido. En modo
  // semanal se mira la primera fecha del rango ("desde").
  private validarFechaEstreno(grupo: AbstractControl): ValidationErrors | null {
    const peliculaId = grupo.get('pelicula_id')?.value;
    const semanal = grupo.get('modo')?.value === 'semanal';
    const fecha: string = semanal
      ? (grupo.get('semanal.desde')?.value ?? '')
      : (grupo.get('fecha_hora')?.value ?? '').slice(0, 10);
    const pelicula = this.peliculas().find((p) => p.id === peliculaId);

    if (!pelicula?.fecha_estreno || !fecha) return null;
    return fecha < pelicula.fecha_estreno ? { antesDelEstreno: true } : null;
  }

  // Texto de cada opción del <select>: si la película todavía no se
  // estrenó, se avisa ahí mismo, así el admin ya sabe desde qué día puede
  // programarla. Ejemplo: "Dune 3 (estreno 12/12)".
  protected etiqueta(pelicula: IPelicula): string {
    if (this.peliculasService.estadoVenta(pelicula) === 'cartelera') return pelicula.nombre;
    const [, mes, dia] = pelicula.fecha_estreno!.split('-');
    return `${pelicula.nombre} (estreno ${dia}/${mes})`;
  }

  // Fecha de estreno de la película elegida, como '12/12', para el mensaje
  // de error ('' si no tiene, o si todavía no eligieron película).
  protected estrenoElegido(): string {
    const peliculaId = this.formulario.controls.pelicula_id.value;
    const fecha = this.peliculas().find((p) => p.id === peliculaId)?.fecha_estreno;
    if (!fecha) return '';
    const [, mes, dia] = fecha.split('-');
    return `${dia}/${mes}`;
  }

  protected diaElegido(numero: number): boolean {
    return this.formulario.controls.semanal.controls.dias.value.includes(numero);
  }

  // Los días son checkboxes sueltos (como los géneros en Nueva película):
  // tildar/destildar agrega o saca el número de la lista del control.
  protected alternarDia(numero: number) {
    const control = this.formulario.controls.semanal.controls.dias;
    const dias = control.value.includes(numero)
      ? control.value.filter((d) => d !== numero)
      : [...control.value, numero];
    control.setValue(dias);
    control.markAsTouched();
  }

  private async cargarOpciones() {
    this.peliculas.set(await this.peliculasService.obtenerTodas()); //trae todas las peliculas y las setea en el signal de peliculas
    // Las películas llegan después de que se creó el formulario: volvemos a
    // validarlo para que validarFechaEstreno ya las tenga en cuenta.
    this.formulario.updateValueAndValidity();
    this.usuario = await this.authService.usuarioActual();
  }

  protected async guardar() {
    this.error.set(null);
    this.mensaje.set(null);
    this.creadas.set([]);
    this.fallidas.set([]);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    const fechas =
      valores.modo === 'semanal' ? this.fechasSemanales() : [new Date(valores.fecha_hora)];

    if (fechas.length === 0) {
      this.error.set('Con esos días y ese rango no queda ninguna función futura para crear.');
      return;
    }
    if (fechas.length > MAX_FUNCIONES_POR_CARGA) {
      this.error.set(
        `Son ${fechas.length} funciones: el máximo por carga es ${MAX_FUNCIONES_POR_CARGA}. Achicá el rango de fechas.`,
      );
      return;
    }

    const pelicula = this.peliculas().find((p) => p.id === valores.pelicula_id);
    this.guardando.set(true);

    // Se crean de a una, esperando cada una (for + await, no Promise.all):
    // la sala de cada función se elige mirando las que ya existen, así que
    // si se crearan todas a la vez dos podrían tomar la misma sala libre.
    for (const fecha of fechas) {
      try {
        const { sala_nombre } = await this.funcionesService.crear({
          pelicula_id: valores.pelicula_id!,
          fecha_hora: fecha.toISOString(), //tenia problema con la hora
          formato: valores.formato,
          idioma: valores.idioma,
        });
        this.creadas.update((lista) => [...lista, `${fechaCorta(fecha)} · ${sala_nombre}`]);

        // Una entrada de log por función: la consigna pide "quién creó
        // qué función".
        if (this.usuario) {
          await this.logsService.registrar(
            this.usuario.id,
            `Creó una función de "${pelicula?.nombre ?? 'película'}" en ${sala_nombre} (${fechaCorta(fecha)})`,
          );
        }
      } catch (e) {
        // Si una falla (por ejemplo, no hay sala libre ese día) se sigue
        // con las demás y al final se avisa cuáles no se pudieron.
        this.fallidas.update((lista) => [
          ...lista,
          `${fechaCorta(fecha)}: ${(e as Error).message}`,
        ]);
      }
    }

    this.guardando.set(false);
    const cantidadCreadas = this.creadas().length;

    if (fechas.length === 1) {
      // Una sola función: un mensaje simple (de éxito o de error), sin listas.
      if (cantidadCreadas === 1) {
        this.mensaje.set(`Función creada: ${this.creadas()[0]}.`);
      } else {
        this.error.set(this.fallidas()[0]);
      }
      this.creadas.set([]);
      this.fallidas.set([]);
    } else if (cantidadCreadas > 0) {
      this.mensaje.set(`Se crearon ${cantidadCreadas} de ${fechas.length} funciones.`);
    } else {
      this.error.set('No se pudo crear ninguna de las funciones:');
    }

    // Si se creó al menos una, se limpia el formulario (manteniendo el modo
    // elegido). Si no se creó ninguna, queda como estaba para corregirlo.
    if (cantidadCreadas > 0) {
      this.formulario.reset({
        modo: valores.modo,
        formato: '2d',
        idioma: 'castellano',
        semanal: { dias: [], hora: '', desde: '', hasta: '' },
      });
    }
  }
}