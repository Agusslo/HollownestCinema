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
    this.el.nativeElement.style.boxShadow = `0 0 16px ${this.color()}`;
    this.el.nativeElement.style.transition = 'box-shadow 0.25s ease';
  }

  onMouseLeave() {
    this.el.nativeElement.style.boxShadow = '';
  }
}