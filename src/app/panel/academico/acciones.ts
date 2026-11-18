"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { TipoPeriodoAcademico } from "@prisma/client";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { convertirPlan, crearVersionPlan, etiquetaModalidad, validarCambio } from "@/lib/modalidad";

export type EstadoModalidad = { error?: string };

export async function accionCambiarModalidad(_p: EstadoModalidad, formData: FormData): Promise<EstadoModalidad> {
  const sesion = await requerirRol("ADMIN");
  const planId = Number(formData.get("planId"));
  const plan = await db.planEstudios.findUnique({
    where: { id: planId || 0 },
    include: { _count: { select: { grupos: true, alumnos: true } } },
  });
  if (!plan) return { error: "Ese plan ya no existe." };

  const cambio = {
    modalidad: String(formData.get("modalidad")) as TipoPeriodoAcademico,
    periodos: Number(formData.get("periodos")),
    plantilla: String(formData.get("plantilla") ?? "").trim(),
  };
  const problema = validarCambio(cambio);
  if (problema) return { error: problema };
  if (cambio.modalidad === plan.modalidad && cambio.periodos === plan.duracionPeriodos) {
    return { error: "Elegiste la misma modalidad y los mismos periodos que ya tiene." };
  }

  const enUso = plan._count.grupos + plan._count.alumnos > 0;
  if (!enUso) {
    await db.$transaction((tx) => convertirPlan(tx, plan.id, cambio), { timeout: 30_000 });
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "ACTUALIZAR",
      entidad: "PlanEstudios",
      entidadId: plan.id,
      descripcion: `Plan ${plan.clave} convertido de ${etiquetaModalidad(plan.modalidad)} (${plan.duracionPeriodos}) a ${etiquetaModalidad(cambio.modalidad)} (${cambio.periodos})`,
    });
    revalidatePath("/panel/academico");
    redirect(`/panel/academico/plan/${plan.id}?cambiado=convertido`);
  }

  // Con alumnos o grupos: version nueva del plan.
  const nombre = String(formData.get("nombre") ?? "").trim();
  const clave = String(formData.get("clave") ?? "").trim().toUpperCase();
  if (nombre.length < 3) return { error: "Escribe el nombre del plan nuevo." };
  if (!/^[A-Z0-9._-]{2,30}$/.test(clave)) return { error: "La clave del plan nuevo debe tener de 2 a 30 letras, numeros, punto o guion." };
  if (await db.planEstudios.findUnique({ where: { clave } })) return { error: `Ya existe un plan con la clave ${clave}.` };

  const nuevo = await db.$transaction(
    (tx) =>
      crearVersionPlan(tx, plan.id, {
        ...cambio,
        nombre: nombre.slice(0, 150),
        clave,
        copiarMaterias: formData.get("copiarMaterias") === "on",
      }),
    { timeout: 60_000 }
  );
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "PlanEstudios",
    entidadId: nuevo.id,
    descripcion: `Plan ${nuevo.clave} (${etiquetaModalidad(cambio.modalidad)}, ${cambio.periodos} periodos) creado como version nueva de ${plan.clave}, que deja de recibir nuevo ingreso`,
  });
  revalidatePath("/panel/academico");
  redirect(`/panel/academico/plan/${nuevo.id}?cambiado=version&anterior=${plan.id}`);
}
