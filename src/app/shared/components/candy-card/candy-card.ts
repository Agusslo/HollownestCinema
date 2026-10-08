import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import ICandyProducto from '../../../core/interfaces/candy-producto';

// Sólo los datos que la tarjeta muestra. Con Pick le pasamos un producto
// entero (en la compra) o un objeto armado a mano con lo que el admin va
// escribiendo en el formulario (en la vista previa de Nuevo producto).
export type ICandyCardProducto = Pick<
  ICandyProducto,
  'nombre' | 'precio' | 'imagen_url' | 'puntos_canje'
>;

// La tarjeta de un producto del candy bar, como componente propio (mismo
// criterio que PosterCard). Antes el HTML estaba sólo en la pantalla de
// butacas; ahora la compra y la vista previa de "Nuevo producto" usan esta
// misma tarjeta, así que se ven iguales.
@Component({
  selector: 'app-candy-card',
  imports: [DecimalPipe],
  templateUrl: './candy-card.html',
  styleUrl: './candy-card.css',
})
export class CandyCard {
  producto = input.required<ICandyCardProducto>();

  // Cuántas unidades hay en el carrito: con 0 se ve el botón "+ Agregar" y
  // con más, el contador con − y +.
  cantidad = input(0);

  // La tarjeta no maneja el carrito: avisa qué tocó el usuario y la pantalla
  // de compra decide. En la vista previa nadie escucha estos eventos, así
  // que la tarjeta se ve igual pero el botón no hace nada.
  agregar = output<void>();
  quitar = output<void>();
}
