import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Butacas as ButacasService } from '../../../core/services/butacas';
import { Entradas } from '../../../core/services/entradas';
import { Funciones } from '../../../core/services/funciones';
import { Auth } from '../../../core/services/auth';
import { Cupones } from '../../../core/services/cupones';
import { Candy } from '../../../core/services/candy';
import IFuncion from '../../../core/interfaces/funcion';
import IPerfil from '../../../core/interfaces/perfil';
import ICupon from '../../../core/interfaces/cupon';
import ICandyCategoria from '../../../core/interfaces/candy-categoria';
import { ICandyProductoConCategoria } from '../../../core/interfaces/candy-producto';
import { Pdf } from '../../../core/services/pdf';

@Component({
  selector: 'app-butacas',
  imports: [],
  templateUrl: './butacas.html',
  styleUrl: './butacas.css',
})
export class Butacas {
  private route = inject(ActivatedRoute);
  private butacasService = inject(ButacasService);
  private entradasService = inject(Entradas);
  private funcionesService = inject(Funciones);
  private authService = inject(Auth);
  private cuponesService = inject(Cupones);
  private candyService = inject(Candy);

  protected funcion_id = 0;
  protected layout = signal<string[][]>([]);
  protected ocupadas = signal<Set<string>>(new Set());
  protected seleccionadas = signal<Set<string>>(new Set());
  protected funcion = signal<IFuncion | null>(null);
  protected usuario = signal<IPerfil | null>(null);
  protected cupones = signal<ICupon[]>([]);
  protected cargando = signal(true);
  protected comprando = signal(false);
  protected error = signal<string | null>(null);
  protected compraExitosa = signal(false);

  // Candy bar
  protected candyCategorias = signal<ICandyCategoria[]>([]);
  protected candyProductos = signal<ICandyProductoConCategoria[]>([]);
  protected categoriaActiva = signal<number | null>(null);
  // Mapa producto_id -> cantidad, es el "carrito" de candy de esta compra
  protected carritoCandy = signal<Map<number, number>>(new Map());

  private pdfService = inject(Pdf);
  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    this.funcion_id = Number(this.route.snapshot.queryParamMap.get('funcion'));
    this.layout.set(this.butacasService.generarLayoutSala());

    const ocupadasArray = await this.entradasService.obtenerButacasOcupadas(this.funcion_id);
    this.ocupadas.set(new Set(ocupadasArray));

    this.funcion.set(await this.funcionesService.obtenerPorId(this.funcion_id));
    this.usuario.set(await this.authService.usuarioActual());
    this.cupones.set(await this.cuponesService.obtenerTodos());

    const [categorias, productos] = await Promise.all([
      this.candyService.obtenerCategorias(),
      this.candyService.obtenerProductos(),
    ]);
    this.candyCategorias.set(categorias);
    this.candyProductos.set(productos);
    if (categorias.length > 0) {
      this.categoriaActiva.set(categorias[0].id);
    }

    this.cargando.set(false);
  }

  protected estaOcupada(butaca: string): boolean {
    return this.ocupadas().has(butaca);
  }

  protected estaSeleccionada(butaca: string): boolean {
    return this.seleccionadas().has(butaca);
  }

  protected toggleButaca(butaca: string): void {
    if (this.estaOcupada(butaca)) return;

    const nuevas = new Set(this.seleccionadas());
    if (nuevas.has(butaca)) {
      nuevas.delete(butaca);
    } else {
      nuevas.add(butaca);
    }
    this.seleccionadas.set(nuevas);
  }

  // ── Candy bar ──

  protected productosDeCategoriaActiva(): ICandyProductoConCategoria[] {
    const categoria = this.categoriaActiva();
    return this.candyProductos().filter((p) => p.categoria_id === categoria);
  }

  protected cantidadEnCarrito(producto_id: number): number {
    return this.carritoCandy().get(producto_id) ?? 0;
  }

  protected agregarCandy(producto_id: number): void {
    // Copiamos el Map en uno nuevo antes de modificarlo (mismo motivo que
    // ya vimos con los Set de géneros): así Angular detecta el cambio.
    const nuevo = new Map(this.carritoCandy());
    nuevo.set(producto_id, (nuevo.get(producto_id) ?? 0) + 1);
    this.carritoCandy.set(nuevo);
  }

  protected quitarCandy(producto_id: number): void {
    const nuevo = new Map(this.carritoCandy());
    const actual = nuevo.get(producto_id) ?? 0;
    if (actual <= 1) {
      nuevo.delete(producto_id);
    } else {
      nuevo.set(producto_id, actual - 1);
    }
    this.carritoCandy.set(nuevo);
  }

  // Lista "aplanada" del carrito, con el producto completo adentro (no
  // sólo el id) — más cómoda para recorrer en el template que el Map.
  protected itemsCandyEnCarrito(): { producto: ICandyProductoConCategoria; cantidad: number }[] {
    return Array.from(this.carritoCandy().entries())
      .map(([producto_id, cantidad]) => {
        const producto = this.candyProductos().find((p) => p.id === producto_id);
        return producto ? { producto, cantidad } : null;
      })
      .filter(
        (item): item is { producto: ICandyProductoConCategoria; cantidad: number } => item !== null,
      );
  }

  protected butacasSeleccionadasTexto(): string {
    if (this.seleccionadas().size === 0) return '';
    return Array.from(this.seleccionadas())
      .sort((a, b) => {
        const filaA = a.charAt(0);
        const filaB = b.charAt(0);
        if (filaA !== filaB) return filaA.localeCompare(filaB);
        const numA = parseInt(a.slice(1), 10);
        const numB = parseInt(b.slice(1), 10);
        return numA - numB;
      })
      .map((b) => `${b.charAt(0)} ${b.slice(1)}`)
      .join(' · ');
  }

  protected candySubtotal(): number {
    return Math.round(
      this.itemsCandyEnCarrito().reduce(
        (acumulado, item) => acumulado + item.producto.precio * item.cantidad,
        0,
      ),
    );
  }

  // Porcentaje de descuento que le corresponde al usuario actual (0 si
  // no aplica ninguno) — ya resuelve la regla de "el mayor entre los que
  // apliquen, sin acumular" adentro del servicio.
  protected descuentoAplicado(): number {
    return this.cuponesService.calcularDescuento(this.usuario(), this.cupones());
  }

  protected calcularTotal(): number {
    const funcionActual = this.funcion();
    if (!funcionActual) return 0;
    const precio = this.entradasService.precioPorFormato(funcionActual.formato);
    const subtotal = this.seleccionadas().size * precio + this.candySubtotal();
    const descuento = this.descuentoAplicado();
    const total = descuento > 0 ? subtotal * (1 - descuento / 100) : subtotal;
    return Math.round(total);
  }

  protected async confirmarCompra() {
    if (this.seleccionadas().size === 0) return;

    this.error.set(null);
    this.comprando.set(true);

    try {
      const usuario = this.usuario();

      const candyItems = Array.from(this.carritoCandy().entries()).map(
        ([producto_id, cantidad]) => ({ producto_id, cantidad }),
      );

      // Guardamos el detalle del candy en un formato simple (nombre + cantidad)
      // ANTES de vaciar el carrito más abajo, porque después de la compra
      // exitosa lo reseteamos a vacío.
      const candyParaPdf = this.itemsCandyEnCarrito().map((item) => ({
        nombre: item.producto.nombre,
        cantidad: item.cantidad,
      }));

      const { entradas: butacasCompradas, orden } = await this.entradasService.comprar(
        this.funcion_id,
        Array.from(this.seleccionadas()),
        usuario,
        candyItems,
      );

      const detalle = await this.funcionesService.obtenerDetalleCompra(this.funcion_id);

      await this.pdfService.generarEntradas(
        butacasCompradas.map((b) => ({
          ...detalle,
          fila: b.fila,
          columna: b.columna,
          codigo_qr: b.codigo_qr,
        })),
        candyParaPdf.length > 0 ? { codigo_qr: orden.codigo_qr, items: candyParaPdf } : undefined, //si hay candy arma el QR de la orden, sino no lo pasa y no genera la página extra del PDF
      );

      this.compraExitosa.set(true);
      this.seleccionadas.set(new Set());
      this.carritoCandy.set(new Map());

      const ocupadasArray = await this.entradasService.obtenerButacasOcupadas(this.funcion_id);
      this.ocupadas.set(new Set(ocupadasArray));
      this.usuario.set(await this.authService.usuarioActual());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.comprando.set(false);
    }
  }
}
