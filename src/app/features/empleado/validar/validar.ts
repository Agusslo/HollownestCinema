    import { Component, inject, signal } from '@angular/core';
    import { DatePipe } from '@angular/common';
    import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
    import { Entradas } from '../../../core/services/entradas';
    import { Ordenes } from '../../../core/services/ordenes';
    import { IEntradaValidacion } from '../../../core/interfaces/entrada';
    import { IOrdenConCandy } from '../../../core/interfaces/orden';

    type Modo = 'entrada' | 'candy';

    @Component({
    selector: 'app-validar',
    imports: [ReactiveFormsModule, DatePipe],
    templateUrl: './validar.html',
    styleUrl: './validar.css',
    })
    export class Validar {
    private entradasService = inject(Entradas);
    private ordenesService = inject(Ordenes);

    protected modo = signal<Modo>('entrada');
    protected codigoControl = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
    });

    protected buscando = signal(false);
    protected confirmando = signal(false);
    protected mensaje = signal<string | null>(null);
    protected error = signal<string | null>(null);

    protected entradaEncontrada = signal<IEntradaValidacion | null>(null);
    protected ordenEncontrada = signal<IOrdenConCandy | null>(null);

    protected elegirModo(modo: Modo) {
        this.modo.set(modo);
        this.limpiarResultado();
    }

    private limpiarResultado() {
        this.entradaEncontrada.set(null);
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
        if (this.modo() === 'entrada') {
            const entrada = await this.entradasService.buscarPorCodigo(codigo);
            if (!entrada) {
            this.error.set('No se encontró ninguna entrada con ese código.');
            } else {
            this.entradaEncontrada.set(entrada);
            }
        } else {
            const orden = await this.ordenesService.buscarPorCodigo(codigo);
            if (!orden) {
            this.error.set('No se encontró ninguna orden con ese código.');
            } else if (orden.orden_candy_items.length === 0) {
            this.error.set('Esta orden no tiene candy para retirar.');
            } else {
            this.ordenEncontrada.set(orden);
            }
        }
        } catch (e) {
        this.error.set((e as Error).message);
        } finally {
        this.buscando.set(false);
        }
    }

    protected async confirmarEntrada() {
        const entrada = this.entradaEncontrada();
        if (!entrada) return;

        this.confirmando.set(true);
        try {
        const validada = await this.entradasService.validar(entrada.id);
        this.mensaje.set(
            validada
            ? 'Entrada validada. Puede pasar a la sala.'
            : 'Esta entrada ya había sido validada antes — no puede volver a usarse.',
        );
        this.entradaEncontrada.set(null);
        this.codigoControl.reset('');
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
        try {
        const entregado = await this.ordenesService.marcarCandyEntregado(orden.id);
        this.mensaje.set(
            entregado
            ? 'Candy entregado.'
            : 'El candy de esta orden ya había sido entregado antes.',
        );
        this.ordenEncontrada.set(null);
        this.codigoControl.reset('');
        } catch (e) {
        this.error.set((e as Error).message);
        } finally {
        this.confirmando.set(false);
        }
    }
    }