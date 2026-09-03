import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Tailwind v4's postcss.config.mjs is not loadable by Vite here; tests never touch CSS.
  css: { postcss: {} },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
