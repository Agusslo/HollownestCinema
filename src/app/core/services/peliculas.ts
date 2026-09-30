import { Service, inject } from '@angular/core';
import { Supabase } from './supabase';
import IGenero from '../interfaces/genero';
import IPelicula, { IPeliculaConGeneros } from '../interfaces/pelicula';

// La consigna: "abrir la venta de entradas 7 días antes del estreno".
const DIAS_PREVENTA = 7;

// En qué momento está una película respecto de su estreno:
// - 'proximamente': todavía no se estrenó y el admin no abrió la venta.
//   Se muestra en "Próximamente" con el botón "Avisame"; no se vende.
// - 'preventa': todavía no se estrenó, pero el admin ya abrió la venta.
//   Se vende al precio de preventa.
// - 'cartelera': ya se estrenó (o nunca tuvo fecha de estreno cargada).
//   Se vende a precio normal.
export type EstadoVenta = 'proximamente' | 'preventa' | 'cartelera';

@Service()
export class Peliculas {
  private supabase = inject(Supabase);

  async obtenerTodas(): Promise<IPeliculaConGeneros[]> {
    const { data, error } = await this.supabase.Supabase.from('peliculas').select(
      '*, peliculas_generos(generos(id, nombre))',
    );

    if (error) throw error;
    return data as unknown as IPeliculaConGeneros[];
  }

  // venta_abierta_en también se omite: al crear una película la venta
  // nunca está abierta (la base la deja en null). Se abre después, desde
  // el botón "Abrir venta" del admin.
  async crear(pelicula: Omit<IPelicula, 'id' | 'venta_abierta_en'>): Promise<IPelicula> {
    //omit es una utilidad de typescript que permite omitir una propiedad de un tipo, en este caso omitimos la propiedad id de la interfaz IPelicula
    const { data, error } = await this.supabase.Supabase.from('peliculas')
      .insert(pelicula)
      .select()
      .single();

    if (error) throw error;
    return data as IPelicula;
  }

  async obtenerPorId(id: number): Promise<IPelicula> {
    const { data, error } = await this.supabase.Supabase.from('peliculas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as IPelicula;
  }

  generarSlug(nombre: string): string {
    //esta función genera un slug a partir del nombre de la película, para poder usarlo en la URL
    return nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async obtenerPorSlug(slug: string): Promise<IPeliculaConGeneros> {
    //esta función obtiene una película a partir de su slug, para poder usarlo en la URL
    const peliculas = await this.obtenerTodas();
    const pelicula = peliculas.find((item) => this.generarSlug(item.nombre) === slug);

    if (!pelicula) throw new Error(`No se encontró la película: ${slug}`);
    return pelicula;
  }

  async obtenerMasVendidas(cantidad: number): Promise<IPeliculaConGeneros[]> {
    // Traemos cada entrada junto con la película de su función, vía doble
    // join embebido: entradas -> funciones -> peliculas
    const { data, error } = await this.supabase.Supabase.from('entradas').select(
      'funciones(pelicula_id)',
    );

    if (error) throw error;

    // Contamos ocurrencias de cada pelicula_id
    const conteo = new Map<number, number>();
    for (const fila of data as unknown as { funciones: { pelicula_id: number } }[]) {
      const id = fila.funciones.pelicula_id;
      conteo.set(id, (conteo.get(id) ?? 0) + 1);
    }

    // Ordenamos los ids de mayor a menor cantidad de ventas
    const idsOrdenados = [...conteo.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, cantidad);

    const todas = await this.obtenerTodas();
    // Reordenamos "todas" según idsOrdenados, para respetar el ranking
    return idsOrdenados
      .map((id) => todas.find((p) => p.id === id))
      .filter((p): p is IPeliculaConGeneros => p !== undefined);
  }

  // Aplana la estructura anidada que devuelve Supabase (un array de filas de
  // peliculas_generos, cada una con su género adentro) a un array simple de
  // géneros, más cómodo para usar en los templates.
  generosDe(pelicula: IPeliculaConGeneros): IGenero[] {
    return pelicula.peliculas_generos.map((pg) => pg.generos);
  }

  // ── Próximamente y preventa ──────────────────────────────────────────
  // El estado NO se guarda en la base: se calcula comparando fechas cada
  // vez que se pregunta. Por eso no hace falta un cron que "cambie" nada a
  // medianoche: lo que avanza es el día de hoy, no el dato.
  //
  // Las fechas se comparan como texto 'YYYY-MM-DD'. Funciona porque en ese
  // formato el orden alfabético coincide con el orden de las fechas (año,
  // después mes, después día, siempre con la misma cantidad de dígitos):
  // '2026-12-05' < '2026-12-12' tanto como texto como en el calendario.
  estadoVenta(pelicula: IPelicula): EstadoVenta {
    const hoy = this.hoy();

    if (!pelicula.fecha_estreno || hoy >= pelicula.fecha_estreno) return 'cartelera';
    return pelicula.venta_abierta_en ? 'preventa' : 'proximamente';
  }

  // Botón "Abrir venta" de la pantalla de admin Preventas: guarda la fecha
  // y hora de este momento en venta_abierta_en, y desde ahí estadoVenta()
  // la ve como 'preventa'. El .is('venta_abierta_en', null) hace que sólo
  // se actualice si la venta TODAVÍA no estaba abierta (mismo truco que
  // Entradas.validar): así nunca se pisa la fecha original. Devuelve false
  // si no se actualizó ninguna fila (ya estaba abierta, o RLS lo rechazó
  // porque quien lo pidió no es admin).
  async abrirVenta(id: number): Promise<boolean> {
    const { data, error } = await this.supabase.Supabase.from('peliculas')
      .update({ venta_abierta_en: new Date().toISOString() })
      .eq('id', id)
      .is('venta_abierta_en', null)
      .select('id');

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  // ¿Se le puede apretar "Abrir venta" a esta película? Sólo si todavía
  // está en Próximamente y ya faltan 7 días o menos para el estreno (la
  // consigna: "abrir la venta de entradas 7 días antes del estreno").
  // Ejemplo, estreno 12/12: hasta el 04/12 da false; desde el 05/12, true.
  puedeAbrirVenta(pelicula: IPelicula): boolean {
    return (
      this.estadoVenta(pelicula) === 'proximamente' &&
      this.hoy() >= this.inicioPreventa(pelicula.fecha_estreno!)
    );
  }

  // Día en que arranca la preventa: 7 días antes del estreno.
  // '2026-12-12' → '2026-12-05'. La cuenta se hace en UTC para tratar la
  // fecha como un día de calendario puro, sin que la zona horaria la
  // corra; setUTCDate() se encarga solo de cambiar de mes o de año
  // ('2026-12-03' → '2026-11-26').
  inicioPreventa(fecha_estreno: string): string {
    const fecha = new Date(`${fecha_estreno}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() - DIAS_PREVENTA);
    return fecha.toISOString().slice(0, 10);
  }

  // Hoy como 'YYYY-MM-DD' según el reloj de quien usa la app (Argentina).
  // No uso toISOString() porque ese devuelve la fecha en UTC: a las 22hs
  // de Argentina ya sería "mañana" en UTC.
  private hoy(): string {
    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${ahora.getFullYear()}-${mes}-${dia}`;
  }
}