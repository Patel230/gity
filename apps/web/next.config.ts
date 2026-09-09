import type { NextConfig } from "next";

/**
 * GitHub Pages = static file hosting, so Gity builds as a fully static
 * export (`out/`). Every page is client-rendered against api.github.com.
 *
 * NEXT_PUBLIC_BASE_PATH: set to `/<repo-name>` for project Pages sites
 * (e.g. `/gity`). Leave empty for user/org Pages sites (`<user>.github.io`).
 * The deploy workflow sets this automatically from the repository name.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
