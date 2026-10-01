    import IPelicula from './pelicula';

    // Una fila de la tabla `avisos`: "este usuario quiere que le avisen cuando
    // se habilite la venta de esta película" (el botón "Avisame" de la sección
    // Próximamente).
    export default interface IAviso {
    id: number;
    usuario_id: string;
    pelicula_id: number;
    // null = todavía no se le mostró el aviso. Se completa cuando se le
    // muestra, para no repetírselo cada vez que abre la app.
    avisado_en: string | null;
    creado_en: string;
    }

    // Con la película embebida (join), para saber si ya abrió la venta y armar
    // el mensaje del aviso sin pedir cada película aparte.
    export interface IAvisoConPelicula extends IAviso {
    peliculas: IPelicula;
    }