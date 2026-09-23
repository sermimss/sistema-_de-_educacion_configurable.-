// Calcula el cierre de dependencias de uno o varios paquetes dentro de
// node_modules, para copiar al paquete instalable solo lo necesario.
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const raiz = process.argv[2];
const semillas = process.argv.slice(3);
const vistos = new Set();
const pendientes = [];

function raizDelPaquete(archivo, nombre) {
  let dir = path.dirname(archivo);
  while (dir !== path.dirname(dir)) {
    const pj = path.join(dir, "package.json");
    if (existsSync(pj)) {
      try {
        if (JSON.parse(readFileSync(pj, "utf8")).name === nombre) return dir;
      } catch { /* sigue subiendo */ }
    }
    dir = path.dirname(dir);
  }
  return null;
}

function agregar(nombre, desde) {
  const req = createRequire(path.join(desde, "noop.js"));
  let dir = null;
  try {
    dir = path.dirname(req.resolve(`${nombre}/package.json`));
  } catch {
    try { dir = raizDelPaquete(req.resolve(nombre), nombre); } catch { return; }
  }
  if (!dir || vistos.has(dir)) return;
  vistos.add(dir);
  pendientes.push(dir);
}

for (const s of semillas) agregar(s, raiz);

while (pendientes.length) {
  const dir = pendientes.pop();
  let pkg;
  try { pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")); } catch { continue; }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}) };
  for (const nombre of Object.keys(deps)) agregar(nombre, dir);
}

for (const dir of [...vistos].sort()) console.log(path.relative(raiz, dir));
