/**
 * generate-icon.js
 * Creates trayIconTemplate.png and trayIconTemplate@2x.png
 * in the assets/ folder using only Node.js built-in modules.
 *
 * macOS template images: solid black pixels + transparency.
 * The OS renders them in the appropriate menu bar color automatically.
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── CRC32 (required by PNG spec) ──────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : (c >>> 1) >>> 0;
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return ((crc ^ 0xffffffff) >>> 0);
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

// ── PNG encoder ───────────────────────────────────────────────────────────────
function encodePNG(width, height, pixelsFn) {
  // Pixel buffer: RGBA, all transparent initially
  const px = new Uint8Array(width * height * 4);

  function set(x, y, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = a;
  }

  pixelsFn(set, width, height);

  // Raw scanlines (filter byte 0 = None per row)
  const rowLen = 1 + width * 4;
  const raw = Buffer.allocUnsafe(height * rowLen);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0;
    for (let x = 0; x < width; x++) {
      const pIdx = (y * width + x) * 4;
      const rIdx = y * rowLen + 1 + x * 4;
      raw[rIdx] = px[pIdx]; raw[rIdx + 1] = px[pIdx + 1];
      raw[rIdx + 2] = px[pIdx + 2]; raw[rIdx + 3] = px[pIdx + 3];
    }
  }

  const compressed = zlib.deflateSync(raw);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([SIG, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

// ── Icon design: todo checklist (3 rows) ─────────────────────────────────────
// Layout on an 18×18 grid (scaled for @2x)
//
//   ██ ··· ████████████
//   ██ ··· ████████████
//   ·· ··· ············
//   ██ ··· ██████████
//   ██ ··· ██████████
//   ·· ··· ············
//   ██ ··· ████████████
//   ██ ··· ████████████

function drawChecklist(set, w, h) {
  const s = w / 18; // scale factor

  function sq(gx, gy, size) {
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++)
        set(Math.round((gx + dx) * s), Math.round((gy + dy) * s));
  }

  function hline(gx1, gx2, gy, thickness = 1) {
    for (let t = 0; t < thickness; t++)
      for (let gx = gx1; gx <= gx2; gx++)
        set(Math.round(gx * s), Math.round((gy + t) * s));
  }

  // Row 1  (y = 2–3): bullet at x=2, line x=6–15
  sq(2, 2, 2);
  hline(6, 15, 2, 2);

  // Row 2  (y = 7–8): bullet at x=2, shorter line x=6–12 (in-progress)
  sq(2, 7, 2);
  hline(6, 12, 7, 2);

  // Row 3  (y = 12–13): bullet at x=2, line x=6–15
  sq(2, 12, 2);
  hline(6, 15, 12, 2);
}

// ── Generate & save ───────────────────────────────────────────────────────────
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

const png18 = encodePNG(18, 18, drawChecklist);
fs.writeFileSync(path.join(assetsDir, 'trayIconTemplate.png'), png18);
console.log('✓  assets/trayIconTemplate.png   (18×18)');

const png36 = encodePNG(36, 36, drawChecklist);
fs.writeFileSync(path.join(assetsDir, 'trayIconTemplate@2x.png'), png36);
console.log('✓  assets/trayIconTemplate@2x.png (36×36)');

console.log('\nIcons generated successfully!');
