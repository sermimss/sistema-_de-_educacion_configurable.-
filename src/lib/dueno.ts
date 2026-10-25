import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clientePublico } from "./clientes";
import { hashPassword, verificarPassword } from "./password";
import { asegurarTablasPlataforma } from "./plataforma";
import { firmarDato, verificarDato } from "./sesion";
import { modoPlataforma } from "./modo";

/// La cuenta del dueno de la plataforma. Va aparte de las cuentas de los
/// colegios: administra colegios y codigos de alta, pero no ve calificaciones,
/// alumnos ni pagos de ningun colegio.

const COOKIE_DUENO = "sesion_plataforma";
const HORAS_SESION = 8;
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

export async function duenoRegistrado(): Promise<boolean> {
  await asegurarTablasPlataforma();
  const filas = await clientePublico.$queryRaw<{ total: bigint }[]>`
    SELECT count(*) AS total FROM plataforma.dueno`;
  return Number(filas[0]?.total ?? 0) > 0;
}

function claveArranqueCorrecta(capturada: string): boolean {
  const esperada = process.env.PLATAFORMA_CLAVE_ARRANQUE ?? "";
  if (esperada.length < 12) return false;
  const a = Buffer.from(capturada);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hayClaveArranque(): boolean {
  return (process.env.PLATAFORMA_CLAVE_ARRANQUE ?? "").length >= 12;
}

/// La primera cuenta del dueno. Pide la clave de arranque que se definio en
/// el servidor, para que nadie mas pueda adueñarse de una plataforma recien
/// publicada.
export async function crearPrimerDueno(
  usuario: string,
  password: string,
  claveArranque: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await duenoRegistrado()) return { ok: false, error: "La cuenta del dueno ya existe." };
  if (!claveArranqueCorrecta(claveArranque)) return { ok: false, error: "La clave de arranque no es correcta." };
  const limpio = usuario.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(limpio)) {
    return { ok: false, error: "El usuario debe tener de 3 a 40 letras, numeros, punto o guion." };
  }
  if (password.length < 10) return { ok: false, error: "La contrasena debe tener al menos 10 caracteres." };
  // Solo entra si sigue sin haber dueno: dos altas al mismo tiempo no dejan dos.
  const creadas = await clientePublico.$executeRaw`
    INSERT INTO plataforma.dueno (usuario, password_hash)
    SELECT ${limpio}, ${await hashPassword(password)}
     WHERE NOT EXISTS (SELECT 1 FROM plataforma.dueno)`;
  if (creadas !== 1) return { ok: false, error: "La cuenta del dueno ya existe." };
  return iniciarDueno(limpio, password);
}

export async function iniciarDueno(
  usuario: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await asegurarTablasPlataforma();
  const [dueno] = await clientePublico.$queryRaw<
    { id: number; usuario: string; password_hash: string; intentos_fallidos: number; bloqueado_hasta: Date | null }[]
  >`SELECT id, usuario, password_hash, intentos_fallidos, bloqueado_hasta
      FROM plataforma.dueno WHERE usuario = ${usuario.trim().toLowerCase()}`;
  if (!dueno) return { ok: false, error: "Usuario o contrasena incorrectos." };
  if (dueno.bloqueado_hasta && dueno.bloqueado_hasta > new Date()) {
    return { ok: false, error: "Cuenta bloqueada por intentos fallidos. Espera unos minutos." };
  }
  if (!(await verificarPassword(password, dueno.password_hash))) {
    const intentos = dueno.intentos_fallidos + 1;
    const bloqueo = intentos >= MAX_INTENTOS ? new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) : null;
    await clientePublico.$executeRaw`
      UPDATE plataforma.dueno SET intentos_fallidos = ${intentos}, bloqueado_hasta = ${bloqueo}
       WHERE id = ${dueno.id}`;
    return { ok: false, error: "Usuario o contrasena incorrectos." };
  }
  await clientePublico.$executeRaw`
    UPDATE plataforma.dueno SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ${dueno.id}`;

  const almacen = await cookies();
  almacen.set(COOKIE_DUENO, await firmarDato({ dueno: dueno.id, usuario: dueno.usuario }, HORAS_SESION), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/plataforma",
    maxAge: HORAS_SESION * 3600,
  });
  return { ok: true };
}

export async function duenoActual(): Promise<{ id: number; usuario: string } | null> {
  if (!modoPlataforma()) return null;
  const token = (await cookies()).get(COOKIE_DUENO)?.value;
  const datos = token ? await verificarDato(token) : null;
  if (!datos?.dueno) return null;
  return { id: Number(datos.dueno), usuario: String(datos.usuario ?? "") };
}

export async function requerirDueno() {
  const dueno = await duenoActual();
  if (!dueno) redirect("/plataforma");
  return dueno;
}

export async function cerrarSesionDueno() {
  (await cookies()).delete({ name: COOKIE_DUENO, path: "/plataforma" });
}
