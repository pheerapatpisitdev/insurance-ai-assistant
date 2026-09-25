import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * Posting a piece draws its poster on the server, inside the page the owner pressed from, and
 * the drawing reads two .wasm files off disk at run time — which the bundler cannot see, so
 * each such page must list them. On 2026-09-25 /content/calendar shipped without them and
 * every post from the calendar failed with ENOENT on index_bg.wasm.
 */

const WASM = ["./node_modules/harfbuzzjs/hb.wasm", "./node_modules/@resvg/resvg-wasm/index_bg.wasm"];
/** the pages whose server actions reach drawPoster (publish-flow) */
const DRAWING_ROUTES = ["/api/content-poster", "/content", "/content/calendar"];

describe("every page that draws a poster ships the poster's wasm", () => {
  it.each(DRAWING_ROUTES)("%s", (route) => {
    const includes = nextConfig.outputFileTracingIncludes ?? {};
    const listed = Object.entries(includes)
      .filter(([key]) => key === route || (key.endsWith("/**") && route.startsWith(key.slice(0, -3))))
      .flatMap(([, files]) => files);
    for (const file of WASM) expect(listed, `${route} → ${file}`).toContain(file);
  });
});
