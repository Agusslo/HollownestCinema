import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from '../../../core/services/supabase';
import { Butacas as ButacasService, IFilaSala, tipoDeButaca } from '../../../core/services/butacas';
import { Entradas } from '../../../core/services/entradas';
import { Peliculas } from '../../../core/services/peliculas';
import { Funciones } from '../../../core/services/funciones';
import { Auth } from '../../../core/services/auth';
import { Cupones } from '../../../core/services/cupones';
import { Candy } from '../../../core/services/candy';
import { Combos } from '../../../core/services/combos';
import { Fidelizacion } from '../../../core/services/fidelizacion';
import { IComboConItems } from '../../../core/interfaces/combo';
import { IFuncionConSala } from '../../../core/interfaces/funcion';
import IPelicula from '../../../core/interfaces/pelicula';
import IPerfil from '../../../core/interfaces/perfil';
import ICupon from '../../../core/interfaces/cupon';
import { IFidelizacionConfig } from '../../../core/interfaces/canje';
import ICandyCategoria from '../../../core/interfaces/candy-categoria';
import { ICandyProductoConCategoria } from '../../../core/interfaces/candy-producto';
import { Pdf } from '../../../core/services/pdf';
import { LoadingComponent } from '../../../shared/components/loading/loading';
import { GlowHover } from '../../../shared/directives/glow-hover';

@Component({
  selector: 'app-butacas',
  imports: [LoadingComponent, GlowHover, DecimalPipe],
  templateUrl: './butacas.html',
  styleUrl: './butacas.css',
})
export class Butacas implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabaseService = inject(Supabase);
  private butacasService = inject(ButacasService);
  private entradasService = inject(Entradas);
  private funcionesService = inject(Funciones);
  private peliculasService = inject(Peliculas);
  private authService = inject(Auth);
  private cuponesService = inject(Cupones);
  private candyService = inject(Candy);
  private combosService = inject(Combos);
  private fidelizacionService = inject(Fidelizacion);

  // Canal de Supabase Realtime — se abre en cargarDatos() y se cierra en
  // ngOnDestroy() para no dejar la conexión abierta al salir de la pantalla.
  private canal: RealtimeChannel | null = null;
  // Butacas que este mismo tab está comprando en este momento — el canal
  // también nos avisa de nuestro propio insert, y sin este chequeo lo
  // tratábamos como si otro usuario nos hubiera ganado de mano.
  private codigosEnCompraPropia = new Set<string>();

  protected funcion_id = 0;
  protected layout = signal<IFilaSala[]>([]);
  protected ocupadas = signal<Set<string>>(new Set());
  protected seleccionadas = signal<Set<string>>(new Set());
  protected funcion = signal<IFuncionConSala | null>(null);
  protected peliculaActual = signal<IPelicula | null>(null);

  // Precio de preventa que corresponde cobrar ahora: el de la película si
  // está en preventa, o null si se vende a precio normal (en cartelera, o
  // en preventa pero sin precio especial cargado).
  protected precioPreventa = computed(() => {
    const pelicula = this.peliculaActual();
    if (!pelicula || this.peliculasService.estadoVenta(pelicula) !== 'preventa') return null;
    return pelicula.precio_preventa;
  });

  // '2026-12-12' → '12/12', para el aviso de preventa.
  protected fechaCorta(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const [, mes, dia] = fecha.split('-');
    return `${dia}/${mes}`;
  }
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

  // Combos: "entrada + candy a precio fijo". Por simplicidad, uno por
  // compra (la consigna no pide poder combinar varios).
  protected combosDisponibles = signal<IComboConItems[]>([]);
  protected comboSeleccionado = signal<IComboConItems | null>(null);

  // Fidelización — canje de entradas con puntos
  protected fidelizacionConfig = signal<IFidelizacionConfig | null>(null);
  protected usarPuntos = signal(false);

  private pdfService = inject(Pdf);
  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    const paramFuncion =
      this.route.snapshot.paramMap.get('funcion') ||
      this.route.snapshot.paramMap.get('id') ||
      this.route.snapshot.queryParamMap.get('funcion') ||
      '';
    const slugPelicula = this.route.snapshot.paramMap.get('nombre') || '';

    let funcionEncontrada: IFuncionConSala | null = null;

    if (slugPelicula) {
      try {
        const pelicula = await this.peliculasService.obtenerPorSlug(slugPelicula);
        const funciones = await this.funcionesService.obtenerPorPelicula(pelicula.id);
        funcionEncontrada =
          funciones.find(
            (f) =>
              this.funcionesService.generarSlug(f) === paramFuncion ||
              String(f.id) === paramFuncion,
          ) ?? null;
      } catch {}
    }

    if (!funcionEncontrada && paramFuncion) {
      const idNumerico = parseInt(paramFuncion, 10);
      if (!isNaN(idNumerico) && idNumerico > 0) {
        try {
          funcionEncontrada = await this.funcionesService.obtenerPorId(idNumerico);
        } catch {}
      }
    }

    if (!funcionEncontrada) {
      this.error.set('No se encontró la función seleccionada.');
      this.cargando.set(false);
      return;
    }

    this.funcion_id = funcionEncontrada.id;
    this.funcion.set(funcionEncontrada);
    const pelicula = await this.peliculasService.obtenerPorId(funcionEncontrada.pelicula_id);
    this.peliculaActual.set(pelicula);

    // Si la película sigue en Próximamente (el admin todavía no abrió la
    // venta), no se puede comprar. El detalle ya no deja entrar acá, pero
    // alguien podría escribir la URL de las butacas a mano: por eso se
    // vuelve a chequear. Se corta igual que cuando no se encuentra la
    // función: con el mensaje de error y sin cargar la sala.
    if (this.peliculasService.estadoVenta(pelicula) === 'proximamente') {
      this.error.set(
        `La venta de "${pelicula.nombre}" todavía no abrió. Vas a poder comprar desde la preventa.`,
      );
      this.cargando.set(false);
      return;
    }
    this.layout.set(this.butacasService.generarLayoutSala());

    const ocupadasArray = await this.entradasService.obtenerButacasOcupadas(this.funcion_id);
    this.ocupadas.set(new Set(ocupadasArray));
    this.suscribirCambiosButacas();

    this.usuario.set(await this.authService.usuarioActual());
    this.cupones.set(await this.cuponesService.obtenerTodos());
    this.fidelizacionConfig.set(await this.fidelizacionService.obtenerConfig());

    const [categorias, productos] = await Promise.all([
      this.candyService.obtenerCategorias(),
      this.candyService.obtenerProductos(),
    ]);
    this.candyCategorias.set(categorias);
    this.candyProductos.set(productos);
    if (categorias.length > 0) {
      this.categoriaActiva.set(categorias[0].id);
    }

    this.combosDisponibles.set(await this.combosService.obtenerActivos());

    this.cargando.set(false);
  }

  // Escucha en vivo cuando se inserta una entrada nueva para ESTA función
  // (de cualquier usuario, no sólo el propio) y agrega esa butaca a
  // "ocupadas" al toque, sin que haga falta recargar la pantalla.
  private suscribirCambiosButacas(): void {
    this.canal = this.supabaseService.Supabase.channel(`butacas-funcion-${this.funcion_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'entradas',
          filter: `funcion_id=eq.${this.funcion_id}`,
        },
        (payload) => {
          const nueva = payload.new as { fila: string; columna: number };
          const codigo = `${nueva.fila}${nueva.columna}`;

          const actualizadas = new Set(this.ocupadas());
          actualizadas.add(codigo);
          this.ocupadas.set(actualizadas);

          // Es nuestra propia compra en curso — no es "otro usuario nos
          // ganó de mano", así que no tocamos la selección ni avisamos.
          if (this.codigosEnCompraPropia.has(codigo)) return;

          // Si justo la tenía elegida yo (pero todavía sin pagar), se la
          // saco de la selección: otro usuario la compró primero.
          if (this.seleccionadas().has(codigo)) {
            const propias = new Set(this.seleccionadas());
            propias.delete(codigo);
            this.seleccionadas.set(propias);
            this.error.set(`La butaca ${codigo} se acaba de ocupar. La sacamos de tu selección.`);
          }
        },
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.canal?.unsubscribe();
  }

  protected estaOcupada(butaca: string): boolean {
    return this.ocupadas().has(butaca);
  }

  protected estaSeleccionada(butaca: string): boolean {
    return this.seleccionadas().has(butaca);
  }

  // Para el aviso del resumen de compra — la consigna pide que quede
  // claro ANTES de pagar que se está comprando una butaca VIP.
  protected cantidadVip(): number {
    return Array.from(this.seleccionadas()).filter((codigo) => tipoDeButaca(codigo) === 'vip')
      .length;
  }

  // Scroll manual, sin pasar por el Router — un <a href="#candy-bar">
  // terminaba disparando la navegación de Angular (por el
  // anchorScrolling del router) y nos mandaba a la cartelera en vez de
  // simplemente bajar la página.
  protected irACandyBar(): void {
    document.getElementById('candy-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Atajo de la barra del candy (en celular el resumen queda al final)
  protected irAResumen(): void {
    document.getElementById('resumen-compra')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected esVip(codigo: string): boolean {
    return tipoDeButaca(codigo) === 'vip';
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

    // El combo necesita al menos 1 butaca elegida (es "entrada + candy a
    // precio fijo" — sin entrada no tiene sentido). Si te quedás sin
    // butacas mientras había un combo elegido, lo sacamos solo: si no,
    // quedaba "elegido" para siempre sin forma de sacarlo a mano, porque
    // el botón del combo se deshabilita justamente cuando no hay butacas
    // seleccionadas.
    if (nuevas.size === 0 && this.comboSeleccionado()) {
      this.comboSeleccionado.set(null);
    }
  }

  // ── Candy bar ──

  protected productosDeCategoriaActiva(): ICandyProductoConCategoria[] {
    const categoria = this.categoriaActiva();
    return this.candyProductos().filter((p) => p.categoria_id === categoria);
  }

  protected cantidadEnCarrito(producto_id: number): number {
    return this.carritoCandy().get(producto_id) ?? 0;
  }

  // Para el numerito de cada pestaña: cuántas unidades de esa categoría
  // ya hay en el carrito, así se ve de un vistazo qué se eligió.
  protected cantidadEnCategoria(categoria_id: number): number {
    return this.itemsCandyEnCarrito()
      .filter((item) => item.producto.categoria_id === categoria_id)
      .reduce((acumulado, item) => acumulado + item.cantidad, 0);
  }

  protected cantidadTotalCandy(): number {
    return Array.from(this.carritoCandy().values()).reduce((acumulado, n) => acumulado + n, 0);
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

  // Ordenadas por fila y número (A1, A2, B10…), para los chips del resumen
  protected butacasSeleccionadasOrdenadas(): string[] {
    return Array.from(this.seleccionadas()).sort((a, b) => {
      const filaA = a.charAt(0);
      const filaB = b.charAt(0);
      if (filaA !== filaB) return filaA.localeCompare(filaB);
      return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
    });
  }

  protected candySubtotal(): number {
    // Las unidades de candy canjeadas con puntos (ver candyCanjeado() más
    // abajo) no se cobran en pesos — por eso a cada línea le restamos la
    // cantidad canjeada antes de multiplicar por el precio.
    const canjeadoPorProducto = new Map(
      this.candyCanjeado().map((item) => [item.producto_id, item.cantidad]),
    );

    return Math.round(
      this.itemsCandyEnCarrito().reduce((acumulado, item) => {
        const cantidadCanjeada = canjeadoPorProducto.get(item.producto.id) ?? 0;
        const cantidadPagada = item.cantidad - cantidadCanjeada;
        return acumulado + item.producto.precio * cantidadPagada;
      }, 0),
    );
  }

  // Porcentaje de descuento que le corresponde al usuario actual (0 si
  // no aplica ninguno) — ya resuelve la regla de "el mayor entre los que
  // apliquen, sin acumular" adentro del servicio.
  protected descuentoAplicado(): number {
    return this.cuponesService.calcularDescuento(this.usuario(), this.cupones());
  }

  // Elegir un combo (o el mismo de nuevo para sacarlo). Necesita que ya
  // haya al menos 1 butaca elegida — el botón del HTML se deshabilita si
  // no, así que acá sólo confirmamos por las dudas.
  protected elegirCombo(combo: IComboConItems) {
    if (this.seleccionadas().size === 0) return;
    const yaEstabaElegido = this.comboSeleccionado()?.id === combo.id;
    this.comboSeleccionado.set(yaEstabaElegido ? null : combo);

    // El combo es "entrada + candy a precio fijo" pagado con plata o
    // crédito — no tiene sentido combinarlo con puntos (ya viene con un
    // precio especial armado por el admin, no con el costo normal en
    // puntos de una entrada suelta o un candy suelto).
    if (!yaEstabaElegido) {
      this.usarPuntos.set(false);
    }
  }

  protected calcularTotal(): number {
    const funcionActual = this.funcion();
    if (!funcionActual) return 0;

    // Antes era "precio del formato × cantidad de butacas"; ahora cada
    // butaca puede tener un precio distinto si es VIP, así que sumamos
    // butaca por butaca en vez de multiplicar por un precio único. Las
    // butacas canjeadas con puntos quedan afuera de esta cuenta — son
    // gratis en pesos, ya se "pagaron" con puntos.
    const canjeadas = new Set(this.butacasCanjeadas());
    const preciosButacas = Array.from(this.seleccionadas())
      .filter((codigo) => !canjeadas.has(codigo))
      .map((codigo) =>
        this.entradasService.precioPorButaca(funcionActual.formato, codigo, this.precioPreventa()),
      );
    let subtotalEntradas = preciosButacas.reduce((acumulado, precio) => acumulado + precio, 0);

    const combo = this.comboSeleccionado();
    if (combo && preciosButacas.length > 0) {
      // El combo "es" 1 entrada + su candy a precio fijo: le sacamos al
      // subtotal el precio de la butaca más barata (para no perder el
      // recargo VIP de las demás si mezclaste butacas normales y VIP) y
      // sumamos el precio fijo del combo en su lugar.
      const precioMasBarato = Math.min(...preciosButacas);
      subtotalEntradas = subtotalEntradas - precioMasBarato + combo.precio;
    }

    const subtotal = subtotalEntradas + this.candySubtotal();
    const descuento = this.descuentoAplicado();
    const total = descuento > 0 ? subtotal * (1 - descuento / 100) : subtotal;
    return Math.round(total);
  }

  // Crédito (de una cancelación anterior): si el usuario lo tiene y activó
  // el toggle, esto es cuánto se descuenta — nunca más de lo que tiene, ni
  // más de lo que cuesta la compra.
  protected usarCredito = signal(false);

  // Crédito y puntos son excluyentes: sólo uno de los dos a la vez. Activar
  // uno apaga el otro automáticamente, para no complicar la cuenta de "qué
  // butaca se pagó con qué" en una misma compra.
  protected toggleUsarCredito(): void {
    const nuevo = !this.usarCredito();
    this.usarCredito.set(nuevo);
    if (nuevo) this.usarPuntos.set(false);
  }

  // Además de excluir crédito, los puntos tampoco se pueden usar si hay un
  // combo elegido (el combo ya tiene su propio precio fijo armado por el
  // admin — ver elegirCombo() más arriba).
  protected toggleUsarPuntos(): void {
    if (this.comboSeleccionado()) return;
    const nuevo = !this.usarPuntos();
    this.usarPuntos.set(nuevo);
    if (nuevo) this.usarCredito.set(false);
  }

  protected creditoAUsar(): number {
    if (!this.usarCredito()) return 0;
    const disponible = this.usuario()?.credito ?? 0;
    return Math.min(disponible, this.calcularTotal());
  }

  protected montoAPagar(): number {
    return this.calcularTotal() - this.creditoAUsar();
  }

  // Fidelización: de las butacas seleccionadas, cuáles se terminan pagando
  // con puntos. Canjeamos primero las más baratas en puntos (las que no son
  // VIP) para que el saldo alcance para la mayor cantidad de entradas
  // posible, y paramos apenas los puntos no alcanzan para la siguiente.
  protected butacasCanjeadas(): string[] {
    const config = this.fidelizacionConfig();
    const usuario = this.usuario();
    if (!this.usarPuntos() || !config || !usuario) return [];

    const ordenadas = Array.from(this.seleccionadas()).sort(
      (a, b) =>
        this.entradasService.costoEntradaEnPuntos(config.puntos_por_entrada_gratis, a) -
        this.entradasService.costoEntradaEnPuntos(config.puntos_por_entrada_gratis, b),
    );

    const canjeadas: string[] = [];
    let puntosRestantes = usuario.puntos;

    for (const codigo of ordenadas) {
      const costo = this.entradasService.costoEntradaEnPuntos(config.puntos_por_entrada_gratis, codigo);
      if (costo > puntosRestantes) break; // ya no alcanza ni para la más barata que queda
      canjeadas.push(codigo);
      puntosRestantes -= costo;
    }

    return canjeadas;
  }

  protected puntosAUsar(): number {
    const config = this.fidelizacionConfig();
    if (!config) return 0;
    return this.butacasCanjeadas().reduce(
      (acumulado, codigo) =>
        acumulado + this.entradasService.costoEntradaEnPuntos(config.puntos_por_entrada_gratis, codigo),
      0,
    );
  }

  // Fidelización — canje de candy con puntos. Con lo que sobra después de
  // canjear entradas (butacasCanjeadas de arriba tiene prioridad), vemos
  // qué candy del carrito tiene un costo en puntos configurado
  // (producto.puntos_canje) y canjeamos tantas unidades como alcancen,
  // empezando por el más barato en puntos. Si en una línea el saldo sólo
  // alcanza para parte de las unidades (ej. pediste 3 pochoclos pero sólo
  // te alcanza para 2), esas 2 se canjean y la 3ra se cobra en pesos.
  protected candyCanjeado(): { producto_id: number; cantidad: number; puntos: number }[] {
    const usuario = this.usuario();
    if (!this.usarPuntos() || !usuario) return [];

    let puntosRestantes = usuario.puntos - this.puntosAUsar();

    const candidatos = this.itemsCandyEnCarrito()
      .filter((item) => item.producto.puntos_canje != null && item.producto.puntos_canje > 0)
      .sort((a, b) => (a.producto.puntos_canje as number) - (b.producto.puntos_canje as number));

    const canjeado: { producto_id: number; cantidad: number; puntos: number }[] = [];

    for (const item of candidatos) {
      const costoUnidad = item.producto.puntos_canje as number;
      const unidadesQueAlcanzan = Math.min(item.cantidad, Math.floor(puntosRestantes / costoUnidad));
      if (unidadesQueAlcanzan <= 0) continue;

      canjeado.push({
        producto_id: item.producto.id,
        cantidad: unidadesQueAlcanzan,
        puntos: unidadesQueAlcanzan * costoUnidad,
      });
      puntosRestantes -= unidadesQueAlcanzan * costoUnidad;
    }

    return canjeado;
  }

  protected puntosCandyAUsar(): number {
    return this.candyCanjeado().reduce((acumulado, item) => acumulado + item.puntos, 0);
  }

  // Para el template: cuántas unidades de ESTE producto puntual (por su
  // id) ya están cubiertas por puntos, para poder aclararlo en el resumen
  // del carrito de candy.
  protected cantidadCanjeadaCandy(producto_id: number): number {
    return this.candyCanjeado().find((item) => item.producto_id === producto_id)?.cantidad ?? 0;
  }

  // Misma cuenta que ya usa Cupones para "mayores de 50" — la duplico acá
  // en vez de importarla de otro componente porque es una cuentita chica
  // y no vale la pena acoplar dos pantallas por esto.
  private calcularEdad(fechaNacimiento: string): number {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const noLlegoElCumple =
      hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
    if (noLlegoElCumple) edad--;
    return edad;
  }

  protected async confirmarCompra() {
    if (this.seleccionadas().size === 0) return;

    this.error.set(null);

    // Restricción de edad de la película: se chequea ACÁ, antes de mandar
    // nada al servidor, porque hace falta saber la fecha de nacimiento del
    // usuario — y eso sólo lo tenemos si está logueado.
    const restriccion = this.peliculaActual()?.restriccion_edad;
    if (restriccion) {
      const usuarioActual = this.usuario();
      if (!usuarioActual) {
        this.error.set(
          `Esta película es apta para mayores de ${restriccion} años. Necesitás iniciar sesión para comprar, así podemos verificar tu edad.`,
        );
        return;
      }
      if (this.calcularEdad(usuarioActual.fecha_nacimiento) < restriccion) {
        this.error.set(
          `Esta película es apta para mayores de ${restriccion} años. No podés comprar entradas para esta función.`,
        );
        return;
      }
    }

    this.comprando.set(true);
    // Guardamos qué butacas somos NOSOTROS quienes las estamos comprando,
    // para que el handler de Realtime (más abajo) no confunda nuestro
    // propio insert con el de otro usuario.
    this.codigosEnCompraPropia = new Set(this.seleccionadas());

    try {
      const usuario = this.usuario();

      const combo = this.comboSeleccionado();
      const itemsDelCombo = combo
        ? combo.combo_items.map((item) => ({ producto_id: item.producto_id, cantidad: item.cantidad }))
        : [];

      // Del carrito de candy, restamos las unidades que se van a canjear
      // con puntos (candyCanjeado) — esas van aparte, no como candyItems
      // (que es sólo lo que se paga con plata). Si no restáramos esto acá,
      // Entradas.comprar() insertaría la cantidad dos veces: una como
      // pagada y otra como canjeada.
      const canjeadoPorProducto = new Map(
        this.candyCanjeado().map((item) => [item.producto_id, item.cantidad]),
      );
      const candyItems = [
        ...Array.from(this.carritoCandy().entries())
          .map(([producto_id, cantidad]) => ({
            producto_id,
            cantidad: cantidad - (canjeadoPorProducto.get(producto_id) ?? 0),
          }))
          .filter((item) => item.cantidad > 0),
        ...itemsDelCombo,
      ];

      // Guardamos el detalle del candy en un formato simple (nombre + cantidad)
      // ANTES de vaciar el carrito más abajo, porque después de la compra
      // exitosa lo reseteamos a vacío.
      const candyParaPdf = [
        ...this.itemsCandyEnCarrito().map((item) => ({
          nombre: item.producto.nombre,
          cantidad: item.cantidad,
        })),
        ...(combo?.combo_items.map((item) => ({
          nombre: item.candy_productos.nombre,
          cantidad: item.cantidad,
        })) ?? []),
      ];

      // Igual que el candy: las butacas (ya ordenadas) se guardan antes de
      // que se vacíe la selección.
      const butacasParaPdf = this.butacasSeleccionadasOrdenadas();

      const { orden } = await this.entradasService.comprar(
        this.funcion_id,
        Array.from(this.seleccionadas()),
        usuario,
        candyItems,
        this.calcularTotal(),
        this.creditoAUsar(),
        this.butacasCanjeadas(),
        this.candyCanjeado(),
      );

      const detalle = await this.funcionesService.obtenerDetalleCompra(this.funcion_id);

      // Un solo QR para toda la compra (el de la orden): vale para todas
      // las butacas y también para retirar el candy.
      await this.pdfService.generarCompra({
        ...detalle,
        butacas: butacasParaPdf,
        candy: candyParaPdf,
        codigo_qr: orden.codigo_qr,
      });

      this.compraExitosa.set(true);
      this.seleccionadas.set(new Set());
      this.carritoCandy.set(new Map());
      this.comboSeleccionado.set(null);

      const ocupadasArray = await this.entradasService.obtenerButacasOcupadas(this.funcion_id);
      this.ocupadas.set(new Set(ocupadasArray));
      this.usuario.set(await this.authService.usuarioActual());

      // El profe pidió que después de comprar te lleve a ver lo que
      // compraste — dejamos ver el cartel de éxito un instante y recién
      // ahí navegamos, así no desaparece la pantalla de golpe. Sólo tiene
      // sentido si está logueado (una compra anónima no tiene "Mis
      // compras" a donde ir).
      if (usuario) {
        setTimeout(() => this.router.navigateByUrl('/mis-compras'), 1800);
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.comprando.set(false);
      this.codigosEnCompraPropia.clear();
    }
  }
}