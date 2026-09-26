import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Logs } from '../../../core/services/logs';
import { ILogActividadConUsuario } from '../../../core/interfaces/log-actividad';
import { BlobatarComponent } from '../../../shared/components/blobatar/blobatar';

type TipoAccion = 'funcion' | 'entrada' | 'candy' | 'cupon' | 'otro';

// El log guarda la acción como texto libre ("Creó una función de…",
// "Validó la entrada…"), así que el tipo se deduce del comienzo del texto
// — sólo para elegir ícono y color, no cambia nada de lo que se guarda.
const TIPOS: { tipo: TipoAccion; patron: RegExp; icono: string }[] = [
  { tipo: 'funcion', patron: /función/i, icono: '🎬' },
  { tipo: 'entrada', patron: /entrada/i, icono: '🎟️' },
  { tipo: 'candy', patron: /candy|combo/i, icono: '🍿' },
  { tipo: 'cupon', patron: /cup[oó]n/i, icono: '🏷️' },
];

interface IGrupoDia {
  titulo: string;
  entradas: ILogActividadConUsuario[];
}

@Component({
  selector: 'app-log-actividad',
  imports: [DatePipe, BlobatarComponent],
  templateUrl: './log-actividad.html',
  styleUrl: './log-actividad.css',
})
export class LogActividad {
  private logsService = inject(Logs);

  protected entradas = signal<ILogActividadConUsuario[]>([]);
  protected cargando = signal(true);

  // Agrupa las entradas por día (vienen ordenadas, más nuevas primero),
  // para mostrar "Hoy", "Ayer" o la fecha como separador.
  protected grupos = computed<IGrupoDia[]>(() => {
    const grupos: IGrupoDia[] = [];
    for (const entrada of this.entradas()) {
      const titulo = this.tituloDia(new Date(entrada.creado_en));
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.titulo === titulo) {
        ultimo.entradas.push(entrada);
      } else {
        grupos.push({ titulo, entradas: [entrada] });
      }
    }
    return grupos;
  });

  constructor() {
    this.logsService.obtenerTodo().then((entradas) => {
      this.entradas.set(entradas);
      this.cargando.set(false);
    });
  }

  protected tipoDe(accion: string): TipoAccion {
    return TIPOS.find((t) => t.patron.test(accion))?.tipo ?? 'otro';
  }

  protected iconoDe(accion: string): string {
    return TIPOS.find((t) => t.patron.test(accion))?.icono ?? '◆';
  }

  private tituloDia(fecha: Date): string {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    if (fecha.toDateString() === hoy.toDateString()) return 'Hoy';
    if (fecha.toDateString() === ayer.toDateString()) return 'Ayer';
    return fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
