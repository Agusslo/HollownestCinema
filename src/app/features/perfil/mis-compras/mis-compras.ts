import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Ordenes } from '../../../core/services/ordenes';
import { IOrdenConDetalle } from '../../../core/interfaces/orden';
import IPerfil from '../../../core/interfaces/perfil';

// Mismo límite que ya usa Ordenes.cancelar() del lado del servicio — acá
// lo repetimos sólo para decidir si mostramos el botón de cancelar o no.
// La validación real (la que de verdad importa) la hace igual el service.
const HORAS_LIMITE_CANCELACION = 2;

@Component({
  selector: 'app-mis-compras',
  imports: [DatePipe],
  templateUrl: './mis-compras.html',
  styleUrl: './mis-compras.css',
})
export class MisCompras {
  private authService = inject(Auth);
  private ordenesService = inject(Ordenes);
  private router = inject(Router);

  protected usuario = signal<IPerfil | null>(null);
  protected compras = signal<IOrdenConDetalle[]>([]);
  protected cargando = signal(true);
  protected error = signal<string | null>(null);
  protected mensaje = signal<string | null>(null);

  // Id de la orden para la que se está mostrando el "¿seguro?" — evita
  // cancelar con un solo click por error.
  protected confirmando = signal<number | null>(null);
  protected cancelando = signal(false);

  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    const usuario = await this.authService.usuarioActual();
    this.usuario.set(usuario);

    if (!usuario) {
      this.router.navigateByUrl('/login');
      return;
    }

    this.compras.set(await this.ordenesService.obtenerMisCompras(usuario.id));
    this.cargando.set(false);
  }

  // Misma regla que el service: activa, sin entradas usadas, y falta más
  // de HORAS_LIMITE_CANCELACION para la función.
  protected puedeCancelarse(orden: IOrdenConDetalle): boolean {
    if (orden.cancelada_en) return false;
    if (orden.entradas.length === 0) return false;
    if (orden.entradas.some((e) => e.validada_en)) return false;

    const fechaFuncion = new Date(orden.entradas[0].funciones.fecha_hora);
    const limite = new Date(fechaFuncion.getTime() - HORAS_LIMITE_CANCELACION * 60 * 60 * 1000);
    return new Date() < limite;
  }

  protected montoACreditar(orden: IOrdenConDetalle): number {
    return orden.total - orden.credito_usado;
  }

  // Todas las entradas de una orden pertenecen siempre a la misma función
  // (Entradas.comprar() recibe un solo funcion_id) — por eso alcanza con
  // mostrar la película/sala/horario una sola vez y sólo listar las
  // butacas, en vez de repetir toda esa info por cada asiento comprado.
  protected butacasTexto(orden: IOrdenConDetalle): string {
    return orden.entradas.map((e) => `${e.fila}${e.columna}`).join(', ');
  }

  protected candyTexto(orden: IOrdenConDetalle): string {
    return orden.orden_candy_items
      .map((item) => `${item.cantidad}x ${item.candy_productos.nombre}`)
      .join(' · ');
  }

  // Para distinguirle al usuario POR QUÉ no puede cancelar (ya usó una
  // entrada vs. simplemente se pasó el plazo de las 2hs).
  protected tieneEntradaValidada(orden: IOrdenConDetalle): boolean {
    return orden.entradas.some((e) => e.validada_en);
  }

  protected pedirConfirmacion(ordenId: number) {
    this.confirmando.set(ordenId);
  }

  protected cancelarConfirmacion() {
    this.confirmando.set(null);
  }

  protected async confirmarCancelacion(orden: IOrdenConDetalle) {
    const usuarioActual = this.usuario();
    if (!usuarioActual) return;

    this.cancelando.set(true);
    this.error.set(null);
    try {
      await this.ordenesService.cancelar(orden.id, usuarioActual.id);
      this.mensaje.set(
        `Compra cancelada. Se acreditaron $${this.montoACreditar(orden)} a tu cuenta.`,
      );
      this.confirmando.set(null);
      await this.cargarDatos();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cancelando.set(false);
    }
  }
}