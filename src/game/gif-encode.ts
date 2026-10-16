/**
 * A small animated-GIF encoder for the death GIF posted to Discord. Pixel art has few colours, so a
 * palette is built from the frames' most used colours (at most 255, plus one transparent index)
 * and everything else maps to its nearest palette colour. LZW as in the GIF89a spec.
 */
export type GifFrame = { data: Uint8ClampedArray; delayCs: number };

function key15(r: number, g: number, b: number): number {
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

export function encodeGif(w: number, h: number, frames: GifFrame[], loop = true): Uint8Array {
  // 1. Palette: the most used 15-bit colours. Index 0 is transparent.
  const counts = new Map<number, number>();
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! < 128) continue;
      const k = key15(d[i]!, d[i + 1]!, d[i + 2]!);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255).map(([k]) => k);
  const pal: [number, number, number][] = [[0, 0, 0], ...top.map((k) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4] as [number, number, number])];
  const index = new Map<number, number>();
  top.forEach((k, i) => index.set(k, i + 1));
  const nearest = (k: number): number => {
    const hit = index.get(k);
    if (hit !== undefined) return hit;
    const r = ((k >> 10) & 31) * 8, g = ((k >> 5) & 31) * 8, b = (k & 31) * 8;
    let best = 1, bd = Infinity;
    for (let i = 1; i < pal.length; i++) {
      const [pr, pg, pb] = pal[i]!;
      const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    index.set(k, best);
    return best;
  };

  const out: number[] = [];
  const byte = (b: number) => out.push(b & 255);
  const word = (v: number) => { byte(v); byte(v >> 8); };
  const str = (s: string) => { for (let i = 0; i < s.length; i++) byte(s.charCodeAt(i)); };

  str("GIF89a");
  word(w); word(h);
  byte(0xf7); // global colour table, 8 bits, 256 entries
  byte(0); byte(0);
  for (let i = 0; i < 256; i++) { const c = pal[i] ?? [0, 0, 0]; byte(c[0]); byte(c[1]); byte(c[2]); }
  if (loop) { byte(0x21); byte(0xff); byte(11); str("NETSCAPE2.0"); byte(3); byte(1); word(0); byte(0); }

  for (const f of frames) {
    // Graphic control: restore to background between frames, index 0 transparent.
    byte(0x21); byte(0xf9); byte(4); byte(0b00001001); word(Math.max(2, f.delayCs)); byte(0); byte(0);
    byte(0x2c); word(0); word(0); word(w); word(h); byte(0);
    const px = new Uint8Array(w * h);
    const d = f.data;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) px[p] = d[i + 3]! < 128 ? 0 : nearest(key15(d[i]!, d[i + 1]!, d[i + 2]!));
    lzw(px, 8, byte);
  }
  byte(0x3b);
  return new Uint8Array(out);
}

function lzw(pixels: Uint8Array, minCode: number, byte: (b: number) => void): void {
  byte(minCode);
  const clear = 1 << minCode, end = clear + 1;
  let size = minCode + 1, next = end + 1;
  let dict = new Map<number, number>();
  let buf = 0, bits = 0;
  const block: number[] = [];
  const flushBlock = () => { if (!block.length) return; byte(block.length); for (const b of block) byte(b); block.length = 0; };
  const emit = (code: number) => {
    buf |= code << bits;
    bits += size;
    while (bits >= 8) { block.push(buf & 255); buf >>>= 8; bits -= 8; if (block.length === 255) flushBlock(); }
  };
  emit(clear);
  let prefix = pixels[0]!;
  for (let i = 1; i < pixels.length; i++) {
    const c = pixels[i]!;
    const k = (prefix << 8) | c;
    const hit = dict.get(k);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(k, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(clear);
      dict = new Map();
      size = minCode + 1;
      next = end + 1;
    }
    prefix = c;
  }
  emit(prefix);
  emit(end);
  if (bits > 0) block.push(buf & 255);
  flushBlock();
  byte(0);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
