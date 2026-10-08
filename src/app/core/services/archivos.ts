    import { Service, inject } from '@angular/core';
    import { AbstractControl, ValidationErrors } from '@angular/forms';
    import { Supabase } from './supabase';

    // Bucket público de Supabase Storage donde se guardan las imágenes: los
    // pósters en la raíz y las fotos de los productos en la carpeta productos/.
    export const BUCKET_IMAGENES = 'posters';

    // Los mismos formatos y tamaño máximo que tiene configurados el bucket: si
    // el archivo no cumple, se avisa antes de subirlo (si no, Supabase lo
    // rechazaría igual, pero con un error menos claro).
    export const FORMATOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
    export const TAMANIO_MAXIMO_MB = 5;

    // Validador para un FormControl<File | null> con una imagen (el póster de
    // una película o la foto de un producto). Si no hay archivo devuelve null
    // y de ese caso se encarga Validators.required.
    export function validarImagen(control: AbstractControl<File | null>): ValidationErrors | null {
    const archivo = control.value;
    if (!archivo) return null;
    if (!FORMATOS_IMAGEN.includes(archivo.type)) return { formatoImagen: true };
    if (archivo.size > TAMANIO_MAXIMO_MB * 1024 * 1024) return { tamanioImagen: true };
    return null;
    }

    // Lo que devuelve una subida: la ruta del archivo dentro del bucket (para
    // poder borrarlo) y la URL pública (la que se guarda en la base de datos).
    export interface IArchivoSubido {
    ruta: string;
    url: string;
    }

    // Subida de archivos a Supabase Storage (mismo patrón que vimos en la
    // clase de Storage). Los archivos van a un bucket y en la tabla se guarda
    // sólo la URL, como texto: la base de datos no guarda imágenes.
    @Service()
    export class Archivos {
    private supabase = inject(Supabase);

    // carpeta es opcional: sin ella el archivo queda en la raíz del bucket
    // (como los pósters); con ella, por ejemplo 'productos/abc.jpg'.
    async subirImagen(bucket: string, archivo: File, carpeta?: string): Promise<IArchivoSubido> {
        // Nombre único para cada archivo: con Date.now() dos subidas en el
        // mismo milisegundo pisarían una a la otra; randomUUID() no se repite.
        // Se conserva la extensión original (.jpg, .png, .webp).
        const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const nombre = `${crypto.randomUUID()}.${extension}`;
        const ruta = carpeta ? `${carpeta}/${nombre}` : nombre;

        const { error } = await this.supabase.Supabase.storage.from(bucket).upload(ruta, archivo);
        if (error) throw error;

        // getPublicUrl no consulta al servidor: arma la URL con el nombre del
        // bucket y la ruta. Funciona porque el bucket es público (lectura libre).
        const { data } = this.supabase.Supabase.storage.from(bucket).getPublicUrl(ruta);
        return { ruta, url: data.publicUrl };
    }

    // Para deshacer una subida si después falla el guardado en la tabla, así
    // no quedan imágenes sueltas en el bucket que no usa nadie.
    async borrar(bucket: string, ruta: string): Promise<void> {
        const { error } = await this.supabase.Supabase.storage.from(bucket).remove([ruta]);
        if (error) throw error;
    }
    }
