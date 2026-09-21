"use server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { registrarBitacora } from "@/lib/bitacora";
import { guardarConfig, sembrarConfiguracion } from "@/lib/configuracion";
import { esquemaInstalacion, type DatosInstalacion } from "@/lib/esquemas-instalacion";

export type ResultadoInstalacion =
  | { ok: true; mensaje: string }
  | { ok: false; error: string; detalles?: string[] };

/// Ejecuta la instalacion inicial completa. Es idempotente en el sentido
/// de que se niega a correr dos veces: si ya hay una institucion instalada
/// aborta sin tocar nada.
export async function instalarSistema(datos: DatosInstalacion): Promise<ResultadoInstalacion> {
  const validacion = esquemaInstalacion.safeParse(datos);
  if (!validacion.success) {
    return {
      ok: false,
      error: "Hay datos incompletos o invalidos en el asistente.",
      detalles: validacion.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  const d = validacion.data;

  const existente = await db.institucion.findUnique({ where: { id: 1 } });
  if (existente?.instalado) {
    return { ok: false, error: "El sistema ya fue instalado. Ingresa con tu cuenta de administrador." };
  }

  // Validaciones de negocio que el esquema no puede cubrir por si solo.
  const clavesNivel = new Set(d.niveles.map((n) => n.clave));
  const planHuerfano = d.planes.find((p) => !clavesNivel.has(p.nivelClave));
  if (planHuerfano) {
    return { ok: false, error: `El plan "${planHuerfano.nombre}" apunta a un nivel que no existe.` };
  }
  if (new Date(d.ciclo.fechaFin) <= new Date(d.ciclo.fechaInicio)) {
    return { ok: false, error: "La fecha de fin del ciclo debe ser posterior a la de inicio." };
  }
  if (d.escala.minimaAprobatoria < d.escala.valorMinimo || d.escala.minimaAprobatoria > d.escala.valorMaximo) {
    return { ok: false, error: "La calificacion minima aprobatoria debe estar dentro de la escala." };
  }
  if (d.escala.valorMaximo <= d.escala.valorMinimo) {
    return { ok: false, error: "El valor maximo de la escala debe ser mayor al minimo." };
  }

  try {
    const idAdministrador = await db.$transaction(
      async (tx) => {
        // 1. Identidad de la institucion
        await tx.institucion.upsert({
          where: { id: 1 },
          update: {},
          create: { id: 1, nombre: d.institucion.nombre },
        });
        await tx.institucion.update({
          where: { id: 1 },
          data: {
            ...d.institucion,
            email: d.institucion.email || null,
            colorSecundario: d.institucion.colorSecundario ?? "#0f172a",
            instalado: true,
            fechaInstalacion: new Date(),
          },
        });

        // 2. Planteles y turnos
        for (const plantel of d.planteles) {
          await tx.plantel.create({ data: plantel });
        }
        for (const [indice, turno] of d.turnos.entries()) {
          await tx.turno.create({ data: { ...turno, orden: indice } });
        }

        // 3. Niveles, planes y grados (un grado por cada periodo del plan)
        const nivelesPorClave = new Map<string, number>();
        for (const [indice, nivel] of d.niveles.entries()) {
          const creado = await tx.nivelEducativo.create({ data: { ...nivel, orden: indice } });
          nivelesPorClave.set(nivel.clave, creado.id);
        }
        for (const plan of d.planes) {
          const nivelId = nivelesPorClave.get(plan.nivelClave)!;
          const planCreado = await tx.planEstudios.create({
            data: {
              nombre: plan.nombre,
              clave: plan.clave,
              nivelId,
              duracionPeriodos: plan.duracionPeriodos,
              creditosTotales: plan.creditosTotales || null,
            },
          });
          for (let numero = 1; numero <= plan.duracionPeriodos; numero++) {
            await tx.grado.create({
              data: {
                planId: planCreado.id,
                numero,
                nombre: plan.plantillaGrado.replace(/\{N\}/g, String(numero)),
                orden: numero,
              },
            });
          }
        }

        // 4. Ciclo escolar y periodos de evaluacion
        const inicio = new Date(d.ciclo.fechaInicio);
        const fin = new Date(d.ciclo.fechaFin);
        const ciclo = await tx.cicloEscolar.create({
          data: {
            nombre: d.ciclo.nombre,
            clave: d.ciclo.clave,
            fechaInicio: inicio,
            fechaFin: fin,
            estado: "ACTIVO",
            activo: true,
          },
        });
        const duracionTotal = fin.getTime() - inicio.getTime();
        const duracionPeriodo = duracionTotal / d.ciclo.numeroPeriodos;
        for (let numero = 1; numero <= d.ciclo.numeroPeriodos; numero++) {
          const desde = new Date(inicio.getTime() + duracionPeriodo * (numero - 1));
          const hasta = new Date(inicio.getTime() + duracionPeriodo * numero - 86_400_000);
          await tx.periodoEvaluacion.create({
            data: {
              cicloId: ciclo.id,
              numero,
              nombre: d.ciclo.plantillaPeriodo.replace(/\{N\}/g, String(numero)),
              fechaInicio: desde,
              fechaFin: numero === d.ciclo.numeroPeriodos ? fin : hasta,
              capturaAbierta: numero === 1,
            },
          });
        }

        // 5. Escala de calificacion
        await tx.escalaCalificacion.create({
          data: { ...d.escala, predeterminada: true, activa: true },
        });

        // 6. Modulos de horario
        for (const [indice, modulo] of d.horarios.modulos.entries()) {
          await tx.moduloHorario.create({ data: { ...modulo, orden: indice } });
        }

        // 7. Conceptos de cobro y regla de recargo
        for (const [indice, concepto] of d.finanzas.conceptos.entries()) {
          await tx.conceptoCobro.create({
            data: {
              ...concepto,
              diaVencimiento: concepto.diaVencimiento ?? d.finanzas.diaVencimientoDefault,
              orden: indice,
            },
          });
        }
        if (d.finanzas.recargoActivo) {
          await tx.reglaRecargo.create({
            data: {
              nombre: "Recargo por pago tardio",
              tipoCalculo: d.finanzas.recargoTipoCalculo,
              valor: d.finanzas.recargoValor,
              diasGracia: d.finanzas.recargoDiasGracia,
              frecuencia: "UNICA",
              aplicaATodos: true,
              activa: true,
            },
          });
        }

        // 8. Cuenta de administrador + su registro de personal
        const usuario = await tx.usuario.create({
          data: {
            usuario: d.administrador.usuario.toLowerCase(),
            email: d.administrador.email.toLowerCase(),
            passwordHash: await hashPassword(d.administrador.password),
            rol: "ADMIN",
            activo: true,
          },
        });
        await tx.empleado.create({
          data: {
            numeroEmpleado: "ADMIN-001",
            usuarioId: usuario.id,
            nombres: d.administrador.nombres,
            apellidoPaterno: d.administrador.apellidoPaterno,
            apellidoMaterno: d.administrador.apellidoMaterno || null,
            esDocente: false,
            puesto: "Administrador del sistema",
            email: d.administrador.email.toLowerCase(),
            estado: "ACTIVO",
          },
        });

        return usuario.id;
      },
      { timeout: 60_000, maxWait: 15_000 }
    );

    // 9. Parametros configurables derivados del asistente
    await sembrarConfiguracion();
    const ajustes: Array<[string, string]> = [
      ["asistencia.docente_decide_modo", String(d.asistencia.docenteDecideModo)],
      ["asistencia.modo_predeterminado", d.asistencia.modoPredeterminado],
      ["asistencia.docente_decide_afectacion", String(d.asistencia.docenteDecideAfectacion)],
      ["asistencia.faltas_consecutivas_alerta", String(d.asistencia.faltasConsecutivasAlerta)],
      ["asistencia.retardos_equivalen_falta", String(d.asistencia.retardosEquivalenFalta)],
      ["horarios.dias_habiles", JSON.stringify(d.horarios.diasHabiles)],
      ["horarios.duracion_modulo_minutos", String(d.horarios.duracionModuloMinutos)],
      ["finanzas.dia_vencimiento_default", String(d.finanzas.diaVencimientoDefault)],
      ["finanzas.permite_pagos_parciales", String(d.finanzas.permitePagosParciales)],
      ["finanzas.permite_convenios", String(d.finanzas.permiteConvenios)],
      ["finanzas.serie_recibo", d.finanzas.serieRecibo],
      ["finanzas.leyenda_recibo", d.finanzas.leyendaRecibo],
      ["finanzas.bloquear_por_adeudo", String(d.finanzas.bloquearPorAdeudo)],
    ];
    for (const [clave, valor] of ajustes) {
      await guardarConfig(clave, valor, idAdministrador);
    }
    await registrarBitacora({
      usuarioId: idAdministrador,
      accion: "CONFIGURAR",
      entidad: "Institucion",
      entidadId: "1",
      descripcion: `Instalacion inicial completada para ${d.institucion.nombre}`,
    });

    return { ok: true, mensaje: "Instalacion completada." };
  } catch (error) {
    console.error("[instalacion] error:", error);
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      ok: false,
      error: mensaje.includes("Unique constraint")
        ? "Hay claves repetidas (plantel, nivel, plan, turno o concepto). Revisa que cada clave sea unica."
        : `No se pudo completar la instalacion: ${mensaje}`,
    };
  }
}
