import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Emit route directories (for example auth/callback/index.html) so
  // Cloudflare Pages serves the OAuth callback at the registered URL.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
