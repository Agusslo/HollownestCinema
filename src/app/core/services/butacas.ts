import { Service } from '@angular/core';

const FILAS = 'ABCDEFGHIJKLMNOPQRST'.split('');
const BUTACAS_POR_FILA = 28; // bloques de 4 + 20 + 4

@Service()
export class Butacas {
  generarLayoutSala(): string[][] {
    return FILAS.map((fila) =>
      Array.from({ length: BUTACAS_POR_FILA }, (_, i) => `${fila}${i + 1}`),
    );
  }
}