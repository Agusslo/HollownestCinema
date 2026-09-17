    import { Component, inject, signal, OnDestroy } from '@angular/core';
    import { DatePipe } from '@angular/common';
    import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
    import { Html5Qrcode } from 'html5-qrcode';
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
    export class Validar implements OnDestroy {
    private entradasService = inject(Entradas);
    private ordenesService = inject(Ordenes);

    // Instancia del lector de cámara. No es un signal porque no se muestra
    // en la plantilla — sólo lo usamos para arrancarlo/pararlo.
    private lector: Html5Qrcode | null = null;
    protected camaraActiva = signal(false);

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