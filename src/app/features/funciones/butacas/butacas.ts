import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Butacas as ButacasService } from '../../../core/services/butacas';
import { Entradas } from '../../../core/services/entradas';

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

  protected funcion_id = 0;
  protected layout = signal<string[][]>([]);
  protected ocupadas = signal<Set<string>>(new Set());
  protected seleccionadas = signal<Set<string>>(new Set());
  protected cargando = signal(true);

  constructor() {
    this.cargarDatos();
  }

  private async cargarDatos() { // Carga los datos de la función y las butacas ocupadas
    this.funcion_id = Number(this.route.snapshot.queryParamMap.get('funcion'));
    this.layout.set(this.butacasService.generarLayoutSala());

    const ocupadasArray = await this.entradasService.obtenerButacasOcupadas(this.funcion_id);
    this.ocupadas.set(new Set(ocupadasArray));

    this.cargando.set(false);
  }

  protected estaOcupada(butaca: string): boolean {
    return this.ocupadas().has(butaca);
  }

  protected estaSeleccionada(butaca: string): boolean {
    return this.seleccionadas().has(butaca);
  }

  protected toggleButaca(butaca: string): void { //cuando se hace click en una butaca, si no está ocupada, se agrega o se quita de las seleccionadas
    if (this.estaOcupada(butaca)) return;

    const nuevas = new Set(this.seleccionadas());// Crea un nuevo Set para evitar mutar el estado directamente
    if (nuevas.has(butaca)) {
      nuevas.delete(butaca);
    } else {
      nuevas.add(butaca);
    }
    this.seleccionadas.set(nuevas);// Actualiza el estado de las butacas seleccionadas
  }
}