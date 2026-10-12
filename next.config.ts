import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*.trycloudflare.com"],
  experimental: {
    // Enables forbidden() so missing permissions render a 403 page (src/app/forbidden.tsx).
    authInterrupts: true,
    serverActions: {
      allowedOrigins: ["*.trycloudflare.com"],
    },
  },
};

export default nextConfig;
