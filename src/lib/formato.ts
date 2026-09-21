/// Utilidades de presentacion. La moneda y la zona horaria salen de la
/// configuracion de la institucion, nunca estan fijas en el codigo.

export function formatearMoneda(
  monto: number | string | { toString(): string },
  moneda = "MXN",
  locale = "es-MX"
): string {
  const valor = typeof monto === "number" ? monto : Number(monto.toString());
  return new Intl.NumberFormat(locale, { style: "currency", currency: moneda }).format(
    Number.isFinite(valor) ? valor : 0
  );
}

export function formatearFecha(fecha: Date | string | null | undefined, locale = "es-MX"): string {
  if (!fecha) return "—";
  const valor = typeof fecha === "string" ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(valor);
}

export function formatearFechaHora(fecha: Date | string | null | undefined, locale = "es-MX"): string {
  if (!fecha) return "—";
  const valor = typeof fecha === "string" ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(valor);
}

/// Resuelve plantillas de folio/matricula: {ANIO}, {ANIO2}, {CONSECUTIVO:n}
export function resolverPlantilla(
  plantilla: string,
  datos: { consecutivo: number; nivel?: string; plan?: string; fecha?: Date }
): string {
  const fecha = datos.fecha ?? new Date();
  return plantilla
    .replace(/\{ANIO\}/g, String(fecha.getFullYear()))
    .replace(/\{ANIO2\}/g, String(fecha.getFullYear()).slice(-2))
    .replace(/\{MES\}/g, String(fecha.getMonth() + 1).padStart(2, "0"))
    .replace(/\{NIVEL\}/g, datos.nivel ?? "")
    .replace(/\{PLAN\}/g, datos.plan ?? "")
    .replace(/\{CONSECUTIVO:(\d+)\}/g, (_m, digitos: string) =>
      String(datos.consecutivo).padStart(Number(digitos), "0")
    )
    .replace(/\{CONSECUTIVO\}/g, String(datos.consecutivo));
}

export const DIAS_SEMANA = [
  { valor: 1, nombre: "Lunes", corto: "Lun" },
  { valor: 2, nombre: "Martes", corto: "Mar" },
  { valor: 3, nombre: "Miercoles", corto: "Mie" },
  { valor: 4, nombre: "Jueves", corto: "Jue" },
  { valor: 5, nombre: "Viernes", corto: "Vie" },
  { valor: 6, nombre: "Sabado", corto: "Sab" },
  { valor: 7, nombre: "Domingo", corto: "Dom" },
];
