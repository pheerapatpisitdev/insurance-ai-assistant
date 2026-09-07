import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production builds write to a separate folder so verifying a build never clobbers the
  // dev server's .next (which leaves it throwing "Cannot find module './xxx.js'").
  // Use `npm run verify`, which sets NEXT_DIST_DIR=.next-build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // pdfjs loads its worker through a dynamic import at runtime. Bundling it rewrites that
  // path and the import fails ("Setting up fake worker failed"), so keep it external and
  // let Node resolve it from node_modules.
  serverExternalPackages: ["pdfjs-dist"],
  // the quote card draws Thai text, and the drawing library needs the font files themselves
  outputFileTracingIncludes: { "/api/card": ["./src/app/api/card/*.ttf"] },
  /* config options here */
};

export default nextConfig;
