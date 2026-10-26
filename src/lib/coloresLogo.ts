/// Detecta los colores de un logo a partir de sus pixeles. No toca la base:
/// corre en el navegador, sobre la imagen que se acaba de elegir.

export type ColorDetectado = { hex: string; peso: number };

function aHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function saturacionYLuz(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const luz = (max + min) / 2;
  const saturacion = max === min ? 0 : (max - min) / (1 - Math.abs(2 * luz - 1));
  return { saturacion, luz };
}

function distancia(a: string, b: string): number {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return Math.hypot(c(a, 1) - c(b, 1), c(a, 3) - c(b, 3), c(a, 5) - c(b, 5));
}

/// Agrupa los pixeles en colores parecidos y devuelve los mas usados. Se
/// ignoran los transparentes y el fondo blanco o casi blanco, que casi todos
/// los logos traen y no es un color de la marca.
export function coloresDominantes(
  pixeles: Uint8ClampedArray,
  maximo = 6
): ColorDetectado[] {
  const cubetas = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i < pixeles.length; i += 4) {
    const [r, g, b, a] = [pixeles[i], pixeles[i + 1], pixeles[i + 2], pixeles[i + 3]];
    if (a < 128) continue;
    if (r > 235 && g > 235 && b > 235) continue;
    const llave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cubeta = cubetas.get(llave) ?? { r: 0, g: 0, b: 0, n: 0 };
    cubeta.r += r;
    cubeta.g += g;
    cubeta.b += b;
    cubeta.n += 1;
    cubetas.set(llave, cubeta);
    total++;
  }
  if (total === 0) return [];

  const ordenados = [...cubetas.values()]
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ hex: aHex(c.r / c.n, c.g / c.n, c.b / c.n), peso: c.n / total }));

  // Se juntan los tonos casi iguales para no proponer cinco azules.
  const distintos: ColorDetectado[] = [];
  for (const color of ordenados) {
    const parecido = distintos.find((d) => distancia(d.hex, color.hex) < 48);
    if (parecido) parecido.peso += color.peso;
    else distintos.push({ ...color });
    if (distintos.length >= maximo * 2) break;
  }
  return distintos
    .filter((c) => c.peso >= 0.01)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, maximo);
}

/// Propone el color principal (el mas presente con color de verdad, no gris)
/// y el secundario (el siguiente que se distinga del principal).
export function proponerColores(colores: ColorDetectado[]): { primario: string; secundario: string } | null {
  if (colores.length === 0) return null;
  const conColor = colores.filter((c) => {
    const r = parseInt(c.hex.slice(1, 3), 16);
    const g = parseInt(c.hex.slice(3, 5), 16);
    const b = parseInt(c.hex.slice(5, 7), 16);
    const { saturacion, luz } = saturacionYLuz(r, g, b);
    return saturacion > 0.25 && luz > 0.12 && luz < 0.85;
  });
  const primario = (conColor[0] ?? colores[0]).hex;
  const secundario =
    [...conColor, ...colores].find((c) => distancia(c.hex, primario) > 80)?.hex ?? "#0f172a";
  return { primario, secundario };
}

/// Lee los pixeles de una imagen elegida en un <input type="file">.
export async function leerPixeles(archivo: File): Promise<Uint8ClampedArray> {
  const mapa = await createImageBitmap(archivo);
  const escala = Math.min(1, 96 / Math.max(mapa.width, mapa.height));
  const ancho = Math.max(1, Math.round(mapa.width * escala));
  const alto = Math.max(1, Math.round(mapa.height * escala));
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) return new Uint8ClampedArray();
  contexto.drawImage(mapa, 0, 0, ancho, alto);
  return contexto.getImageData(0, 0, ancho, alto).data;
}
