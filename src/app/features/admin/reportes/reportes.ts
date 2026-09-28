import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Reportes as ReportesService } from '../../../core/services/reportes';
import IFacturacionDiaria, { IPeliculaMasVista, IReporteMasVistas } from '../../../core/interfaces/reporte';
import { GlowHover } from '../../../shared/directives/glow-hover';

@Component({
  selector: 'app-reportes',
  imports: [DatePipe, DecimalPipe, GlowHover],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes {
  private reportesService = inject(ReportesService);

  protected facturacion = signal<IFacturacionDiaria[]>([]);
  protected masVistas = signal<IReporteMasVistas>({ semana: [], mes: [] });
  protected cargando = signal(true);
  protected error = signal<string | null>(null);

  // Totales de todo el período mostrado, para no obligar al admin a sumar
  // la columna a mano.
  protected totalFacturado = computed(() =>
    this.facturacion().reduce((acumulado, fila) => acumulado + fila.montoFacturado, 0),
  );
  protected totalEntradas = computed(() =>
    this.facturacion().reduce((acumulado, fila) => acumulado + fila.entradasVendidas, 0),
  );

  // Cuánto se facturó en promedio por cada entrada vendida (en pesos)
  protected ticketPromedio = computed(() => {
    const entradas = this.totalEntradas();
    return entradas > 0 ? Math.round(this.totalFacturado() / entradas) : 0;
  });

  // El día que más se facturó: se destaca en la tabla
  protected mejorDia = computed(() => {
    const filas = this.facturacion();
    if (filas.length === 0) return null;
    const mejor = filas.reduce((max, fila) => (fila.montoFacturado > max.montoFacturado ? fila : max));
    return mejor.montoFacturado > 0 ? mejor : null;
  });

  // Largo de la barra de cada día, relativo al mejor día (0–100%)
  protected porcentajeDelMaximo(monto: number): number {
    const maximo = this.mejorDia()?.montoFacturado ?? 0;
    return maximo > 0 ? (monto / maximo) * 100 : 0;
  }

  // Mismo criterio que porcentajeDelMaximo(), pero para el ranking de
  // "más vistas": el 100% de la barra es la película con más entradas DE
  // ESE MISMO ranking (la semana tiene su propio máximo, el mes el suyo).
  // Como la lista ya viene ordenada de mayor a menor (ver
  // Reportes.contarYRankear en el service), el máximo es directamente el
  // primer elemento — no hace falta recalcularlo con un reduce.
  protected porcentajeRanking(cantidad: number, lista: IPeliculaMasVista[]): number {
    const maximo = lista[0]?.cantidad ?? 0;
    return maximo > 0 ? (cantidad / maximo) * 100 : 0;
  }

  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    this.cargando.set(true);
    this.error.set(null);

    try {
      // Las dos consultas son independientes entre sí, así que las
      // pedimos en paralelo en vez de esperar a que termine una para
      // recién ahí arrancar la otra.
      const [facturacion, masVistas] = await Promise.all([
        this.reportesService.obtenerFacturacionDiaria(),
        this.reportesService.obtenerMasVistas(),
      ]);
      this.facturacion.set(facturacion);
      this.masVistas.set(masVistas);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }
}