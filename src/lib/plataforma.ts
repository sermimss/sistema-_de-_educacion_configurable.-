import { createHash, randomInt } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { clientePublico, esquemaValido, urlDeEsquema } from "./clientes";

/// Datos de la plataforma, el "edificio": que colegios existen, sus codigos
/// de alta y la cuenta del dueno. Viven en el esquema "plataforma", aparte de
/// los colegios, y no los ve ningun colegio.

export type EstadoColegio = "CONFIGURANDO" | "PENDIENTE_PAGO" | "ACTIVO" | "SUSPENDIDO";

export type ColegioPlataforma = {
  id: number;
  direccion: string | null;
  nombre: string;
  estado: EstadoColegio;
  esquema: string;
  creadoEn: Date;
  configuradoEn: Date | null;
  pagadoEn: Date | null;
  suspendidoEn: Date | null;
  notas: string | null;
};

type FilaColegio = {
  id: number;
  slug: string | null;
  nombre: string;
  estado: EstadoColegio;
  esquema: string;
  creado_en: Date;
  configurado_en: Date | null;
  pagado_en: Date | null;
  suspendido_en: Date | null;
  notas: string | null;
};

function aColegio(fila: FilaColegio): ColegioPlataforma {
  return {
    id: fila.id,
    direccion: fila.slug,
    nombre: fila.nombre,
    estado: fila.estado,
    esquema: fila.esquema,
    creadoEn: fila.creado_en,
    configuradoEn: fila.configurado_en,
    pagadoEn: fila.pagado_en,
    suspendidoEn: fila.suspendido_en,
    notas: fila.notas,
  };
}

const TABLAS = [
  `CREATE SCHEMA IF NOT EXISTS plataforma`,
  `CREATE TABLE IF NOT EXISTS plataforma.colegio (
     id SERIAL PRIMARY KEY,
     slug TEXT UNIQUE,
     nombre TEXT NOT NULL DEFAULT '',
     estado TEXT NOT NULL DEFAULT 'CONFIGURANDO',
     esquema TEXT UNIQUE,
     creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
     configurado_en TIMESTAMPTZ,
     pagado_en TIMESTAMPTZ,
     suspendido_en TIMESTAMPTZ,
     notas TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS plataforma.codigo_alta (
     id SERIAL PRIMARY KEY,
     codigo_hash TEXT NOT NULL UNIQUE,
     pista TEXT NOT NULL,
     etiqueta TEXT,
     creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
     usado_en TIMESTAMPTZ,
     colegio_id INT REFERENCES plataforma.colegio(id),
     revocado BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE TABLE IF NOT EXISTS plataforma.dueno (
     id SERIAL PRIMARY KEY,
     usuario TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
     intentos_fallidos INT NOT NULL DEFAULT 0,
     bloqueado_hasta TIMESTAMPTZ
   )`,
];

const global = globalThis as unknown as {
  tablasPlataforma?: Promise<void>;
  migraciones?: Map<string, Promise<void>>;
  cacheColegios?: Map<string, { colegio: ColegioPlataforma | null; vence: number }>;
};

/// Crea las tablas de la plataforma si no existen. Corre una vez por proceso.
export function asegurarTablasPlataforma(): Promise<void> {
  global.tablasPlataforma ??= (async () => {
    for (const sentencia of TABLAS) {
      try {
        await clientePublico.$executeRawUnsafe(sentencia);
      } catch (error) {
        // Dos procesos creando lo mismo a la vez: el segundo choca, pero la
        // tabla ya existe. Se reintenta una vez para confirmarlo.
        await clientePublico.$executeRawUnsafe(sentencia).catch(() => {
          throw error;
        });
      }
    }
  })().catch((error) => {
    global.tablasPlataforma = undefined;
    throw error;
  });
  return global.tablasPlataforma;
}

// ---------------------------------------------------------------------------
// Colegios
// ---------------------------------------------------------------------------

const cache = (global.cacheColegios ??= new Map());
const SEGUNDOS_CACHE = 15;

function olvidarCache() {
  cache.clear();
}

async function buscar(llave: string, consulta: () => Promise<FilaColegio[]>) {
  const guardado = cache.get(llave);
  if (guardado && guardado.vence > Date.now()) return guardado.colegio;
  await asegurarTablasPlataforma();
  const filas = await consulta();
  const colegio = filas[0] ? aColegio(filas[0]) : null;
  cache.set(llave, { colegio, vence: Date.now() + SEGUNDOS_CACHE * 1000 });
  return colegio;
}

export function colegioPorDireccion(direccion: string) {
  return buscar(`d:${direccion}`, () =>
    clientePublico.$queryRaw<FilaColegio[]>`SELECT * FROM plataforma.colegio WHERE slug = ${direccion}`
  );
}

export function colegioPorId(id: number) {
  return buscar(`i:${id}`, () =>
    clientePublico.$queryRaw<FilaColegio[]>`SELECT * FROM plataforma.colegio WHERE id = ${id}`
  );
}

export async function listarColegios(): Promise<ColegioPlataforma[]> {
  await asegurarTablasPlataforma();
  const filas = await clientePublico.$queryRaw<FilaColegio[]>`
    SELECT * FROM plataforma.colegio ORDER BY creado_en DESC`;
  return filas.map(aColegio);
}

export async function direccionDisponible(direccion: string, salvoColegioId?: number) {
  await asegurarTablasPlataforma();
  const filas = await clientePublico.$queryRaw<{ id: number }[]>`
    SELECT id FROM plataforma.colegio WHERE slug = ${direccion}`;
  return filas.every((f) => f.id === salvoColegioId);
}

/// Aparta la direccion web para el colegio que se esta configurando. Va antes
/// de instalar: si otro colegio la gano un instante antes, la base la rechaza
/// (es unica) y no se instala nada.
export async function reservarDireccion(
  id: number,
  direccion: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const cambiadas = await clientePublico.$executeRaw`
      UPDATE plataforma.colegio SET slug = ${direccion}
       WHERE id = ${id} AND estado = 'CONFIGURANDO'`;
    olvidarCache();
    return cambiadas === 1
      ? { ok: true }
      : { ok: false, error: "Este colegio ya termino su configuracion." };
  } catch {
    return { ok: false, error: `La direccion "${direccion}" ya la usa otro colegio. Elige otra.` };
  }
}

/// Al terminar el asistente: el colegio queda configurado y esperando el pago.
export async function marcarConfigurado(id: number, nombre: string) {
  await clientePublico.$executeRaw`
    UPDATE plataforma.colegio
       SET nombre = ${nombre}, estado = 'PENDIENTE_PAGO', configurado_en = now()
     WHERE id = ${id} AND estado = 'CONFIGURANDO'`;
  olvidarCache();
}

export async function cambiarEstadoColegio(id: number, estado: "ACTIVO" | "SUSPENDIDO") {
  if (estado === "ACTIVO") {
    await clientePublico.$executeRaw`
      UPDATE plataforma.colegio
         SET estado = 'ACTIVO', pagado_en = COALESCE(pagado_en, now()), suspendido_en = NULL
       WHERE id = ${id} AND estado IN ('PENDIENTE_PAGO', 'SUSPENDIDO')`;
  } else {
    await clientePublico.$executeRaw`
      UPDATE plataforma.colegio SET estado = 'SUSPENDIDO', suspendido_en = now()
       WHERE id = ${id} AND estado IN ('PENDIENTE_PAGO', 'ACTIVO')`;
  }
  olvidarCache();
}

export async function guardarNotasColegio(id: number, notas: string) {
  await clientePublico.$executeRaw`UPDATE plataforma.colegio SET notas = ${notas || null} WHERE id = ${id}`;
  olvidarCache();
}

/// Cuantos alumnos activos tiene cada colegio, para el panel del dueno. No lee
/// ningun otro dato del colegio.
export async function alumnosPorColegio(colegios: ColegioPlataforma[]) {
  const resultado = new Map<number, number>();
  for (const colegio of colegios) {
    if (colegio.estado === "CONFIGURANDO" || !esquemaValido(colegio.esquema)) continue;
    try {
      const filas = await clientePublico.$queryRawUnsafe<{ total: bigint }[]>(
        `SELECT count(*) AS total FROM "${colegio.esquema}"."Alumno" WHERE estado = 'ACTIVO'`
      );
      resultado.set(colegio.id, Number(filas[0]?.total ?? 0));
    } catch {
      // Esquema aun sin migrar: no hay alumnos que contar.
    }
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Codigos de alta
// ---------------------------------------------------------------------------

/// Sin letras que se confunden al dictarlas o leerlas (0/O, 1/I/L).
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function huella(codigo: string): string {
  return createHash("sha256").update(normalizarCodigo(codigo)).digest("hex");
}

/// Crea un codigo nuevo. Se muestra una sola vez: en la base solo queda su
/// huella, asi que ni quien vea la base puede usarlo.
export async function crearCodigoAlta(etiqueta: string): Promise<string> {
  await asegurarTablasPlataforma();
  const bloques = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("")
  );
  const codigo = `ALTA-${bloques.join("-")}`;
  await clientePublico.$executeRaw`
    INSERT INTO plataforma.codigo_alta (codigo_hash, pista, etiqueta)
    VALUES (${huella(codigo)}, ${bloques[2]}, ${etiqueta || null})`;
  return codigo;
}

export type CodigoAlta = {
  id: number;
  pista: string;
  etiqueta: string | null;
  creadoEn: Date;
  usadoEn: Date | null;
  colegioId: number | null;
  revocado: boolean;
};

export async function listarCodigos(): Promise<CodigoAlta[]> {
  await asegurarTablasPlataforma();
  const filas = await clientePublico.$queryRaw<
    {
      id: number;
      pista: string;
      etiqueta: string | null;
      creado_en: Date;
      usado_en: Date | null;
      colegio_id: number | null;
      revocado: boolean;
    }[]
  >`SELECT id, pista, etiqueta, creado_en, usado_en, colegio_id, revocado
      FROM plataforma.codigo_alta ORDER BY creado_en DESC`;
  return filas.map((f) => ({
    id: f.id,
    pista: f.pista,
    etiqueta: f.etiqueta,
    creadoEn: f.creado_en,
    usadoEn: f.usado_en,
    colegioId: f.colegio_id,
    revocado: f.revocado,
  }));
}

export async function revocarCodigo(id: number) {
  await clientePublico.$executeRaw`
    UPDATE plataforma.codigo_alta SET revocado = true WHERE id = ${id} AND usado_en IS NULL`;
}

export type ResultadoCanje =
  | { ok: true; colegioId: number; esquema: string }
  | { ok: false; error: string };

/// Canjea un codigo: aparta el espacio del colegio y lo deja listo para el
/// asistente. Con el mismo codigo se puede volver mientras el asistente no se
/// haya terminado (por si se cerro el navegador a medias).
export async function canjearCodigo(codigo: string): Promise<ResultadoCanje> {
  await asegurarTablasPlataforma();
  const limpio = normalizarCodigo(codigo);
  if (limpio.length < 12) return { ok: false, error: "Escribe el codigo completo." };

  return clientePublico.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<
      { id: number; usado_en: Date | null; colegio_id: number | null; revocado: boolean }[]
    >`SELECT id, usado_en, colegio_id, revocado FROM plataforma.codigo_alta
       WHERE codigo_hash = ${huella(limpio)} FOR UPDATE`;
    const fila = filas[0];
    if (!fila || fila.revocado) return { ok: false as const, error: "Ese codigo no es valido." };

    if (fila.colegio_id) {
      const [colegio] = await tx.$queryRaw<FilaColegio[]>`
        SELECT * FROM plataforma.colegio WHERE id = ${fila.colegio_id}`;
      if (colegio?.estado === "CONFIGURANDO") {
        return { ok: true as const, colegioId: colegio.id, esquema: colegio.esquema };
      }
      return { ok: false as const, error: "Ese codigo ya se uso para dar de alta un colegio." };
    }

    const [nuevo] = await tx.$queryRaw<{ id: number }[]>`
      INSERT INTO plataforma.colegio (estado) VALUES ('CONFIGURANDO') RETURNING id`;
    const esquema = `colegio_${nuevo.id}`;
    await tx.$executeRaw`UPDATE plataforma.colegio SET esquema = ${esquema} WHERE id = ${nuevo.id}`;
    await tx.$executeRaw`
      UPDATE plataforma.codigo_alta SET usado_en = now(), colegio_id = ${nuevo.id} WHERE id = ${fila.id}`;
    return { ok: true as const, colegioId: nuevo.id, esquema };
  });
}

// ---------------------------------------------------------------------------
// Espacio de cada colegio en la base
// ---------------------------------------------------------------------------

/// Donde estan la herramienta de migraciones y las migraciones. El servidor
/// compilado corre desde .next/standalone, dos carpetas abajo del proyecto.
function ubicarHerramientas(): { cli: string; esquemaPrisma: string } {
  const candidatos = [process.cwd(), path.resolve(process.cwd(), "..", "..")];
  for (const raiz of candidatos) {
    const cli = path.join(raiz, "node_modules", "prisma", "build", "index.js");
    const esquemaPrisma = path.join(raiz, "prisma", "schema.prisma");
    if (existsSync(cli) && existsSync(esquemaPrisma)) return { cli, esquemaPrisma };
  }
  throw new Error("No se encontro la herramienta de migraciones de Prisma.");
}

/// Crea el espacio del colegio y le aplica todas las migraciones. Si ya
/// estaba al dia no hace nada, asi que se puede llamar las veces que sea.
export function prepararEsquema(esquema: string): Promise<void> {
  const migraciones = (global.migraciones ??= new Map());
  const enCurso = migraciones.get(esquema);
  if (enCurso) return enCurso;

  const tarea = (async () => {
    if (!esquemaValido(esquema)) throw new Error(`Esquema invalido: ${esquema}`);
    await clientePublico.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${esquema}"`);
    const { cli, esquemaPrisma } = ubicarHerramientas();
    await new Promise<void>((resolver, rechazar) => {
      execFile(
        process.execPath,
        [cli, "migrate", "deploy", "--schema", esquemaPrisma],
        { env: { ...process.env, DATABASE_URL: urlDeEsquema(esquema) }, timeout: 180_000 },
        (error, _salida, errores) => {
          if (error) rechazar(new Error(`No se pudo preparar ${esquema}: ${errores || error.message}`));
          else resolver();
        }
      );
    });
  })();

  migraciones.set(esquema, tarea);
  // Si falla se olvida, para que el siguiente intento lo vuelva a probar.
  tarea.catch(() => migraciones.delete(esquema));
  return tarea;
}
