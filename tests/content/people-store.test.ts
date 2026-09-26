import { describe, expect, it } from "vitest";
import { isPhotoPath } from "@/lib/content/people-store";

describe("a person's photo paths", () => {
  it("take the shape <person id>/<slot>.<ext> and nothing else", () => {
    expect(isPhotoPath("b5b0c41f-1e11-4d75-b0e9-9329024413c2/7.jpg")).toBe(true);
    expect(isPhotoPath("../secret")).toBe(false);
    expect(isPhotoPath("b5b0c41f-1e11-4d75-b0e9-9329024413c2/19.jpg")).toBe(true);
    expect(isPhotoPath("b5b0c41f-1e11-4d75-b0e9-9329024413c2/100.jpg")).toBe(false);
  });
});
