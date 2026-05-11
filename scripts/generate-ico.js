import { writeFileSync } from 'fs';
import Jimp from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPng = path.join(__dirname, '..', 'resources', 'icon.png');
const outIco = path.join(__dirname, '..', 'resources', 'icon.ico');

const sizes = [16, 32, 48, 64, 128, 256];

async function main() {
  const original = await Jimp.read(srcPng);

  // Generate BMP-format ICO entries (not PNG-compressed, for electron-builder compatibility)
  const entries = [];
  for (const size of sizes) {
    const resized = original.clone().resize(size, size);
    const { data, width, height } = resized.bitmap;

    // BITMAPINFOHEADER (40 bytes) + pixel data + 1-bit AND mask
    const biSize = 40;
    const pixelDataSize = width * height * 4; // 32bpp BGRA
    // AND mask: 1 bit per pixel, each row padded to 4 bytes
    const andRowBytes = Math.ceil(width / 8);
    const andRowPadded = Math.ceil(andRowBytes / 4) * 4;
    const andSize = andRowPadded * height;

    const totalSize = biSize + pixelDataSize + andSize;
    const buf = Buffer.alloc(totalSize);

    // BITMAPINFOHEADER
    let pos = 0;
    buf.writeUInt32LE(biSize, pos); pos += 4;           // biSize
    buf.writeInt32LE(width, pos); pos += 4;              // biWidth
    buf.writeInt32LE(height * 2, pos); pos += 4;         // biHeight (×2 for ICO = XOR + AND)
    buf.writeUInt16LE(1, pos); pos += 2;                 // biPlanes
    buf.writeUInt16LE(32, pos); pos += 2;                // biBitCount
    buf.writeUInt32LE(0, pos); pos += 4;                 // biCompression (BI_RGB)
    buf.writeUInt32LE(pixelDataSize, pos); pos += 4;     // biSizeImage
    buf.writeInt32LE(0, pos); pos += 4;                  // biXPelsPerMeter
    buf.writeInt32LE(0, pos); pos += 4;                  // biYPelsPerMeter
    buf.writeUInt32LE(0, pos); pos += 4;                 // biClrUsed
    buf.writeUInt32LE(0, pos); pos += 4;                 // biClrImportant

    // Pixel data: RGBA → BGRA (bottom-up)
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        buf[pos++] = data[i + 2]; // B
        buf[pos++] = data[i + 1]; // G
        buf[pos++] = data[i];     // R
        buf[pos++] = data[i + 3]; // A
      }
    }

    // AND mask: all zeros (fully opaque)
    buf.fill(0, pos, pos + andSize);

    entries.push({ size, buf });
    console.log(`  ${size}x${size}: ${buf.length} bytes`);
  }

  // Write ICO file
  const count = entries.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;

  const offsets = [];
  let offset = dirSize;
  for (const e of entries) {
    offsets.push(offset);
    offset += e.buf.length;
  }

  const ico = Buffer.alloc(offset);
  let pos = 0;
  // Header
  ico.writeUInt16LE(0, pos);      // reserved
  ico.writeUInt16LE(1, pos + 2);  // type: ICO
  ico.writeUInt16LE(count, pos + 4);
  pos += 6;

  // Directory entries
  for (let i = 0; i < count; i++) {
    const s = entries[i].size;
    ico.writeUInt8(s === 256 ? 0 : s, pos);             // width
    ico.writeUInt8(s === 256 ? 0 : s, pos + 1);          // height
    ico.writeUInt8(0, pos + 2);                          // palette
    ico.writeUInt8(0, pos + 3);                          // reserved
    ico.writeUInt16LE(1, pos + 4);                       // planes
    ico.writeUInt16LE(32, pos + 6);                      // bpp
    ico.writeUInt32LE(entries[i].buf.length, pos + 8);   // size
    ico.writeUInt32LE(offsets[i], pos + 12);             // offset
    pos += 16;
  }

  // Image data
  for (const e of entries) {
    e.buf.copy(ico, pos);
    pos += e.buf.length;
  }

  writeFileSync(outIco, ico);
  console.log(`Wrote ${outIco} (${ico.length} bytes, ${count} sizes, BMP format)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
