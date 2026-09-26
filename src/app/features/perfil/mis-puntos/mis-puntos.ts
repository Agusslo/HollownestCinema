import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Fidelizacion } from '../../../core/services/fidelizacion';
import { Ordenes } from '../../../core/services/ordenes';
import { ICanjeConDetalle, IFidelizacionConfig } from '../../../core/interfaces/canje';
import { IOrdenConDetalle } from '../../../core/interfaces/orden';
import IPerfil from '../../../core/interfaces/perfil';

// Un renglón de "Mis puntos": puede ser una GANANCIA (una compra pagada
// con plata, que sumó puntos) o un GASTO (un canje, que restó puntos).
// Se unifican los dos en un solo tipo para poder mezclarlos en una sola
// lista ordenada por fecha, en vez de mostrar dos tablas separadas.
interface IMovimientoPuntos {
  fecha: string;
  puntos: number; // positivo = ganancia, negativo = gasto
  tipo: 'compra' | 'entrada' | 'candy';
  // Separado del tipo para poder mostrarlos con estilos distintos:
  // tipo chiquito arriba ("Entrada gratis"), nombre grande abajo.
  titulo: string;
}

const ETIQUETAS_TIPO: Record<IMovimientoPuntos['tipo'], string> = {
  compra: 'Compra',
  entrada: 'Entrada gratis',
  candy: 'Canje de candy',
};

@Component({
  selector: 'app-mis-puntos',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './mis-puntos.html',
  styleUrl: './mis-puntos.css',
})
export class MisPuntos {
  private authService = inject(Auth);
  private fidelizacionService = inject(Fidelizacion);
  private ordenesService = inject(Ordenes);
  private router = inject(Router);

  protected usuario = signal<IPerfil | null>(null);
  protected movimientos = signal<IMovimientoPuntos[]>([]);
  protected cargando = signal(true);
  protected error = signal<string | null>(null);
  protected config = signal<IFidelizacionConfig | null>(null);

  protected totalGanado = computed(() =>
    this.movimientos()
      .filter((m) => m.puntos > 0)
      .reduce((total, m) => total + m.puntos, 0),
  );
  protected totalCanjeado = computed(() =>
    this.movimientos()
      .filter((m) => m.puntos < 0)
      .reduce((total, m) => total - m.puntos, 0),
  );
  // Cuántas entradas gratis alcanzan con los puntos actuales
  protected entradasDisponibles = computed(() => {
    const porEntrada = this.config()?.puntos_por_entrada_gratis;
    const puntos = this.usuario()?.puntos ?? 0;
    return porEntrada ? Math.floor(puntos / porEntrada) : 0;
  });

  protected etiquetaTipo(tipo: IMovimientoPuntos['tipo']): string {
    return ETIQUETAS_TIPO[tipo];
  }

  constructor() {
    this.cargarDatos();
  }

  // Mismo patrón que MisCompras.cargarDatos(): todo dentro de try/catch/finally
  // para que un error de red o de consulta no deje la pantalla trabada en
  // "Cargando..." para siempre.
  private async cargarDatos() {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const usuario = await this.authService.usuarioActual();
      this.usuario.set(usuario);

      if (!usuario) {
        this.router.navigateByUrl('/login');
        return;
      }

      // Traemos las dos fuentes en paralelo: las compras (de ahí sacamos
      // cuántos puntos se GANARON en cada una) y los canjes (los puntos
      // que ya se GASTARON) — no hace falta ninguna tabla nueva para las
      // ganancias: `ordenes` ya guarda `total` y `credito_usado` por
      // compra, y con eso alcanza para recalcular lo mismo que ya calculó
      // Entradas.comprar() en su momento al acreditar los puntos.
      const [compras, canjes, config] = await Promise.all([
        this.ordenesService.obtenerMisCompras(usuario.id),
        this.fidelizacionService.obtenerHistorial(usuario.id),
        this.fidelizacionService.obtenerConfig(),
      ]);
      this.config.set(config);

      const ganancias: IMovimientoPuntos[] = compras
        .map((orden) => ({
          fecha: orden.creado_en,
          // Misma cuenta que usa Entradas.comprar(): 1 punto por cada peso
          // pagado de verdad (total - lo cubierto con crédito). Lo que se
          // pagó con crédito o con puntos no vuelve a sumar puntos acá.
          puntos: Math.floor(Math.max(orden.total - orden.credito_usado, 0)),
          tipo: 'compra' as const,
          titulo: this.tituloCompra(orden),
        }))
        .filter((mov) => mov.puntos > 0);

      const gastos: IMovimientoPuntos[] = canjes.map((canje) => ({
        fecha: canje.creado_en,
        puntos: -canje.puntos_gastados,
        tipo: canje.tipo === 'entrada' ? ('entrada' as const) : ('candy' as const),
        titulo: this.tituloCanje(canje),
      }));

      // Mezclamos las dos listas y ordenamos por fecha, más nuevo primero
      // — así se ve como una sola línea de tiempo de "gané esto, gasté
      // esto otro", en vez de dos historiales separados y sin relación.
      this.movimientos.set(
        [...ganancias, ...gastos].sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
        ),
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  private tituloCompra(orden: IOrdenConDetalle): string {
    if (orden.entradas.length > 0) {
      return orden.entradas[0].funciones.peliculas.nombre;
    }
    return `Orden #${orden.id}`;
  }

  // Nombre de cada renglón de canje: si fue una entrada gratis, el de la
  // película; si fue candy, la cantidad y el producto (ej: "2x Pochoclo grande").
  private tituloCanje(canje: ICanjeConDetalle): string {
    if (canje.tipo === 'entrada') {
      return canje.entradas?.funciones.peliculas.nombre ?? 'Entrada';
    }

    const nombreProducto = canje.candy_productos?.nombre ?? 'Candy';
    return `${canje.cantidad}x ${nombreProducto}`;
  }
}