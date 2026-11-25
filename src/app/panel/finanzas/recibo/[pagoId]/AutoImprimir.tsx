"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/// Abre el dialogo de impresion del recibo y, al cerrarlo, regresa a la caja
/// lista para el siguiente cobro.
export function AutoImprimir({ volver }: { volver: string }) {
  const router = useRouter();
  useEffect(() => {
    const regresar = () => router.push(volver);
    window.addEventListener("afterprint", regresar, { once: true });
    const t = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", regresar);
    };
  }, [router, volver]);
  return (
    <Link href={volver} className="rounded-lg bg-marca-600 px-3 py-1.5 text-sm font-medium text-marca-contraste hover:bg-marca-700" data-volver-caja>
      Volver a la caja
    </Link>
  );
}
