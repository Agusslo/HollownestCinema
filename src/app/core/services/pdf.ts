import { Service } from '@angular/core';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { tipoDeButaca } from './butacas';

export interface DatosEntradaPdf {
    pelicula: string;
    sala: string;
    fecha_hora: string;
    formato: string;
    idioma: string;
    fila: string;
    columna: number;
    codigo_qr: string;
    restriccion_edad: number | null;
}

export interface DatosCandyPdf {
    codigo_qr: string;
    items: { nombre: string; cantidad: number }[];
}

type RGB = [number, number, number];

// Misma paleta que styles.css (--hk-void, --hk-focus, --hk-geo, …)
const COLOR = {
    fondo: [10, 10, 18] as RGB,
    tarjeta: [22, 22, 40] as RGB,
    caja: [14, 14, 28] as RGB,
    celeste: [79, 196, 227] as RGB,
    oro: [232, 168, 50] as RGB,
    alma: [232, 232, 240] as RGB,
    tenue: [150, 150, 172] as RGB,
    borde: [52, 60, 84] as RGB,
    rojo: [192, 57, 43] as RGB,
};

// Hoja A4 y la tarjeta del ticket dentro de ella (en mm)
const HOJA = { ancho: 210, alto: 297 };
const TARJETA = { x: 15, y: 15, ancho: 180, alto: 267 };
const CENTRO = HOJA.ancho / 2;

@Service()
export class Pdf {
    // La fuente y el logo se descargan una sola vez y quedan cacheados
    private trajanBase64: string | null = null;
    private logoDataUrl: string | null = null;

    async generarEntradas(entradas: DatosEntradaPdf[], candy?: DatosCandyPdf): Promise<void> {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const fuente = await this.registrarTrajan(doc);
        const logo = await this.cargarLogo();

        for (let i = 0; i < entradas.length; i++) {
            if (i > 0) doc.addPage();
            await this.paginaEntrada(doc, entradas[i], i + 1, entradas.length, fuente, logo);
        }

        // Página extra sólo si la compra incluyó candy bar — el QR acá es el
        // de la ORDEN completa (distinto al de cada entrada), y es el que
        // hay que mostrar en el mostrador para retirar el pedido.
        if (candy && candy.items.length > 0) {
            doc.addPage();
            await this.paginaCandy(doc, candy, fuente, logo);
        }

        doc.save('entradas.pdf');
    }

    // ── Páginas ──────────────────────────────────────────────────────────

    private async paginaEntrada(
        doc: jsPDF,
        entrada: DatosEntradaPdf,
        numero: number,
        total: number,
        fuente: string,
        logo: string | null,
    ): Promise<void> {
        const butaca = `${entrada.fila}${entrada.columna}`;
        const esVip = tipoDeButaca(butaca) === 'vip';
        const fecha = new Date(entrada.fecha_hora);

        this.fondoYTarjeta(doc, esVip ? COLOR.oro : COLOR.celeste);
        this.encabezado(doc, fuente, logo, total > 1 ? `Entrada ${numero} de ${total}` : 'Entrada');

        // Título de la película
        let y = 62;
        doc.setFont(fuente, 'normal');
        doc.setFontSize(22);
        doc.setTextColor(...COLOR.alma);
        const lineasTitulo: string[] = doc.splitTextToSize(entrada.pelicula.toUpperCase(), 160);
        for (const linea of lineasTitulo.slice(0, 3)) {
            doc.text(linea, CENTRO, y, { align: 'center', charSpace: 0.6 });
            y += 10;
        }

        this.ornamento(doc, y - 2, esVip ? COLOR.oro : COLOR.celeste);
        y += 6;

        // Datos en cajas de 2 columnas
        const anchoCaja = 82;
        const xIzq = CENTRO - anchoCaja - 3;
        const xDer = CENTRO + 3;
        this.caja(doc, fuente, xIzq, y, anchoCaja, 'Fecha', this.capitalizar(
            fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
        ));
        this.caja(doc, fuente, xDer, y, anchoCaja, 'Hora', fecha.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }), COLOR.oro);
        y += 26;
        this.caja(doc, fuente, xIzq, y, anchoCaja, 'Sala', entrada.sala);
        this.caja(doc, fuente, xDer, y, anchoCaja, esVip ? 'Butaca VIP' : 'Butaca', butaca, COLOR.oro);
        y += 30;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR.tenue);
        doc.text(
            `${entrada.formato.toUpperCase()}  ·  ${this.capitalizar(entrada.idioma)}`,
            CENTRO,
            y,
            { align: 'center', charSpace: 0.4 },
        );
        y += 6;

        // Si la película tiene restricción de edad, la consigna pide que
        // TODA entrada de esa función lo aclare, sin importar la edad de
        // quien compró — puede ser un adulto comprando para un menor.
        if (entrada.restriccion_edad) {
            doc.setFillColor(48, 18, 22);
            doc.setDrawColor(...COLOR.rojo);
            doc.setLineWidth(0.3);
            doc.roundedRect(TARJETA.x + 12, y, TARJETA.ancho - 24, 11, 2, 2, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(255, 170, 170);
            doc.text(
                `+${entrada.restriccion_edad}  ·  Apta para mayores de ${entrada.restriccion_edad} años. Debe asistir acompañado de un adulto.`,
                CENTRO,
                y + 7,
                { align: 'center' },
            );
            y += 15;
        }

        await this.troqueladoYQr(
            doc,
            fuente,
            y + 2,
            entrada.codigo_qr,
            'Presentá este código en la puerta de la sala',
        );
    }

    private async paginaCandy(
        doc: jsPDF,
        candy: DatosCandyPdf,
        fuente: string,
        logo: string | null,
    ): Promise<void> {
        this.fondoYTarjeta(doc, COLOR.oro);
        this.encabezado(doc, fuente, logo, 'Candy bar');

        let y = 64;
        doc.setFont(fuente, 'normal');
        doc.setFontSize(22);
        doc.setTextColor(...COLOR.alma);
        doc.text('TU PEDIDO', CENTRO, y, { align: 'center', charSpace: 0.6 });
        y += 8;
        this.ornamento(doc, y, COLOR.oro);
        y += 8;

        // Lista de productos dentro de una caja
        const altoLista = 10 + candy.items.length * 8;
        doc.setFillColor(...COLOR.caja);
        doc.setDrawColor(...COLOR.borde);
        doc.setLineWidth(0.3);
        doc.roundedRect(TARJETA.x + 20, y, TARJETA.ancho - 40, altoLista, 3, 3, 'FD');

        let yItem = y + 10;
        for (const item of candy.items) {
            this.rombo(doc, TARJETA.x + 30, yItem - 1.3, 1.3, COLOR.oro);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...COLOR.oro);
            doc.text(`${item.cantidad}×`, TARJETA.x + 35, yItem);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLOR.alma);
            doc.text(item.nombre, TARJETA.x + 46, yItem);
            yItem += 8;
        }
        y += altoLista + 6;

        await this.troqueladoYQr(
            doc,
            fuente,
            y,
            candy.codigo_qr,
            'Presentá este código en el mostrador para retirar tu pedido',
        );
    }

    // ── Piezas de diseño ─────────────────────────────────────────────────

    private fondoYTarjeta(doc: jsPDF, acento: RGB): void {
        doc.setFillColor(...COLOR.fondo);
        doc.rect(0, 0, HOJA.ancho, HOJA.alto, 'F');

        doc.setFillColor(...COLOR.tarjeta);
        doc.setDrawColor(...acento);
        doc.setLineWidth(0.5);
        doc.roundedRect(TARJETA.x, TARJETA.y, TARJETA.ancho, TARJETA.alto, 5, 5, 'FD');

        // Filo de luz arriba de la tarjeta
        doc.setDrawColor(...acento);
        doc.setLineWidth(0.9);
        doc.line(TARJETA.x + 30, TARJETA.y + 0.4, TARJETA.x + TARJETA.ancho - 30, TARJETA.y + 0.4);
    }

    private encabezado(doc: jsPDF, fuente: string, logo: string | null, etiqueta: string): void {
        const yBase = TARJETA.y + 16;

        if (logo) {
            // knight_face.png es 282×311 → mantenemos la proporción
            doc.addImage(logo, 'PNG', TARJETA.x + 12, yBase - 10, 12, 13.2);
        }

        doc.setFont(fuente, 'normal');
        doc.setFontSize(14);
        doc.setTextColor(...COLOR.alma);
        doc.text('HOLLOWNEST CINEMA', TARJETA.x + (logo ? 28 : 12), yBase, { charSpace: 0.8 });

        doc.setFontSize(8);
        doc.setTextColor(...COLOR.celeste);
        doc.text(etiqueta.toUpperCase(), TARJETA.x + TARJETA.ancho - 12, yBase, {
            align: 'right',
            charSpace: 0.8,
        });

        doc.setDrawColor(...COLOR.borde);
        doc.setLineWidth(0.3);
        doc.line(TARJETA.x + 12, yBase + 8, TARJETA.x + TARJETA.ancho - 12, yBase + 8);
    }

    // ──── ◆ ────
    private ornamento(doc: jsPDF, y: number, color: RGB): void {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.3);
        doc.line(CENTRO - 32, y, CENTRO - 5, y);
        doc.line(CENTRO + 5, y, CENTRO + 32, y);
        this.rombo(doc, CENTRO, y, 1.8, color);
    }

    private rombo(doc: jsPDF, x: number, y: number, r: number, color: RGB): void {
        doc.setFillColor(...color);
        // Arranca arriba y recorre derecha → abajo → izquierda
        doc.lines(
            [
                [r, r],
                [-r, r],
                [-r, -r],
            ],
            x,
            y - r,
            [1, 1],
            'F',
            true,
        );
    }

    private caja(
        doc: jsPDF,
        fuente: string,
        x: number,
        y: number,
        ancho: number,
        etiqueta: string,
        valor: string,
        colorValor: RGB = COLOR.alma,
    ): void {
        doc.setFillColor(...COLOR.caja);
        doc.setDrawColor(...COLOR.borde);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, ancho, 22, 3, 3, 'FD');

        doc.setFont(fuente, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLOR.celeste);
        doc.text(etiqueta.toUpperCase(), x + 6, y + 7, { charSpace: 0.8 });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(colorValor === COLOR.oro ? 17 : 12.5);
        doc.setTextColor(...colorValor);
        const texto: string[] = doc.splitTextToSize(valor, ancho - 12);
        doc.text(texto[0], x + 6, y + 16.5);
    }

    // Línea troquelada con muescas (como un ticket de verdad) y debajo el QR
    // grande sobre fondo blanco, que es lo que mejor leen los lectores.
    private async troqueladoYQr(
        doc: jsPDF,
        fuente: string,
        y: number,
        codigo: string,
        instruccion: string,
    ): Promise<void> {
        doc.setDrawColor(...COLOR.borde);
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(TARJETA.x + 8, y, TARJETA.x + TARJETA.ancho - 8, y);
        doc.setLineDashPattern([], 0);
        doc.setFillColor(...COLOR.fondo);
        doc.circle(TARJETA.x, y, 5, 'F');
        doc.circle(TARJETA.x + TARJETA.ancho, y, 5, 'F');

        // El QR ocupa todo el alto que queda (hasta ~105 mm)
        const piso = TARJETA.y + TARJETA.alto - 20;
        const lado = Math.min(105, piso - (y + 10));
        const xQr = CENTRO - lado / 2;
        const yQr = y + 9;

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(xQr - 4, yQr - 4, lado + 8, lado + 8, 4, 4, 'F');
        const qr = await QRCode.toDataURL(codigo, {
            width: 900,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#0a0a12', light: '#ffffff' },
        });
        doc.addImage(qr, 'PNG', xQr, yQr, lado, lado);

        const yTexto = yQr + lado + 11;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR.alma);
        doc.text(instruccion, CENTRO, yTexto, { align: 'center' });

        doc.setFont(fuente, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLOR.tenue);
        doc.text(`CÓDIGO ${codigo.slice(0, 8).toUpperCase()}`, CENTRO, yTexto + 6, {
            align: 'center',
            charSpace: 1,
        });
    }

    // ── Recursos ─────────────────────────────────────────────────────────

    // Registra TrajanPro (la misma fuente de la web) dentro del PDF. jsPDF
    // sólo acepta .ttf y lo necesita en base64. Si falla la descarga,
    // seguimos con una fuente estándar para no bloquear la compra.
    private async registrarTrajan(doc: jsPDF): Promise<string> {
        try {
            if (!this.trajanBase64) {
                const respuesta = await fetch('/fonts/TrajanPro-Regular.ttf');
                if (!respuesta.ok) throw new Error('No se pudo cargar la fuente');
                this.trajanBase64 = this.aBase64(await respuesta.arrayBuffer());
            }
            doc.addFileToVFS('TrajanPro-Regular.ttf', this.trajanBase64);
            doc.addFont('TrajanPro-Regular.ttf', 'Trajan', 'normal');
            return 'Trajan';
        } catch {
            return 'times';
        }
    }

    private async cargarLogo(): Promise<string | null> {
        if (this.logoDataUrl) return this.logoDataUrl;
        try {
            const respuesta = await fetch('/img/knight_face.png');
            if (!respuesta.ok) return null;
            const blob = await respuesta.blob();
            this.logoDataUrl = await new Promise<string>((resolve, reject) => {
                const lector = new FileReader();
                lector.onload = () => resolve(lector.result as string);
                lector.onerror = () => reject(lector.error);
                lector.readAsDataURL(blob);
            });
            return this.logoDataUrl;
        } catch {
            return null;
        }
    }

    private aBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binario = '';
        // De a pedazos: String.fromCharCode con millones de argumentos revienta la pila
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binario);
    }

    private capitalizar(texto: string): string {
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }
}
