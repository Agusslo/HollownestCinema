import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Butacas as ButacasService } from '../../../core/services/butacas';
import { Entradas } from '../../../core/services/entradas';
import { Funciones } from '../../../core/services/funciones';
import { Auth } from '../../../core/services/auth';
import { Cupones } from '../../../core/services/cupones';
import IFuncion from '../../../core/interfaces/funcion';
import IPerfil from '../../../core/interfaces/perfil';
import ICupon from '../../../core/interfaces/cupon';
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
    const subtotal = this.seleccionadas().size * precio;
    const descuento = this.descuentoAplicado();
    return descuento > 0 ? subtotal * (1 - descuento / 100) : subtotal;
  }

  protected async confirmarCompra() {
    if (this.seleccionadas().size === 0) return;

    this.error.set(null);
    this.comprando.set(true);

    try {
      const usuario = this.usuario();
      const butacasCompradas = await this.entradasService.comprar(
        this.funcion_id,
        Array.from(this.seleccionadas()),
        usuario,
      );

      const detalle = await this.funcionesService.obtenerDetalleCompra(this.funcion_id);

      await this.pdfService.generarEntradas(
        butacasCompradas.map((b) => ({
          ...detalle,
          fila: b.fila,
          columna: b.columna,
          codigo_qr: b.codigo_qr,
        })),
      );

      this.compraExitosa.set(true);
      this.seleccionadas.set(new Set());

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