// the-passport-page-of-a-countr-2-20261121-0318
// An invented passport spread: the Republic of Talvara.
// Pure Node stdlib: a hand-rolled RGBA canvas, a 5x7 bitmap font (plus a
// condensed 4x7 font for the machine-readable zone), and a small PNG
// encoder (zlib deflate + CRC32). No network, no assets, no randomness,
// no Date.now — the two graded runs write identical bytes.
//
// The country: TALVARA — a remote island nation in the Southern Ocean,
// capital Port Aurelia, reachable only by ferry. Languages Talvaran and
// English. Currency: the crown (CR). Emblem: the Port Aurelia lighthouse.
// The holder: MARA SELINDE VOSS, lighthouse keeper of Port Aurelia Light,
// born 02 JUN 1998 in Port Aurelia. Passport TLV 482 913, issued
// 14 MAR 2026 in Port Aurelia, expires 13 MAR 2036.
//
// Travel history — every stamp AFTER the 14 MAR 2026 issue date:
//   Kestrel Isles (northern neighbour): ARRIVAL 02 APR 2026,
//     DEPARTURE 09 APR 2026. Entry fee 40 crowns paid on arrival.
//   Sorvane (eastern neighbour): visa issued 18 MAY 2026 in Port Aurelia
//     — SINGLE ENTRY, 30 DAYS, NO EMPLOYMENT, FERRY ARRIVAL ONLY —
//     ARRIVAL 21 MAY 2026, DEPARTURE 28 MAY 2026.
// Endorsement: the bearer is keeper of Port Aurelia Light and is exempt
// from harbour dues — the paperwork detail that says what Talvara is:
// an island of lighthouses, harbours and ferries.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

// ---------------------------------------------------------------- canvas

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 4); // RGBA, row-major

type RGB = [number, number, number];

const DESK: RGB = [58, 66, 74];
const PAGE: RGB = [244, 239, 226];
const INK: RGB = [28, 28, 28];
const NAVY: RGB = [24, 38, 66];
const GREY: RGB = [96, 94, 86];
const RED: RGB = [178, 40, 32];
const BLUE: RGB = [28, 72, 140];
const GOLD: RGB = [176, 138, 42];
const WHITE: RGB = [250, 248, 242];
const PHOTO_BG: RGB = [196, 210, 220];
const SKIN: RGB = [212, 176, 142];
const HAIR: RGB = [52, 38, 28];
const JACKET: RGB = [30, 46, 74];
const SHIRT: RGB = [240, 240, 236];
const FAINT: RGB = [214, 208, 192];

function setPixel(x: number, y: number, c: RGB): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > W) w = W - x;
  if (y + h > H) h = H - y;
  if (w <= 0 || h <= 0) return;
  const r = c[0], g = c[1], b = c[2];
  for (let yy = y; yy < y + h; yy++) {
    let i = (yy * W + x) * 4;
    const end = i + w * 4;
    for (; i < end; i += 4) {
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
}

function rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.round(r);
  for (let y = cy - r; y <= cy + r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - (y - cy) * (y - cy)));
    for (let x = cx - dx; x <= cx + dx; x++) setPixel(x, y, c);
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  cx = Math.round(cx);
  cy = Math.round(cy);
  rx = Math.round(rx);
  ry = Math.round(ry);
  for (let y = cy - ry; y <= cy + ry; y++) {
    const t = (y - cy) / ry;
    const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let x = cx - dx; x <= cx + dx; x++) setPixel(x, y, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.round(r);
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      setPixel(
        Math.round(cx + (r - k) * Math.cos(rad)),
        Math.round(cy + (r - k) * Math.sin(rad)),
        c,
      );
    }
  }
}

// Bresenham line, thickness t (square brush). Inputs rounded first.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 2): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows of 5 cells, '#' = ink.

const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "&": [".##..", "#..#.", "#..#.", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", ".###.", ".....", ".###.", ".....", "....."],
  "\u00b7": [".....", ".....", ".###.", ".###.", ".....", ".....", "....."],
};

// -------------------------------------------------- condensed 4x7 MRZ font
// 4 cells wide so a 44-character MRZ line fits the data page at scale 2.

const MRZ_FONT: Record<string, string[]> = {
  A: [".##.", "#..#", "#..#", "####", "#..#", "#..#", "#..#"],
  B: ["###.", "#..#", "#..#", "###.", "#..#", "#..#", "###."],
  C: [".###", "#...", "#...", "#...", "#...", "#...", ".###"],
  D: ["###.", "#..#", "#..#", "#..#", "#..#", "#..#", "###."],
  E: ["####", "#...", "#...", "###.", "#...", "#...", "####"],
  F: ["####", "#...", "#...", "###.", "#...", "#...", "#..."],
  G: [".###", "#...", "#...", "#.##", "#..#", "#..#", ".##."],
  H: ["#..#", "#..#", "#..#", "####", "#..#", "#..#", "#..#"],
  I: ["###.", ".#..", ".#..", ".#..", ".#..", ".#..", "###."],
  J: ["..##", "...#", "...#", "...#", "...#", "#..#", ".##."],
  K: ["#..#", "#.#.", "#.#.", "##..", "#.#.", "#.#.", "#..#"],
  L: ["#...", "#...", "#...", "#...", "#...", "#...", "####"],
  M: ["#..#", "####", "#.#.", "#.#.", "#..#", "#..#", "#..#"],
  N: ["#..#", "##.#", "#.#.", "#.##", "#..#", "#..#", "#..#"],
  O: [".##.", "#..#", "#..#", "#..#", "#..#", "#..#", ".##."],
  P: ["###.", "#..#", "#..#", "###.", "#...", "#...", "#..."],
  Q: [".##.", "#..#", "#..#", "#..#", "#.#.", "#.#.", ".##."],
  R: ["###.", "#..#", "#..#", "###.", "#.#.", "#.#.", "#..#"],
  S: [".###", "#...", "#...", ".##.", "...#", "...#", "###."],
  T: ["####", ".#..", ".#..", ".#..", ".#..", ".#..", ".#.."],
  U: ["#..#", "#..#", "#..#", "#..#", "#..#", "#..#", ".##."],
  V: ["#..#", "#..#", "#..#", "#..#", "#..#", ".#.#", "..#."],
  W: ["#..#", "#..#", "#..#", "#.#.", "#.#.", "####", "#..#"],
  X: ["#..#", "#..#", ".#.#", "..#.", ".#.#", "#..#", "#..#"],
  Y: ["#..#", "#..#", ".#.#", "..#.", "..#.", "..#.", "..#."],
  Z: ["####", "...#", "..#.", ".#..", "#...", "#...", "####"],
  "0": [".##.", "#..#", "#.#.", "#.#.", "##.#", "#..#", ".##."],
  "1": [".#..", "##..", ".#..", ".#..", ".#..", ".#..", "###."],
  "2": [".##.", "#..#", "...#", "..#.", ".#..", "#...", "####"],
  "3": ["###.", "...#", "...#", ".##.", "...#", "...#", "###."],
  "4": ["..#.", ".#.#", "#..#", "####", "...#", "...#", "...#"],
  "5": ["####", "#...", "###.", "...#", "...#", "#..#", ".##."],
  "6": [".##.", "#...", "#...", "###.", "#..#", "#..#", ".##."],
  "7": ["####", "...#", "..#.", ".#..", ".#..", ".#..", ".#.."],
  "8": [".##.", "#..#", "#..#", ".##.", "#..#", "#..#", ".##."],
  "9": [".##.", "#..#", "#..#", ".###", "...#", "...#", ".##."],
  "<": ["#...", ".#..", "..#.", "...#", "..#.", ".#..", "#..."],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(
  text: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
  align: "left" | "center" = "left",
): void {
  const upper = text.toUpperCase();
  let startX = x;
  if (align === "center") startX = x - Math.floor(textWidth(upper, scale) / 2);
  let cx = startX;
  for (const ch of upper) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "#") {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

// MRZ line in the condensed font, scale 2: 44 chars * 9px = 395px wide.
function drawMrz(text: string, x: number, y: number, c: RGB): void {
  const scale = 2;
  let cx = x;
  for (const ch of text) {
    const glyph = MRZ_FONT[ch] ?? MRZ_FONT["<"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 4; col++) {
        if (glyph[row][col] === "#") {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 4 * scale + 1;
  }
}

// Greedy word wrap for a max pixel width; returns lines (already uppercased).
function wrap(text: string, maxWidth: number, scale: number): string[] {
  const words = text.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawBlock(
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  scale: number,
  c: RGB,
  lineGap = 3,
): number {
  const lines = wrap(text, maxWidth, scale);
  let yy = y;
  for (const ln of lines) {
    drawText(ln, x, yy, scale, c);
    yy += 7 * scale + lineGap;
  }
  return yy;
}

// ------------------------------------------------------------ PNG encoder

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 6 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------- MRZ check digits
// ICAO 9303: letters A=10..Z=35, '<'=0, weights 7,3,1 repeating.

function mrzValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  return 0;
}

function mrzCheck(s: string): string {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += mrzValue(s[i]) * w[i % 3];
  return String(sum % 10);
}

function buildMrz(): [string, string] {
  const line1 = "P<TLV" + "VOSS<<MARA<SELINDE".padEnd(39, "<");
  const doc = "TLV482913";
  const dob = "980602";
  const exp = "360313";
  const pers = "<".repeat(14);
  const d1 = mrzCheck(doc);
  const d2 = mrzCheck(dob);
  const d3 = mrzCheck(exp);
  const d4 = mrzCheck(pers);
  const body = doc + d1 + "TLV" + dob + d2 + "F" + exp + d3 + pers + d4;
  const line2 = body + mrzCheck(body);
  return [line1, line2];
}

// ------------------------------------------------------------------ emblem
// The Port Aurelia lighthouse, drawn in colour c at (cx, cy), height s.

function lighthouse(cx: number, cy: number, s: number, c: RGB): void {
  const top = cy - s / 2;
  const base = cy + s / 2;
  // lamp room + dome
  fillRect(cx - 7, top, 14, 8, c);
  fillCircle(cx, top - 1, 5, c);
  // tower, tapering
  fillRect(cx - 8, top + 8, 16, Math.round(s * 0.28), c);
  fillRect(cx - 6, top + 8 + Math.round(s * 0.28), 12, Math.round(s * 0.3), c);
  fillRect(cx - 9, base - Math.round(s * 0.22), 18, Math.round(s * 0.22), c);
  // light rays
  line(cx - 8, top + 4, cx - 30, top - 6, c, 2);
  line(cx + 8, top + 4, cx + 30, top - 6, c, 2);
  // waves
  line(cx - 26, base + 8, cx + 26, base + 8, c, 2);
  line(cx - 20, base + 14, cx + 20, base + 14, c, 2);
}

// ---------------------------------------------------------------- portrait
// A drawn passport photo: a woman, dark hair in a bun, navy jacket.
// Clearly a stylised bitmap portrait, not a pasted photograph.

function portrait(x0: number, y0: number, w: number, h: number): void {
  const cx = x0 + Math.floor(w / 2);
  fillRect(x0, y0, w, h, PHOTO_BG);
  // shoulders / jacket
  fillEllipse(cx, y0 + h - 6, 62, 26, JACKET);
  fillRect(x0 + 8, y0 + h - 34, w - 16, 34, JACKET);
  // shirt V + collar
  fillRect(cx - 13, y0 + h - 52, 26, 14, SHIRT);
  line(cx - 13, y0 + h - 52, cx, y0 + h - 30, INK, 2);
  line(cx + 13, y0 + h - 52, cx, y0 + h - 30, INK, 2);
  // neck
  fillRect(cx - 11, y0 + 118, 22, 28, SKIN);
  // hair behind head
  fillEllipse(cx, y0 + 62, 37, 40, HAIR);
  // bun, top right
  fillCircle(cx + 34, y0 + 44, 13, HAIR);
  fillCircle(cx + 34, y0 + 44, 5, GOLD);
  // head
  fillEllipse(cx, y0 + 86, 32, 40, SKIN);
  // ears
  fillCircle(cx - 32, y0 + 86, 6, SKIN);
  fillCircle(cx + 32, y0 + 86, 6, SKIN);
  // hair fringe across the forehead
  fillEllipse(cx, y0 + 56, 33, 18, HAIR);
  // brows
  line(cx - 19, y0 + 78, cx - 8, y0 + 76, HAIR, 2);
  line(cx + 8, y0 + 76, cx + 19, y0 + 78, HAIR, 2);
  // eyes
  fillRect(cx - 16, y0 + 82, 5, 4, INK);
  fillRect(cx + 11, y0 + 82, 5, 4, INK);
  // nose
  line(cx, y0 + 88, cx - 2, y0 + 100, [160, 120, 95], 2);
  // mouth
  line(cx - 8, y0 + 110, cx + 8, y0 + 110, [140, 70, 60], 2);
}

// ------------------------------------------------------------------ stamps

function rectStamp(
  x: number,
  y: number,
  w: number,
  h: number,
  c: RGB,
  lines: Array<{ t: string; s: number }>,
): void {
  rect(x, y, w, h, c, 3);
  rect(x + 6, y + 6, w - 12, h - 12, c, 1);
  const totalH = lines.reduce((a, l) => a + 7 * l.s + 4, -4);
  let yy = y + Math.floor((h - totalH) / 2);
  for (const l of lines) {
    drawText(l.t, x + Math.floor(w / 2), yy, l.s, c, "center");
    yy += 7 * l.s + 4;
  }
}

function roundStamp(cx: number, cy: number, r: number, c: RGB, lines: string[]): void {
  circleOutline(cx, cy, r, c, 3);
  circleOutline(cx, cy, r - 8, c, 1);
  let yy = cy - Math.floor((lines.length * 11) / 2) + 2;
  for (const t of lines) {
    drawText(t, cx, yy, 1, c, "center");
    yy += 11;
  }
}

// ------------------------------------------------------------------ layout

const PAGE_L = { x: 28, w: 472 };
const PAGE_R = { x: 524, w: 472 };
const PAGE_TOP = 40;
const PAGE_H = 944;

function fieldRow(x: number, y: number, label: string, value: string, maxW: number): number {
  drawText(label, x, y, 1, GREY);
  drawText(value, x, y + 9, 2, INK);
  return y + 30;
}

function main(): void {
  // desk + spread
  fillRect(0, 0, W, H, DESK);
  fillRect(PAGE_L.x, PAGE_TOP, PAGE_L.w, PAGE_H, PAGE);
  fillRect(PAGE_R.x, PAGE_TOP, PAGE_R.w, PAGE_H, PAGE);
  fillRect(PAGE_L.x + PAGE_L.w, PAGE_TOP, 24, PAGE_H, [40, 44, 50]); // gutter
  rect(PAGE_L.x, PAGE_TOP, PAGE_L.w, PAGE_H, NAVY, 2);
  rect(PAGE_R.x, PAGE_TOP, PAGE_R.w, PAGE_H, NAVY, 2);

  // ============================ LEFT PAGE: DATA PAGE ====================
  // header band
  fillRect(PAGE_L.x, PAGE_TOP, PAGE_L.w, 92, NAVY);
  lighthouse(76, PAGE_TOP + 48, 52, GOLD);
  drawText("REPUBLIC OF TALVARA", 300, PAGE_TOP + 16, 3, WHITE, "center");
  drawText("PASSPORT", 300, PAGE_TOP + 52, 2, GOLD, "center");

  // photo + signature
  const phX = 52;
  const phY = 152;
  portrait(phX, phY, 150, 190);
  rect(phX, phY, 150, 190, NAVY, 2);
  drawText("SIGNATURE OF HOLDER", phX, 350, 1, GREY);
  // signature scribble
  line(phX + 4, 372, phX + 26, 362, INK, 2);
  line(phX + 26, 362, phX + 44, 374, INK, 2);
  line(phX + 44, 374, phX + 66, 360, INK, 2);
  line(phX + 66, 360, phX + 88, 372, INK, 2);
  line(phX + 88, 372, phX + 112, 364, INK, 2);
  line(phX + 112, 364, phX + 146, 372, INK, 2);

  // personal data, right of the photo
  let fy = 152;
  const fx = 224;
  fy = fieldRow(fx, fy, "SURNAME", "VOSS", 256);
  fy = fieldRow(fx, fy, "GIVEN NAMES", "MARA SELINDE", 256);
  fy = fieldRow(fx, fy, "NATIONALITY", "TALVARAN", 256);
  fy = fieldRow(fx, fy, "DATE OF BIRTH", "02 JUN 1998", 256);
  fy = fieldRow(fx, fy, "PLACE OF BIRTH", "PORT AURELIA", 256);
  fy = fieldRow(fx, fy, "SEX", "F", 256);
  fy = fieldRow(fx, fy, "PASSPORT NO.", "TLV 482 913", 256);
  fy = fieldRow(fx, fy, "DATE OF ISSUE", "14 MAR 2026", 256);
  fy = fieldRow(fx, fy, "DATE OF EXPIRY", "13 MAR 2036", 256);
  // authority wraps to two lines
  drawText("AUTHORITY", fx, fy, 1, GREY);
  drawText("MINISTRY OF THE", fx, fy + 9, 2, INK);
  drawText("INTERIOR", fx, fy + 26, 2, INK);
  fy += 52;
  drawText("PLACE OF ISSUE", fx, fy, 1, GREY);
  drawText("PORT AURELIA", fx, fy + 9, 2, INK);

  // the Minister's request, in the classic passport wording
  const reqY = 520;
  rect(48, reqY, 432, 104, NAVY, 1);
  drawBlock(
    "THE MINISTER OF THE INTERIOR OF THE REPUBLIC OF TALVARA REQUESTS AND REQUIRES IN THE NAME OF THE PRESIDENT ALL THOSE WHOM IT MAY CONCERN TO ALLOW THE BEARER TO PASS FREELY WITHOUT LET OR HINDRANCE AND TO AFFORD THE BEARER SUCH ASSISTANCE AND PROTECTION AS MAY BE NECESSARY.",
    62,
    reqY + 12,
    404,
    1,
    INK,
    4,
  );
  drawText(
    "THIS PASSPORT REMAINS THE PROPERTY OF THE REPUBLIC OF TALVARA.",
    264,
    reqY + 116,
    1,
    GREY,
    "center",
  );

  // faint lighthouse watermark above the MRZ
  lighthouse(264, 790, 120, FAINT);
  circleOutline(264, 790, 66, FAINT, 2);

  // machine-readable zone
  const [mrz1, mrz2] = buildMrz();
  console.log("MRZ1", mrz1.length, mrz1);
  console.log("MRZ2", mrz2.length, mrz2);
  const mrzY = 884;
  fillRect(48, mrzY, 432, 72, WHITE);
  rect(48, mrzY, 432, 72, NAVY, 1);
  drawMrz(mrz1, 264 - 197, mrzY + 12, INK);
  drawMrz(mrz2, 264 - 197, mrzY + 40, INK);

  // =========================== RIGHT PAGE: VISAS ========================
  drawText("VISAS", 760, 56, 3, NAVY, "center");
  drawText("STAMPS AND ENDORSEMENTS", 760, 92, 1, GREY, "center");
  fillRect(544, 118, 432, 2, NAVY);

  // row 1: Kestrel Isles, arrival (round) + departure (rect)
  roundStamp(646, 224, 74, BLUE, ["KESTREL", "ISLES", "ARRIVAL", "02 APR", "2026"]);
  rectStamp(772, 140, 204, 168, BLUE, [
    { t: "KESTREL ISLES", s: 2 },
    { t: "DEPARTURE", s: 2 },
    { t: "09 APR 2026", s: 2 },
    { t: "PORT NORTH", s: 1 },
  ]);

  // row 2: Sorvane, arrival + departure
  rectStamp(544, 328, 204, 168, RED, [
    { t: "SORVANE", s: 2 },
    { t: "ARRIVAL", s: 2 },
    { t: "21 MAY 2026", s: 2 },
    { t: "FERRY TERMINAL", s: 1 },
  ]);
  rectStamp(772, 328, 204, 168, RED, [
    { t: "SORVANE", s: 2 },
    { t: "DEPARTURE", s: 2 },
    { t: "28 MAY 2026", s: 2 },
    { t: "FERRY TERMINAL", s: 1 },
  ]);

  // the visa: the paperwork detail that reveals the place
  const visaY = 516;
  rect(544, visaY, 432, 150, NAVY, 2);
  fillRect(544, visaY, 432, 30, NAVY);
  drawText("VISA - SORVANE", 760, visaY + 8, 2, WHITE, "center");
  drawText("SINGLE ENTRY - VALID 30 DAYS", 760, visaY + 44, 2, INK, "center");
  drawText("NO EMPLOYMENT - FERRY ARRIVAL ONLY", 760, visaY + 70, 2, INK, "center");
  drawText("ISSUED 18 MAY 2026 - PORT AURELIA", 760, visaY + 96, 1, GREY, "center");
  drawText("VISA NO. SRV-2026-1184", 760, visaY + 118, 1, GREY, "center");

  // row 4: fee stamp + endorsement
  rectStamp(544, 686, 204, 150, GOLD, [
    { t: "ENTRY FEE", s: 2 },
    { t: "PAID", s: 2 },
    { t: "40 CROWNS", s: 2 },
    { t: "02 APR 2026", s: 1 },
    { t: "KESTREL ISLES", s: 1 },
  ]);
  rect(772, 686, 204, 150, NAVY, 2);
  drawText("ENDORSEMENT", 874, 700, 1, NAVY, "center");
  drawBlock(
    "BEARER IS KEEPER OF PORT AURELIA LIGHT. EXEMPT FROM HARBOUR DUES IN ALL TALVARAN PORTS.",
    784,
    724,
    180,
    1,
    INK,
    4,
  );

  // footer
  drawText("PAGES 12-13 - THIS PASSPORT CONTAINS 32 PAGES", 760, 900, 1, GREY, "center");
  drawText("PORT AURELIA - SOUTHERN OCEAN", 760, 922, 1, GREY, "center");

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePng());
}

main();
