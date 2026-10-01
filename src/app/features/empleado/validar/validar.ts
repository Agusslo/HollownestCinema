import { Component, inject, signal, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import { Entradas } from '../../../core/services/entradas';
import { Ordenes } from '../../../core/services/ordenes';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import { IOrdenValidacion } from '../../../core/interfaces/orden';
import IPerfil from '../../../core/interfaces/perfil';
import { GlowHover } from '../../../shared/directives/glow-hover';

@Component({
  selector: 'app-validar',
  imports: [ReactiveFormsModule, DatePipe, GlowHover],
  templateUrl: './validar.html',
  styleUrl: './validar.css',
})
export class Validar implements OnDestroy {
  private entradasService = inject(Entradas);
  private ordenesService = inject(Ordenes);
  private authService = inject(Auth);
  private logsService = inject(Logs);

  // Quién es el empleado/admin validando — se usa sólo para el log.
  private usuario: IPerfil | null = null;

  constructor() {
    this.authService.usuarioActual().then((u) => (this.usuario = u));
  }

  // Instancia del lector de cámara. No es un signal porque no se muestra
  // en la plantilla — sólo lo usamos para arrancarlo/pararlo.
  private lector: Html5Qrcode | null = null;
  protected camaraActiva = signal(false);

  protected codigoControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  protected buscando = signal(false);
  protected confirmando = signal(false);
  protected mensaje = signal<string | null>(null);
  protected error = signal<string | null>(null);

  // La compra que se está mirando. El QR es uno solo por compra y equivale
  // a todo (entradas + candy), así que ya no hay un modo "entrada" y otro
  // "candy": se muestra todo junto y cada parte se confirma por separado,
  // porque se usan en lugares distintos (la puerta de la sala y el
  // mostrador del candy bar).
  protected ordenEncontrada = signal<IOrdenValidacion | null>(null);
  // Código con el que se encontró esa compra, para poder volver a traerla
  // después de confirmar y mostrar cómo quedó.
  private codigoBuscado = '';

  private limpiarResultado() {
    this.ordenEncontrada.set(null);
    this.mensaje.set(null);
    this.error.set(null);
  }

  // Sólo busca y muestra, no modifica nada todavía — así el empleado puede
  // chequear que los datos coinciden con lo que tiene el cliente antes de
  // confirmar.
  protected async buscar() {
    if (this.codigoControl.invalid) {
      this.codigoControl.markAsTouched();
      return;
    }

    this.limpiarResultado();
    this.buscando.set(true);
    const codigo = this.codigoControl.value.trim();

    try {
      const orden = await this.ordenesService.buscarPorCodigo(codigo);
      if (!orden) {
        this.error.set('No se encontró ninguna compra con ese código.');
      } else {
        this.codigoBuscado = codigo;
        this.ordenEncontrada.set(orden);
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.buscando.set(false);
    }
  }

  // ── Datos para mostrar ──

  // Todas las entradas de una compra son de la misma función, así que los
  // datos de la película/sala/horario salen de la primera.
  protected funcionDe(orden: IOrdenValidacion) {
    return orden.entradas[0]?.funciones ?? null;
  }

  protected entradasPendientes(orden: IOrdenValidacion): number {
    return orden.entradas.filter((e) => !e.validada_en).length;
  }

  // Fecha en que se usaron las entradas (para avisar "ya fue validada el…")
  protected fechaValidacion(orden: IOrdenValidacion): string | null {
    return orden.entradas.find((e) => e.validada_en)?.validada_en ?? null;
  }

  // Nada más para hacer con este QR: cancelada, o ya se usó todo.
  protected estaAgotada(orden: IOrdenValidacion): boolean {
    if (orden.cancelada_en) return true;
    const candyPendiente = orden.orden_candy_items.length > 0 && !orden.candy_entregado_en;
    return this.entradasPendientes(orden) === 0 && !candyPendiente;
  }

  // ── Confirmaciones ──

  protected async confirmarEntradas() {
    const orden = this.ordenEncontrada();
    if (!orden) return;

    this.confirmando.set(true);
    this.mensaje.set(null);
    this.error.set(null);
    try {
      const validadas = await this.entradasService.validarDeOrden(orden.id);
      const butacas = validadas.map((e) => `${e.fila}${e.columna}`).join(', ');
      const cuantas = validadas.length === 1 ? '1 entrada' : `${validadas.length} entradas`;

      this.mensaje.set(
        validadas.length > 0
          ? `Se ${validadas.length === 1 ? 'validó' : 'validaron'} ${cuantas} (${butacas}). Puede${validadas.length === 1 ? '' : 'n'} pasar a la sala.`
          : 'Las entradas de esta compra ya habían sido validadas antes — no pueden volver a usarse.',
      );

      // Sólo logueamos si REALMENTE se validó algo ahora — si ya estaban
      // usadas de antes, no hubo ninguna acción nueva que registrar.
      if (validadas.length > 0 && this.usuario) {
        const pelicula = this.funcionDe(orden)?.peliculas.nombre ?? '';
        await this.logsService.registrar(
          this.usuario.id,
          `Validó el QR de la orden #${orden.id}: ${cuantas} (${butacas}) de "${pelicula}"`,
        );
      }

      await this.recargarOrden();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.confirmando.set(false);
    }
  }

  protected async confirmarCandy() {
    const orden = this.ordenEncontrada();
    if (!orden) return;

    this.confirmando.set(true);
    this.mensaje.set(null);
    this.error.set(null);
    try {
      const entregado = await this.ordenesService.marcarCandyEntregado(orden.id);
      this.mensaje.set(
        entregado ? 'Candy entregado.' : 'El candy de esta compra ya había sido entregado antes.',
      );

      if (entregado && this.usuario) {
        const detalle = orden.orden_candy_items
          .map((item) => `${item.cantidad}x ${item.candy_productos.nombre}`)
          .join(', ');
        await this.logsService.registrar(
          this.usuario.id,
          `Validó el QR de la orden #${orden.id}: entregó el candy (${detalle})`,
        );
      }

      await this.recargarOrden();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.confirmando.set(false);
    }
  }

  // Vuelve a traer la compra para que la tarjeta muestre cómo quedó (qué
  // ya se usó y qué falta), y deja el campo listo para el próximo código.
  private async recargarOrden() {
    this.ordenEncontrada.set(await this.ordenesService.buscarPorCodigo(this.codigoBuscado));
    this.codigoControl.reset('');
  }

  protected async activarCamara() {
    this.error.set(null);
    this.camaraActiva.set(true);

    // El <div id="lector-qr"> recién aparece en el DOM cuando Angular
    // procesa el cambio del signal de arriba. Esperamos un tick para que
    // ya esté pintado antes de pedirle a Html5Qrcode que lo use.
    await new Promise((resolve) => setTimeout(resolve, 0));

    this.lector = new Html5Qrcode('lector-qr');
    try {
      await this.lector.start(
        { facingMode: 'environment' }, // cámara trasera si el dispositivo tiene varias
        { fps: 10, qrbox: 250 },
        (codigoDecodificado) => this.onScanExitoso(codigoDecodificado),
        () => {}, // se llama en cada frame sin QR detectado — no es un error, se ignora
      );
    } catch (e) {
      this.error.set('No se pudo acceder a la cámara: ' + (e as Error).message);
      this.camaraActiva.set(false);
    }
  }

  protected async detenerCamara() {
    if (this.lector) {
      try {
        await this.lector.stop();
        this.lector.clear();
      } catch {
        // si ya estaba parada (por ejemplo, tras un error de start), no hay nada que limpiar
      }
      this.lector = null;
    }
    this.camaraActiva.set(false);
  }

  private async onScanExitoso(codigo: string) {
    await this.detenerCamara();
    this.codigoControl.setValue(codigo);
    this.buscar();
  }

  // Si el empleado se va de la pantalla con la cámara prendida, la apagamos
  // igual — si no, el navegador se queda usando la cámara de fondo.
  async ngOnDestroy() {
    await this.detenerCamara();
  }
}
