import { DOC_MAX_SIDE, type Box } from "@/lib/content/claim";
import { drawSticker } from "./stickers";

/**
 * รีวิวเคลม in the browser: photographs shrunk before they are sent, and the covers burnt into
 * the pixels before a paper is uploaded. A cover laid over a picture with CSS hides nothing once
 * the picture is saved; one painted into it cannot be lifted off.
 */

export interface Shrunk {
  blob: Blob;
  width: number;
  height: number;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.88));
}

/** A photograph at DOC_MAX_SIDE on its long side at most, as JPEG — small enough to send six at once. */
export async function shrink(file: Blob): Promise<Shrunk> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, DOC_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { blob: await toJpeg(canvas), width: canvas.width, height: canvas.height };
}

/** the page's own font, so a sticker's Thai draws as the page shows it */
export const pageFont = () => getComputedStyle(document.body).fontFamily || "sans-serif";

/** The photograph with a sticker painted over every box, as a new JPEG. */
export async function burn(photo: Blob, boxes: Box[]): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const g = canvas.getContext("2d")!;
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  const font = pageFont();
  boxes.forEach((b, i) => drawSticker(g, b, i, canvas.width, canvas.height, font));
  return toJpeg(canvas);
}
