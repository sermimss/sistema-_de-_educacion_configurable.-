import { randomInt } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "./password";

/// Recuperar el acceso de una cuenta de un colegio. Se usa desde la bandeja
/// de solicitudes de acceso, desde el enlace que genera el dueno de la
/// plataforma y, en espiritu, desde el comando local (que no puede importar
/// esto y repite la misma logica).

/// Sin letras ni numeros que se confunden al dictarlos (0/O, 1/I/L).
const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const NUMEROS = "23456789";

/// Contrasena temporal facil de dictar: cuatro letras, guion y cuatro
/// numeros (KPMR-4827). Cumple las reglas minimas y la persona debe
/// cambiarla al entrar.
export function contrasenaTemporal(): string {
  const de = (alfabeto: string, n: number) =>
    Array.from({ length: n }, () => alfabeto[randomInt(alfabeto.length)]).join("");
  return `${de(LETRAS, 4)}-${de(NUMEROS, 4)}`;
}

type Cliente = PrismaClient | Prisma.TransactionClient;

/// Pone una contrasena nueva, quita el bloqueo por intentos y cierra las
/// sesiones abiertas de esa cuenta (por si alguien mas la estaba usando).
export async function restablecerCuenta(
  cliente: Cliente,
  usuarioId: number,
  password: string,
  opciones: { temporal: boolean }
) {
  await cliente.usuario.update({
    where: { id: usuarioId },
    data: {
      passwordHash: await hashPassword(password),
      debeCambiarPassword: opciones.temporal,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  });
  await cliente.sesion.updateMany({ where: { usuarioId, revocada: false }, data: { revocada: true } });
}
