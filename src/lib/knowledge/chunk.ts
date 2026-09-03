export interface Chunk {
  page: number | null;
  ordinal: number;
  content: string;
}

const TARGET = 1200;   // characters per chunk, roughly half a page of Thai text
const OVERLAP = 200;   // carried into the next chunk so a sentence is never cut in half

/** Thai has no spaces between words, so break on paragraphs and Thai sentence breaks. */
function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}|\n(?=\s*(?:\d+[.)]|[•●▪-]\s))/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

/** Splits one page's text into overlapping chunks that stay under the target size. */
export function chunkPage(text: string, page: number | null, startOrdinal = 0): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer = "";
  let ordinal = startOrdinal;

  const flush = () => {
    const content = buffer.trim();
    if (content.length >= 40) chunks.push({ page, ordinal: ordinal++, content });
    buffer = content.length > OVERLAP ? content.slice(-OVERLAP) : "";
  };

  for (const para of splitParagraphs(text)) {
    if (para.length > TARGET) {
      // A single very long paragraph: cut it on whitespace near the target size.
      for (let i = 0; i < para.length; i += TARGET - OVERLAP) {
        buffer = `${buffer} ${para.slice(i, i + TARGET)}`.trim();
        flush();
      }
      continue;
    }
    if (buffer.length + para.length > TARGET) flush();
    buffer = buffer ? `${buffer}\n${para}` : para;
  }
  if (buffer.trim().length >= 40) chunks.push({ page, ordinal: ordinal++, content: buffer.trim() });
  return chunks;
}

/** Splits a whole document, keeping page numbers when the extractor gives them. */
export function chunkPages(pages: string[]): Chunk[] {
  const out: Chunk[] = [];
  pages.forEach((text, i) => {
    out.push(...chunkPage(text, i + 1, out.length));
  });
  return out;
}
