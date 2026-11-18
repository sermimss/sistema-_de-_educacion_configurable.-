import { requerirRol } from "@/lib/auth";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { configBool, configJson } from "@/lib/configuracion";
import { empleadoDeSesion } from "@/lib/docencia";
import { bloquesDelAlumno, bloquesDelDocente } from "@/lib/horarioSemanal";
import { obtenerInstitucion } from "@/lib/institucion";
import { ahoraEnZona } from "@/lib/reuniones";
import { CuadroHorario, ClasesDeHoy } from "@/components/CuadroHorario";
import { Alerta, EstadoVacio, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

/// Horario de la semana: el alumno ve las clases de su grupo; el docente, las
/// de todos sus grupos. Cada clase con su boton de Google Meet si lo tiene.
export default async function PaginaMiHorario() {
  const sesion = await requerirRol("ALUMNO", "DOCENTE");
  const [institucion, diasHabiles] = await Promise.all([
    obtenerInstitucion(),
    configJson<number[]>("horarios.dias_habiles", [1, 2, 3, 4, 5]),
  ]);
  const ahora = ahoraEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");

  let bloques;
  let descripcion = "";
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;
    if (!(await configBool("portales.alumno_ve_horario", true))) {
      return <Alerta tipo="aviso">El colegio tiene desactivada esta seccion.</Alerta>;
    }
    const delAlumno = await bloquesDelAlumno(alumno.id);
    if (!delAlumno.ciclo) return <Alerta tipo="aviso">Aun no estas inscrito en ningun grupo.</Alerta>;
    bloques = delAlumno.bloques;
    descripcion = `${delAlumno.ciclo}${delAlumno.grupo ? ` · grupo ${delAlumno.grupo}` : ""}`;
  } else {
    if (!(await empleadoDeSesion(sesion.usuarioId))) {
      return <Alerta tipo="aviso">Tu usuario no esta ligado a un registro de personal.</Alerta>;
    }
    bloques = await bloquesDelDocente(sesion.usuarioId);
    descripcion = `${new Set(bloques.map((b) => b.titulo + b.detalle)).size} clase(s) a la semana`;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Mi horario</h1>
        <p className="mt-1 text-sm text-slate-600">{descripcion}</p>
      </header>

      {bloques.length === 0 ? (
        <Tarjeta>
          <EstadoVacio titulo="Tu horario aun no esta publicado" mensaje="Cuando control escolar lo cargue, aparecera aqui." />
        </Tarjeta>
      ) : (
        <>
          <Tarjeta titulo="Hoy">
            <ClasesDeHoy bloques={bloques} ahora={ahora} />
          </Tarjeta>
          <Tarjeta titulo="La semana">
            <CuadroHorario bloques={bloques} diasHabiles={diasHabiles} ahora={ahora} />
          </Tarjeta>
        </>
      )}
    </div>
  );
}
