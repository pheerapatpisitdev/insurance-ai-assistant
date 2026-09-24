import { describe, expect, it } from "vitest";
import { googleImageBody, openAiEditForm, TAKES_REFERENCES } from "@/lib/ai/images";

const ref = { bytes: Buffer.from([1, 2, 3]), mimeType: "image/jpeg" };

describe("reference photos for the image models", () => {
  it("sends Gemini the text, then each photo as an image item", () => {
    const body = googleImageBody("gemini-3.1-flash-image", "draw", {}, [ref, ref]) as { input: Record<string, unknown>[] };
    expect(body.input[0]).toEqual({ type: "text", text: "draw" });
    expect(body.input.slice(1)).toEqual([
      { type: "image", mime_type: "image/jpeg", data: "AQID" },
      { type: "image", mime_type: "image/jpeg", data: "AQID" },
    ]);
  });
  it("sends Gemini only the text when there are none", () => {
    expect((googleImageBody("m", "draw", {}, []) as { input: unknown[] }).input).toHaveLength(1);
  });
  it("gives OpenAI's edit endpoint every photo as image[]", () => {
    const form = openAiEditForm("gpt-image-2", "draw", {}, [ref, ref]);
    expect(form.getAll("image[]")).toHaveLength(2);
    expect(form.get("prompt")).toBe("draw");
  });
  it("names the providers that take references", () => {
    expect([...TAKES_REFERENCES].sort()).toEqual(["google", "openai"]);
  });
});
