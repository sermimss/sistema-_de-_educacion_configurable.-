import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { ETIQUETAS_CATEGORIA, sembrarConfiguracion } from "@/lib/configuracion";
import { Alerta, Tarjeta } from "@/components/ui";
import FormularioCategoria from "./FormularioCategoria";
import FormularioIdentidad from "./FormularioIdentidad";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracion() {
  await requerirRol("ADMIN");
  // Asegura que los parametros nuevos del catalogo aparezcan tras una
  // actualizacion del sistema, sin pisar lo que la escuela ya ajusto.
  await sembrarConfiguracion();

  const institucion = await obtenerInstitucion();
  const parametros = await db.configuracion.findMany({
    orderBy: [{ categoria: "asc" }, { orden: "asc" }],
  });

  const porCategoria = new Map<string, typeof parametros>();
  for (const parametro of parametros) {
    const lista = porCategoria.get(parametro.categoria) ?? [];
    lista.push(parametro);
    porCategoria.set(parametro.categoria, lista);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Configuracion del sistema</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cada parametro de esta pantalla cambia el comportamiento del sistema sin tocar el codigo.
        </p>
      </header>

      <Alerta tipo="info">
        Hay {parametros.length} parametros configurables. Los cambios quedan registrados en la
        bitacora de auditoria con el usuario y la fecha.
      </Alerta>

      {institucion && (
        <Tarjeta titulo="Identidad de la institucion" descripcion="Nombre, logo y colores que ve todo el mundo">
          <FormularioIdentidad
            institucion={{
              nombre: institucion.nombre,
              nombreCorto: institucion.nombreCorto,
              lema: institucion.lema,
              logoUrl: institucion.logoUrl,
              colorPrimario: institucion.colorPrimario,
              colorSecundario: institucion.colorSecundario,
              telefono: institucion.telefono,
              email: institucion.email,
              direccion: institucion.direccion,
              razonSocial: institucion.razonSocial,
              rfc: institucion.rfc,
              regimenFiscal: institucion.regimenFiscal,
            }}
          />
        </Tarjeta>
      )}

      {[...porCategoria.entries()].map(([categoria, lista]) => (
        <Tarjeta
          key={categoria}
          titulo={ETIQUETAS_CATEGORIA[categoria] ?? categoria}
          descripcion={`${lista.length} parametro(s)`}
        >
          <FormularioCategoria
            categoria={ETIQUETAS_CATEGORIA[categoria] ?? categoria}
            parametros={lista.map((p) => ({
              clave: p.clave,
              valor: p.valor,
              tipo: p.tipo,
              etiqueta: p.etiqueta,
              descripcion: p.descripcion,
              opciones: p.opciones,
              editable: p.editable,
            }))}
          />
        </Tarjeta>
      ))}
    </div>
  );
}
