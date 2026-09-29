import { Service } from '@angular/core';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import IFacturacionDiaria, { IReporteMasVistas, ICandyMasVendido } from '../interfaces/reporte';
import { cargarLogo, registrarTrajan } from './pdf-recursos';

// Lo que necesita este service para armar los dos archivos: exactamente
// los mismos tres reportes que ya carga la pantalla de administración. No
// se vuelve a consultar la base acá — se exporta lo que ya está en
// pantalla, tal cual lo está viendo el admin en ese momento.
export interface IDatosExportarReportes {
    facturacion: IFacturacionDiaria[];
    masVistas: IReporteMasVistas;
    candyMasVendido: ICandyMasVendido[];
}

interface IFilaRanking {
    nombre: string;
    cantidad: number;
}

type RGB = [number, number, number];

// Hoja A4 en mm
const HOJA = { ancho: 210, alto: 297 };
const MARGEN = 15;
const ANCHO_UTIL = HOJA.ancho - MARGEN * 2; // 180
const LIMITE_INFERIOR = HOJA.alto - 22; // deja lugar para el pie de página

// Paleta del reporte: fondo blanco (se imprime), con los acentos de la web.
// El dorado de las barras es el mismo validado para el modo claro en pantalla.
const COLOR = {
    insignia: [24, 26, 46] as RGB, // fondo del escudito del logo
    celeste: [22, 141, 168] as RGB,
    oro: [166, 111, 28] as RGB,
    tinta: [20, 28, 36] as RGB,
    texto: [45, 55, 64] as RGB,
    tenue: [96, 106, 116] as RGB,
    linea: [226, 230, 235] as RGB,
    caja: [255, 255, 255] as RGB,
    encabezadoTabla: [243, 246, 248] as RGB,
    cebra: [249, 250, 251] as RGB,
    pista: [234, 237, 241] as RGB,
    destacado: [254, 248, 236] as RGB,
};

@Service()
export class ExportacionReportes {
    // ── PDF ──────────────────────────────────────────────────────────────
    // Reporte en fondo blanco, pensado para imprimir o adjuntar por mail —
    // no reutiliza el diseño de Pdf.generarEntradas() a propósito: ese es un
    // ticket para el cliente (fondo oscuro, QR), esto es una planilla para
    // el admin. Lo que sí comparten es la identidad (fuente Trajan, logo y
    // colores), que viene de pdf-recursos.ts.
    async exportarPdf(datos: IDatosExportarReportes): Promise<void> {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const fuente = await registrarTrajan(doc);
        const logo = await cargarLogo();

        let y = this.encabezado(doc, fuente, logo);
        y = this.resumen(doc, fuente, y, datos.facturacion);
        y = this.tablaFacturacion(doc, fuente, y, datos.facturacion);

        // Los dos rankings de películas, uno al lado del otro
        y = this.tituloSeccion(doc, fuente, this.asegurarEspacio(doc, y, 60), 'Películas más vistas');
        const anchoMitad = (ANCHO_UTIL - 6) / 2;
        const finSemana = this.ranking(doc, fuente, MARGEN, y, anchoMitad, 'Última semana', datos.masVistas.semana, 'entradas');
        const finMes = this.ranking(doc, fuente, MARGEN + anchoMitad + 6, y, anchoMitad, 'Último mes', datos.masVistas.mes, 'entradas');
        y = Math.max(finSemana, finMes) + 10;

        y = this.tituloSeccion(doc, fuente, this.asegurarEspacio(doc, y, 50), 'Candy bar');
        this.ranking(doc, fuente, MARGEN, y, ANCHO_UTIL, 'Más vendidos', datos.candyMasVendido, 'unidades');

        this.piesDePagina(doc);
        doc.save(`reporte-hollownest-${this.fechaParaNombreDeArchivo()}.pdf`);
    }

    // Encabezado claro: logo en un escudito oscuro (el caballero es blanco
    // y sobre la hoja blanca no se vería), nombre del cine y la fecha.
    // Devuelve el "y" (en mm) donde puede arrancar el contenido de abajo.
    private encabezado(doc: jsPDF, fuente: string, logo: string | null): number {
        const xTexto = logo ? MARGEN + 17 : MARGEN;
        if (logo) {
            doc.setFillColor(...COLOR.insignia);
            doc.roundedRect(MARGEN, 12, 13, 13, 3, 3, 'F');
            doc.addImage(logo, 'PNG', MARGEN + 2.4, 13.4, 8.2, 9);
        }

        doc.setFont(fuente, 'normal');
        doc.setFontSize(17);
        doc.setTextColor(...COLOR.tinta);
        doc.text('HOLLOWNEST CINEMA', xTexto, 19.5, { charSpace: 0.3 });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...COLOR.tenue);
        doc.text('Reporte de administración', xTexto, 25);

        const ahora = new Date();
        doc.setFontSize(8.5);
        doc.text('Generado el', HOJA.ancho - MARGEN, 18.5, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...COLOR.tinta);
        doc.text(
            `${ahora.toLocaleDateString('es-AR')} · ${ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`,
            HOJA.ancho - MARGEN,
            24,
            { align: 'right' },
        );

        // Filo celeste debajo del encabezado
        doc.setDrawColor(...COLOR.celeste);
        doc.setLineWidth(0.6);
        doc.line(MARGEN, 31, MARGEN + ANCHO_UTIL, 31);

        return 42;
    }

    // Fila de 4 números clave arriba de todo, como en la pantalla
    private resumen(doc: jsPDF, fuente: string, y: number, facturacion: IFacturacionDiaria[]): number {
        const totalFacturado = facturacion.reduce((t, f) => t + f.montoFacturado, 0);
        const totalEntradas = facturacion.reduce((t, f) => t + f.entradasVendidas, 0);
        const promedio = totalEntradas > 0 ? Math.round(totalFacturado / totalEntradas) : 0;
        const mejor = this.mejorDia(facturacion);

        const tarjetas: { etiqueta: string; valor: string; detalle: string; acento: RGB }[] = [
            { etiqueta: 'Facturado', valor: this.pesos(totalFacturado), detalle: `${facturacion.length} días`, acento: COLOR.oro },
            { etiqueta: 'Entradas', valor: totalEntradas.toLocaleString('es-AR'), detalle: 'vendidas', acento: COLOR.celeste },
            { etiqueta: 'Promedio', valor: this.pesos(promedio), detalle: 'por entrada', acento: COLOR.celeste },
            {
                etiqueta: 'Mejor día',
                valor: mejor ? this.formatearFecha(mejor.fecha).slice(0, 5) : '—',
                detalle: mejor ? this.pesos(mejor.montoFacturado) : 'sin ventas',
                acento: COLOR.oro,
            },
        ];

        const separacion = 4;
        const ancho = (ANCHO_UTIL - separacion * 3) / 4;
        const alto = 24;
        tarjetas.forEach((tarjeta, i) => {
            const x = MARGEN + i * (ancho + separacion);
            doc.setFillColor(...COLOR.caja);
            doc.setDrawColor(...COLOR.linea);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'FD');
            // Filo de color arriba de cada tarjeta
            doc.setDrawColor(...tarjeta.acento);
            doc.setLineWidth(0.9);
            doc.line(x + 4, y + 0.4, x + ancho - 4, y + 0.4);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...tarjeta.acento);
            doc.text(tarjeta.etiqueta.toUpperCase(), x + 5, y + 7.5, { charSpace: 0.2 });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...COLOR.tinta);
            doc.text(tarjeta.valor, x + 5, y + 15);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...COLOR.tenue);
            doc.text(tarjeta.detalle, x + 5, y + 20.5);
        });

        return y + alto + 12;
    }

    // Tabla de facturación con barra por día (relativa al mejor día), el
    // mejor día resaltado y la fila de total al final.
    private tablaFacturacion(doc: jsPDF, fuente: string, y: number, facturacion: IFacturacionDiaria[]): number {
        y = this.tituloSeccion(doc, fuente, y, 'Facturación diaria');

        if (facturacion.length === 0) {
            return this.sinDatos(doc, y);
        }

        const mejor = this.mejorDia(facturacion);
        const maximo = mejor?.montoFacturado ?? 0;
        const col = { fecha: MARGEN + 3, monto: MARGEN + 88, barra: MARGEN + 94, anchoBarra: 56, entradas: MARGEN + ANCHO_UTIL - 3 };
        const altoFila = 7.5;

        const encabezadoColumnas = (yCol: number): number => {
            doc.setFillColor(...COLOR.encabezadoTabla);
            doc.rect(MARGEN, yCol, ANCHO_UTIL, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...COLOR.tenue);
            doc.text('FECHA', col.fecha, yCol + 5.3, { charSpace: 0.2 });
            this.textoDerecha(doc, 'MONTO FACTURADO', col.monto, yCol + 5.3, 0.2);
            this.textoDerecha(doc, 'ENTRADAS', col.entradas, yCol + 5.3, 0.2);
            return yCol + 8;
        };

        y = encabezadoColumnas(y);

        facturacion.forEach((fila, i) => {
            if (y + altoFila > LIMITE_INFERIOR) {
                doc.addPage();
                y = encabezadoColumnas(20);
            }

            const esMejor = mejor?.fecha === fila.fecha;
            if (esMejor || i % 2 === 1) {
                doc.setFillColor(...(esMejor ? COLOR.destacado : COLOR.cebra));
                doc.rect(MARGEN, y, ANCHO_UTIL, altoFila, 'F');
            }
            const yTexto = y + 5.1;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...COLOR.tenue);
            doc.text(this.diaSemana(fila.fecha), col.fecha, yTexto);
            doc.setFontSize(9.5);
            doc.setTextColor(...COLOR.texto);
            doc.text(this.formatearFecha(fila.fecha), col.fecha + 9, yTexto);
            if (esMejor) {
                this.rombo(doc, col.fecha + 38, yTexto - 1.2, 1.1, COLOR.oro);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(...COLOR.oro);
                doc.text('MEJOR DÍA', col.fecha + 40.5, yTexto - 0.2);
            }

            doc.setFont('helvetica', esMejor ? 'bold' : 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(...COLOR.tinta);
            doc.text(this.pesos(fila.montoFacturado), col.monto, yTexto, { align: 'right' });

            this.barra(doc, col.barra, y + altoFila / 2 - 1.1, col.anchoBarra, maximo > 0 ? fila.montoFacturado / maximo : 0);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLOR.texto);
            doc.text(String(fila.entradasVendidas), col.entradas, yTexto, { align: 'right' });

            y += altoFila;
        });

        // Total
        const totalFacturado = facturacion.reduce((t, f) => t + f.montoFacturado, 0);
        const totalEntradas = facturacion.reduce((t, f) => t + f.entradasVendidas, 0);
        doc.setDrawColor(...COLOR.oro);
        doc.setLineWidth(0.5);
        doc.line(MARGEN, y + 1, MARGEN + ANCHO_UTIL, y + 1);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLOR.oro);
        doc.text('TOTAL', col.fecha, y + 7.5, { charSpace: 0.2 });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...COLOR.tinta);
        doc.text(this.pesos(totalFacturado), col.monto, y + 7.5, { align: 'right' });
        doc.text(totalEntradas.toLocaleString('es-AR'), col.entradas, y + 7.5, { align: 'right' });

        return y + 20;
    }

    // Un ranking (películas o candy) dentro de una tarjeta: posición,
    // nombre completo, cantidad y barra relativa al primero de la lista.
    // Devuelve el "y" donde termina la tarjeta.
    private ranking(
        doc: jsPDF,
        fuente: string,
        x: number,
        y: number,
        ancho: number,
        titulo: string,
        filas: IFilaRanking[],
        unidad: string,
    ): number {
        const padding = 5;
        const anchoTexto = ancho - padding * 2 - 18;

        // Primero medimos cuánto va a ocupar, para dibujar la tarjeta detrás
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lineasPorFila = filas.map((f) => doc.splitTextToSize(this.titulo(f.nombre), anchoTexto) as string[]);
        const altoFilas = lineasPorFila.reduce((t, lineas) => t + lineas.length * 4 + 6, 0);
        const alto = 14 + (filas.length === 0 ? 8 : altoFilas) + 2;

        doc.setFillColor(...COLOR.caja);
        doc.setDrawColor(...COLOR.linea);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLOR.celeste);
        doc.text(titulo.toUpperCase(), x + padding, y + 8, { charSpace: 0.2 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLOR.tenue);
        doc.text(unidad, x + ancho - padding, y + 8, { align: 'right' });

        let yFila = y + 15;
        if (filas.length === 0) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.text('Sin datos en este período.', x + padding, yFila + 2);
            return y + alto;
        }

        const maximo = filas[0].cantidad;
        filas.forEach((fila, i) => {
            const lineas = lineasPorFila[i];

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...(i === 0 ? COLOR.oro : COLOR.tenue));
            doc.text(String(i + 1), x + padding, yFila);

            doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...COLOR.tinta);
            doc.text(lineas, x + padding + 6, yFila);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(String(fila.cantidad), x + ancho - padding, yFila, { align: 'right' });

            const yBarra = yFila + (lineas.length - 1) * 4 + 1.8;
            this.barra(doc, x + padding + 6, yBarra, ancho - padding * 2 - 6, maximo > 0 ? fila.cantidad / maximo : 0);

            yFila += lineas.length * 4 + 6;
        });

        return y + alto;
    }

    // ── Piezas de diseño ─────────────────────────────────────────────────

    // Título de sección: ◆ TEXTO ─────────────
    private tituloSeccion(doc: jsPDF, fuente: string, y: number, texto: string): number {
        this.rombo(doc, MARGEN + 1.5, y - 1.3, 1.5, COLOR.celeste);
        doc.setFont(fuente, 'normal');
        doc.setFontSize(12);
        doc.setTextColor(...COLOR.tinta);
        doc.text(texto.toUpperCase(), MARGEN + 6, y, { charSpace: 0.3 });
        const anchoTexto = doc.getTextWidth(texto.toUpperCase()) + texto.length * 0.3;
        doc.setDrawColor(...COLOR.linea);
        doc.setLineWidth(0.3);
        doc.line(MARGEN + 10 + anchoTexto, y - 1.3, MARGEN + ANCHO_UTIL, y - 1.3);
        return y + 7;
    }

    // Texto alineado a la derecha CON letter-spacing: jsPDF no suma el
    // charSpace al calcular el align 'right' y el texto se pasa del borde,
    // así que lo ubicamos a mano desde su ancho real.
    private textoDerecha(doc: jsPDF, texto: string, xDerecha: number, y: number, charSpace: number): void {
        const ancho = doc.getTextWidth(texto) + charSpace * (texto.length - 1);
        doc.text(texto, xDerecha - ancho, y, { charSpace });
    }

    // Barra fina con extremo redondeado sobre una pista gris
    private barra(doc: jsPDF, x: number, y: number, ancho: number, proporcion: number): void {
        const alto = 2.2;
        doc.setFillColor(...COLOR.pista);
        doc.roundedRect(x, y, ancho, alto, 1.1, 1.1, 'F');
        const relleno = Math.max(0, Math.min(1, proporcion)) * ancho;
        if (relleno > 0) {
            doc.setFillColor(...COLOR.oro);
            doc.roundedRect(x, y, Math.max(relleno, alto), alto, 1.1, 1.1, 'F');
        }
    }

    private rombo(doc: jsPDF, x: number, y: number, r: number, color: RGB): void {
        doc.setFillColor(...color);
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

    private sinDatos(doc: jsPDF, y: number): number {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...COLOR.tenue);
        doc.text('Sin datos.', MARGEN, y + 2);
        return y + 14;
    }

    // Si lo que viene no entra en la hoja actual, arranca una nueva
    private asegurarEspacio(doc: jsPDF, y: number, altoNecesario: number): number {
        if (y + altoNecesario > LIMITE_INFERIOR) {
            doc.addPage();
            return 22;
        }
        return y;
    }

    // Pie en todas las hojas: nombre del reporte y "Página x de n"
    private piesDePagina(doc: jsPDF): void {
        const total = doc.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
            doc.setPage(i);
            const y = HOJA.alto - 12;
            doc.setDrawColor(...COLOR.linea);
            doc.setLineWidth(0.3);
            doc.line(MARGEN, y - 4, MARGEN + ANCHO_UTIL, y - 4);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...COLOR.tenue);
            doc.text('Hollownest Cinema · Reporte de administración', MARGEN, y);
            doc.text(`Página ${i} de ${total}`, MARGEN + ANCHO_UTIL, y, { align: 'right' });
        }
    }

    // ── Excel ────────────────────────────────────────────────────────────
    // Un libro con 4 hojas, una por reporte, así en Excel cada tabla se
    // puede ordenar/filtrar por separado sin pisar a las demás.
    exportarExcel(datos: IDatosExportarReportes): void {
        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            libro,
            XLSX.utils.json_to_sheet(
                datos.facturacion.map((fila) => ({
                    Fecha: this.formatearFecha(fila.fecha),
                    'Monto facturado': fila.montoFacturado,
                    'Entradas vendidas': fila.entradasVendidas,
                })),
            ),
            'Facturación diaria',
        );

        XLSX.utils.book_append_sheet(
            libro,
            XLSX.utils.json_to_sheet(
                datos.masVistas.semana.map((fila) => ({ Película: fila.nombre, Entradas: fila.cantidad })),
            ),
            'Más vistas - semana',
        );

        XLSX.utils.book_append_sheet(
            libro,
            XLSX.utils.json_to_sheet(
                datos.masVistas.mes.map((fila) => ({ Película: fila.nombre, Entradas: fila.cantidad })),
            ),
            'Más vistas - mes',
        );

        XLSX.utils.book_append_sheet(
            libro,
            XLSX.utils.json_to_sheet(
                datos.candyMasVendido.map((fila) => ({ Producto: fila.nombre, Unidades: fila.cantidad })),
            ),
            'Candy bar',
        );

        XLSX.writeFile(libro, `reporte-hollownest-${this.fechaParaNombreDeArchivo()}.xlsx`);
    }

    // ── Compartido ───────────────────────────────────────────────────────

    private mejorDia(facturacion: IFacturacionDiaria[]): IFacturacionDiaria | null {
        if (facturacion.length === 0) return null;
        const mejor = facturacion.reduce((max, f) => (f.montoFacturado > max.montoFacturado ? f : max));
        return mejor.montoFacturado > 0 ? mejor : null;
    }

    private pesos(monto: number): string {
        return `$${monto.toLocaleString('es-AR')}`;
    }

    // "spiderman across the spiderverse" → "Spiderman Across The Spiderverse",
    // igual que en pantalla (varios nombres están guardados en minúscula)
    private titulo(texto: string): string {
        return texto.replace(/(^|\s)(\p{L})/gu, (_, espacio: string, letra: string) => espacio + letra.toUpperCase());
    }

    // "2026-09-26" → "26/09/2026". Reformateamos el string a mano, sin pasar
    // por `new Date(...)`: un string sin hora como "2026-09-26" Date lo
    // interpreta como medianoche UTC, y en un huso horario negativo (como
    // Argentina) eso puede terminar mostrando el día anterior. Partiendo el
    // string nosotros mismos nos evitamos ese problema por completo.
    private formatearFecha(fecha: string): string {
        return fecha.split('-').reverse().join('/');
    }

    // "2026-09-26" → "vie". Mismo cuidado que arriba: armamos la fecha con
    // año/mes/día locales en vez de parsear el string como UTC.
    private diaSemana(fecha: string): string {
        const [anio, mes, dia] = fecha.split('-').map(Number);
        return new Date(anio, mes - 1, dia)
            .toLocaleDateString('es-AR', { weekday: 'short' })
            .replace('.', '');
    }

    private fechaParaNombreDeArchivo(): string {
        return new Date().toISOString().slice(0, 10);
    }
}
