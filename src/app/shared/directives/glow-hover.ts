import { Directive, ElementRef, inject, input } from '@angular/core';

// Mismo patrón que vimos en la clase de directivas (host listeners +
// ElementRef + input()), aplicado a nuestro propio tema: en vez de un
// highlight de color fijo, agrega el glow celeste característico de
// Hollownest al pasar el mouse por encima.
@Directive({
  selector: '[appGlowHover]',
  host: {
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
  },
})
export class GlowHover {
  private el: ElementRef<HTMLElement> = inject(ElementRef);

  // Color configurable por si en algún lado se quiere el glow dorado
  // (--hk-geo) en vez del celeste (--hk-focus) por default.
  color = input('#4fc4e3');

  onMouseEnter() {
    const elemento = this.el.nativeElement;
    elemento.style.boxShadow = `0 0 16px ${this.color()}`;
    // Sólo le ponemos transición si el elemento no tiene una propia: si
    // no, pisaríamos las del CSS (por ejemplo la de transform que hace
    // "levantar" los pósters) y esos efectos dejarían de animarse.
    if (getComputedStyle(elemento).transitionDuration === '0s') {
      elemento.style.transition = 'box-shadow 0.25s ease';
    }
  }

  onMouseLeave() {
    this.el.nativeElement.style.boxShadow = '';
  }
}