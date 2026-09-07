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
}

@Service()
export class Pdf {
    async generarEntradas(entradas: DatosEntradaPdf[]): Promise<void> {
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

        doc.addImage(qrDataUrl, 'PNG', 20, 70, 60, 60);
        }

        doc.save('entradas.pdf');
    }
}