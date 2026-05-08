import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración de imágenes (permitir dominios externos si es necesario)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Deshabilitar el strict mode de React en producción si causa doble render
  reactStrictMode: true,

  // Headers de seguridad y CORS
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
