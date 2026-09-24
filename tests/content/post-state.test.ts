import { afterEach, describe, expect, it, vi } from "vitest";
import { postState, PublishError } from "@/lib/facebook/publish";

/**
 * Whether a held post went up, asked of Graph with the shapes Graph really answers in. Every
 * row so far keeps a bare photo id (postPhoto got no post_id for a scheduled photo), and a
 * Photo node has no is_published — asking one for it is an error, not a "no".
 */

type Answer = { status?: number; body: unknown };
function graph(answers: Record<string, Answer>) {
  const fetch = vi.fn(async (url: string) => {
    const u = new URL(url);
    const key = `${u.pathname.split("/").pop()}?${u.searchParams.get("fields")}`;
    const a = answers[key] ?? { status: 400, body: { error: { code: 100, message: `(#100) Tried accessing nonexisting field (${u.searchParams.get("fields")})` } } };
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("postState", () => {
  it("asks a photo for its story, not for is_published it does not have", async () => {
    const f = graph({
      "1124071103287384?page_story_id": { body: { page_story_id: "105_777", id: "1124071103287384" } },
      "105_777?is_published": { body: { is_published: true, id: "105_777" } },
    });
    expect(await postState("1124071103287384", "t")).toBe("published");
    expect(f.mock.calls.map(([u]) => new URL(u as string).searchParams.get("fields"))).toEqual(["page_story_id", "is_published"]);
  });

  it("reads a post that is still not published as unpublished", async () => {
    graph({
      "1124071103287384?page_story_id": { body: { page_story_id: "105_777", id: "1124071103287384" } },
      "105_777?is_published": { body: { is_published: false, id: "105_777" } },
    });
    expect(await postState("1124071103287384", "t")).toBe("unpublished");
  });

  it("asks a post id for is_published directly", async () => {
    graph({ "105_777?is_published": { body: { is_published: true, id: "105_777" } } });
    expect(await postState("105_777", "t")).toBe("published");
  });

  it("cannot decide for a photo with no story — unknown, never unpublished", async () => {
    graph({ "1124071103287384?page_story_id": { body: { id: "1124071103287384" } } });
    expect(await postState("1124071103287384", "t")).toBe("unknown");
  });

  it("throws on a Graph error (a token, a permission, a missing field) rather than answering", async () => {
    graph({ "1124071103287384?page_story_id": { status: 400, body: { error: { code: 190, message: "Error validating access token" } } } });
    await expect(postState("1124071103287384", "t")).rejects.toBeInstanceOf(PublishError);
    // the old question, is_published of a photo, is an error too — and so is not a "no"
    graph({});
    await expect(postState("105_777", "t")).rejects.toBeInstanceOf(PublishError);
  });
});
