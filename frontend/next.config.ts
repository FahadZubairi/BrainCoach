import type { NextConfig } from "next";

// In production the browser calls the API through this app's own origin (/api/* → BACKEND_URL), so the
// httpOnly session cookie is first-party. Separate hosts like *.vercel.app and *.onrender.com are
// different sites, and browsers wouldn't send a SameSite=Lax cookie between them.
const backendUrl = process.env.BACKEND_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return backendUrl ? [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }] : [];
  },
};

export default nextConfig;
