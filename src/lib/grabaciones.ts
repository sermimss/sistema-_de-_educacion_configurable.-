/// Grabaciones de las clases de Google Meet. Sin acceso a la base: lo usan
/// tambien los formularios del navegador.
///
/// Meet guarda cada grabacion en el Google Drive de quien organiza la reunion.
/// El docente pega aqui ese enlace; los alumnos de la clase lo ven hasta el
/// mismo dia del mes siguiente a la clase (clase del 3 de marzo: hasta el 3 de
/// abril, inclusive). Despues solo lo ven el docente y la administracion.

import { aFechaDia, textoDeFecha } from "./fechasDia";

export { aFechaDia, hoyEnZona, textoDeFecha } from "./fechasDia";

/// Acepta el enlace que da Drive al compartir el video y lo deja limpio.
/// Solo Google Drive: los alumnos le dan clic con confianza.
export function normalizarEnlaceGrabacion(
  texto: string
): { ok: true; enlace: string } | { ok: false; error: string } {
  const limpio = texto.trim();
  const error = "Pega el enlace de la grabacion en Google Drive (drive.google.com/...).";
  if (!limpio) return { ok: false, error };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`);
  } catch {
    return { ok: false, error };
  }
  if (url.hostname.toLowerCase() !== "drive.google.com") {
    return { ok: false, error: "Solo se aceptan enlaces de Google Drive, donde Meet guarda las grabaciones." };
  }
  const id = url.pathname.match(/^\/file\/d\/([\w-]{10,})/)?.[1] ?? (url.pathname === "/open" ? url.searchParams.get("id") : null);
  if (!id || !/^[\w-]{10,}$/.test(id)) {
    return { ok: false, error: "Ese enlace no es de un archivo de Drive. Abre la grabacion y usa \"Compartir\" > \"Copiar enlace\"." };
  }
  // Algunos archivos antiguos de Drive necesitan su resourcekey para abrir.
  const llave = url.searchParams.get("resourcekey");
  return {
    ok: true,
    enlace: `https://drive.google.com/file/d/${id}/view${llave && /^[\w-]+$/.test(llave) ? `?resourcekey=${llave}` : ""}`,
  };
}

/// El mismo dia del mes siguiente. Si ese mes no tiene ese dia (31 de enero),
/// el ultimo dia del mes (28 o 29 de febrero).
export function fechaDeVencimiento(fechaClase: string): string {
  const [anio, mes, dia] = fechaClase.split("-").map(Number);
  const siguienteAnio = mes === 12 ? anio + 1 : anio;
  const siguienteMes = mes === 12 ? 1 : mes + 1;
  const diasDelMes = new Date(Date.UTC(siguienteAnio, siguienteMes, 0)).getUTCDate();
  const d = Math.min(dia, diasDelMes);
  return `${siguienteAnio}-${String(siguienteMes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/// Disponible para los alumnos hasta el final del dia de vencimiento.
export function grabacionVigente(disponibleHasta: Date, hoy: string): boolean {
  return textoDeFecha(disponibleHasta) >= hoy;
}

/// Dias que le quedan (0 = vence hoy).
export function diasRestantes(disponibleHasta: Date, hoy: string): number {
  return Math.round((disponibleHasta.getTime() - aFechaDia(hoy).getTime()) / 86_400_000);
}
