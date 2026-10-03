import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Funciones } from '../../../core/services/funciones';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import { Toasts } from '../../../core/services/toasts';
import { IFuncionAdmin } from '../../../core/interfaces/funcion';
import IPerfil from '../../../core/interfaces/perfil';
import { LoadingComponent } from '../../../shared/components/loading/loading';

// Pantalla de admin "Funciones": las funciones programadas de todas las
// películas, con la sala, el formato, el idioma y cuántas entradas tiene
// cada una. Se puede dar de baja una función mientras no tenga entradas
// vendidas (por ejemplo, si se cargó con el horario equivocado).
@Component({
  selector: 'app-funciones-admin',
  imports: [DatePipe, RouterLink, LoadingComponent],
  templateUrl: './funciones.html',
  styleUrl: './funciones.css',
})
export class FuncionesAdmin {
  private funcionesService = inject(Funciones);
  private authService = inject(Auth);
  private logsService = inject(Logs);
  private toasts = inject(Toasts);

  // Mismo criterio que el resto de las pantallas de admin: el guard ya
  // garantiza que es admin; esto es para saber QUIÉN, para el log.
  private usuario: IPerfil | null = null;

  protected funciones = signal<IFuncionAdmin[]>([]);
  protected cargando = signal(true);
  // Filtro por película (null = todas).
  protected peliculaFiltro = signal<string | null>(null);
  // Id de la función que está pidiendo confirmación para borrarse: el
  // botón "Borrar" se convierte en "¿Seguro?" + Sí / No, así no se borra
  // nada de un solo click por error.
  protected confirmando = signal<number | null>(null);
  protected procesando = signal<number | null>(null);

  // Nombres de las películas que tienen funciones, para el filtro.
  protected peliculas = computed(() =>
    [...new Set(this.funciones().map((f) => f.peliculas.nombre))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  protected funcionesFiltradas = computed(() => {
    const filtro = this.peliculaFiltro();
    return filtro
      ? this.funciones().filter((f) => f.peliculas.nombre === filtro)
      : this.funciones();
  });

  constructor() {
    this.cargar();
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
  }

  private async cargar() {
    try {
      this.funciones.set(await this.funcionesService.obtenerProximasAdmin());
    } catch {
      this.toasts.error('No se pudieron cargar las funciones', 'Probá recargar la página.');
    } finally {
      this.cargando.set(false);
    }
  }

  // entradas(count) llega como [{ count: N }].
  protected vendidas(funcion: IFuncionAdmin): number {
    return funcion.entradas[0]?.count ?? 0;
  }

  protected filtrar(evento: Event) {
    const valor = (evento.target as HTMLSelectElement).value;
    this.peliculaFiltro.set(valor || null);
  }

  protected async borrar(funcion: IFuncionAdmin) {
    if (this.procesando() !== null) return;
    this.procesando.set(funcion.id);

    try {
      await this.funcionesService.borrar(funcion.id);

      // Se saca de la lista sin volver a pedir todo (filter devuelve una
      // lista nueva, así el signal avisa del cambio).
      this.funciones.update((lista) => lista.filter((f) => f.id !== funcion.id));

      // '20/10 18:00' (hora local, formato de 24 hs)
      const fecha = new Date(funcion.fecha_hora);
      const dosDigitos = (n: number) => String(n).padStart(2, '0');
      const cuando = `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)} ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
      if (this.usuario) {
        await this.logsService.registrar(
          this.usuario.id,
          `Borró la función de "${funcion.peliculas.nombre}" en ${funcion.salas.nombre} (${cuando})`,
        );
      }
      this.toasts.exito('Función borrada', `${funcion.peliculas.nombre} · ${cuando}`);
    } catch (e) {
      this.toasts.error('No se pudo borrar', (e as Error).message);
    } finally {
      this.procesando.set(null);
      this.confirmando.set(null);
    }
  }
}