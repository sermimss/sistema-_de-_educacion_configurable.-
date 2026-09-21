import { db } from "./db";
import { configTexto } from "./configuracion";
import { resolverPlantilla } from "./formato";

/// Genera la siguiente matricula segun la plantilla configurada por la escuela
/// (por ejemplo {ANIO}-{CONSECUTIVO:4}). Reintenta si la matricula resultante
/// ya existe, lo que puede pasar si se importaron alumnos con otro criterio.
export async function generarMatricula(datos?: { nivel?: string; plan?: string }): Promise<string> {
  const plantilla = await configTexto("academico.plantilla_matricula", "{ANIO}-{CONSECUTIVO:4}");
  const anio = new Date().getFullYear();
  const inicioAnio = new Date(anio, 0, 1);

  const yaCreados = await db.alumno.count({ where: { creadoEn: { gte: inicioAnio } } });

  for (let intento = 0; intento < 200; intento++) {
    const candidata = resolverPlantilla(plantilla, {
      consecutivo: yaCreados + 1 + intento,
      nivel: datos?.nivel,
      plan: datos?.plan,
    });
    const existente = await db.alumno.findUnique({ where: { matricula: candidata } });
    if (!existente) return candidata;
  }

  // Salida de emergencia: nunca debe llegar aqui con una plantilla sana.
  return `${anio}-${Date.now().toString().slice(-6)}`;
}

/// Consecutivo para los folios que usan plantilla (cargos, pagos, nomina).
export async function siguienteFolio(
  plantilla: string,
  contarExistentes: () => Promise<number>
): Promise<string> {
  const total = await contarExistentes();
  return resolverPlantilla(plantilla, { consecutivo: total + 1 });
}
