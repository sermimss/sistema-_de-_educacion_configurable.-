"use client";

import { useActionState, useState } from "react";
import type { TipoPeriodoAcademico, TipoPrograma } from "@prisma/client";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { MODALIDADES, nombrePeriodo, plantillaSugerida } from "@/lib/modalidad";
import { accionCrearNivel, accionCrearPrograma, accionEditarPrograma, type EstadoPrograma } from "./programas";

type Nivel = { id: number; nombre: string; tipoPeriodo: TipoPeriodoAcademico };

function Mensajes({ estado }: { estado: EstadoPrograma }) {
  return (
    <>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
    </>
  );
}

function ElegirTipo({ valor, onChange }: { valor: TipoPrograma; onChange?: (t: TipoPrograma) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-4 text-sm text-slate-700">
      <legend className="etiqueta-campo">Tipo</legend>
      {(
        [
          ["CARRERA", "Carrera", "Programa completo"],
          ["CERTIFICACION", "Certificacion", "Programa corto: diplomado, curso"],
        ] as const
      ).map(([v, etiqueta, ayuda]) => (
        <label key={v} className="flex items-center gap-2">
          <input type="radio" name="tipo" value={v} defaultChecked={valor === v} onChange={() => onChange?.(v)} />
          <span>
            {etiqueta} <span className="text-xs text-slate-500">({ayuda})</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/// Alta de una carrera o certificacion con sus periodos. Las materias se
/// agregan despues en Materias.
export function FormularioNuevoPrograma({ niveles, nivelInicial }: { niveles: Nivel[]; nivelInicial?: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoPrograma, FormData>(accionCrearPrograma, {});
  const primero = niveles.find((n) => n.id === nivelInicial) ?? niveles[0];
  const [tipo, setTipo] = useState<TipoPrograma>("CARRERA");
  const [modalidad, setModalidad] = useState<TipoPeriodoAcademico>(primero?.tipoPeriodo ?? "SEMESTRE");
  const [periodos, setPeriodos] = useState("6");
  const [plantilla, setPlantilla] = useState(plantillaSugerida(primero?.tipoPeriodo ?? "SEMESTRE"));
  const n = Math.min(30, Math.max(0, Number(periodos) || 0));

  const cambiarModalidad = (m: TipoPeriodoAcademico) => {
    setModalidad(m);
    setPlantilla(plantillaSugerida(m));
  };

  return (
    <form action={accion} className="space-y-4">
      <Mensajes estado={estado} />
      <ElegirTipo
        valor={tipo}
        onChange={(t) => {
          setTipo(t);
          if (t === "CERTIFICACION" && periodos === "6") setPeriodos("1");
          if (t === "CARRERA" && periodos === "1") setPeriodos("6");
        }}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Selector
          etiqueta="Nivel"
          name="nivelId"
          required
          defaultValue={primero?.id}
          onChange={(e) => {
            const nivel = niveles.find((x) => x.id === Number(e.target.value));
            if (nivel) cambiarModalidad(nivel.tipoPeriodo);
          }}
        >
          {niveles.map((nivel) => (
            <option key={nivel.id} value={nivel.id}>{nivel.nombre}</option>
          ))}
        </Selector>
        <Campo
          etiqueta="Nombre"
          name="nombre"
          required
          maxLength={150}
          className="sm:col-span-2"
          placeholder={tipo === "CARRERA" ? "Por ejemplo: Licenciatura en Derecho" : "Por ejemplo: Certificacion en Excel avanzado"}
        />
        <Campo etiqueta="Clave" name="clave" required maxLength={30} placeholder={tipo === "CARRERA" ? "LDER-01" : "CERT-EXCEL"} />
        <Campo
          etiqueta="Titulo que otorga (opcional)"
          name="tituloOtorga"
          maxLength={150}
          className="sm:col-span-2"
          placeholder={tipo === "CARRERA" ? "Licenciado(a) en Derecho" : "Certificado en Excel avanzado"}
          ayuda="Se puede usar en constancias y certificados"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Selector etiqueta="Modalidad" name="modalidad" value={modalidad} onChange={(e) => cambiarModalidad(e.target.value as TipoPeriodoAcademico)}>
          {MODALIDADES.map((m) => (
            <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
          ))}
        </Selector>
        <Campo etiqueta="Numero de periodos" name="periodos" type="number" min={1} max={30} required value={periodos} onChange={(e) => setPeriodos(e.target.value)} />
        <Campo etiqueta="Nombre de cada periodo" name="plantilla" required value={plantilla} onChange={(e) => setPlantilla(e.target.value)} ayuda="Usa {N} para el numero" />
      </div>
      {n > 0 && plantilla.includes("{N}") && (
        <div>
          <p className="text-xs text-slate-500">Quedaria asi:</p>
          <div className="mt-1 flex flex-wrap gap-1.5" data-vista-periodos>
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className="rounded bg-marca-50 px-2 py-0.5 text-xs text-marca-700">{nombrePeriodo(plantilla, i + 1)}</span>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500">Se crea sin materias; despues las agregas en Materias, en su mapa curricular.</p>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Creando..." : tipo === "CARRERA" ? "Crear carrera" : "Crear certificacion"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioEditarPrograma({
  plan,
  niveles,
  puedeCambiarNivel,
}: {
  plan: { id: number; nombre: string; clave: string; tipo: TipoPrograma; tituloOtorga: string | null; nivelId: number };
  niveles: Nivel[];
  puedeCambiarNivel: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoPrograma, FormData>(accionEditarPrograma, {});
  return (
    <form action={accion} className="space-y-4" data-editar-programa>
      <input type="hidden" name="planId" value={plan.id} />
      <Mensajes estado={estado} />
      <ElegirTipo valor={plan.tipo} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Nombre" name="nombre" required maxLength={150} defaultValue={plan.nombre} className="sm:col-span-2" />
        <Campo etiqueta="Clave" name="clave" required maxLength={30} defaultValue={plan.clave} />
        <Campo etiqueta="Titulo que otorga (opcional)" name="tituloOtorga" maxLength={150} defaultValue={plan.tituloOtorga ?? ""} className="sm:col-span-2" />
        <Selector
          etiqueta="Nivel"
          name="nivelId"
          defaultValue={plan.nivelId}
          disabled={!puedeCambiarNivel}
          ayuda={puedeCambiarNivel ? undefined : "No se cambia: ya tiene alumnos o grupos"}
        >
          {niveles.map((nivel) => (
            <option key={nivel.id} value={nivel.id}>{nivel.nombre}</option>
          ))}
        </Selector>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar datos"}</Boton>
      </div>
    </form>
  );
}

export function FormularioNivel() {
  const [estado, accion, pendiente] = useActionState<EstadoPrograma, FormData>(accionCrearNivel, {});
  return (
    <form action={accion} className="space-y-3" data-nuevo-nivel>
      <Mensajes estado={estado} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo etiqueta="Nombre del nivel" name="nombre" required maxLength={80} placeholder="Por ejemplo: Educacion continua" className="sm:col-span-2" />
        <Campo etiqueta="Clave del nivel" name="clave" required maxLength={30} placeholder="EC" />
        <Selector etiqueta="Modalidad habitual" name="tipoPeriodo" defaultValue="SEMESTRE">
          {MODALIDADES.map((m) => (
            <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
          ))}
        </Selector>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente}>{pendiente ? "Creando..." : "Crear nivel"}</Boton>
      </div>
    </form>
  );
}
