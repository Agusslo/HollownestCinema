// Los 4 tipos de toast. Cada uno se pinta con un color distinto (ver
// toast.css), pero la estructura es siempre la misma.
export type TipoToast = 'exito' | 'error' | 'advertencia' | 'info';

// Un toast que está en pantalla en este momento.
export default interface IToast {
  // Identificador único: lo necesitamos para saber CUÁL sacar de la lista
  // cuando se cierra (por el tiempo o por la ×), y para el `track` del @for.
  id: string;
  tipo: TipoToast;
  titulo: string;
  mensaje: string;
  // Opcional: un link dentro del toast, por ejemplo
  // "¡Ya podés comprar entradas de Dune 3!" → "Ir a comprar".
  enlace?: { texto: string; ruta: string };
}