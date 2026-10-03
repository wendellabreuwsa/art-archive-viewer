// Decoder for AGS (Adventure Game Studio) compiled room files (.crm).
// Extracts background images (main + animated frames), LZSS-compressed.

export interface CrmImage {
  name: string;
  width: number;
  height: number;
  url: string;
}

export interface CrmFile {
  name: string;
  path: string;
  images: CrmImage[];
  error?: string;
}

function lzssExpand(d: Uint8Array, start: number, compLen: number, maxSize: number): Uint8Array {
  const out = new Uint8Array(maxSize);
  const buf = new Uint8Array(4096);
  let i = 4096 - 16;
  let s = start;
  const end = Math.min(start + compLen, d.length);
  let o = 0;
  while (o < maxSize && s < end) {
    const bits = d[s++];
    for (let k = 0; k < 8; k++) {
      if (o >= maxSize || s >= end) break;
      if ((bits >> k) & 1) {
        let j = d[s] | (d[s + 1] << 8);
        s += 2;
        let len = ((j >> 12) & 15) + 3;
        j = (i - j - 1) & 4095;
        while (len-- && o < maxSize) {
          const c = buf[j];
          buf[i] = c;
          out[o++] = c;
          j = (j + 1) & 4095;
          i = (i + 1) & 4095;
        }
      } else {
        const c = d[s++];
        buf[i] = c;
        out[o++] = c;
        i = (i + 1) & 4095;
      }
    }
  }
  return out;
}

// Validate a candidate LZSS header at offset by decoding its first 8 bytes.
function checkHeader(d: Uint8Array, dv: DataView, off: number, limit: number) {
  if (off + 8 > limit) return null;
  const max = dv.getInt32(off, true);
  const comp = dv.getInt32(off + 4, true);
  if (max < 64 || max > 80_000_000 || comp < 16 || comp >= max || off + 8 + comp > limit) return null;
  const head = lzssExpand(d, off + 8, Math.min(comp, 64), 8);
  const hv = new DataView(head.buffer);
  const stride = hv.getInt32(0, true);
  const h = hv.getInt32(4, true);
  if (stride <= 0 || h <= 0 || h > 10000 || stride > 40000 || stride * h + 8 !== max) return null;
  return { max, comp, stride, h };
}

function scan(d: Uint8Array, dv: DataView, from: number, to: number) {
  const found: { off: number; max: number; comp: number; stride: number; h: number }[] = [];
  let o = from;
  while (o < to - 8) {
    const r = checkHeader(d, dv, o, to);
    if (r) {
      found.push({ off: o, ...r });
      o += 8 + r.comp;
    } else o++;
  }
  return found;
}

async function toUrl(
  d: Uint8Array,
  hdr: { off: number; max: number; comp: number; stride: number; h: number },
  bpp: number,
): Promise<{ url: string; width: number; height: number }> {
  const raw = lzssExpand(d, hdr.off + 8, hdr.comp, hdr.max);
  const w = Math.floor(hdr.stride / bpp);
  const h = hdr.h;
  const px = new Uint8ClampedArray(w * h * 4);
  // palette (1024 bytes) sits right before the header
  const pal = d.subarray(Math.max(0, hdr.off - 1024), hdr.off);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = 8 + y * hdr.stride + x * bpp;
      const di = (y * w + x) * 4;
      if (bpp === 4) {
        px[di] = raw[si + 2];
        px[di + 1] = raw[si + 1];
        px[di + 2] = raw[si];
      } else if (bpp === 2) {
        const v = raw[si] | (raw[si + 1] << 8);
        px[di] = ((v >> 11) & 31) * 8.226;
        px[di + 1] = ((v >> 5) & 63) * 4.048;
        px[di + 2] = (v & 31) * 8.226;
      } else {
        const p = raw[si] * 4;
        px[di] = pal[p] * 4;
        px[di + 1] = pal[p + 1] * 4;
        px[di + 2] = pal[p + 2] * 4;
      }
      px[di + 3] = 255;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.putImageData(new ImageData(px, w, h), 0, 0);
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  return { url: URL.createObjectURL(blob), width: w, height: h };
}

export async function parseCrm(file: File, path: string): Promise<CrmFile> {
  const result: CrmFile = { name: file.name, path, images: [] };
  try {
    const d = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(d.buffer);
    const version = dv.getInt16(0, true);
    let bpp = 1;
    // Walk blocks to find main (1) and animated backgrounds (6)
    const regions: [number, number][] = [];
    let p = 2;
    while (p < d.length) {
      const t = d[p];
      if (t === 0xff || p + 5 > d.length) break;
      const len = dv.getInt32(p + 1, true);
      if (len < 0) break;
      if (t === 1) {
        if (version >= 12) bpp = dv.getInt32(p + 5, true);
        regions.push([p + 5, p + 5 + len]);
      } else if (t === 6) regions.push([p + 5, p + 5 + len]);
      p += 5 + len;
    }
    if (![1, 2, 4].includes(bpp)) bpp = 1;
    if (!regions.length) regions.push([0, d.length]);
    const headers = regions.flatMap(([a, b]) => scan(d, dv, a, Math.min(b, d.length)));
    for (let i = 0; i < headers.length; i++) {
      const b = headers[i].stride % bpp === 0 ? bpp : headers[i].stride % 4 === 0 ? 4 : 1;
      const img = await toUrl(d, headers[i], b);
      result.images.push({ name: `Imagem ${i + 1}`, ...img });
    }
    if (!result.images.length) result.error = "Nenhuma imagem encontrada";
  } catch (e) {
    result.error = e instanceof Error ? e.message : "Erro ao ler arquivo";
  }
  return result;
}
