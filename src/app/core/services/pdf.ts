import { Service } from '@angular/core';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

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

@Service()
export class Pdf {
    async generarEntradas(entradas: DatosEntradaPdf[], candy?: DatosCandyPdf): Promise<void> {
        const doc = new jsPDF();

        for (let i = 0; i < entradas.length; i++) { //for loop para poder agregar una nueva página por cada entrada
        const entrada = entradas[i];
        if (i > 0) doc.addPage();

        const qrDataUrl = await QRCode.toDataURL(entrada.codigo_qr);

        doc.setFontSize(20);
        doc.text(entrada.pelicula, 20, 20);

        doc.setFontSize(12);
        doc.text(`Sala: ${entrada.sala}`, 20, 35);
        doc.text(`Fecha y hora: ${new Date(entrada.fecha_hora).toLocaleString('es-AR')}`, 20, 43);
        doc.text(`Formato: ${entrada.formato.toUpperCase()} — Idioma: ${entrada.idioma}`, 20, 51);
        doc.text(`Butaca: ${entrada.fila}${entrada.columna}`, 20, 59);

        // Si la película tiene restricción de edad, la consigna pide que
        // TODA entrada de esa función lo aclare, sin importar la edad de
        // quien compró — puede ser un adulto comprando para un menor.
        if (entrada.restriccion_edad) {
            doc.setFontSize(10);
            doc.setTextColor(180, 30, 30);
            doc.text(
                `Apta para mayores de ${entrada.restriccion_edad} años. Debe asistir acompañado de un adulto.`,
                20,
                67,
            );
            doc.setTextColor(0, 0, 0);
        }

        doc.addImage(qrDataUrl, 'PNG', 20, 78, 60, 60);
        }

        // Página extra sólo si la compra incluyó candy bar — el QR acá es el
        // de la ORDEN completa (distinto al de cada entrada), y es el que
        // hay que mostrar en el mostrador para retirar el pedido.
        if (candy && candy.items.length > 0) {
            doc.addPage();

            const qrCandy = await QRCode.toDataURL(candy.codigo_qr);

            doc.setFontSize(20);
            doc.text('Comprobante de Candy Bar', 20, 20);

            doc.setFontSize(12);
            doc.text('Presentá este código en el mostrador para retirar tu pedido:', 20, 35);

            let y = 50;
            for (const item of candy.items) {
                doc.text(`${item.cantidad}x ${item.nombre}`, 20, y);
                y += 8;
            }

            doc.addImage(qrCandy, 'PNG', 20, y + 10, 60, 60);
        }

        doc.save('entradas.pdf');
    }
}