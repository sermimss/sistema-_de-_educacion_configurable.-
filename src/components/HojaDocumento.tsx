import { aBloques, type Tramo } from "@/lib/documentos/campos";

/// La hoja tamano carta de un documento institucional: membrete con el logo y
/// los colores del colegio, el texto, la firma con su sello y el pie con el
/// folio. Sirve igual para la vista previa y para el documento ya emitido.

export type MarcaHoja = {
  nombre: string;
  lema?: string | null;
  claveCentroTrabajo?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  logo: string | null;
  colorPrimario: string;
  colorSecundario: string;
};

export type DatosHoja = {
  tablaCalificaciones?: { periodos: string[]; filas: { materia: string; porPeriodo: string[]; final: string }[] };
  renglones?: number;
};

function Linea({ tramos }: { tramos: Tramo[] }) {
  return (
    <>
      {tramos.map((t, i) => (t.negrita ? <strong key={i}>{t.texto}</strong> : <span key={i}>{t.texto}</span>))}
    </>
  );
}

export function HojaDocumento({
  marca,
  titulo,
  cuerpo,
  datos,
  firmante,
  folio,
  fechaEmision,
  cancelado,
}: {
  marca: MarcaHoja;
  titulo: string;
  cuerpo: string;
  datos?: DatosHoja;
  firmante?: { nombre: string | null; cargo: string | null; firma: string | null; sello: string | null } | null;
  folio?: string | null;
  fechaEmision?: string | null;
  cancelado?: boolean;
}) {
  const bloques = aBloques(cuerpo);
  const contacto = [marca.direccion, marca.telefono && `Tel. ${marca.telefono}`, marca.email].filter(Boolean).join(" · ");

  return (
    <article
      className="hoja-impresion hoja-carta relative mx-auto flex w-full max-w-[216mm] flex-col bg-white text-[13px] leading-relaxed text-slate-900 shadow-sm"
      style={{ minHeight: "279mm" }}
      data-documento
    >
      {cancelado && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="-rotate-[30deg] select-none text-7xl font-black tracking-widest text-red-600/25">CANCELADO</span>
        </div>
      )}

      <header className="px-[16mm] pt-[12mm]">
        <div className="flex items-center gap-4">
          {marca.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={marca.logo} alt="" className="h-20 w-auto max-w-[45mm] object-contain" data-logo-documento />
          ) : null}
          <div className="min-w-0 flex-1 text-right">
            <p className="text-lg font-bold uppercase leading-tight" style={{ color: marca.colorPrimario }}>
              {marca.nombre}
            </p>
            {marca.lema && <p className="text-xs italic text-slate-600">{marca.lema}</p>}
            {marca.claveCentroTrabajo && <p className="text-xs text-slate-600">C.C.T. {marca.claveCentroTrabajo}</p>}
          </div>
        </div>
        <div className="mt-3 h-1 rounded-full" style={{ backgroundColor: marca.colorPrimario }} />
        <div className="mt-0.5 h-0.5 rounded-full" style={{ backgroundColor: marca.colorSecundario }} />
      </header>

      <main className="flex-1 px-[20mm] py-[8mm]">
        {titulo && (
          <h1 className="mb-6 text-center text-base font-bold tracking-wide" style={{ color: marca.colorSecundario }}>
            {titulo}
          </h1>
        )}
        <div className="space-y-4 text-justify">
          {bloques.map((bloque, i) => {
            if (bloque.tipo === "parrafo") {
              const alineacion =
                bloque.alineacion === "derecha" ? "text-right" : bloque.alineacion === "centro" ? "text-center" : "";
              return (
                <p key={i} className={alineacion}>
                  {bloque.lineas.map((linea, j) => (
                    <span key={j}>
                      {j > 0 && <br />}
                      <Linea tramos={linea} />
                    </span>
                  ))}
                </p>
              );
            }
            if (bloque.tipo === "firmas") {
              return (
                <div key={i} className="flex flex-wrap justify-around gap-8 pt-10">
                  {bloque.textos.map((texto, j) => (
                    <div key={j} className="w-56 border-t border-slate-800 pt-1 text-center text-xs">
                      {texto}
                    </div>
                  ))}
                </div>
              );
            }
            if (bloque.tipo === "tabla_calificaciones") {
              const tabla = datos?.tablaCalificaciones;
              if (!tabla || tabla.filas.length === 0) {
                return (
                  <p key={i} className="text-center text-xs italic text-slate-500">
                    Sin calificaciones registradas en el periodo en curso.
                  </p>
                );
              }
              return (
                <table key={i} className="w-full border-collapse text-xs">
                  <thead>
                    <tr style={{ backgroundColor: marca.colorPrimario, color: "var(--marca-contraste)" }}>
                      <th className="border border-slate-400 px-2 py-1 text-left">Materia</th>
                      {tabla.periodos.map((p) => (
                        <th key={p} className="border border-slate-400 px-2 py-1">{p}</th>
                      ))}
                      <th className="border border-slate-400 px-2 py-1">Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabla.filas.map((fila) => (
                      <tr key={fila.materia}>
                        <td className="border border-slate-400 px-2 py-1">{fila.materia}</td>
                        {fila.porPeriodo.map((c, k) => (
                          <td key={k} className="border border-slate-400 px-2 py-1 text-center">{c}</td>
                        ))}
                        <td className="border border-slate-400 px-2 py-1 text-center font-semibold">{fila.final}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            }
            return (
              <table key={i} className="w-full border-collapse text-xs">
                <thead>
                  <tr style={{ backgroundColor: marca.colorPrimario, color: "var(--marca-contraste)" }}>
                    {["Fecha", "Entrada", "Salida", "Horas", "Actividades realizadas", "Firma del supervisor"].map((t) => (
                      <th key={t} className="border border-slate-400 px-2 py-1">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: datos?.renglones ?? 15 }, (_, k) => (
                    <tr key={k} className="h-7">
                      <td className="w-[18mm] border border-slate-400" />
                      <td className="w-[15mm] border border-slate-400" />
                      <td className="w-[15mm] border border-slate-400" />
                      <td className="w-[12mm] border border-slate-400" />
                      <td className="border border-slate-400" />
                      <td className="w-[30mm] border border-slate-400" />
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center text-center">
          <p className="text-xs font-semibold tracking-widest">A T E N T A M E N T E</p>
          <div className="relative mt-2 flex h-24 w-72 items-end justify-center">
            {firmante?.sello && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firmante.sello} alt="" className="absolute -right-16 top-0 h-24 w-24 object-contain opacity-90" data-sello />
            )}
            {firmante?.firma && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firmante.firma} alt="" className="relative h-20 w-auto max-w-[60mm] object-contain" data-firma />
            )}
          </div>
          <div className="w-72 border-t border-slate-800 pt-1">
            <p className="text-sm font-semibold">{firmante?.nombre ?? ""}</p>
            <p className="text-xs text-slate-600">{firmante?.cargo ?? ""}</p>
          </div>
        </div>
      </main>

      <footer
        className="flex items-center justify-between gap-4 px-[16mm] py-2 text-[10px]"
        style={{ backgroundColor: marca.colorSecundario, color: "var(--marca-sec-contraste)" }}
      >
        <span>{contacto}</span>
        <span className="whitespace-nowrap">
          {folio ? `Folio ${folio}` : "Vista previa"}
          {fechaEmision ? ` · ${fechaEmision}` : ""}
        </span>
      </footer>
    </article>
  );
}
