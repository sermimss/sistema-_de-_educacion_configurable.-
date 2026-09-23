/**
 * Siembra la configuracion base y, con SEED_DEMO=1, un colegio de ejemplo
 * para poder navegar el sistema sin capturar nada a mano.
 *
 *   npm run db:seed              -> solo parametros de configuracion
 *   SEED_DEMO=1 npm run db:seed  -> ademas datos de demostracion
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATALOGO_CONFIGURACION } from "../src/lib/configuracion";

const db = new PrismaClient();

async function sembrarConfiguracion() {
  let creadas = 0;
  for (const definicion of CATALOGO_CONFIGURACION) {
    const existente = await db.configuracion.findUnique({ where: { clave: definicion.clave } });
    if (existente) continue;
    await db.configuracion.create({
      data: {
        clave: definicion.clave,
        valor: definicion.valor,
        tipo: definicion.tipo,
        categoria: definicion.categoria,
        etiqueta: definicion.etiqueta,
        descripcion: definicion.descripcion,
        opciones: definicion.opciones ?? undefined,
        editable: definicion.editable ?? true,
        orden: definicion.orden ?? 0,
      },
    });
    creadas++;
  }
  console.log(`Configuracion: ${creadas} parametro(s) creado(s), ${CATALOGO_CONFIGURACION.length} en total.`);
}

async function sembrarDemostracion() {
  const yaInstalado = await db.institucion.findUnique({ where: { id: 1 } });
  if (yaInstalado?.instalado) {
    console.log("Ya hay una institucion instalada; no se toca nada.");
    return;
  }

  console.log("Creando colegio de demostracion...");

  await db.institucion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nombre: "Colegio de Demostracion",
      nombreCorto: "Demo",
      lema: "Ejemplo para probar el sistema",
      colorPrimario: "#1d4ed8",
      ciudad: "Ciudad de Mexico",
      pais: "Mexico",
      moneda: "MXN",
      instalado: true,
      fechaInstalacion: new Date(),
    },
  });

  const plantel = await db.plantel.create({ data: { nombre: "Plantel Centro", clave: "CEN" } });
  const turno = await db.turno.create({
    data: { nombre: "Matutino", horaInicio: "07:00", horaFin: "14:00", orden: 0 },
  });

  const nivel = await db.nivelEducativo.create({
    data: { nombre: "Bachillerato", clave: "BACH", tipoPeriodo: "SEMESTRE", orden: 0 },
  });

  const plan = await db.planEstudios.create({
    data: { nombre: "Bachillerato General", clave: "BG-01", nivelId: nivel.id, duracionPeriodos: 6 },
  });

  const grados = [];
  for (let numero = 1; numero <= plan.duracionPeriodos; numero++) {
    grados.push(
      await db.grado.create({
        data: { planId: plan.id, numero, nombre: `${numero}o Semestre`, orden: numero },
      })
    );
  }

  const ciclo = await db.cicloEscolar.create({
    data: {
      nombre: "Ciclo escolar 2026-2027",
      clave: "2026-2027",
      fechaInicio: new Date("2026-08-17"),
      fechaFin: new Date("2027-07-09"),
      estado: "ACTIVO",
    },
  });

  // Las fechas de los parciales se reparten entre el inicio y el fin del ciclo,
  // igual que lo hace el asistente de instalacion.
  const NUMERO_PARCIALES = 3;
  const inicioCiclo = ciclo.fechaInicio.getTime();
  const duracionParcial = (ciclo.fechaFin.getTime() - inicioCiclo) / NUMERO_PARCIALES;
  for (let numero = 1; numero <= NUMERO_PARCIALES; numero++) {
    await db.periodoEvaluacion.create({
      data: {
        cicloId: ciclo.id,
        numero,
        nombre: `Parcial ${numero}`,
        fechaInicio: new Date(inicioCiclo + duracionParcial * (numero - 1)),
        fechaFin:
          numero === NUMERO_PARCIALES
            ? ciclo.fechaFin
            : new Date(inicioCiclo + duracionParcial * numero - 86_400_000),
        capturaAbierta: numero === 1,
      },
    });
  }

  const escala = await db.escalaCalificacion.create({
    data: {
      nombre: "Escala 0 a 100",
      tipo: "NUMERICA",
      valorMinimo: 0,
      valorMaximo: 100,
      decimales: 2,
      redondeo: "NINGUNO",
      minimaAprobatoria: 70,
      predeterminada: true,
    },
  });

  const modulos = [
    { nombre: "Modulo 1", horaInicio: "07:00", horaFin: "07:50", esReceso: false },
    { nombre: "Modulo 2", horaInicio: "07:50", horaFin: "08:40", esReceso: false },
    { nombre: "Receso", horaInicio: "08:40", horaFin: "09:00", esReceso: true },
    { nombre: "Modulo 3", horaInicio: "09:00", horaFin: "09:50", esReceso: false },
  ];
  for (const [orden, modulo] of modulos.entries()) {
    await db.moduloHorario.create({ data: { ...modulo, orden } });
  }

  await db.conceptoCobro.createMany({
    data: [
      { clave: "INS", nombre: "Inscripcion", tipo: "INSCRIPCION", montoBase: 4500, periodicidad: "UNICO", diaVencimiento: 10, orden: 0 },
      { clave: "COL", nombre: "Colegiatura", tipo: "COLEGIATURA", montoBase: 2800, periodicidad: "MENSUAL", diaVencimiento: 10, orden: 1 },
      { clave: "MAT", nombre: "Material didactico", tipo: "MATERIAL", montoBase: 900, periodicidad: "SEMESTRAL", diaVencimiento: 10, orden: 2 },
    ],
  });

  await db.reglaRecargo.create({
    data: {
      nombre: "Recargo por pago tardio",
      tipoCalculo: "PORCENTAJE",
      valor: 10,
      diasGracia: 3,
      frecuencia: "UNICA",
      aplicaATodos: true,
    },
  });

  // Conceptos de nomina de ejemplo. Los porcentajes son inventados a
  // proposito: cada colegio captura los suyos, el sistema no calcula tablas
  // oficiales de ISR ni de seguridad social.
  await db.conceptoNomina.createMany({
    data: [
      { clave: "BONO-PUNT", nombre: "Bono de puntualidad", tipo: "PERCEPCION", tipoCalculo: "FIJO", valor: 500, gravable: true, orden: 0 },
      { clave: "RET-SUELDO", nombre: "Retencion sobre sueldo", tipo: "DEDUCCION", tipoCalculo: "PORCENTAJE", valor: 10, gravable: false, orden: 1 },
      { clave: "FONDO-AHO", nombre: "Fondo de ahorro", tipo: "DEDUCCION", tipoCalculo: "FIJO", valor: 200, gravable: false, orden: 2 },
    ],
  });

  const hash = await bcrypt.hash("Demo1234", 12);

  const usuarioAdmin = await db.usuario.create({
    data: { usuario: "admin", email: "admin@demo.mx", passwordHash: hash, rol: "ADMIN" },
  });
  await db.empleado.create({
    data: {
      numeroEmpleado: "ADMIN-001",
      usuarioId: usuarioAdmin.id,
      nombres: "Ana",
      apellidoPaterno: "Direccion",
      esDocente: false,
      puesto: "Administrador del sistema",
      email: "admin@demo.mx",
    },
  });

  const usuarioDocente = await db.usuario.create({
    data: { usuario: "docente", email: "docente@demo.mx", passwordHash: hash, rol: "DOCENTE" },
  });
  const docente = await db.empleado.create({
    data: {
      numeroEmpleado: "DOC-001",
      usuarioId: usuarioDocente.id,
      nombres: "Luis",
      apellidoPaterno: "Hernandez",
      esDocente: true,
      puesto: "Docente de Ciencias",
      tipoContrato: "TIEMPO_COMPLETO",
      salarioBase: 18000,
      email: "docente@demo.mx",
    },
  });

  const materias = await Promise.all(
    [
      { clave: "MAT-1", nombre: "Matematicas I" },
      { clave: "ESP-1", nombre: "Lengua y Literatura" },
      { clave: "ANA-1", nombre: "Anatomia I" },
      { clave: "ANA-2", nombre: "Anatomia II" },
    ].map((materia) => db.materia.create({ data: materia }))
  );

  const planMaterias = [];
  for (const [indice, materia] of materias.entries()) {
    planMaterias.push(
      await db.planMateria.create({
        data: {
          planId: plan.id,
          gradoId: indice === 3 ? grados[1].id : grados[0].id,
          materiaId: materia.id,
          creditos: 8,
          horasSemana: 4,
          orden: indice,
        },
      })
    );
  }

  // Anatomia II requiere Anatomia I aprobada.
  await db.prerrequisito.create({
    data: { planMateriaId: planMaterias[3].id, requierePlanMateriaId: planMaterias[2].id },
  });

  const grupo = await db.grupo.create({
    data: {
      nombre: "1A",
      cicloId: ciclo.id,
      planId: plan.id,
      gradoId: grados[0].id,
      plantelId: plantel.id,
      turnoId: turno.id,
      cupoMaximo: 30,
    },
  });

  for (const planMateria of planMaterias.slice(0, 3)) {
    await db.clase.create({
      data: {
        cicloId: ciclo.id,
        grupoId: grupo.id,
        planMateriaId: planMateria.id,
        docenteId: docente.id,
        escalaId: escala.id,
        modoAsistencia: "POR_CLASE",
      },
    });
  }

  const nombresAlumnos = [
    ["Sofia", "Ramirez", "Lopez"],
    ["Diego", "Torres", "Mendez"],
    ["Valeria", "Nunez", "Castro"],
    ["Mateo", "Flores", "Rivas"],
  ];

  for (const [indice, [nombres, paterno, materno]] of nombresAlumnos.entries()) {
    const matricula = `2026-${String(indice + 1).padStart(4, "0")}`;
    const usuarioAlumno = await db.usuario.create({
      data: { usuario: matricula, email: `${matricula}@demo.mx`, passwordHash: hash, rol: "ALUMNO" },
    });
    const alumno = await db.alumno.create({
      data: {
        matricula,
        usuarioId: usuarioAlumno.id,
        nombres,
        apellidoPaterno: paterno,
        apellidoMaterno: materno,
        planId: plan.id,
        plantelId: plantel.id,
        turnoId: turno.id,
        fechaIngreso: new Date("2026-08-17"),
      },
    });
    await db.tutor.create({
      data: {
        alumnoId: alumno.id,
        nombre: `Tutor de ${nombres}`,
        parentesco: "Madre/Padre",
        telefono: "55-0000-0000",
        esResponsableFinanciero: true,
        esContactoEmergencia: true,
      },
    });
    await db.inscripcion.create({
      data: { alumnoId: alumno.id, cicloId: ciclo.id, grupoId: grupo.id, gradoId: grados[0].id },
    });
    // Inscribir al grupo no basta: el alumno tambien entra a cada clase abierta,
    // que es donde viven calificaciones y asistencia.
    const clasesDelGrupo = await db.clase.findMany({ where: { grupoId: grupo.id } });
    await db.alumnoClase.createMany({
      data: clasesDelGrupo.map((clase) => ({ claseId: clase.id, alumnoId: alumno.id })),
      skipDuplicates: true,
    });
  }

  console.log("Demostracion lista.");
  console.log("  Admin:   admin / Demo1234");
  console.log("  Docente: docente / Demo1234");
  console.log("  Alumno:  2026-0001 / Demo1234");
}

async function main() {
  await sembrarConfiguracion();
  if (process.env.SEED_DEMO === "1") await sembrarDemostracion();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
