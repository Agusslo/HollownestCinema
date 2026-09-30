import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Toasts } from '../../../core/services/toasts';

// El componente NO decide qué toasts mostrar: sólo dibuja la lista que tiene
// el service Toasts. Se pone UNA sola vez en app.html, y desde cualquier
// pantalla se agregan toasts llamando al service (toasts.exito(...), etc.).
@Component({
  selector: 'app-toast',
  imports: [RouterLink],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class ToastComponent {
  protected toastsService = inject(Toasts);

  // Un ícono por tipo, para que el toast no dependa sólo del color para
  // entenderse (alguien con daltonismo igual distingue éxito de error).
  protected readonly iconos = {
    exito: '◆',
    error: '✕',
    advertencia: '!',
    info: 'i',
  };
}