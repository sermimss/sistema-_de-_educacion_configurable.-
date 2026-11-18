import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { formatearFechaHora } from "@/lib/formato";
import { ETIQUETA_ROL } from "@/lib/navegacion";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { AccionesSolicitud } from "./Acciones";

export const dynamic = "force-dynamic";

function nombreDe(u: {
  usuario: string;
  alumno: { nombres: string; apellidoPaterno: string; apellidoMaterno: string | null } | null;
  empleado: { nombres: string; apellidoPaterno: string; apellidoMaterno: string | null } | null;
}) {
  return u.alumno ? nombreCompleto(u.alumno) : u.empleado ? nombreCompleto(u.empleado) : u.usuario;
}

export default async function PaginaAccesos() {
  await requerirRol("ADMIN");
  const incluir = { usuario: { include: { alumno: true, empleado: true } } } as const;
  const [pendientes, recientes] = await Promise.all([
    db.solicitudAcceso.findMany({ where: { estado: "PENDIENTE" }, orderBy: { creadaEn: "asc" }, include: incluir }),
    db.solicitudAcceso.findMany({
      where: { estado: { not: "PENDIENTE" } },
      orderBy: { atendidaEn: "desc" },
      take: 20,
      include: incluir,
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Solicitudes de acceso</h1>
        <p className="mt-1 text-sm text-slate-600">
          Docentes y alumnos que olvidaron su contrasena y la pidieron desde la pantalla de acceso.
        </p>
      </header>

      <Tarjeta titulo="Por atender" descripcion="Antes de asignar, confirma que quien lo pide es la persona.">
        {pendientes.length === 0 ? (
          <EstadoVacio titulo="Nadie esta esperando" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendientes.map((s) => (
              <li key={s.id} className="space-y-2 py-3" data-solicitud-acceso={s.usuario.usuario}>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {nombreDe(s.usuario)} · <span className="font-mono text-xs">{s.usuario.usuario}</span>{" "}
                    <Insignia>{ETIQUETA_ROL[s.usuario.rol]}</Insignia>
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatearFechaHora(s.creadaEn)}
                    {s.mensaje ? ` · "${s.mensaje}"` : ""}
                  </p>
                </div>
                <AccionesSolicitud solicitudId={s.id} />
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {recientes.length > 0 && (
        <Tarjeta titulo="Atendidas recientemente">
          <ul className="divide-y divide-slate-100 text-sm">
            {recientes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {nombreDe(s.usuario)} · <span className="font-mono text-xs">{s.usuario.usuario}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {s.estado === "ATENDIDA" ? "contrasena temporal asignada" : "descartada"} ·{" "}
                  {s.atendidaEn ? formatearFechaHora(s.atendidaEn) : ""}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
