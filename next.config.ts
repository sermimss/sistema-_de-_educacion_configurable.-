import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Empaquetado minimo para la imagen de Docker.
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  // Avisos, material y entregas de tareas: hasta 5 archivos de 10 MB.
  experimental: { serverActions: { bodySizeLimit: "55mb" } },
};

export default nextConfig;
