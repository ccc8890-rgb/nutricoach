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

  // Headers de seguridad, CORS y PWA
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Service Worker scope para PWA
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // Cache óptimo para assets estáticos del manifest
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
