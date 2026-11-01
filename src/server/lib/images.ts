/** Erkennt Bildformate anhand der ersten Bytes (nicht anhand des Dateinamens) und liest die Abmessungen. */

export interface ImageInfo {
  mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  ext: "png" | "jpg" | "gif" | "webp";
  width: number | null;
  height: number | null;
}

const jpegSize = (buf: Buffer): { width: number; height: number } | null => {
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buf.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    offset += 2 + length;
  }
  return null;
};

const webpSize = (buf: Buffer): { width: number; height: number } | null => {
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 " && buf.length >= 30) return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L" && buf.length >= 25) {
    const b0 = buf[21] ?? 0, b1 = buf[22] ?? 0, b2 = buf[23] ?? 0, b3 = buf[24] ?? 0;
    return { width: 1 + (b0 | ((b1 & 0x3f) << 8)), height: 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) };
  }
  if (chunk === "VP8X" && buf.length >= 30) return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  return null;
};

export const detectImage = (buf: Buffer): ImageInfo | null => {
  if (buf.length < 16) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png", width: buf.length >= 24 ? buf.readUInt32BE(16) : null, height: buf.length >= 24 ? buf.readUInt32BE(20) : null };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    const size = jpegSize(buf);
    return { mime: "image/jpeg", ext: "jpg", width: size?.width ?? null, height: size?.height ?? null };
  }
  const head = buf.toString("ascii", 0, 6);
  if (head === "GIF87a" || head === "GIF89a") {
    return { mime: "image/gif", ext: "gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const size = webpSize(buf);
    return { mime: "image/webp", ext: "webp", width: size?.width ?? null, height: size?.height ?? null };
  }
  return null;
};
