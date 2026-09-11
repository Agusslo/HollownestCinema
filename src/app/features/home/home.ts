import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Peliculas } from '../../core/services/peliculas';
import IPelicula from '../../core/interfaces/pelicula';
import { DuracionPipe } from '../../core/pipes/duracion-pipe';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DuracionPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private peliculasService = inject(Peliculas);
  protected destacadas = signal<IPelicula[]>([]);
  protected peliculas = signal<IPelicula[]>([]);
  protected todas = signal<IPelicula[]>([]); //guardamos la lista completa para poder buscar sobre ella
  protected cargando = signal(true);
  protected busqueda = signal(''); // NUEVO

  //computed() recalcula esto solo cada vez que cambian busqueda() o
  // todas() — no hay que llamarlo a mano. Devuelve null si no hay búsqueda
  // activa (para distinguir "no está buscando" de "buscó y no encontró nada").
  protected resultadosBusqueda = computed<IPelicula[] | null>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) return null;
    return this.todas().filter((p) => p.nombre.toLowerCase().includes(texto));
  });

  constructor() {
    this.cargarPeliculas();
  }

  protected generarSlug(nombre: string): string {
    return this.peliculasService.generarSlug(nombre);
  }

  protected buscar(valor: string): void {
    // NUEVO
    this.busqueda.set(valor);
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
      this.todas.set(todas); // NUEVO
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
