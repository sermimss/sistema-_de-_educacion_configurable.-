#!/usr/bin/env node
// Recupera el acceso del administrador en una instalacion de un solo colegio
// (las computadoras del colegio). Se corre en la computadora donde esta la
// base de datos, la principal si hay varias en red:
//
//   Linux:    ./restablecer-admin.sh
//   Windows:  clic derecho en restablecer-admin.cmd > Ejecutar como administrador
//
// Muestra las cuentas de administrador, le pone una contrasena temporal a la
// elegida y obliga a cambiarla al entrar. Solo puede usarlo quien tiene acceso
// a esta computadora y a su archivo 'entorno', que es lo que lo hace seguro.
//
//   node scripts/restablecer-admin.mjs            elige de la lista
//   node scripts/restablecer-admin.mjs direccion  restablece esa cuenta

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function salir(mensaje) {
  console.error(`\n${mensaje}\n`);
  process.exit(1);
}

// La cadena de conexion sale del archivo 'entorno' de la instalacion (o del
// .env en una copia de desarrollo), salvo que ya venga en el ambiente.
if (!process.env.DATABASE_URL) {
  for (const nombre of ["entorno", ".env"]) {
    const archivo = path.join(raiz, nombre);
    if (!existsSync(archivo)) continue;
    try {
      for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
        const m = linea.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      salir(
        `No se pudo leer el archivo '${nombre}'. En Windows, ejecuta este programa como administrador ` +
          "(clic derecho > Ejecutar como administrador); en Linux, con sudo."
      );
    }
    break;
  }
}
if (process.env.MODO_PLATAFORMA === "1") {
  salir("Esta instalacion es la plataforma en internet: ahi el dueno genera un enlace de recuperacion desde su panel.");
}
if (!process.env.DATABASE_URL) salir("No se encontro la cadena de conexion (DATABASE_URL) en el archivo 'entorno'.");

const { PrismaClient } = await import("@prisma/client");
const bcrypt = (await import("bcryptjs")).default;
const db = new PrismaClient();

try {
  const cuentas = await db.usuario.findMany({
    where: { rol: "ADMIN" },
    include: { empleado: true },
    orderBy: { id: "asc" },
  });
  if (cuentas.length === 0) {
    salir("Esta base no tiene cuentas de administrador. Si hay varias computadoras en red, corre esto en la principal.");
  }

  const descripcion = (c) =>
    `${c.usuario}${c.empleado ? ` (${c.empleado.nombres} ${c.empleado.apellidoPaterno})` : ""}${c.activo ? "" : " [desactivada]"}`;

  let elegida = null;
  const pedida = process.argv[2]?.trim().toLowerCase();
  if (pedida) {
    elegida = cuentas.find((c) => c.usuario === pedida || c.email === pedida);
    if (!elegida) salir(`No hay una cuenta de administrador llamada "${pedida}".`);
  } else if (cuentas.length === 1) {
    elegida = cuentas[0];
  } else {
    console.log("\nCuentas de administrador:");
    cuentas.forEach((c, i) => console.log(`  ${i + 1}. ${descripcion(c)}`));
    const consola = createInterface({ input: process.stdin, output: process.stdout });
    const respuesta = await consola.question("\nNumero de la cuenta a restablecer: ");
    consola.close();
    elegida = cuentas[Number(respuesta) - 1];
    if (!elegida) salir("Numero invalido. No se cambio nada.");
  }

  // Igual que en el sistema: cuatro letras y cuatro numeros faciles de dictar.
  const de = (alfabeto, n) => Array.from({ length: n }, () => alfabeto[randomInt(alfabeto.length)]).join("");
  const temporal = `${de("ABCDEFGHJKMNPQRSTUVWXYZ", 4)}-${de("23456789", 4)}`;

  await db.$transaction([
    db.usuario.update({
      where: { id: elegida.id },
      data: {
        passwordHash: await bcrypt.hash(temporal, 12),
        debeCambiarPassword: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        activo: true,
      },
    }),
    db.sesion.updateMany({ where: { usuarioId: elegida.id, revocada: false }, data: { revocada: true } }),
    db.bitacora.create({
      data: {
        usuarioId: elegida.id,
        accion: "ACTUALIZAR",
        entidad: "Usuario",
        entidadId: String(elegida.id),
        descripcion: "Contrasena restablecida desde la computadora del servidor (restablecer-admin)",
      },
    }),
  ]);

  console.log("\n==============================================");
  console.log(" Acceso de administracion restablecido");
  console.log("==============================================");
  console.log(`  Usuario:              ${elegida.usuario}`);
  console.log(`  Contrasena temporal:  ${temporal}`);
  console.log("\n Al entrar, el sistema pedira cambiarla.");
  console.log(" Anota tu usuario y tu nueva contrasena en un lugar seguro.\n");
} finally {
  await db.$disconnect();
}
