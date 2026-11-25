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

// ---------------- Fecha y hora en la zona del colegio ----------------

function partesEnZona(fecha: Date, zona: string): Record<string, number> {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(fecha);
  const v: Record<string, number> = {};
  for (const p of partes) if (p.type !== "literal") v[p.type] = Number(p.value);
  return v;
}

/// Minutos que la zona va adelante de UTC en ese instante (Mexico: -360).
function desfase(fecha: Date, zona: string): number {
  const v = partesEnZona(fecha, zona);
  const comoUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour % 24, v.minute, v.second);
  return Math.round((comoUtc - fecha.getTime()) / 60_000);
}

/// "2026-11-25T10:00" (lo que da un <input type="datetime-local">) en la
/// zona del colegio, al instante real.
export function fechaHoraAInstante(texto: string, zona: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const [, a, mes, d, h, min] = m.map(Number);
  const comoUtc = Date.UTC(a, mes - 1, d, h, min);
  let instante = comoUtc - desfase(new Date(comoUtc), zona) * 60_000;
  instante = comoUtc - desfase(new Date(instante), zona) * 60_000;
  const fecha = new Date(instante);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/// Al reves: el valor para un <input type="datetime-local">.
export function instanteAFechaHora(fecha: Date, zona: string): string {
  const v = partesEnZona(fecha, zona);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${v.year}-${dos(v.month)}-${dos(v.day)}T${dos(v.hour % 24)}:${dos(v.minute)}`;
}

/// "25 nov 2026, 10:00" en la zona del colegio.
export function fechaHoraLegible(fecha: Date, zona: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: zona }).format(fecha);
  } catch {
    return fecha.toISOString();
  }
}
