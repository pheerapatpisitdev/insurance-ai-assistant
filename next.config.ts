import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production builds write to a separate folder so verifying a build never clobbers the
  // dev server's .next (which leaves it throwing "Cannot find module './xxx.js'").
  // Use `npm run verify`, which sets NEXT_DIST_DIR=.next-build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // the quote cards draw Thai text, and the drawing library needs the font files themselves —
  // the health card reads the same two faces from where the other one keeps them
  outputFileTracingIncludes: {
    "/api/card": ["./src/app/api/card/*.ttf"],
    "/api/ihealthy-card": ["./src/app/api/card/*.ttf"],
  },
};

export default nextConfig;
