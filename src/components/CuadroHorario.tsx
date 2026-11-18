import { DIAS_SEMANA } from "@/lib/formato";
import { estadoDelBloque } from "@/lib/reuniones";

export type BloqueHorario = {
  id: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  titulo: string;
  detalle: string;
  enlace: string | null;
};

/// Boton para entrar a la clase en Google Meet. Abre en otra pestana y no le
/// pasa a Meet de que pagina viene.
export function BotonMeet({ enlace, compacto, resaltado }: { enlace: string; compacto?: boolean; resaltado?: boolean }) {
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      data-boton-meet
      className={`inline-flex items-center gap-1 rounded-md font-medium ${
        compacto ? "px-1.5 py-0.5 text-[11px]" : "px-3 py-1.5 text-sm"
      } ${resaltado ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white text-emerald-700 ring-1 ring-emerald-600 hover:bg-emerald-50"}`}
    >
      <svg viewBox="0 0 24 24" className={compacto ? "h-3 w-3" : "h-4 w-4"} fill="currentColor" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2.4l4.3-3.1A1 1 0 0 1 22 7.1v9.8a1 1 0 0 1-1.7.8L16 14.6V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      </svg>
      {compacto ? "Meet" : "Entrar a la clase en linea"}
    </a>
  );
}

/// Cuadro semanal: filas por hora de inicio, columnas por dia. Los dias
/// habiles del colegio mas cualquier otro dia en que haya clase.
export function CuadroHorario({
  bloques,
  diasHabiles,
  ahora,
}: {
  bloques: BloqueHorario[];
  diasHabiles: number[];
  ahora: { dia: number; hora: string };
}) {
  const usados = new Set(bloques.map((b) => b.diaSemana));
  const dias = DIAS_SEMANA.filter((d) => diasHabiles.includes(d.valor) || usados.has(d.valor));
  const horas = [...new Set(bloques.map((b) => b.horaInicio))].sort();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-slate-200 pb-2 pr-3 text-left text-xs uppercase tracking-wide text-slate-500">Hora</th>
            {dias.map((dia) => (
              <th
                key={dia.valor}
                className={`border-b border-slate-200 px-2 pb-2 text-left text-xs uppercase tracking-wide ${
                  dia.valor === ahora.dia ? "text-marca-700" : "text-slate-500"
                }`}
              >
                {dia.nombre}
                {dia.valor === ahora.dia ? " · hoy" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horas.map((hora) => (
            <tr key={hora} className="align-top">
              <td className="border-b border-slate-100 py-2 pr-3 text-xs text-slate-500">{hora}</td>
              {dias.map((dia) => {
                const enCelda = bloques.filter((b) => b.diaSemana === dia.valor && b.horaInicio === hora);
                return (
                  <td key={dia.valor} className="border-b border-slate-100 px-2 py-2">
                    {enCelda.length === 0 ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      enCelda.map((b) => {
                        const enCurso = estadoDelBloque(b, ahora) === "en-curso";
                        return (
                          <div
                            key={b.id}
                            className={`space-y-0.5 rounded-md px-2 py-1 ${enCurso ? "bg-emerald-50 ring-1 ring-emerald-500" : "bg-marca-50"}`}
                          >
                            <p className="text-xs font-medium text-marca-900">{b.titulo}</p>
                            <p className="text-[11px] text-slate-500">{b.detalle}</p>
                            <p className="text-[11px] text-slate-400">
                              {b.horaInicio}-{b.horaFin}
                              {enCurso ? " · en curso" : ""}
                            </p>
                            {b.enlace && <BotonMeet enlace={b.enlace} compacto resaltado={enCurso} />}
                          </div>
                        );
                      })
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/// Las clases de hoy, con la que esta en curso resaltada y su boton de Meet.
export function ClasesDeHoy({ bloques, ahora }: { bloques: BloqueHorario[]; ahora: { dia: number; hora: string } }) {
  const hoy = bloques
    .filter((b) => b.diaSemana === ahora.dia)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  if (hoy.length === 0) return <p className="text-sm text-slate-500">Hoy no hay clases en tu horario.</p>;
  return (
    <ul className="divide-y divide-slate-100" data-clases-hoy>
      {hoy.map((b) => {
        const estado = estadoDelBloque(b, ahora);
        return (
          <li key={b.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${estado === "pasada" ? "opacity-50" : ""}`}>
            <div>
              <p className="text-sm font-medium text-slate-800">
                {b.horaInicio}-{b.horaFin} · {b.titulo}
                {estado === "en-curso" && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">en curso</span>
                )}
              </p>
              <p className="text-xs text-slate-500">{b.detalle}</p>
            </div>
            {b.enlace && estado !== "pasada" && <BotonMeet enlace={b.enlace} resaltado={estado === "en-curso"} />}
          </li>
        );
      })}
    </ul>
  );
}
