import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Empaquetado minimo para la imagen de Docker.
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
