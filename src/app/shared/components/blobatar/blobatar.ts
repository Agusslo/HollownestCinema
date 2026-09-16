import { Component, input, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { _parts } from 'blobatar/internal';
import { blobatarUri } from 'blobatar/uri';

@Component({
  selector: 'app-blobatar',
  standalone: true,
  template: `
    @if (animate() && partes(); as p) {
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.style]="estilosVariables()"
        class="blobatar-svg"
        [attr.aria-label]="name()"
        role="img"
      >
        <g [class]="p.cls" [innerHTML]="sanitizedInner()"></g>
      </svg>
    } @else {
      <img
        [src]="uri()"
        [alt]="name()"
        [width]="size()"
        [height]="size()"
        class="blobatar-img"
      />
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      flex-shrink: 0;
    }
    .blobatar-svg,
    .blobatar-img {
      display: block;
      border-radius: 50%;
      overflow: hidden;
      transition: transform 0.25s ease;
    }
  `],
})
export class BlobatarComponent {
  private sanitizer = inject(DomSanitizer);

  name = input<string>('Sombra');
  size = input<number>(32);
  animate = input<'hover' | 'always' | undefined>('hover');

  protected uri = computed(() => blobatarUri(this.name() || 'Sombra'));

  protected partes = computed(() => {
    if (!this.animate()) return null;
    try {
      return _parts(this.name() || 'Sombra', { animate: this.animate() });
    } catch {
      return null;
    }
  });

  protected sanitizedInner = computed<SafeHtml>(() => {
    const inner = this.partes()?.inner ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(inner);
  });

  protected estilosVariables = computed(() => {
    const vars = this.partes()?.vars;
    if (!vars) return null;
    return Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  });
}

