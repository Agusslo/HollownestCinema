import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Candy } from '../../../core/services/candy';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import { Toasts } from '../../../core/services/toasts';
import { ICandyProductoConCategoria } from '../../../core/interfaces/candy-producto';
import IPerfil from '../../../core/interfaces/perfil';
import { LoadingComponent } from '../../../shared/components/loading/loading';

// Lo que el admin está escribiendo en una fila, antes de guardar.
interface IBorrador {
  precio: string;
  puntos: string;
}

// Pantalla de admin "Productos": todos los productos del candy bar, para
// modificar el precio y los puntos de canje, y para sacar un producto de
// la venta (baja lógica: no se borra, así no se pierden las compras, los
// canjes ni los reportes donde aparece) o volver a ponerlo.
@Component({
  selector: 'app-productos-admin',
  imports: [RouterLink, LoadingComponent],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class ProductosAdmin {
  private candyService = inject(Candy);
  private authService = inject(Auth);
  private logsService = inject(Logs);
  private toasts = inject(Toasts);

  // Mismo criterio que el resto de las pantallas de admin: el guard ya
  // garantiza que es admin; esto es para saber QUIÉN, para el log.
  private usuario: IPerfil | null = null;

  protected productos = signal<ICandyProductoConCategoria[]>([]);
  protected cargando = signal(true);
  protected procesando = signal<number | null>(null);
  // Lo editado en cada fila (por id de producto) y todavía no guardado.
  protected borradores = signal<Map<number, IBorrador>>(new Map());

  protected cantidadActivos = computed(() => this.productos().filter((p) => p.activo).length);

  constructor() {
    this.cargar();
    this.authService.usuarioActual().then((usuario) => (this.usuario = usuario));
  }

  private async cargar() {
    try {
      // true = también los que están fuera de la venta
      this.productos.set(await this.candyService.obtenerProductos(true));
    } catch {
      this.toasts.error('No se pudieron cargar los productos', 'Probá recargar la página.');
    } finally {
      this.cargando.set(false);
    }
  }

  // Lo que se muestra en cada input: el borrador si lo están editando, si
  // no el valor guardado.
  protected precioEnPantalla(producto: ICandyProductoConCategoria): string {
    return this.borradores().get(producto.id)?.precio ?? String(producto.precio);
  }

  protected puntosEnPantalla(producto: ICandyProductoConCategoria): string {
    return this.borradores().get(producto.id)?.puntos ?? String(producto.puntos_canje ?? '');
  }

  protected editar(producto: ICandyProductoConCategoria, campo: keyof IBorrador, evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    this.borradores.update((mapa) => {
      const nuevo = new Map(mapa);
      const actual = nuevo.get(producto.id) ?? {
        precio: String(producto.precio),
        puntos: String(producto.puntos_canje ?? ''),
      };
      nuevo.set(producto.id, { ...actual, [campo]: valor });
      return nuevo;
    });
  }

  // Valida el borrador: precio entero mayor a 0; puntos vacío (no se
  // canjea) o entero mayor a 0. Devuelve null si algo está mal.
  private leerBorrador(
    producto: ICandyProductoConCategoria,
  ): { precio: number; puntos: number | null } | null {
    const borrador = this.borradores().get(producto.id);
    if (!borrador) return null;

    const precio = Number(borrador.precio);
    const puntos = borrador.puntos.trim() === '' ? null : Number(borrador.puntos);
    const esEnteroPositivo = (n: number) => Number.isInteger(n) && n > 0;

    if (!esEnteroPositivo(precio)) return null;
    if (puntos !== null && !esEnteroPositivo(puntos)) return null;
    return { precio, puntos };
  }

  protected hayCambios(producto: ICandyProductoConCategoria): boolean {
    const valores = this.leerBorrador(producto);
    return (
      valores !== null &&
      (valores.precio !== producto.precio || valores.puntos !== producto.puntos_canje)
    );
  }

  protected borradorInvalido(producto: ICandyProductoConCategoria): boolean {
    return this.borradores().has(producto.id) && this.leerBorrador(producto) === null;
  }

  protected async guardar(producto: ICandyProductoConCategoria) {
    const valores = this.leerBorrador(producto);
    if (!valores || this.procesando() !== null) return;
    this.procesando.set(producto.id);

    try {
      await this.candyService.actualizarProducto(producto.id, {
        precio: valores.precio,
        puntos_canje: valores.puntos,
      });

      // La consigna pide registrar "quién modificó un precio".
      if (this.usuario) {
        if (valores.precio !== producto.precio) {
          await this.logsService.registrar(
            this.usuario.id,
            `Modificó el precio de "${producto.nombre}": $${producto.precio} → $${valores.precio}`,
          );
        }
        if (valores.puntos !== producto.puntos_canje) {
          await this.logsService.registrar(
            this.usuario.id,
            `Modificó los puntos de canje de "${producto.nombre}": ${producto.puntos_canje ?? 'sin canje'} → ${valores.puntos ?? 'sin canje'}`,
          );
        }
      }

      this.actualizarEnLista(producto.id, { precio: valores.precio, puntos_canje: valores.puntos });
      this.descartar(producto);
      this.toasts.exito('Producto actualizado', producto.nombre);
    } catch {
      this.toasts.error('No se pudo guardar', 'Probá de nuevo en un momento.');
    } finally {
      this.procesando.set(null);
    }
  }

  protected descartar(producto: ICandyProductoConCategoria) {
    this.borradores.update((mapa) => {
      const nuevo = new Map(mapa);
      nuevo.delete(producto.id);
      return nuevo;
    });
  }

  protected async alternarVenta(producto: ICandyProductoConCategoria) {
    if (this.procesando() !== null) return;
    this.procesando.set(producto.id);
    const activo = !producto.activo;

    try {
      await this.candyService.actualizarProducto(producto.id, { activo });
      this.actualizarEnLista(producto.id, { activo });

      if (this.usuario) {
        await this.logsService.registrar(
          this.usuario.id,
          activo
            ? `Volvió a poner a la venta "${producto.nombre}"`
            : `Sacó de la venta "${producto.nombre}"`,
        );
      }
      this.toasts.exito(
        activo ? 'Producto a la venta' : 'Producto fuera de la venta',
        activo
          ? `${producto.nombre} ya se puede comprar.`
          : `${producto.nombre} ya no aparece para comprar.`,
      );
    } catch {
      this.toasts.error('No se pudo guardar el cambio', 'Probá de nuevo en un momento.');
    } finally {
      this.procesando.set(null);
    }
  }

  // Actualiza un producto en la lista sin volver a pedir todo a Supabase.
  private actualizarEnLista(id: number, cambios: Partial<ICandyProductoConCategoria>) {
    this.productos.update((lista) => lista.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  }
}