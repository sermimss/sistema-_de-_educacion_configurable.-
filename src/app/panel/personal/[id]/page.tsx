import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { configBool } from "@/lib/configuracion";
import { formatearFecha } from "@/lib/formato";
import { Alerta, Boton, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import FormularioEmpleado from "../FormularioEmpleado";
import { reiniciarPasswordEmpleado } from "../acciones";

export const dynamic = "force-dynamic";

export default async function PaginaEmpleado({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  await requerirRol("ADMIN");
  const { id } = await params;
  const { creado } = await searchParams;
  const empleadoId = Number(id);
  if (!Number.isFinite(empleadoId)) notFound();

  const empleado = await db.empleado.findUnique({
    where: { id: empleadoId },
    include: {
      usuario: { select: { usuario: true, rol: true, ultimoAcceso: true, debeCambiarPassword: true } },
      clases: {
        include: {
          grupo: { select: { nombre: true } },
          planMateria: { include: { materia: { select: { nombre: true } } } },
          ciclo: { select: { nombre: true } },
        },
      },
    },
  });
  if (!empleado) notFound();

  const nominaActiva = await configBool("nomina.activa", true);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/panel/personal" className="text-sm text-marca-600 hover:underline">
            ← Personal
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{nombreCompleto(empleado)}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{empleado.numeroEmpleado}</p>
        </div>
        <Insignia tono={empleado.estado === "ACTIVO" ? "exito" : "alerta"}>
          {empleado.estado.toLowerCase()}
        </Insignia>
      </header>

      {creado === "1" && (
        <Alerta tipo="exito">
          Registro creado.
          {empleado.usuario &&
            ` Su cuenta es "${empleado.usuario.usuario}" con el numero de empleado como contrasena temporal.`}
        </Alerta>
      )}

      <FormularioEmpleado
        nominaActiva={nominaActiva}
        empleado={{
          id: empleado.id,
          numeroEmpleado: empleado.numeroEmpleado,
          nombres: empleado.nombres,
          apellidoPaterno: empleado.apellidoPaterno,
          apellidoMaterno: empleado.apellidoMaterno,
          esDocente: empleado.esDocente,
          puesto: empleado.puesto,
          gradoAcademico: empleado.gradoAcademico,
          email: empleado.email,
          telefono: empleado.telefono,
          rfc: empleado.rfc,
          curp: empleado.curp,
          nss: empleado.nss,
          tipoContrato: empleado.tipoContrato,
          salarioBase: empleado.salarioBase ? String(empleado.salarioBase) : null,
          pagoPorHora: empleado.pagoPorHora ? String(empleado.pagoPorHora) : null,
          banco: empleado.banco,
          clabe: empleado.clabe,
          estado: empleado.estado,
          tieneUsuario: Boolean(empleado.usuarioId),
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Clases asignadas">
          {empleado.clases.length === 0 ? (
            <EstadoVacio
              titulo="Sin clases asignadas"
              mensaje="Se asignan desde la pantalla del grupo."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {empleado.clases.map((clase) => (
                <li key={clase.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-800">{clase.planMateria.materia.nombre}</span>
                  <span className="text-xs text-slate-500">
                    {clase.grupo.nombre} · {clase.ciclo.nombre}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Acceso al sistema">
          {empleado.usuario ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Usuario</span>
                <span className="font-mono text-slate-900">{empleado.usuario.usuario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Rol</span>
                <span className="text-slate-900">{empleado.usuario.rol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ultimo acceso</span>
                <span className="text-slate-900">
                  {empleado.usuario.ultimoAcceso
                    ? formatearFecha(empleado.usuario.ultimoAcceso)
                    : "Nunca"}
                </span>
              </div>
              {empleado.usuario.debeCambiarPassword && (
                <Alerta tipo="aviso">Debe cambiar su contrasena en el proximo acceso.</Alerta>
              )}
              <form action={reiniciarPasswordEmpleado}>
                <input type="hidden" name="empleadoId" value={empleado.id} />
                <Boton type="submit" variante="secundario">
                  Reiniciar contrasena
                </Boton>
              </form>
            </div>
          ) : (
            <EstadoVacio titulo="Sin cuenta de acceso" />
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
