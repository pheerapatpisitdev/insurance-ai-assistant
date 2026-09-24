import type { Layout, Theme } from "./poster";

/**
 * What the image model is asked for when a poster gets a picture behind it.
 *
 * Maryjane's buildBackgroundPrompt (src/lib/ai/image-prompt.ts), cut to what this site needs.
 * Its two load-bearing rules are kept word for word in spirit: the picture has no text of any
 * kind, because every Thai word on the poster is set afterwards by a real font; and the part of
 * the frame the words will sit on is kept calm, so they can be read.
 *
 * No Thai reaches the model. Image models read Thai badly and, worse, try to draw it — a Thai
 * word in the prompt is how garbled lettering ends up in the picture. The writer's imagePrompt
 * is English by instruction; anything Thai left in it is removed, and the owner's own request,
 * which may well be Thai, is translated before it gets here.
 */

const KEEP_CLEAR: Record<Layout, string> = {
  top: "Keep the top half of the frame calm and uncluttered — simple tones, no busy detail.",
  center: "Keep a calm horizontal band across the middle of the frame — simple tones, no busy detail.",
  bottom: "Keep the bottom half of the frame calm and uncluttered — simple tones, no busy detail.",
};

const PALETTE: Record<Theme, string> = {
  navy: "deep navy blue shadows with warm sand and cream highlights",
  sand: "warm sand, cream and soft beige tones with small touches of deep navy",
  white: "bright, airy whites and soft greys with small touches of deep navy",
  noir: "rich blacks and deep charcoal with warm gold accents, low-key luxurious lighting",
  champagne: "soft champagne, warm ivory and pale gold tones, gentle glowing light",
  emerald: "deep emerald and forest greens with touches of warm gold",
  mint: "fresh mint, pale sea-green and clean white tones, light and airy",
  sky: "clear sky blues, soft white and pale cloud tones, calm daylight",
  royal: "vivid royal blue and deep cobalt with small touches of warm yellow",
  violet: "deep violet and plum shadows with soft lilac highlights",
  lavender: "soft lavender, lilac and pale violet pastels, dreamy light",
  blush: "blush pink, rose and soft cream pastels, tender warm light",
  red: "bold crimson and deep red tones with small touches of warm yellow, energetic",
  orange: "vibrant orange and burnt amber tones, energetic warm light",
  peach: "warm peach, coral and apricot tones, soft golden-hour light",
  sunny: "bright sunny yellows and warm golden light with small touches of charcoal",
  teal: "deep teal and turquoise tones with soft sandy highlights",
  terracotta: "earthy terracotta, rust and warm clay tones with cream highlights",
  charcoal: "modern charcoal and cool slate greys with small touches of soft blue",
  cream: "minimal warm cream, off-white and light beige tones with a touch of amber",
};

/** what an insurance advertisement must never picture, whatever the scene */
const AVOID = [
  "hospital gore, blood, injuries, needles close-up",
  "funerals, coffins, graves, grieving at a deathbed",
  "piles of cash, gold, gambling imagery",
  "company logos, insurer branding, documents with readable writing",
  "rigid posing, generic corporate stock photography, plastic skin, sterile showroom lighting",
];

const THAI = /[฀-๿]+/g;

export function stripThai(text: string): string {
  return text.replace(THAI, " ").replace(/\s+/g, " ").trim();
}

export function backgroundPrompt(opts: {
  /** the writer's English scene for this piece */
  scene: string;
  layout: Layout;
  theme: Theme;
  /** the owner's request, already in English */
  request?: string | null;
}): string {
  const scene = stripThai(opts.scene) || "A believable everyday moment of a Thai family at home, warm and unposed.";
  const request = opts.request ? stripThai(opts.request) : "";
  return [
    "Create a natural, editorial-quality 1:1 square background photograph for a Thai insurance agent's Facebook post.",
    "",
    "Scene:",
    scene,
    ...(request ? ["", "The page owner asks for this — follow it closely:", request] : []),
    "",
    "Absolute rules:",
    "- NO text, letters, numbers or words, and NO logos, watermarks, signatures or user-interface elements anywhere in the image.",
    `- ${KEEP_CLEAR[opts.layout]}`,
    `- Avoid: ${AVOID.join("; ")}.`,
    "",
    "Visual direction:",
    `- Colour palette: ${PALETTE[opts.theme]}.`,
    "- Thai people in a Thai setting; imperfect natural gestures, believable depth, soft natural light.",
    "- Hopeful and reassuring rather than fearful.",
    "- Thai headline text will be placed on top of the image later, so leave room to breathe.",
  ].join("\n");
}
