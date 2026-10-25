import type { PrismaClient } from "@prisma/client";
import { clienteDeEsquema, clientePublico } from "./clientes";
import { colegioActual } from "./colegio";
import { modoPlataforma } from "./modo";

/// Acceso a la base de datos del colegio de esta solicitud.
///
/// En modo un colegio es la base de siempre. En modo plataforma, cada consulta
/// se manda al espacio (esquema) del colegio que corresponde a la solicitud, asi
/// que el resto del sistema sigue escribiendo db.alumno.findMany(...) sin saber
/// que hay mas colegios, y no hay forma de que una pantalla lea otro colegio.

export class SinColegio extends Error {
  constructor() {
    super("Esta solicitud no pertenece a ningun colegio.");
  }
}

async function clienteDeLaSolicitud(): Promise<PrismaClient> {
  if (!modoPlataforma()) return clientePublico;
  const colegio = await colegioActual();
  if (!colegio) throw new SinColegio();
  return clienteDeEsquema(colegio.esquema);
}

/// Hay colegio en esta solicitud (o es modo un colegio, donde siempre lo hay).
export async function hayColegio(): Promise<boolean> {
  return !modoPlataforma() || Boolean(await colegioActual());
}

type Funcion = (...argumentos: unknown[]) => unknown;

export const db = new Proxy({} as PrismaClient, {
  get(_objetivo, propiedad: string | symbol) {
    if (typeof propiedad === "symbol" || propiedad === "then") return undefined;
    // $transaction, $queryRaw, $executeRaw...
    if (propiedad.startsWith("$")) {
      return (...argumentos: unknown[]) =>
        clienteDeLaSolicitud().then((cliente) =>
          (Reflect.get(cliente, propiedad) as Funcion).apply(cliente, argumentos)
        );
    }
    // db.alumno.findMany(...)
    return new Proxy(
      {},
      {
        get(_modelo, metodo: string | symbol) {
          if (typeof metodo === "symbol" || metodo === "then") return undefined;
          return (...argumentos: unknown[]) =>
            clienteDeLaSolicitud().then((cliente) => {
              const delegado = Reflect.get(cliente, propiedad) as Record<string, Funcion>;
              return delegado[metodo].apply(delegado, argumentos);
            });
        },
      }
    );
  },
});
