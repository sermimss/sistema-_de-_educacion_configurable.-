/// Fechas de calendario ("YYYY-MM-DD"). Se guardan a medianoche UTC y "hoy"
/// se calcula en la zona horaria del colegio. Sin acceso a la base: lo usan
/// tambien los formularios del navegador.

/// "YYYY-MM-DD" de hoy en la zona del colegio.
export function hoyEnZona(zona: string, fecha = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
  } catch {
    return hoyEnZona("America/Mexico_City", fecha);
  }
}

export function esFechaDia(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = aFechaDia(texto);
  return !Number.isNaN(fecha.getTime()) && textoDeFecha(fecha) === texto;
}

export function aFechaDia(texto: string): Date {
  return new Date(`${texto}T00:00:00.000Z`);
}

export function textoDeFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/// 1 = lunes ... 7 = domingo.
export function diaDeLaSemana(texto: string): number {
  const d = aFechaDia(texto).getUTCDay();
  return d === 0 ? 7 : d;
}

export function sumarDias(texto: string, dias: number): string {
  return textoDeFecha(new Date(aFechaDia(texto).getTime() + dias * 86_400_000));
}

/// Lunes y domingo de la semana de una fecha.
export function semanaDe(texto: string): { lunes: string; domingo: string } {
  const lunes = sumarDias(texto, 1 - diaDeLaSemana(texto));
  return { lunes, domingo: sumarDias(lunes, 6) };
}

/// "mie 25 nov"
export function fechaCorta(texto: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(aFechaDia(texto))
    .replace(/\./g, "");
}
