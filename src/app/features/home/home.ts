import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Peliculas } from '../../core/services/peliculas';
import { Generos } from '../../core/services/generos';
import { IPeliculaConGeneros } from '../../core/interfaces/pelicula';
import IGenero from '../../core/interfaces/genero';
import { DuracionPipe } from '../../core/pipes/duracion-pipe';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DuracionPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private peliculasService = inject(Peliculas);
  private generosService = inject(Generos);

  protected destacadas = signal<IPeliculaConGeneros[]>([]);
  protected peliculas = signal<IPeliculaConGeneros[]>([]);
  protected todas = signal<IPeliculaConGeneros[]>([]); //guardamos la lista completa para poder buscar sobre ella
  protected cargando = signal(true);
  protected busqueda = signal('');
  protected generosDisponibles = signal<IGenero[]>([]);
  protected generoSeleccionado = signal<number | null>(null);

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

  protected generarSlug(nombre: string): string {
    return this.peliculasService.generarSlug(nombre);
  }

  protected buscar(valor: string): void {
    this.busqueda.set(valor);
  }

  protected seleccionarGenero(valor: string): void {
    this.generoSeleccionado.set(valor === '' ? null : Number(valor));
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