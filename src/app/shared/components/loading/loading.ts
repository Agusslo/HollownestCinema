import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading',
  standalone: true,
  template: `
    <section class="pantalla-loading" [class.pantalla-completa]="fullscreen()" aria-live="polite">
      <div class="loading-soul">
        <span class="soul-spinner"></span>
      </div>
      <p class="loading-title">
        {{ mensaje() }}<span class="loading-dots" aria-hidden="true">...</span>
      </p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
    `,
  ],
})
export class LoadingComponent {
  mensaje = input<string>('Explorando Hallownest');
  fullscreen = input<boolean>(false);
}
