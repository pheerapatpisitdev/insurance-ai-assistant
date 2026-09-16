import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = "public/brand/advisortool-robot-avst-v12.png";
const { data, info } = await sharp(source).trim().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
// The generated PNG has a few nearly black opaque pixels in otherwise transparent areas.
// Remove those so the app icon has one even charcoal ground.
for (let p = 0; p < data.length; p += 4) {
  if (data[p] < 20 && data[p + 1] < 20 && data[p + 2] < 20) data[p + 3] = 0;
}
const trimmed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
await writeFile("public/brand/advisortool-robot-avst-clean.png", trimmed);

async function icon(size, inset = 0.08) {
  const innerWidth = Math.round(size * (1 - inset * 2));
  const innerHeight = Math.round(size * (1 - inset * 2));
  return sharp({
    create: { width: size, height: size, channels: 4, background: "#26272a" },
  })
    .composite([{ input: await sharp(trimmed).resize(innerWidth, innerHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), gravity: "centre" }])
    .png()
    .toBuffer();
}

// Next.js picks up these file-convention icons automatically.
await writeFile("src/app/icon.png", await icon(512));
await writeFile("src/app/apple-icon.png", await icon(180));
await writeFile("public/app-icon-192.png", await icon(192));
await writeFile("public/app-icon-512.png", await icon(512));

// ICO supports PNG-encoded entries and keeps the same artwork at browser tab sizes.
const entries = await Promise.all([16, 32, 48].map((size) => icon(size, 0.04)));
const header = Buffer.alloc(6 + entries.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((data, index) => {
  const p = 6 + index * 16;
  const size = [16, 32, 48][index];
  header.writeUInt8(size, p);
  header.writeUInt8(size, p + 1);
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(data.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += data.length;
});
await writeFile("src/app/favicon.ico", Buffer.concat([header, ...entries]));
