/// Calculos de fechas del calendario de un grupo. No toca la base de datos,
/// asi que lo usan tanto el formulario (en el navegador) como el servidor.

const UN_DIA = 86_400_000;

export type ParcialCapturado = { nombre: string; fechaInicio: string; fechaFin: string };

/// Fecha "AAAA-MM-DD" a medianoche UTC, igual que el resto del sistema.
export function leerFecha(texto: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function fechaATexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/// Reparte el periodo de clases en partes iguales. El ultimo parcial termina
/// justo en la fecha de termino del grupo.
export function repartirParciales(
  inicio: string,
  fin: string,
  cantidad: number,
  plantilla = "Parcial {N}"
): ParcialCapturado[] {
  const desde = leerFecha(inicio);
  const hasta = leerFecha(fin);
  if (!desde || !hasta || hasta <= desde || cantidad < 1) return [];
  const dias = Math.round((hasta.getTime() - desde.getTime()) / UN_DIA) + 1;
  const parciales: ParcialCapturado[] = [];
  for (let numero = 1; numero <= cantidad; numero++) {
    const primerDia = Math.floor((dias * (numero - 1)) / cantidad);
    const ultimoDia = numero === cantidad ? dias - 1 : Math.floor((dias * numero) / cantidad) - 1;
    parciales.push({
      nombre: plantilla.replace(/\{N\}/g, String(numero)),
      fechaInicio: fechaATexto(new Date(desde.getTime() + primerDia * UN_DIA)),
      fechaFin: fechaATexto(new Date(desde.getTime() + Math.max(primerDia, ultimoDia) * UN_DIA)),
    });
  }
  return parciales;
}

/// Revisa fechas del grupo y de sus parciales. Devuelve los problemas
/// encontrados, en palabras para la persona que captura.
export function validarCalendario(
  inicio: string,
  fin: string,
  parciales: ParcialCapturado[]
): string[] {
  const problemas: string[] = [];
  const desde = leerFecha(inicio);
  const hasta = leerFecha(fin);
  if (!desde) problemas.push("Falta la fecha de inicio de clases.");
  if (!hasta) problemas.push("Falta la fecha de termino de clases.");
  if (desde && hasta && hasta <= desde) {
    problemas.push("La fecha de termino debe ser posterior a la de inicio.");
  }
  if (parciales.length < 1) problemas.push("El grupo necesita al menos un parcial.");
  if (parciales.length > 12) problemas.push("Un grupo puede tener a lo mas 12 parciales.");
  if (problemas.length > 0 || !desde || !hasta) return problemas;

  let finAnterior: Date | null = null;
  parciales.forEach((parcial, indice) => {
    const etiqueta = parcial.nombre.trim() || `Parcial ${indice + 1}`;
    const pIni = leerFecha(parcial.fechaInicio);
    const pFin = leerFecha(parcial.fechaFin);
    if (!parcial.nombre.trim()) problemas.push(`El parcial ${indice + 1} necesita nombre.`);
    if (!pIni || !pFin) {
      problemas.push(`${etiqueta}: faltan sus fechas.`);
      return;
    }
    if (pFin < pIni) problemas.push(`${etiqueta}: termina antes de empezar.`);
    if (pIni < desde || pFin > hasta) {
      problemas.push(`${etiqueta}: sus fechas quedan fuera del inicio y termino de clases.`);
    }
    if (finAnterior && pIni <= finAnterior) {
      problemas.push(`${etiqueta}: empieza antes de que termine el parcial anterior.`);
    }
    finAnterior = pFin;
  });
  return problemas;
}
