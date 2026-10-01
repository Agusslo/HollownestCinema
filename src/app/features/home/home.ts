import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Peliculas } from '../../core/services/peliculas';
import { Generos } from '../../core/services/generos';
import { IPeliculaConGeneros } from '../../core/interfaces/pelicula';
import IGenero from '../../core/interfaces/genero';
import { DuracionPipe } from '../../core/pipes/duracion-pipe';
import { LoadingComponent } from '../../shared/components/loading/loading';
import { GlowHover } from '../../shared/directives/glow-hover';
import { PosterCard } from '../../shared/components/poster-card/poster-card';
import { Proximamente } from './proximamente/proximamente';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DuracionPipe, LoadingComponent, GlowHover, Proximamente, PosterCard],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  private peliculasService = inject(Peliculas);
  private generosService = inject(Generos);

  protected destacadas = signal<IPeliculaConGeneros[]>([]);
  protected peliculas = signal<IPeliculaConGeneros[]>([]);
  protected todas = signal<IPeliculaConGeneros[]>([]); //guardamos la lista completa para poder buscar sobre ella
  // Las que todavía no se estrenaron (próximamente o en preventa): van a la
  // sección "Próximamente" en vez de a la cartelera.
  protected proximas = signal<IPeliculaConGeneros[]>([]);
  protected cargando = signal(true);
  protected busqueda = signal('');
  protected generosDisponibles = signal<IGenero[]>([]);
  protected generoSeleccionado = signal<number | null>(null);
  protected mostrarHero = computed(() => {
    return !this.busqueda().trim() && this.generoSeleccionado() === null;
  });
  protected shermaSonando = signal(false);
  private shermaAudio?: HTMLAudioElement;

  // ── Carrusel Hero ──
  protected slideActual = signal(0);
  protected totalSlides = 3;
  private timerInterval?: any;

  protected peliculaBanner = computed(() => {
    return this.destacadas()[0] ?? this.peliculas()[0] ?? null;
  });

  // computed() recalcula esto solo cada vez que cambian busqueda(),
  // generoSeleccionado() o todas() — no hay que llamarlo a mano. Devuelve
  // null si no hay ningún filtro activo (para distinguir "no está
  // filtrando" de "filtró y no encontró nada").
  protected resultadosBusqueda = computed<IPeliculaConGeneros[] | null>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const genero = this.generoSeleccionado();

    if (!texto && genero === null) return null;

    return this.todas().filter((p) => {
      const coincideTexto = !texto || p.nombre.toLowerCase().includes(texto);
      const coincideGenero =
        genero === null || this.peliculasService.generosDe(p).some((g) => g.id === genero);
      return coincideTexto && coincideGenero;
    });
  });

  constructor() {
    this.cargarPeliculas();
    this.generosService.obtenerTodos().then((generos) => this.generosDisponibles.set(generos));
  }

  ngOnInit() {
    this.iniciarAutoplay();
  }

  ngOnDestroy() {
    this.detenerAutoplay();
  }

  protected siguienteSlide(): void {
    this.slideActual.update((curr) => (curr + 1) % this.totalSlides);
    this.reiniciarAutoplay();
  }

  protected anteriorSlide(): void {
    this.slideActual.update((curr) => (curr - 1 + this.totalSlides) % this.totalSlides);
    this.reiniciarAutoplay();
  }

  protected irASlide(index: number): void {
    this.slideActual.set(index);
    this.reiniciarAutoplay();
  }

  private iniciarAutoplay(): void {
    this.timerInterval = setInterval(() => {
      this.slideActual.update((curr) => (curr + 1) % this.totalSlides);
    }, 6000);
  }

  private detenerAutoplay(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private reiniciarAutoplay(): void {
    this.detenerAutoplay();
    this.iniciarAutoplay();
  }

  protected scrollHaciaCartelera(): void {
    const el = document.getElementById('seccion-cartelera');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  protected generarSlug(nombre: string): string {
    return this.peliculasService.generarSlug(nombre);
  }

  protected buscar(valor: string): void {
    this.busqueda.set(valor);
  }

  protected seleccionarGenero(valor: string): void {
    this.generoSeleccionado.set(valor === '' ? null : Number(valor));
  }

  protected alternarSherma(): void {
    if (!this.shermaAudio) {
      this.shermaAudio = new Audio('/music/shermasong.mp3');
      this.shermaAudio.volume = 0.28;
      this.shermaAudio.addEventListener('ended', () => this.shermaSonando.set(false));
    }

    if (this.shermaAudio.paused) {
      this.shermaAudio.currentTime = 0;
      void this.shermaAudio.play();
      this.shermaSonando.set(true);
    } else {
      this.shermaAudio.pause();
      this.shermaSonando.set(false);
    }
  }

  private async cargarPeliculas() {
    // Pedimos las dos listas en paralelo con Promise.all, en vez de una
    // después de la otra: son dos consultas independientes, no tiene
    // sentido esperar a que termine una para arrancar la otra.
    try {
      // Pedimos 10 más vendidas (no 3) porque después filtramos: una
      // película en preventa puede tener entradas vendidas, pero todavía
      // nadie la vio, así que no puede estar en "Las más vistas".
      const [masVendidas, todas] = await Promise.all([
        this.peliculasService.obtenerMasVendidas(10),
        this.peliculasService.obtenerTodas(),
      ]);

      // Separamos según el estado de venta (Peliculas.estadoVenta): las
      // estrenadas van a la cartelera; las demás, a "Próximamente".
      const enCartelera = (p: IPeliculaConGeneros) =>
        this.peliculasService.estadoVenta(p) === 'cartelera';

      const top = masVendidas.filter(enCartelera).slice(0, 3);

      // Sacamos de la cartelera las que ya aparecen en el top, para no
      // mostrar una película dos veces.
      const idsTop = new Set(top.map((p) => p.id));
      const resto = todas.filter((p) => enCartelera(p) && !idsTop.has(p.id));

      // Próximamente: ordenadas por fecha de estreno, la más cercana
      // primero. Las fechas son texto 'YYYY-MM-DD', así que localeCompare
      // las ordena bien (mismo motivo que en estadoVenta).
      const proximas = todas
        .filter((p) => !enCartelera(p))
        .sort((a, b) => a.fecha_estreno!.localeCompare(b.fecha_estreno!));

      this.destacadas.set(top);
      this.peliculas.set(resto);
      this.proximas.set(proximas);
      this.todas.set(todas);
    } catch (error) {
      console.error('No se pudo cargar la cartelera', error);
      this.destacadas.set([]);
      this.peliculas.set([]);
      this.proximas.set([]);
      this.todas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }
}