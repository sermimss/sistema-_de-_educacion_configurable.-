#!/usr/bin/env node
// Pone al dia el espacio de cada colegio de la plataforma con las migraciones
// nuevas. Lo corre el arranque en modo plataforma, despues de migrar la base
// compartida. Un colegio que falla no detiene a los demas.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(raiz, "node_modules", "prisma", "build", "index.js");
const esquemaPrisma = path.join(raiz, "prisma", "schema.prisma");

const db = new PrismaClient();
let esquemas = [];
try {
  const filas = await db.$queryRawUnsafe(
    "SELECT esquema FROM plataforma.colegio WHERE esquema IS NOT NULL ORDER BY id"
  );
  esquemas = filas.map((f) => f.esquema).filter((e) => /^colegio_\d{1,9}$/.test(e));
} catch {
  // La plataforma aun no tiene tablas: no hay colegios que migrar.
} finally {
  await db.$disconnect();
}

let fallidos = 0;
for (const esquema of esquemas) {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("schema", esquema);
  try {
    execFileSync(process.execPath, [cli, "migrate", "deploy", "--schema", esquemaPrisma], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 180_000,
    });
    console.log(`[colegios] ${esquema} al dia`);
  } catch (error) {
    fallidos++;
    console.error(`[colegios] ${esquema} fallo: ${String(error.stderr ?? error.message).slice(0, 500)}`);
  }
}
console.log(`[colegios] ${esquemas.length - fallidos} de ${esquemas.length} colegio(s) al dia`);
process.exit(fallidos ? 1 : 0);
