import { Service } from '@angular/core';

export type TipoFila = 'normal' | 'accesible' | 'vip';

export interface IButaca {
  codigo: string; // ej. "J5"
}

export interface IFilaSala {
  letra: string;
  tipo: TipoFila;
  // Tamaño de cada bloque de esta fila (izquierda/centro/derecha), para
  // poder dibujar los pasillos en el lugar correcto según el tipo de fila
  bloques: number[];
  butacas: IButaca[];
}

const FILAS = 'ABCDEFGHIJKLMNOPQRST'.split('');

// Filas J y K: antes eran butacas comunes, ahora son la fila accesible.
// Se mantienen como filas propias (la sala sigue teniendo 20 filas en
// total), pero con menos butacas por fila — el espacio extra es lo que
// necesita una butaca para silla de ruedas.
const FILAS_ACCESIBLES = ['J', 'K'];

// Últimas 3 filas de la sala: butacas VIP, más caras y marcadas distinto.
const FILAS_VIP = ['R', 'S', 'T'];

const BLOQUES_NORMAL = [4, 20, 4];
const BLOQUES_ACCESIBLE = [2, 10, 2];

// Función pura (no depende de instanciar el servicio) para saber el tipo
// de una butaca a partir de su código — la usamos acá para armar el mapa,
// pero también la necesita Entradas para calcular el precio de cada
// butaca vendida, así que se exporta suelta en vez de método de instancia.
export function tipoDeFila(letra: string): TipoFila {
  if (FILAS_ACCESIBLES.includes(letra)) return 'accesible';
  if (FILAS_VIP.includes(letra)) return 'vip';
  return 'normal';
}

export function tipoDeButaca(codigo: string): TipoFila {
  return tipoDeFila(codigo.charAt(0));
}

@Service()
export class Butacas {
  generarLayoutSala(): IFilaSala[] {
    return FILAS.map((letra) => {
      const tipo = tipoDeFila(letra);
      const bloques = tipo === 'accesible' ? BLOQUES_ACCESIBLE : BLOQUES_NORMAL;

      const butacas: IButaca[] = [];
      let numero = 1;
      for (const tamanioBloque of bloques) {
        for (let i = 0; i < tamanioBloque; i++) {
          butacas.push({ codigo: `${letra}${numero}` });
          numero++;
        }
      }

      return { letra, tipo, bloques, butacas };
    });
  }
}