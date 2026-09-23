import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Logs } from '../../../core/services/logs';
import { ILogActividadConUsuario } from '../../../core/interfaces/log-actividad';

@Component({
  selector: 'app-log-actividad',
  imports: [DatePipe],
  templateUrl: './log-actividad.html',
  styleUrl: './log-actividad.css',
})
export class LogActividad {
  private logsService = inject(Logs);

  protected entradas = signal<ILogActividadConUsuario[]>([]);
  protected cargando = signal(true);

  constructor() {
    this.logsService.obtenerTodo().then((entradas) => {
      this.entradas.set(entradas);
      this.cargando.set(false);
    });
  }
}