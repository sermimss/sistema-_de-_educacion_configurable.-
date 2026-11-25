import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Empaquetado minimo para la imagen de Docker.
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  // Entregas de tareas: hasta 3 archivos de 10 MB.
  experimental: { serverActions: { bodySizeLimit: "35mb" } },
};

export default nextConfig;
