import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import IPelicula from '../../../core/interfaces/pelicula';
import { DuracionPipe } from '../../../core/pipes/duracion-pipe';
import { GlowHover } from '../../directives/glow-hover';

// Sólo los datos que la tarjeta muestra. Con Pick le pasamos una película
// entera (en la Home) o un objeto armado a mano con lo que el admin va
// escribiendo en el formulario (en la vista previa de Nueva película).
export type IPosterPelicula = Pick<IPelicula, 'nombre' | 'imagen_url' | 'duracion_minutos'>;

// La tarjeta de póster de la cartelera, como componente propio. Antes el
// HTML estaba repetido en la Home; ahora la Home y la vista previa de
// "Nueva película" usan este mismo componente, así que es imposible que se
// vean distintas: cualquier cambio de diseño se hace una sola vez, acá.
@Component({
  selector: 'app-poster-card',
  imports: [RouterLink, DuracionPipe, GlowHover],
  templateUrl: './poster-card.html',
  styleUrl: './poster-card.css',
})
export class PosterCard {
  // input.required: sin película no hay nada que mostrar, así que Angular
  // da error de compilación si alguien usa <app-poster-card> sin pasarla.
  pelicula = input.required<IPosterPelicula>();

  // A dónde lleva la tarjeta al hacer click. En la Home es el detalle de
  // la película; en la vista previa queda en null (la película todavía no
  // existe) y la tarjeta se ve igual, pero no navega a ningún lado.
  enlace = input<string[] | null>(null);
}