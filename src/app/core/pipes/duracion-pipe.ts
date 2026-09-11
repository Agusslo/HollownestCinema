import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duracion',
})
export class DuracionPipe implements PipeTransform {
  transform(minutosTotales: number): string {
    const horas = Math.floor(minutosTotales / 60);
    const minutos = minutosTotales % 60;

    if (horas === 0) {
      return `${minutos}m`;
    }

    return `${horas}h ${minutos}m`;
  }
}