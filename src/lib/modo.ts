/// Como corre esta instalacion. Lo lee tambien el middleware, asi que no puede
/// importar nada de Node ni de la base de datos.
///
/// - Un colegio (predeterminado): una instalacion, una base, un colegio. Es lo
///   que usan los paquetes para las computadoras del colegio y su red local.
/// - Plataforma (MODO_PLATAFORMA=1): un solo sistema en internet con muchos
///   colegios. Cada colegio vive en su propio espacio de la base de datos y
///   tiene su propia direccion: /<direccion> o <direccion>.<dominio>.

export function modoPlataforma(): boolean {
  return process.env.MODO_PLATAFORMA === "1";
}

/// Dominio propio de la plataforma (ej. "miplataforma.com"). Con el, cada
/// colegio tambien entra por <direccion>.miplataforma.com.
export function dominioPlataforma(): string | null {
  const dominio = (process.env.DOMINIO_PLATAFORMA ?? "").trim().toLowerCase();
  return dominio || null;
}

/// Palabras que ya usa el sistema y no pueden ser la direccion de un colegio.
export const DIRECCIONES_RESERVADAS = new Set([
  "acceso", "alta", "api", "panel", "instalacion", "plataforma", "colegio", "colegios",
  "www", "admin", "app", "static", "public", "favicon.ico", "robots.txt", "sitemap.xml",
  "_next", "salud", "ayuda", "soporte", "login", "registro",
]);

export const COOKIE_COLEGIO = "colegio_elegido";
export const COOKIE_ALTA = "alta_colegio";
export const CABECERA_COLEGIO = "x-colegio";

export function direccionValida(direccion: string): boolean {
  return (
    /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(direccion) &&
    !direccion.includes("--") &&
    !DIRECCIONES_RESERVADAS.has(direccion)
  );
}

/// Propone una direccion a partir del nombre: "Colegio Vanguardia" -> "colegio-vanguardia".
export function sugerirDireccion(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/// El colegio que indica el nombre del servidor, si la plataforma tiene dominio
/// propio: "vanguardia.miplataforma.com" -> "vanguardia".
export function colegioDelHost(host: string | null): string | null {
  const dominio = dominioPlataforma();
  if (!dominio || !host) return null;
  const nombre = host.split(":")[0].toLowerCase();
  if (!nombre.endsWith(`.${dominio}`)) return null;
  const sub = nombre.slice(0, -(dominio.length + 1));
  return sub && !sub.includes(".") && direccionValida(sub) ? sub : null;
}
