import jsPDF from 'jspdf';

// Recursos compartidos por los dos PDF de la app (las entradas del cliente
// y el reporte del admin): la fuente Trajan de la web y el logo del
// caballero. Se descargan una sola vez y quedan en memoria.
let trajanBase64: string | null = null;
let logoDataUrl: string | null = null;

// Registra TrajanPro dentro del PDF. jsPDF sólo acepta .ttf y lo necesita
// en base64. Si falla la descarga devuelve una fuente estándar, para que
// generar el PDF nunca quede bloqueado por esto.
export async function registrarTrajan(doc: jsPDF): Promise<string> {
    try {
        if (!trajanBase64) {
            const respuesta = await fetch('/fonts/TrajanPro-Regular.ttf');
            if (!respuesta.ok) throw new Error('No se pudo cargar la fuente');
            trajanBase64 = aBase64(await respuesta.arrayBuffer());
        }
        doc.addFileToVFS('TrajanPro-Regular.ttf', trajanBase64);
        doc.addFont('TrajanPro-Regular.ttf', 'Trajan', 'normal');
        return 'Trajan';
    } catch {
        return 'times';
    }
}

// knight_face.png como data URL (282×311 px), o null si no se pudo cargar
export async function cargarLogo(): Promise<string | null> {
    if (logoDataUrl) return logoDataUrl;
    try {
        const respuesta = await fetch('/img/knight_face.png');
        if (!respuesta.ok) return null;
        const blob = await respuesta.blob();
        logoDataUrl = await new Promise<string>((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result as string);
            lector.onerror = () => reject(lector.error);
            lector.readAsDataURL(blob);
        });
        return logoDataUrl;
    } catch {
        return null;
    }
}

function aBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binario = '';
    // De a pedazos: String.fromCharCode con millones de argumentos revienta la pila
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binario);
}
