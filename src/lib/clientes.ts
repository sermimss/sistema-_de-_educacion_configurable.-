import { PrismaClient } from "@prisma/client";

/// Conexiones a la base. En modo un colegio solo existe la publica. En modo
/// plataforma cada colegio tiene su propio esquema de PostgreSQL (su
/// "habitacion"): las mismas tablas, pero separadas, de modo que una consulta
/// de un colegio no puede ver los datos de otro.

const LOG: ("warn" | "error")[] =
  process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

const global = globalThis as unknown as {
  prismaPublico?: PrismaClient;
  prismaColegios?: Map<string, PrismaClient>;
};

export const clientePublico: PrismaClient =
  global.prismaPublico ?? new PrismaClient({ log: LOG });
if (process.env.NODE_ENV !== "production") global.prismaPublico = clientePublico;

const porEsquema = (global.prismaColegios ??= new Map<string, PrismaClient>());
/// Cada cliente abre sus propias conexiones; se mantienen solo los colegios
/// usados recientemente para no agotar las conexiones de la base.
const MAXIMO_CLIENTES = Number(process.env.PLATAFORMA_MAX_CLIENTES ?? 25);

export function esquemaValido(esquema: string): boolean {
  return /^colegio_\d{1,9}$/.test(esquema);
}

/// La cadena de conexion de un esquema: la misma base, otro espacio.
export function urlDeEsquema(esquema: string): string {
  if (!esquemaValido(esquema)) throw new Error(`Esquema invalido: ${esquema}`);
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Falta DATABASE_URL.");
  const url = new URL(base);
  url.searchParams.set("schema", esquema);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", process.env.PLATAFORMA_CONEXIONES_POR_COLEGIO ?? "3");
  }
  return url.toString();
}

export function clienteDeEsquema(esquema: string): PrismaClient {
  const existente = porEsquema.get(esquema);
  if (existente) {
    // Se mueve al final: el menos usado queda al principio.
    porEsquema.delete(esquema);
    porEsquema.set(esquema, existente);
    return existente;
  }
  const cliente = new PrismaClient({ log: LOG, datasources: { db: { url: urlDeEsquema(esquema) } } });
  porEsquema.set(esquema, cliente);
  while (porEsquema.size > MAXIMO_CLIENTES) {
    const [masViejo, viejo] = porEsquema.entries().next().value as [string, PrismaClient];
    porEsquema.delete(masViejo);
    void viejo.$disconnect();
  }
  return cliente;
}
