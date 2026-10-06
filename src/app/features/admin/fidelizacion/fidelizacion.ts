import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Fidelizacion as FidelizacionService } from '../../../core/services/fidelizacion';
import { Precios } from '../../../core/services/precios';
import { conRecargoVip } from '../../../core/services/entradas';
import { Auth } from '../../../core/services/auth';
import { Logs } from '../../../core/services/logs';
import IPerfil from '../../../core/interfaces/perfil';
import { LoadingComponent } from '../../../shared/components/loading/loading';
import { GlowHover } from '../../../shared/directives/glow-hover';

// Pantalla de admin para la consigna de fidelización: "Yo como admin quiero
// poder configurar cuántos puntos cuesta cada recompensa". Los puntos de
// cada producto de candy ya se cargan en Alta de candy; acá se configura el
// costo de la ENTRADA gratis, que vive en la tabla fidelizacion_config
// (una sola fila, id = 1). Mismo patrón que la pantalla de Cupones.
@Component({
  selector: 'app-fidelizacion',
  imports: [ReactiveFormsModule, LoadingComponent, GlowHover],
  templateUrl: './fidelizacion.html',
  styleUrl: './fidelizacion.css',
})
export class Fidelizacion {
  private fidelizacionService = inject(FidelizacionService);
  private preciosService = inject(Precios);
  private authService = inject(Auth);
  private logsService = inject(Logs);

  private usuario: IPerfil | null = null;
  // El valor con el que arrancó la pantalla, para loguear el cambio sólo si
  // realmente lo modificó (igual que en Cupones) y mostrar "500 → 600".
  private valorOriginal = 0;

  // Recargo VIP (porcentaje) que configuró el admin en "Precios". Se usa
  // sólo para la vista previa de cuánto cuesta canjear una butaca VIP.
  protected recargoVip = signal(0);

  protected cargando = signal(true);
  protected guardando = signal(false);
  protected mensaje = signal<string | null>(null);
  protected error = signal<string | null>(null);

  // Es un solo campo, así que alcanza con un FormControl suelto (sin
  // FormGroup). min(1): una entrada gratis por 0 puntos no tiene sentido.
  // pattern: sólo números enteros (no se pueden gastar medios puntos).
  protected puntos = new FormControl(0, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
  });
    protected formulario = new FormGroup({ puntos: this.puntos });

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      const [config, precios] = await Promise.all([
        this.fidelizacionService.obtenerConfig(),
        this.preciosService.obtener(),
      ]);
      this.recargoVip.set(precios.recargo_vip);
      this.valorOriginal = config.puntos_por_entrada_gratis;
      this.puntos.setValue(this.valorOriginal);
      this.usuario = await this.authService.usuarioActual();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  // Lo que cuesta en puntos la butaca VIP con el valor que está escrito
  // ahora, para que el admin vea el efecto antes de guardar. Misma cuenta
  // (conRecargoVip) que usa Entradas.costoEntradaEnPuntos() al comprar.
  protected costoVip(): number {
    return conRecargoVip(this.puntos.value, this.recargoVip());
  }

  protected async guardar() {
    this.error.set(null);
    this.mensaje.set(null);

    if (this.puntos.invalid) {
      this.puntos.markAsTouched();
      return;
    }

    const nuevo = this.puntos.value;
    if (nuevo === this.valorOriginal) {
      this.mensaje.set('No hubo cambios para guardar.');
      return;
    }

    this.guardando.set(true);
    try {
      await this.fidelizacionService.actualizarPuntosPorEntrada(nuevo);

      // La consigna pide registrar "quién modificó un precio": el costo en
      // puntos de una recompensa es un precio.
      if (this.usuario) {
        await this.logsService.registrar(
          this.usuario.id,
          `Modificó el costo de la entrada gratis: ${this.valorOriginal} → ${nuevo} puntos`,
        );
      }

      this.valorOriginal = nuevo;
      this.mensaje.set('Costo actualizado correctamente.');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}