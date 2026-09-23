import { describe, expect, it } from "vitest";
import { DEFAULT_PAINTER, DEFAULT_WRITER, PAINTERS, WRITERS, painterOf, shortModel, writerOf } from "@/lib/content/models";

describe("the models the owner may pick", () => {
  it("offers the three writers the bake-off kept, Sonnet first and the default", () => {
    expect(WRITERS.map((w) => w.model)).toEqual(["claude-sonnet-5", "gpt-5", "gemini-3.7-flash"]);
    expect(DEFAULT_WRITER).toBe("best");
    expect(writerOf(DEFAULT_WRITER).model).toBe("claude-sonnet-5");
  });

  it("never passes on a model name the browser made up", () => {
    // an id not on the list is the default, so a stranger cannot order the dearest model
    expect(writerOf("claude-opus-5-5").model).toBe("claude-sonnet-5");
    expect(writerOf(undefined).model).toBe("claude-sonnet-5");
    expect(painterOf("gpt-image-ultra").modelId).toBe("gpt-image-medium");
  });

  it("has a no-picture choice that costs nothing, and the standard picture as default", () => {
    expect(painterOf("none")).toMatchObject({ modelId: null, thb: 0 });
    expect(painterOf(DEFAULT_PAINTER).modelId).toBe("gpt-image-medium");
    expect(PAINTERS.map((p) => p.id)).toEqual(["none", "standard", "sharp", "gemini"]);
  });

  it("names a fallback model the owner did not pick", () => {
    expect(shortModel("gemini-3.7-flash")).toBe("Gemini Flash");
    expect(shortModel("glm-5.3")).toBe("GLM-5.3");
    expect(shortModel("some-new-model")).toBe("some-new-model");
  });
});
