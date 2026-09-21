"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { Alerta, Boton, Campo, Selector, Tarjeta } from "@/components/ui";
import { DIAS_SEMANA } from "@/lib/formato";
import type { esquemaInstalacion, DatosInstalacion } from "@/lib/esquemas-instalacion";
import { instalarSistema } from "./acciones";

type Estado = z.input<typeof esquemaInstalacion>;

const PASOS = [
  { id: "institucion", titulo: "Institucion", descripcion: "Identidad, contacto y datos fiscales" },
  { id: "planteles", titulo: "Planteles y turnos", descripcion: "Donde y cuando opera la escuela" },
  { id: "academico", titulo: "Niveles y planes", descripcion: "Que se imparte y cuanto dura" },
  { id: "ciclo", titulo: "Ciclo escolar", descripcion: "Fechas y periodos de evaluacion" },
  { id: "escala", titulo: "Evaluacion", descripcion: "Escala y minima aprobatoria" },
  { id: "horarios", titulo: "Horarios", descripcion: "Dias habiles y modulos" },
  { id: "asistencia", titulo: "Asistencia", descripcion: "Como se pasa lista y cuando alertar" },
  { id: "finanzas", titulo: "Finanzas", descripcion: "Conceptos, recargos y recibos" },
  { id: "admin", titulo: "Administrador", descripcion: "Tu cuenta de acceso" },
  { id: "resumen", titulo: "Confirmar", descripcion: "Revision final" },
] as const;

const ESTADO_INICIAL: Estado = {
  institucion: {
    nombre: "",
    nombreCorto: "",
    lema: "",
    colorPrimario: "#1d4ed8",
    colorSecundario: "#0f172a",
    direccion: "",
    ciudad: "",
    estado: "",
    pais: "Mexico",
    codigoPostal: "",
    telefono: "",
    email: "",
    sitioWeb: "",
    razonSocial: "",
    rfc: "",
    regimenFiscal: "",
    claveCentroTrabajo: "",
    moneda: "MXN",
    simboloMoneda: "$",
    zonaHoraria: "America/Mexico_City",
  },
  planteles: [{ nombre: "Plantel principal", clave: "P1", direccion: "", telefono: "" }],
  turnos: [{ nombre: "Matutino", horaInicio: "07:00", horaFin: "14:00" }],
  niveles: [{ nombre: "Bachillerato", clave: "BACH", tipoPeriodo: "SEMESTRE" }],
  planes: [
    {
      nombre: "Bachillerato General",
      clave: "BG-01",
      nivelClave: "BACH",
      duracionPeriodos: 6,
      creditosTotales: 0,
      plantillaGrado: "{N}o Semestre",
    },
  ],
  ciclo: {
    nombre: "Ciclo escolar 2026-2027",
    clave: "2026-2027",
    fechaInicio: "2026-08-17",
    fechaFin: "2027-07-09",
    numeroPeriodos: 3,
    plantillaPeriodo: "Parcial {N}",
  },
  escala: {
    nombre: "Escala 0 a 100",
    tipo: "NUMERICA",
    valorMinimo: 0,
    valorMaximo: 100,
    decimales: 2,
    redondeo: "NINGUNO",
    minimaAprobatoria: 70,
  },
  horarios: {
    diasHabiles: [1, 2, 3, 4, 5],
    duracionModuloMinutos: 50,
    modulos: [
      { nombre: "Modulo 1", horaInicio: "07:00", horaFin: "07:50", esReceso: false },
      { nombre: "Modulo 2", horaInicio: "07:50", horaFin: "08:40", esReceso: false },
      { nombre: "Receso", horaInicio: "08:40", horaFin: "09:00", esReceso: true },
      { nombre: "Modulo 3", horaInicio: "09:00", horaFin: "09:50", esReceso: false },
      { nombre: "Modulo 4", horaInicio: "09:50", horaFin: "10:40", esReceso: false },
    ],
  },
  asistencia: {
    docenteDecideModo: true,
    modoPredeterminado: "POR_CLASE",
    docenteDecideAfectacion: true,
    faltasConsecutivasAlerta: 3,
    retardosEquivalenFalta: 3,
  },
  finanzas: {
    diaVencimientoDefault: 10,
    conceptos: [
      { clave: "INS", nombre: "Inscripcion", tipo: "INSCRIPCION", montoBase: 0, periodicidad: "UNICO", obligatorio: true },
      { clave: "COL", nombre: "Colegiatura", tipo: "COLEGIATURA", montoBase: 0, periodicidad: "MENSUAL", obligatorio: true },
    ],
    recargoActivo: true,
    recargoTipoCalculo: "PORCENTAJE",
    recargoValor: 10,
    recargoDiasGracia: 3,
    permitePagosParciales: true,
    permiteConvenios: true,
    serieRecibo: "A",
    leyendaRecibo: "Este comprobante no tiene validez fiscal.",
    bloquearPorAdeudo: false,
  },
  administrador: {
    usuario: "",
    email: "",
    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    password: "",
  },
};

function FilaLista({ children, alQuitar }: { children: React.ReactNode; alQuitar?: () => void }) {
  return (
    <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      {alQuitar && (
        <button
          type="button"
          onClick={alQuitar}
          className="rounded-md px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Quitar
        </button>
      )}
    </div>
  );
}

function Interruptor({
  etiqueta,
  descripcion,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  descripcion?: string;
  valor: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => alCambiar(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-marca-600 focus:ring-marca-600"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{etiqueta}</span>
        {descripcion && <span className="mt-0.5 block text-xs text-slate-500">{descripcion}</span>}
      </span>
    </label>
  );
}

export default function AsistenteInstalacion() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Estado>(ESTADO_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<string[]>([]);
  const [enviando, iniciarEnvio] = useTransition();

  const actual = PASOS[paso];

  function actualizar<K extends keyof Estado>(seccion: K, valores: Partial<Estado[K]>) {
    setDatos((previo) => ({ ...previo, [seccion]: { ...(previo[seccion] as object), ...valores } }));
  }

  function validarPaso(): string | null {
    switch (actual.id) {
      case "institucion":
        if (!datos.institucion.nombre || datos.institucion.nombre.trim().length < 3)
          return "Escribe el nombre de la institucion.";
        return null;
      case "planteles":
        if (!datos.planteles.length) return "Registra al menos un plantel.";
        if (datos.planteles.some((p) => !p.nombre || !p.clave)) return "Cada plantel necesita nombre y clave.";
        if (!datos.turnos.length) return "Registra al menos un turno.";
        return null;
      case "academico":
        if (!datos.niveles.length) return "Registra al menos un nivel educativo.";
        if (!datos.planes.length) return "Registra al menos un plan de estudios.";
        if (datos.planes.some((p) => !datos.niveles.some((n) => n.clave === p.nivelClave)))
          return "Cada plan debe pertenecer a un nivel existente.";
        return null;
      case "ciclo":
        if (new Date(datos.ciclo.fechaFin) <= new Date(datos.ciclo.fechaInicio))
          return "La fecha de fin debe ser posterior a la de inicio.";
        return null;
      case "escala": {
        const { valorMinimo, valorMaximo, minimaAprobatoria } = datos.escala;
        if (Number(valorMaximo) <= Number(valorMinimo)) return "El valor maximo debe ser mayor al minimo.";
        if (Number(minimaAprobatoria) < Number(valorMinimo) || Number(minimaAprobatoria) > Number(valorMaximo))
          return "La minima aprobatoria debe estar dentro de la escala.";
        return null;
      }
      case "horarios":
        if (!datos.horarios.diasHabiles.length) return "Selecciona al menos un dia habil.";
        if (!datos.horarios.modulos.length) return "Define al menos un modulo de horario.";
        return null;
      case "admin": {
        const a = datos.administrador;
        if (!a.usuario || a.usuario.length < 3) return "El usuario debe tener al menos 3 caracteres.";
        if (!a.email.includes("@")) return "Escribe un correo valido.";
        if (!a.nombres || !a.apellidoPaterno) return "Escribe nombre y apellido.";
        if (a.password.length < 8) return "La contrasena debe tener al menos 8 caracteres.";
        return null;
      }
      default:
        return null;
    }
  }

  function siguiente() {
    const problema = validarPaso();
    setError(problema);
    if (!problema) setPaso((p) => Math.min(p + 1, PASOS.length - 1));
  }

  function instalar() {
    setError(null);
    setDetalles([]);
    iniciarEnvio(async () => {
      const resultado = await instalarSistema(datos as unknown as DatosInstalacion);
      if (resultado.ok) {
        router.push("/acceso?instalado=1");
      } else {
        setError(resultado.error);
        setDetalles(resultado.detalles ?? []);
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-marca-600">Asistente de instalacion</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Configura el sistema para tu institucion
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Todo lo que definas aqui se puede cambiar despues desde Configuracion del sistema.
          Ningun valor esta fijo en el codigo.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {PASOS.map((p, indice) => (
          <button
            key={p.id}
            type="button"
            onClick={() => indice <= paso && setPaso(indice)}
            disabled={indice > paso}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              indice === paso
                ? "bg-marca-600 text-white"
                : indice < paso
                  ? "bg-marca-100 text-marca-700 hover:bg-marca-100/80"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            {indice + 1}. {p.titulo}
          </button>
        ))}
      </div>

      <Tarjeta titulo={actual.titulo} descripcion={actual.descripcion}>
        {error && (
          <div className="mb-4">
            <Alerta tipo="error">
              <p className="font-medium">{error}</p>
              {detalles.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {detalles.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </Alerta>
          </div>
        )}

        {actual.id === "institucion" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre de la institucion"
              required
              value={datos.institucion.nombre}
              onChange={(e) => actualizar("institucion", { nombre: e.target.value })}
              placeholder="Colegio ..."
            />
            <Campo
              etiqueta="Nombre corto"
              value={datos.institucion.nombreCorto ?? ""}
              onChange={(e) => actualizar("institucion", { nombreCorto: e.target.value })}
              ayuda="Aparece en menus y encabezados"
            />
            <Campo
              etiqueta="Lema"
              className="sm:col-span-2"
              value={datos.institucion.lema ?? ""}
              onChange={(e) => actualizar("institucion", { lema: e.target.value })}
            />
            <Campo
              etiqueta="Color principal"
              type="color"
              value={datos.institucion.colorPrimario}
              onChange={(e) => actualizar("institucion", { colorPrimario: e.target.value })}
              ayuda="Se usa en la interfaz, boletas y recibos"
            />
            <Campo
              etiqueta="Color secundario"
              type="color"
              value={datos.institucion.colorSecundario ?? "#0f172a"}
              onChange={(e) => actualizar("institucion", { colorSecundario: e.target.value })}
            />
            <Campo
              etiqueta="Telefono"
              value={datos.institucion.telefono ?? ""}
              onChange={(e) => actualizar("institucion", { telefono: e.target.value })}
            />
            <Campo
              etiqueta="Correo institucional"
              type="email"
              value={datos.institucion.email ?? ""}
              onChange={(e) => actualizar("institucion", { email: e.target.value })}
            />
            <Campo
              etiqueta="Direccion"
              className="sm:col-span-2"
              value={datos.institucion.direccion ?? ""}
              onChange={(e) => actualizar("institucion", { direccion: e.target.value })}
            />
            <Campo
              etiqueta="Ciudad"
              value={datos.institucion.ciudad ?? ""}
              onChange={(e) => actualizar("institucion", { ciudad: e.target.value })}
            />
            <Campo
              etiqueta="Estado"
              value={datos.institucion.estado ?? ""}
              onChange={(e) => actualizar("institucion", { estado: e.target.value })}
            />
            <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
              <p className="mb-3 text-sm font-medium text-slate-700">
                Datos fiscales (base para el CFDI cuando se conecte un PAC)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  etiqueta="Razon social"
                  value={datos.institucion.razonSocial ?? ""}
                  onChange={(e) => actualizar("institucion", { razonSocial: e.target.value })}
                />
                <Campo
                  etiqueta="RFC"
                  value={datos.institucion.rfc ?? ""}
                  onChange={(e) => actualizar("institucion", { rfc: e.target.value.toUpperCase() })}
                />
                <Campo
                  etiqueta="Regimen fiscal"
                  value={datos.institucion.regimenFiscal ?? ""}
                  onChange={(e) => actualizar("institucion", { regimenFiscal: e.target.value })}
                  ayuda="Clave del catalogo del SAT, por ejemplo 601"
                />
                <Campo
                  etiqueta="Clave de centro de trabajo"
                  value={datos.institucion.claveCentroTrabajo ?? ""}
                  onChange={(e) => actualizar("institucion", { claveCentroTrabajo: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {actual.id === "planteles" && (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Planteles</h3>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() =>
                    setDatos((p) => ({
                      ...p,
                      planteles: [...p.planteles, { nombre: "", clave: "", direccion: "", telefono: "" }],
                    }))
                  }
                >
                  Agregar plantel
                </Boton>
              </div>
              <div className="space-y-2">
                {datos.planteles.map((plantel, indice) => (
                  <FilaLista
                    key={indice}
                    alQuitar={
                      datos.planteles.length > 1
                        ? () =>
                            setDatos((p) => ({
                              ...p,
                              planteles: p.planteles.filter((_, i) => i !== indice),
                            }))
                        : undefined
                    }
                  >
                    <Campo
                      etiqueta="Nombre"
                      value={plantel.nombre}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planteles: p.planteles.map((x, i) =>
                            i === indice ? { ...x, nombre: e.target.value } : x
                          ),
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Clave"
                      value={plantel.clave}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planteles: p.planteles.map((x, i) =>
                            i === indice ? { ...x, clave: e.target.value.toUpperCase() } : x
                          ),
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Direccion"
                      value={plantel.direccion ?? ""}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planteles: p.planteles.map((x, i) =>
                            i === indice ? { ...x, direccion: e.target.value } : x
                          ),
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Telefono"
                      value={plantel.telefono ?? ""}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planteles: p.planteles.map((x, i) =>
                            i === indice ? { ...x, telefono: e.target.value } : x
                          ),
                        }))
                      }
                    />
                  </FilaLista>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Turnos</h3>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() =>
                    setDatos((p) => ({
                      ...p,
                      turnos: [...p.turnos, { nombre: "", horaInicio: "14:00", horaFin: "20:00" }],
                    }))
                  }
                >
                  Agregar turno
                </Boton>
              </div>
              <div className="space-y-2">
                {datos.turnos.map((turno, indice) => (
                  <FilaLista
                    key={indice}
                    alQuitar={
                      datos.turnos.length > 1
                        ? () =>
                            setDatos((p) => ({ ...p, turnos: p.turnos.filter((_, i) => i !== indice) }))
                        : undefined
                    }
                  >
                    <Campo
                      etiqueta="Nombre"
                      value={turno.nombre}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          turnos: p.turnos.map((x, i) =>
                            i === indice ? { ...x, nombre: e.target.value } : x
                          ),
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Hora de inicio"
                      type="time"
                      value={turno.horaInicio}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          turnos: p.turnos.map((x, i) =>
                            i === indice ? { ...x, horaInicio: e.target.value } : x
                          ),
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Hora de fin"
                      type="time"
                      value={turno.horaFin}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          turnos: p.turnos.map((x, i) =>
                            i === indice ? { ...x, horaFin: e.target.value } : x
                          ),
                        }))
                      }
                    />
                  </FilaLista>
                ))}
              </div>
            </div>
          </div>
        )}

        {actual.id === "academico" && (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Niveles educativos</h3>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() =>
                    setDatos((p) => ({
                      ...p,
                      niveles: [...p.niveles, { nombre: "", clave: "", tipoPeriodo: "SEMESTRE" }],
                    }))
                  }
                >
                  Agregar nivel
                </Boton>
              </div>
              <div className="space-y-2">
                {datos.niveles.map((nivel, indice) => (
                  <FilaLista
                    key={indice}
                    alQuitar={
                      datos.niveles.length > 1
                        ? () =>
                            setDatos((p) => {
                              const eliminado = p.niveles[indice].clave;
                              const restantes = p.niveles.filter((_, i) => i !== indice);
                              const reemplazo = restantes[0].clave;
                              return {
                                ...p,
                                niveles: restantes,
                                planes: p.planes.map((plan) =>
                                  plan.nivelClave === eliminado
                                    ? { ...plan, nivelClave: reemplazo }
                                    : plan
                                ),
                              };
                            })
                        : undefined
                    }
                  >
                    <Campo
                      etiqueta="Nombre"
                      value={nivel.nombre}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          niveles: p.niveles.map((x, i) =>
                            i === indice ? { ...x, nombre: e.target.value } : x
                          ),
                        }))
                      }
                      placeholder="Bachillerato, Licenciatura..."
                    />
                    <Campo
                      etiqueta="Clave"
                      value={nivel.clave}
                      onChange={(e) => {
                        const nuevaClave = e.target.value.toUpperCase();
                        setDatos((p) => {
                          const claveAnterior = p.niveles[indice].clave;
                          return {
                            ...p,
                            niveles: p.niveles.map((x, i) =>
                              i === indice ? { ...x, clave: nuevaClave } : x
                            ),
                            // Los planes apuntan al nivel por su clave: si la
                            // clave cambia hay que reapuntarlos, o quedarian
                            // huerfanos sin que se note en pantalla.
                            planes: p.planes.map((plan) =>
                              plan.nivelClave === claveAnterior
                                ? { ...plan, nivelClave: nuevaClave }
                                : plan
                            ),
                          };
                        });
                      }}
                    />
                    <Selector
                      etiqueta="Tipo de periodo"
                      value={nivel.tipoPeriodo}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          niveles: p.niveles.map((x, i) =>
                            i === indice ? { ...x, tipoPeriodo: e.target.value as typeof x.tipoPeriodo } : x
                          ),
                        }))
                      }
                    >
                      <option value="SEMESTRE">Semestre</option>
                      <option value="CUATRIMESTRE">Cuatrimestre</option>
                      <option value="TRIMESTRE">Trimestre</option>
                      <option value="ANUAL">Anual</option>
                      <option value="MODULAR">Modular</option>
                      <option value="PERSONALIZADO">Personalizado</option>
                    </Selector>
                  </FilaLista>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Planes de estudio</h3>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() =>
                    setDatos((p) => ({
                      ...p,
                      planes: [
                        ...p.planes,
                        {
                          nombre: "",
                          clave: "",
                          nivelClave: p.niveles[0]?.clave ?? "",
                          duracionPeriodos: 6,
                          creditosTotales: 0,
                          plantillaGrado: "{N}o Semestre",
                        },
                      ],
                    }))
                  }
                >
                  Agregar plan
                </Boton>
              </div>
              <p className="mb-2 text-xs text-slate-500">
                La duracion del plan determina cuantos grados se crean y cuantos cargos de
                colegiatura se generan.
              </p>
              <div className="space-y-2">
                {datos.planes.map((plan, indice) => (
                  <FilaLista
                    key={indice}
                    alQuitar={
                      datos.planes.length > 1
                        ? () =>
                            setDatos((p) => ({ ...p, planes: p.planes.filter((_, i) => i !== indice) }))
                        : undefined
                    }
                  >
                    <Campo
                      etiqueta="Nombre del plan"
                      value={plan.nombre}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planes: p.planes.map((x, i) =>
                            i === indice ? { ...x, nombre: e.target.value } : x
                          ),
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Clave"
                      value={plan.clave}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planes: p.planes.map((x, i) =>
                            i === indice ? { ...x, clave: e.target.value.toUpperCase() } : x
                          ),
                        }))
                      }
                    />
                    <Selector
                      etiqueta="Nivel"
                      value={plan.nivelClave}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planes: p.planes.map((x, i) =>
                            i === indice ? { ...x, nivelClave: e.target.value } : x
                          ),
                        }))
                      }
                    >
                      {datos.niveles.map((n) => (
                        <option key={n.clave} value={n.clave}>
                          {n.nombre || n.clave}
                        </option>
                      ))}
                    </Selector>
                    <Campo
                      etiqueta="Duracion (periodos)"
                      type="number"
                      min={1}
                      max={30}
                      value={String(plan.duracionPeriodos)}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planes: p.planes.map((x, i) =>
                            i === indice ? { ...x, duracionPeriodos: Number(e.target.value) } : x
                          ),
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Nombre de cada periodo"
                      className="sm:col-span-2"
                      value={plan.plantillaGrado}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          planes: p.planes.map((x, i) =>
                            i === indice ? { ...x, plantillaGrado: e.target.value } : x
                          ),
                        }))
                      }
                      ayuda="Usa {N} para el numero. Ejemplos: {N}o Semestre, Cuatrimestre {N}, Modulo {N}"
                    />
                  </FilaLista>
                ))}
              </div>
            </div>
          </div>
        )}

        {actual.id === "ciclo" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre del ciclo"
              value={datos.ciclo.nombre}
              onChange={(e) => actualizar("ciclo", { nombre: e.target.value })}
            />
            <Campo
              etiqueta="Clave"
              value={datos.ciclo.clave}
              onChange={(e) => actualizar("ciclo", { clave: e.target.value })}
            />
            <Campo
              etiqueta="Fecha de inicio"
              type="date"
              value={datos.ciclo.fechaInicio}
              onChange={(e) => actualizar("ciclo", { fechaInicio: e.target.value })}
            />
            <Campo
              etiqueta="Fecha de fin"
              type="date"
              value={datos.ciclo.fechaFin}
              onChange={(e) => actualizar("ciclo", { fechaFin: e.target.value })}
            />
            <Campo
              etiqueta="Numero de periodos de evaluacion"
              type="number"
              min={1}
              max={12}
              value={String(datos.ciclo.numeroPeriodos)}
              onChange={(e) => actualizar("ciclo", { numeroPeriodos: Number(e.target.value) })}
              ayuda="Parciales, bimestres o como los llame tu escuela"
            />
            <Campo
              etiqueta="Nombre de cada periodo"
              value={datos.ciclo.plantillaPeriodo}
              onChange={(e) => actualizar("ciclo", { plantillaPeriodo: e.target.value })}
              ayuda="Usa {N} para el numero"
            />
            <div className="sm:col-span-2">
              <Alerta tipo="info">
                Las fechas de cada periodo se reparten automaticamente entre el inicio y el fin del
                ciclo. Podras ajustarlas una por una despues de instalar.
              </Alerta>
            </div>
          </div>
        )}

        {actual.id === "escala" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre de la escala"
              value={datos.escala.nombre}
              onChange={(e) => actualizar("escala", { nombre: e.target.value })}
            />
            <Selector
              etiqueta="Tipo"
              value={datos.escala.tipo}
              onChange={(e) => actualizar("escala", { tipo: e.target.value as "NUMERICA" })}
            >
              <option value="NUMERICA">Numerica</option>
              <option value="LETRA">Por letras</option>
              <option value="CONCEPTUAL">Conceptual</option>
            </Selector>
            <Campo
              etiqueta="Valor minimo"
              type="number"
              value={String(datos.escala.valorMinimo)}
              onChange={(e) => actualizar("escala", { valorMinimo: Number(e.target.value) })}
            />
            <Campo
              etiqueta="Valor maximo"
              type="number"
              value={String(datos.escala.valorMaximo)}
              onChange={(e) => actualizar("escala", { valorMaximo: Number(e.target.value) })}
            />
            <Campo
              etiqueta="Calificacion minima aprobatoria"
              type="number"
              value={String(datos.escala.minimaAprobatoria)}
              onChange={(e) => actualizar("escala", { minimaAprobatoria: Number(e.target.value) })}
              ayuda="La define la institucion"
            />
            <Campo
              etiqueta="Decimales"
              type="number"
              min={0}
              max={4}
              value={String(datos.escala.decimales)}
              onChange={(e) => actualizar("escala", { decimales: Number(e.target.value) })}
            />
            <Selector
              etiqueta="Redondeo"
              className="sm:col-span-2"
              value={datos.escala.redondeo}
              onChange={(e) => actualizar("escala", { redondeo: e.target.value as "NINGUNO" })}
            >
              <option value="NINGUNO">Sin redondeo (se trunca)</option>
              <option value="MATEMATICO">Matematico (0.5 sube)</option>
              <option value="HACIA_ARRIBA">Siempre hacia arriba</option>
              <option value="HACIA_ABAJO">Siempre hacia abajo</option>
            </Selector>
          </div>
        )}

        {actual.id === "horarios" && (
          <div className="space-y-6">
            <div>
              <p className="etiqueta-campo">Dias habiles</p>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia) => {
                  const activo = datos.horarios.diasHabiles.includes(dia.valor);
                  return (
                    <button
                      key={dia.valor}
                      type="button"
                      onClick={() =>
                        setDatos((p) => ({
                          ...p,
                          horarios: {
                            ...p.horarios,
                            diasHabiles: activo
                              ? p.horarios.diasHabiles.filter((d) => d !== dia.valor)
                              : [...p.horarios.diasHabiles, dia.valor].sort((a, b) => Number(a) - Number(b)),
                          },
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        activo
                          ? "border-marca-600 bg-marca-50 text-marca-700"
                          : "border-slate-300 bg-white text-slate-500"
                      }`}
                    >
                      {dia.nombre}
                    </button>
                  );
                })}
              </div>
            </div>

            <Campo
              etiqueta="Duracion de cada modulo (minutos)"
              type="number"
              min={10}
              max={300}
              className="sm:w-64"
              value={String(datos.horarios.duracionModuloMinutos)}
              onChange={(e) =>
                setDatos((p) => ({
                  ...p,
                  horarios: { ...p.horarios, duracionModuloMinutos: Number(e.target.value) },
                }))
              }
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Modulos del dia</h3>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() =>
                    setDatos((p) => ({
                      ...p,
                      horarios: {
                        ...p.horarios,
                        modulos: [
                          ...p.horarios.modulos,
                          {
                            nombre: `Modulo ${p.horarios.modulos.filter((m) => !m.esReceso).length + 1}`,
                            horaInicio: "10:40",
                            horaFin: "11:30",
                            esReceso: false,
                          },
                        ],
                      },
                    }))
                  }
                >
                  Agregar modulo
                </Boton>
              </div>
              <div className="space-y-2">
                {datos.horarios.modulos.map((modulo, indice) => (
                  <FilaLista
                    key={indice}
                    alQuitar={() =>
                      setDatos((p) => ({
                        ...p,
                        horarios: {
                          ...p.horarios,
                          modulos: p.horarios.modulos.filter((_, i) => i !== indice),
                        },
                      }))
                    }
                  >
                    <Campo
                      etiqueta="Nombre"
                      value={modulo.nombre}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          horarios: {
                            ...p.horarios,
                            modulos: p.horarios.modulos.map((x, i) =>
                              i === indice ? { ...x, nombre: e.target.value } : x
                            ),
                          },
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Inicio"
                      type="time"
                      value={modulo.horaInicio}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          horarios: {
                            ...p.horarios,
                            modulos: p.horarios.modulos.map((x, i) =>
                              i === indice ? { ...x, horaInicio: e.target.value } : x
                            ),
                          },
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Fin"
                      type="time"
                      value={modulo.horaFin}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          horarios: {
                            ...p.horarios,
                            modulos: p.horarios.modulos.map((x, i) =>
                              i === indice ? { ...x, horaFin: e.target.value } : x
                            ),
                          },
                        }))
                      }
                    />
                    <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={modulo.esReceso ?? false}
                        onChange={(e) =>
                          setDatos((p) => ({
                            ...p,
                            horarios: {
                              ...p.horarios,
                              modulos: p.horarios.modulos.map((x, i) =>
                                i === indice ? { ...x, esReceso: e.target.checked } : x
                              ),
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-marca-600"
                      />
                      Es receso
                    </label>
                  </FilaLista>
                ))}
              </div>
            </div>
          </div>
        )}

        {actual.id === "asistencia" && (
          <div className="space-y-4">
            <Interruptor
              etiqueta="Cada docente elige como pasa lista"
              descripcion="Por dia completo o clase por clase, desde su propio portal."
              valor={datos.asistencia.docenteDecideModo}
              alCambiar={(v) => actualizar("asistencia", { docenteDecideModo: v })}
            />
            <Selector
              etiqueta="Modo predeterminado"
              className="sm:w-72"
              value={datos.asistencia.modoPredeterminado}
              onChange={(e) =>
                actualizar("asistencia", { modoPredeterminado: e.target.value as "POR_CLASE" })
              }
            >
              <option value="POR_CLASE">Por clase</option>
              <option value="POR_DIA">Por dia</option>
            </Selector>
            <Interruptor
              etiqueta="Cada docente decide si la asistencia afecta la calificacion"
              valor={datos.asistencia.docenteDecideAfectacion}
              alCambiar={(v) => actualizar("asistencia", { docenteDecideAfectacion: v })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Faltas consecutivas que disparan alerta"
                type="number"
                min={1}
                max={30}
                value={String(datos.asistencia.faltasConsecutivasAlerta)}
                onChange={(e) =>
                  actualizar("asistencia", { faltasConsecutivasAlerta: Number(e.target.value) })
                }
                ayuda="Al alcanzarse, el sistema avisa a los administrativos."
              />
              <Campo
                etiqueta="Retardos que equivalen a una falta"
                type="number"
                min={0}
                max={20}
                value={String(datos.asistencia.retardosEquivalenFalta)}
                onChange={(e) =>
                  actualizar("asistencia", { retardosEquivalenFalta: Number(e.target.value) })
                }
                ayuda="0 desactiva la equivalencia."
              />
            </div>
          </div>
        )}

        {actual.id === "finanzas" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Dia de vencimiento predeterminado"
                type="number"
                min={1}
                max={31}
                value={String(datos.finanzas.diaVencimientoDefault)}
                onChange={(e) =>
                  actualizar("finanzas", { diaVencimientoDefault: Number(e.target.value) })
                }
              />
              <Campo
                etiqueta="Serie del recibo"
                value={datos.finanzas.serieRecibo}
                onChange={(e) => actualizar("finanzas", { serieRecibo: e.target.value })}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Conceptos de cobro</h3>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() =>
                    setDatos((p) => ({
                      ...p,
                      finanzas: {
                        ...p.finanzas,
                        conceptos: [
                          ...p.finanzas.conceptos,
                          {
                            clave: "",
                            nombre: "",
                            tipo: "OTRO",
                            montoBase: 0,
                            periodicidad: "UNICO",
                            obligatorio: true,
                          },
                        ],
                      },
                    }))
                  }
                >
                  Agregar concepto
                </Boton>
              </div>
              <div className="space-y-2">
                {datos.finanzas.conceptos.map((concepto, indice) => (
                  <FilaLista
                    key={indice}
                    alQuitar={() =>
                      setDatos((p) => ({
                        ...p,
                        finanzas: {
                          ...p.finanzas,
                          conceptos: p.finanzas.conceptos.filter((_, i) => i !== indice),
                        },
                      }))
                    }
                  >
                    <Campo
                      etiqueta="Clave"
                      value={concepto.clave}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          finanzas: {
                            ...p.finanzas,
                            conceptos: p.finanzas.conceptos.map((x, i) =>
                              i === indice ? { ...x, clave: e.target.value.toUpperCase() } : x
                            ),
                          },
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Nombre"
                      value={concepto.nombre}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          finanzas: {
                            ...p.finanzas,
                            conceptos: p.finanzas.conceptos.map((x, i) =>
                              i === indice ? { ...x, nombre: e.target.value } : x
                            ),
                          },
                        }))
                      }
                    />
                    <Campo
                      etiqueta="Monto"
                      type="number"
                      min={0}
                      step="0.01"
                      value={String(concepto.montoBase)}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          finanzas: {
                            ...p.finanzas,
                            conceptos: p.finanzas.conceptos.map((x, i) =>
                              i === indice ? { ...x, montoBase: Number(e.target.value) } : x
                            ),
                          },
                        }))
                      }
                    />
                    <Selector
                      etiqueta="Periodicidad"
                      value={concepto.periodicidad}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          finanzas: {
                            ...p.finanzas,
                            conceptos: p.finanzas.conceptos.map((x, i) =>
                              i === indice
                                ? { ...x, periodicidad: e.target.value as typeof x.periodicidad }
                                : x
                            ),
                          },
                        }))
                      }
                    >
                      <option value="UNICO">Pago unico</option>
                      <option value="MENSUAL">Mensual</option>
                      <option value="BIMESTRAL">Bimestral</option>
                      <option value="POR_PERIODO_ACADEMICO">Por periodo academico</option>
                      <option value="SEMESTRAL">Semestral</option>
                      <option value="ANUAL">Anual</option>
                    </Selector>
                    <Selector
                      etiqueta="Tipo"
                      value={concepto.tipo}
                      onChange={(e) =>
                        setDatos((p) => ({
                          ...p,
                          finanzas: {
                            ...p.finanzas,
                            conceptos: p.finanzas.conceptos.map((x, i) =>
                              i === indice ? { ...x, tipo: e.target.value as typeof x.tipo } : x
                            ),
                          },
                        }))
                      }
                    >
                      <option value="INSCRIPCION">Inscripcion</option>
                      <option value="REINSCRIPCION">Reinscripcion</option>
                      <option value="COLEGIATURA">Colegiatura</option>
                      <option value="MATERIAL">Material</option>
                      <option value="UNIFORME">Uniforme</option>
                      <option value="TRANSPORTE">Transporte</option>
                      <option value="EVENTO">Evento</option>
                      <option value="EXAMEN">Examen</option>
                      <option value="TRAMITE">Tramite</option>
                      <option value="OTRO">Otro</option>
                    </Selector>
                  </FilaLista>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Recargos por pago tardio</h3>
              <Interruptor
                etiqueta="Cobrar recargo por pago tardio"
                valor={datos.finanzas.recargoActivo}
                alCambiar={(v) => actualizar("finanzas", { recargoActivo: v })}
              />
              {datos.finanzas.recargoActivo && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Selector
                    etiqueta="Tipo de recargo"
                    value={datos.finanzas.recargoTipoCalculo}
                    onChange={(e) =>
                      actualizar("finanzas", { recargoTipoCalculo: e.target.value as "FIJO" })
                    }
                  >
                    <option value="PORCENTAJE">Porcentaje</option>
                    <option value="FIJO">Monto fijo</option>
                  </Selector>
                  <Campo
                    etiqueta="Valor"
                    type="number"
                    min={0}
                    step="0.01"
                    value={String(datos.finanzas.recargoValor)}
                    onChange={(e) => actualizar("finanzas", { recargoValor: Number(e.target.value) })}
                  />
                  <Campo
                    etiqueta="Dias de gracia"
                    type="number"
                    min={0}
                    max={60}
                    value={String(datos.finanzas.recargoDiasGracia)}
                    onChange={(e) =>
                      actualizar("finanzas", { recargoDiasGracia: Number(e.target.value) })
                    }
                  />
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Interruptor
                etiqueta="Permitir pagos parciales"
                valor={datos.finanzas.permitePagosParciales}
                alCambiar={(v) => actualizar("finanzas", { permitePagosParciales: v })}
              />
              <Interruptor
                etiqueta="Permitir convenios de pago"
                valor={datos.finanzas.permiteConvenios}
                alCambiar={(v) => actualizar("finanzas", { permiteConvenios: v })}
              />
              <Interruptor
                etiqueta="Bloquear servicios por adeudo"
                descripcion="Apagado por defecto. Define despues que se bloquea."
                valor={datos.finanzas.bloquearPorAdeudo}
                alCambiar={(v) => actualizar("finanzas", { bloquearPorAdeudo: v })}
              />
            </div>

            <Campo
              etiqueta="Leyenda al pie del recibo"
              value={datos.finanzas.leyendaRecibo}
              onChange={(e) => actualizar("finanzas", { leyendaRecibo: e.target.value })}
              ayuda="Mientras no se conecte un PAC, el recibo es interno y sin validez fiscal."
            />
          </div>
        )}

        {actual.id === "admin" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre de usuario"
              required
              value={datos.administrador.usuario}
              onChange={(e) =>
                actualizar("administrador", { usuario: e.target.value.toLowerCase().trim() })
              }
            />
            <Campo
              etiqueta="Correo electronico"
              type="email"
              required
              value={datos.administrador.email}
              onChange={(e) => actualizar("administrador", { email: e.target.value.trim() })}
            />
            <Campo
              etiqueta="Nombre(s)"
              required
              value={datos.administrador.nombres}
              onChange={(e) => actualizar("administrador", { nombres: e.target.value })}
            />
            <Campo
              etiqueta="Apellido paterno"
              required
              value={datos.administrador.apellidoPaterno}
              onChange={(e) => actualizar("administrador", { apellidoPaterno: e.target.value })}
            />
            <Campo
              etiqueta="Apellido materno"
              value={datos.administrador.apellidoMaterno ?? ""}
              onChange={(e) => actualizar("administrador", { apellidoMaterno: e.target.value })}
            />
            <Campo
              etiqueta="Contrasena"
              type="password"
              required
              value={datos.administrador.password}
              onChange={(e) => actualizar("administrador", { password: e.target.value })}
              ayuda="Minimo 8 caracteres, con letras y numeros."
            />
          </div>
        )}

        {actual.id === "resumen" && (
          <div className="space-y-4">
            <Alerta tipo="aviso">
              Revisa el resumen. Al confirmar se crea la estructura inicial y tu cuenta de
              administrador. Despues podras cambiar cualquier parametro desde Configuracion.
            </Alerta>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Institucion</dt>
                <dd className="mt-1 font-medium text-slate-900">{datos.institucion.nombre || "—"}</dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Planteles y turnos</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {datos.planteles.length} plantel(es), {datos.turnos.length} turno(s)
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Oferta academica</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {datos.niveles.length} nivel(es), {datos.planes.length} plan(es),{" "}
                  {datos.planes.reduce((suma, p) => suma + Number(p.duracionPeriodos), 0)} grados
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Ciclo</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {datos.ciclo.nombre} · {datos.ciclo.numeroPeriodos} periodos
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Evaluacion</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {datos.escala.valorMinimo} a {datos.escala.valorMaximo} · aprueba con{" "}
                  {datos.escala.minimaAprobatoria}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Finanzas</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {datos.finanzas.conceptos.length} concepto(s) · vence el dia{" "}
                  {datos.finanzas.diaVencimientoDefault}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Administrador</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {datos.administrador.nombres} {datos.administrador.apellidoPaterno} ·{" "}
                  {datos.administrador.usuario}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <footer className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
          <Boton
            type="button"
            variante="secundario"
            onClick={() => setPaso((p) => Math.max(0, p - 1))}
            disabled={paso === 0 || enviando}
          >
            Atras
          </Boton>
          <span className="text-xs text-slate-500">
            Paso {paso + 1} de {PASOS.length}
          </span>
          {actual.id === "resumen" ? (
            <Boton type="button" onClick={instalar} disabled={enviando}>
              {enviando ? "Instalando..." : "Instalar sistema"}
            </Boton>
          ) : (
            <Boton type="button" onClick={siguiente} disabled={enviando}>
              Continuar
            </Boton>
          )}
        </footer>
      </Tarjeta>
    </div>
  );
}
