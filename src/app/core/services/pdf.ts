import { Service } from '@angular/core';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { tipoDeButaca } from './butacas';
import { cargarLogo, registrarTrajan } from './pdf-recursos';

// Una compra entera: todas sus butacas, su candy (puede venir vacío) y el
// único QR que equivale a todo (el de la orden).
export interface DatosCompraPdf {
    pelicula: string;
    sala: string;
    fecha_hora: string;
    formato: string;
    idioma: string;
    restriccion_edad: number | null;
    butacas: string[]; // códigos, ej. ["J5", "R12"]
    candy: { nombre: string; cantidad: number }[];
    codigo_qr: string;
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
    // Un solo PDF de una página con un único QR: equivale a todas las
    // entradas de la compra y también al candy bar.
    async generarCompra(compra: DatosCompraPdf): Promise<void> {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const fuente = await registrarTrajan(doc);
        const logo = await cargarLogo();

        await this.paginaCompra(doc, compra, fuente, logo);

        doc.save('entradas.pdf');
    }

    // ── Páginas ──────────────────────────────────────────────────────────

    private async paginaCompra(
        doc: jsPDF,
        compra: DatosCompraPdf,
        fuente: string,
        logo: string | null,
    ): Promise<void> {
        const hayVip = compra.butacas.some((codigo) => tipoDeButaca(codigo) === 'vip');
        const hayCandy = compra.candy.length > 0;
        const acento = hayVip ? COLOR.oro : COLOR.celeste;
        const fecha = new Date(compra.fecha_hora);

        this.fondoYTarjeta(doc, acento);
        this.encabezado(doc, fuente, logo, 'Tu compra');

        // Título de la película
        let y = 62;
        doc.setFont(fuente, 'normal');
        doc.setFontSize(22);
        doc.setTextColor(...COLOR.alma);
        const lineasTitulo: string[] = doc.splitTextToSize(compra.pelicula.toUpperCase(), 160);
        for (const linea of lineasTitulo.slice(0, 3)) {
            doc.text(linea, CENTRO, y, { align: 'center', charSpace: 0.6 });
            y += 10;
        }

        this.ornamento(doc, y - 2, acento);
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
        this.caja(doc, fuente, xIzq, y, anchoCaja, 'Sala', compra.sala);
        this.caja(
            doc,
            fuente,
            xDer,
            y,
            anchoCaja,
            compra.butacas.length === 1 ? 'Entrada' : 'Entradas',
            String(compra.butacas.length),
            COLOR.oro,
        );
        y += 30;

        // Todas las butacas de la compra, aclarando cuáles son VIP
        const textoButacas = compra.butacas
            .map((codigo) => (tipoDeButaca(codigo) === 'vip' ? `${codigo} (VIP)` : codigo))
            .join('  ·  ');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...COLOR.alma);
        const lineasButacas: string[] = doc.splitTextToSize(
            `${compra.butacas.length === 1 ? 'Butaca' : 'Butacas'}  ${textoButacas}`,
            150,
        );
        for (const linea of lineasButacas) {
            doc.text(linea, CENTRO, y, { align: 'center' });
            y += 6;
        }
        y += 1;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR.tenue);
        doc.text(
            `${compra.formato.toUpperCase()}  ·  ${this.capitalizar(compra.idioma)}`,
            CENTRO,
            y,
            { align: 'center', charSpace: 0.4 },
        );
        y += 6;

        // Si la película tiene restricción de edad, la consigna pide que
        // TODA entrada de esa función lo aclare, sin importar la edad de
        // quien compró — puede ser un adulto comprando para un menor.
        if (compra.restriccion_edad) {
            doc.setFillColor(48, 18, 22);
            doc.setDrawColor(...COLOR.rojo);
            doc.setLineWidth(0.3);
            doc.roundedRect(TARJETA.x + 12, y, TARJETA.ancho - 24, 11, 2, 2, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(255, 170, 170);
            doc.text(
                `+${compra.restriccion_edad}  ·  Apta para mayores de ${compra.restriccion_edad} años. Debe asistir acompañado de un adulto.`,
                CENTRO,
                y + 7,
                { align: 'center' },
            );
            y += 15;
        }

        if (hayCandy) {
            y = this.cajaCandy(doc, fuente, y, compra.candy) + 4;
        }

        // Si la compra es muy larga (muchas butacas + mucho candy) y el QR
        // quedaría demasiado chico para leerlo bien, va solo en otra hoja.
        const espacioParaQr = TARJETA.y + TARJETA.alto - 20 - (y + 12);
        if (espacioParaQr < 50) {
            doc.addPage();
            this.fondoYTarjeta(doc, acento);
            this.encabezado(doc, fuente, logo, 'Tu código');
            y = 46;
        }

        await this.troqueladoYQr(
            doc,
            fuente,
            y + 2,
            compra.codigo_qr,
            hayCandy
                ? 'Presentá este código en la puerta de la sala y en el candy bar'
                : 'Presentá este código en la puerta de la sala',
        );
    }

    // Lista del candy dentro de una caja, en dos columnas si son varios
    // productos para que no le saque lugar al QR. Devuelve dónde termina.
    private cajaCandy(
        doc: jsPDF,
        fuente: string,
        y: number,
        items: { nombre: string; cantidad: number }[],
    ): number {
        const x = TARJETA.x + 12;
        const ancho = TARJETA.ancho - 24;
        const columnas = items.length > 3 ? 2 : 1;
        const anchoColumna = ancho / columnas;
        const filas = Math.ceil(items.length / columnas);
        const alto = 13 + filas * 7;

        doc.setFillColor(...COLOR.caja);
        doc.setDrawColor(...COLOR.borde);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, ancho, alto, 3, 3, 'FD');

        doc.setFont(fuente, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLOR.oro);
        doc.text('CANDY BAR', x + 6, y + 7, { charSpace: 0.8 });

        items.forEach((item, i) => {
            const xItem = x + 6 + (i % columnas) * anchoColumna;
            const yItem = y + 15 + Math.floor(i / columnas) * 7;

            this.rombo(doc, xItem + 1.3, yItem - 1.2, 1.1, COLOR.oro);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...COLOR.oro);
            doc.text(`${item.cantidad}×`, xItem + 5, yItem);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLOR.alma);
            const nombre: string[] = doc.splitTextToSize(item.nombre, anchoColumna - 24);
            doc.text(nombre[0], xItem + 14, yItem);
        });

        return y + alto;
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

    private capitalizar(texto: string): string {
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }
}
