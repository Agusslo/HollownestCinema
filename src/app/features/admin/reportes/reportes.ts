import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Reportes as ReportesService } from '../../../core/services/reportes';
import IFacturacionDiaria from '../../../core/interfaces/reporte';
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

  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() {
    this.cargando.set(true);
    this.error.set(null);

    try {
      this.facturacion.set(await this.reportesService.obtenerFacturacionDiaria());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }
}
