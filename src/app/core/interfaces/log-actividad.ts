export default interface ILogActividad {
    id: number;
    usuario_id: string | null;
    accion: string;
    creado_en: string;
}

// Vista para la pantalla de admin: trae el nombre de quién hizo la acción
// (join con perfiles), para no mostrar sólo un uuid pelado.
export interface ILogActividadConUsuario extends ILogActividad {
    perfiles: { nombre: string; apellido: string } | null;
}