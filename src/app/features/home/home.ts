import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Peliculas } from '../../core/services/peliculas';
import { Generos } from '../../core/services/generos';
import { IPeliculaConGeneros } from '../../core/interfaces/pelicula';
import IGenero from '../../core/interfaces/genero';
import { DuracionPipe } from '../../core/pipes/duracion-pipe';
import { LoadingComponent } from '../../shared/components/loading/loading';
import { GlowHover } from '../../shared/directives/glow-hover';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DuracionPipe, LoadingComponent, GlowHover],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  private peliculasService = inject(Peliculas);
  private generosService = inject(Generos);

  protected destacadas = signal<IPeliculaConGeneros[]>([]);
  protected peliculas = signal<IPeliculaConGeneros[]>([]);
  protected todas = signal<IPeliculaConGeneros[]>([]); //guardamos la lista completa para poder buscar sobre ella
  protected cargando = signal(true);
  protected busqueda = signal('');
  protected generosDisponibles = signal<IGenero[]>([]);
  protected generoSeleccionado = signal<number | null>(null);
  protected shermaSonando = signal(false);
  private shermaAudio?: HTMLAudioElement;

  // ── Carrusel Hero ──
  protected slideActual = signal(0);
  protected totalSlides = 3;
  private timerInterval?: any;

  protected peliculaBanner = computed(() => {
    return this.destacadas()[0] ?? this.todas()[0] ?? null;
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
      const [masVendidas, todas] = await Promise.all([
        this.peliculasService.obtenerMasVendidas(3),
        this.peliculasService.obtenerTodas(),
      ]);

      // Sacamos de "todas" las que ya aparecen en masVendidas, para no
      // mostrar una película dos veces en la cartelera.
      const idsTop = new Set(masVendidas.map((p) => p.id));
      const resto = todas.filter((p) => !idsTop.has(p.id));

      this.destacadas.set(masVendidas);
      this.peliculas.set(resto);
      this.todas.set(todas);
    } catch (error) {
      console.error('No se pudo cargar la cartelera', error);
      this.destacadas.set([]);
      this.peliculas.set([]);
      this.todas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }
}