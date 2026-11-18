/// Clases en linea con Google Meet. Sin acceso a la base: lo usan tambien
/// los formularios del navegador.

/// Acepta lo que el docente copie de Meet ("https://meet.google.com/abc-defg-hij",
/// sin https, o solo el codigo "abc-defg-hij") y devuelve el enlace limpio.
/// Solo se aceptan enlaces de Google Meet: los alumnos le dan clic con
/// confianza, asi que no puede ser cualquier pagina.
export function normalizarEnlaceMeet(texto: string): { ok: true; enlace: string | null } | { ok: false; error: string } {
  const limpio = texto.trim();
  if (!limpio) return { ok: true, enlace: null };
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(limpio)) {
    return { ok: true, enlace: `https://meet.google.com/${limpio.toLowerCase()}` };
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`);
  } catch {
    return { ok: false, error: "Pega el enlace de Google Meet (meet.google.com/...)." };
  }
  const host = url.hostname.toLowerCase();
  const esMeet = host === "meet.google.com" || (host === "g.co" && url.pathname.startsWith("/meet/"));
  if (!esMeet || url.pathname.length < 4) {
    return { ok: false, error: "Solo se aceptan enlaces de Google Meet (meet.google.com/...)." };
  }
  // Sin parametros de seguimiento ni datos extra: solo la sala.
  return { ok: true, enlace: `https://${host}${url.pathname.replace(/\/+$/, "")}` };
}

/// Dia de la semana (1 lunes ... 7 domingo) y hora "HH:MM" en la zona del colegio.
export function ahoraEnZona(zona: string, fecha = new Date()): { dia: number; hora: string } {
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(fecha);
  } catch {
    return ahoraEnZona("America/Mexico_City", fecha);
  }
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dias: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const hora = valor("hour") === "24" ? "00" : valor("hour");
  return { dia: dias[valor("weekday")] ?? 1, hora: `${hora}:${valor("minute")}` };
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/// "en-curso" desde 10 minutos antes de empezar (para entrar a tiempo)
/// hasta que termina; "proxima" mas tarde ese dia; "pasada" ya termino.
export function estadoDelBloque(
  bloque: { diaSemana: number; horaInicio: string; horaFin: string },
  ahora: { dia: number; hora: string }
): "en-curso" | "proxima" | "pasada" | "otro-dia" {
  if (bloque.diaSemana !== ahora.dia) return "otro-dia";
  const actual = minutos(ahora.hora);
  if (actual >= minutos(bloque.horaFin)) return "pasada";
  if (actual >= minutos(bloque.horaInicio) - 10) return "en-curso";
  return "proxima";
}
