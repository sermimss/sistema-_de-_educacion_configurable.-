import { cache } from "react";
import { db } from "./db";

/// Lee (y memoiza por request) el registro unico de la institucion.
export const obtenerInstitucion = cache(async () => {
  return db.institucion.findUnique({ where: { id: 1 } });
});

export async function sistemaInstalado(): Promise<boolean> {
  try {
    const institucion = await obtenerInstitucion();
    return Boolean(institucion?.instalado);
  } catch {
    // Si la base aun no existe o no esta migrada, el sistema no esta instalado.
    return false;
  }
}
