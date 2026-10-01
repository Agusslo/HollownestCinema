    import { Service, inject } from '@angular/core';
    import { Supabase } from './supabase';

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

    async subirImagen(bucket: string, archivo: File): Promise<IArchivoSubido> {
        // Nombre único para cada archivo: con Date.now() dos subidas en el
        // mismo milisegundo pisarían una a la otra; randomUUID() no se repite.
        // Se conserva la extensión original (.jpg, .png, .webp).
        const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const ruta = `${crypto.randomUUID()}.${extension}`;

        const { error } = await this.supabase.Supabase.storage.from(bucket).upload(ruta, archivo);
        if (error) throw error;

        // getPublicUrl no consulta al servidor: arma la URL con el nombre del
        // bucket y la ruta. Funciona porque el bucket es público (lectura libre).
        const { data } = this.supabase.Supabase.storage.from(bucket).getPublicUrl(ruta);
        return { ruta, url: data.publicUrl };
    }

    // Para deshacer una subida si después falla el guardado en la tabla, así
    // no quedan imágenes sueltas en el bucket que no usa ninguna película.
    async borrar(bucket: string, ruta: string): Promise<void> {
        const { error } = await this.supabase.Supabase.storage.from(bucket).remove([ruta]);
        if (error) throw error;
    }
    }