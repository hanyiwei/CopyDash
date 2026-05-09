import { readFileSync, writeFileSync } from 'fs';
import Jimp from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPng = path.join(__dirname, '..', 'resources', 'icon.png');
const outIco = path.join(__dirname, '..', 'resources', 'icon.ico');

const sizes = [16, 32, 48, 64, 128, 256];

async function main() {
  const original = await Jimp.read(srcPng);

  // Generate PNG buffers for each size
  const entries = [];
  for (const size of sizes) {
    const resized = original.clone().resize(size, size);
    const buf = await resized.getBufferAsync('image/png');
    entries.push({ size, buf });
    console.log(`  ${size}x${size}: ${buf.length} bytes`);
  }

  // Write ICO file
  const count = entries.length;
  // Header: reserved(2) + type=1(2) + count(2)
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;

  // Calculate offsets
  const offsets = [];
  let offset = dirSize;
  for (const e of entries) {
    offsets.push(offset);
    offset += e.buf.length;
  }

  // Build ICO
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
    ico.writeUInt8(s === 256 ? 0 : s, pos);      // width (0 = 256)
    ico.writeUInt8(s === 256 ? 0 : s, pos + 1);   // height
    ico.writeUInt8(0, pos + 2);                    // palette colors
    ico.writeUInt8(0, pos + 3);                    // reserved
    ico.writeUInt16LE(1, pos + 4);                 // planes
    ico.writeUInt16LE(32, pos + 6);                // bpp
    ico.writeUInt32LE(entries[i].buf.length, pos + 8); // size
    ico.writeUInt32LE(offsets[i], pos + 12);       // offset
    pos += 16;
  }

  // Image data
  for (const e of entries) {
    e.buf.copy(ico, pos);
    pos += e.buf.length;
  }

  writeFileSync(outIco, ico);
  console.log(`Wrote ${outIco} (${ico.length} bytes, ${count} sizes)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
