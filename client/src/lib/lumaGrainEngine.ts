/**
 * Grainy radial-gradient blob field for canvas backgrounds.
 * Ported from sift_luma_grainy.html (Luma mood study).
 */

export const SIFT_LUMA_MOOD_EVENT = "sift:luma-mood" as const;

export type LumaMood =
  | "idle"
  | "listen"
  | "think"
  | "process"
  | "complete"
  | "wait";

const TAU = Math.PI * 2;

export const LUMA_MOODS: LumaMood[] = [
  "idle",
  "listen",
  "think",
  "process",
  "complete",
  "wait",
];

export function lumaMoodIndex(m: LumaMood): number {
  return LUMA_MOODS.indexOf(m);
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function easeOut(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

const grainCache = new Map<number, HTMLCanvasElement>();

function getGrain(size: number): HTMLCanvasElement {
  const hit = grainCache.get(size);
  if (hit) return hit;
  const oc = document.createElement("canvas");
  oc.width = size;
  oc.height = size;
  const ox = oc.getContext("2d");
  if (!ox) return oc;
  const id = ox.createImageData(size, size);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 28;
  }
  ox.putImageData(id, 0, 0);
  grainCache.set(size, oc);
  return oc;
}

function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const maxR = Math.max(rx, ry);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR);
  gr.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  gr.addColorStop(0.42, `rgba(${r},${g},${b},${alpha * 0.55})`);
  gr.addColorStop(0.72, `rgba(${r},${g},${b},${alpha * 0.18})`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.scale(rx / maxR, ry / maxR);
  ctx.beginPath();
  ctx.arc(0, 0, maxR, 0, TAU);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.restore();
}

function organic(t: number, f1: number, f2: number, f3: number, p: number): number {
  return (
    Math.sin(t * f1 + p) * 0.5 +
    Math.sin(t * f2 + p * 1.7) * 0.3 +
    Math.sin(t * f3 + p * 3.1) * 0.2
  );
}

const BG = "#0c1128";

function drawBase(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
}

function drawGrain(ctx: CanvasRenderingContext2D, W: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.18;
  ctx.drawImage(getGrain(W), 0, 0, W, W);
  ctx.restore();
}

function makeIdle(cvs: HTMLCanvasElement): (t: number) => void {
  const ctx = cvs.getContext("2d");
  if (!ctx) return () => {};
  const W = cvs.width;
  const H = cvs.height;
  const cx = W / 2;
  const cy = H / 2;
  return (t) => {
    drawBase(ctx, W, H);
    const s = W / 110;
    const x1 = cx + organic(t, 0.22, 0.37, 0.61, 0) * 18 * s;
    const y1 = cy + organic(t, 0.19, 0.31, 0.53, 0.8) * 12 * s;
    const x2 = cx + organic(t, 0.17, 0.28, 0.46, 2) * 14 * s;
    const y2 = cy + organic(t, 0.23, 0.39, 0.57, 1.4) * 10 * s;
    const ang1 = t * 0.04;
    const ang2 = -t * 0.05 + 0.8;
    blob(ctx, x1, y1, 52 * s, 38 * s, ang1, 195, 230, 100, 0.72);
    blob(ctx, x1 - 4 * s, y1 + 4 * s, 36 * s, 26 * s, ang1 + 0.3, 210, 240, 80, 0.45);
    blob(ctx, x2 + 8 * s, y2 - 6 * s, 44 * s, 34 * s, ang2, 60, 210, 220, 0.65);
    blob(ctx, x2 + 12 * s, y2 - 10 * s, 26 * s, 20 * s, ang2 - 0.4, 100, 230, 240, 0.4);
    blob(ctx, x2 + 6 * s, y2 - 12 * s, 14 * s, 10 * s, 0, 220, 255, 255, 0.35);
    drawGrain(ctx, W);
  };
}

function makeListen(cvs: HTMLCanvasElement): (t: number) => void {
  const ctx = cvs.getContext("2d");
  if (!ctx) return () => {};
  const W = cvs.width;
  const H = cvs.height;
  const cx = W / 2;
  const cy = H / 2;
  return (t) => {
    drawBase(ctx, W, H);
    const s = W / 110;
    const sway = Math.sin(t * 1.1) * 0.14;
    const str = 1 + Math.abs(Math.sin(t * 0.9)) * 0.22;
    const ox = organic(t, 0.28, 0.44, 0.7, 0) * 10 * s;
    const oy = organic(t, 0.22, 0.36, 0.6, 0.9) * 8 * s;
    blob(ctx, cx + ox, cy + oy, 50 * s, 40 * s * str, sway, 140, 100, 240, 0.65);
    blob(ctx, cx + ox + 8 * s, cy + oy - 8 * s, 38 * s, 30 * s, sway + 0.5, 240, 120, 200, 0.55);
    blob(ctx, cx + ox - 16 * s, cy + oy + 6 * s, 28 * s, 18 * s, -sway + 0.2, 60, 200, 220, 0.4);
    const p = 0.55 + Math.sin(t * 2.4) * 0.45;
    blob(ctx, cx + ox + 4 * s, cy + oy - 12 * s, 14 * s * p, 10 * s * p, 0, 255, 240, 255, 0.55 * p);
    drawGrain(ctx, W);
  };
}

function makeThink(cvs: HTMLCanvasElement): (t: number) => void {
  const ctx = cvs.getContext("2d");
  if (!ctx) return () => {};
  const W = cvs.width;
  const H = cvs.height;
  const cx = W / 2;
  const cy = H / 2;
  return (t) => {
    drawBase(ctx, W, H);
    const s = W / 110;
    const br = 0.85 + Math.sin(t * 1.7) * 0.1;
    blob(ctx, cx, cy, 32 * s * br, 26 * s * br, t * 0.07, 60, 140, 255, 0.6);
    blob(ctx, cx, cy, 18 * s * br, 14 * s * br, t * 0.1, 100, 180, 255, 0.45);
    const shards = [
      { sp: 0.5, r: 30, ph: 0, cr: 80, cg: 220, cb: 200 },
      { sp: 0.38, r: 24, ph: 2.1, cr: 140, cg: 100, cb: 255 },
      { sp: 0.7, r: 18, ph: 4.4, cr: 60, cg: 200, cb: 240 },
    ];
    shards.forEach((m) => {
      const a = t * m.sp + m.ph;
      blob(
        ctx,
        cx + Math.cos(a) * m.r * s,
        cy + Math.sin(a) * m.r * s * 0.65,
        18 * s,
        12 * s,
        a,
        m.cr,
        m.cg,
        m.cb,
        0.5,
      );
    });
    drawGrain(ctx, W);
  };
}

function makeProcess(cvs: HTMLCanvasElement): (t: number) => void {
  const ctx = cvs.getContext("2d");
  if (!ctx) return () => {};
  const W = cvs.width;
  const H = cvs.height;
  const cx = W / 2;
  const cy = H / 2;
  return (t) => {
    drawBase(ctx, W, H);
    const s = W / 110;
    const sp = t * 0.75;
    for (let i = 0; i < 5; i++) {
      const a = sp + i * (TAU / 5);
      const r = (26 - i * 2) * s;
      const bx = cx + Math.cos(a) * r;
      const by = cy + Math.sin(a) * r * 0.72;
      const sz = (34 - i * 3) * s;
      const g_ = [
        [0, 230, 180],
        [40, 245, 195],
        [80, 220, 160],
        [20, 210, 140],
        [0, 190, 130],
      ][i];
      blob(ctx, bx, by, sz, sz * 0.68, a + 0.4, g_[0], g_[1], g_[2], 0.52 - i * 0.04);
    }
    const cr = 10 * s + Math.sin(t * 4) * 3 * s;
    blob(ctx, cx, cy, cr * 1.8, cr * 1.8, 0, 200, 255, 230, 0.4);
    blob(ctx, cx, cy, cr, cr, 0, 240, 255, 245, 0.85);
    drawGrain(ctx, W);
  };
}

function makeComplete(cvs: HTMLCanvasElement): (t: number) => void {
  const ctx = cvs.getContext("2d");
  if (!ctx) return () => {};
  const W = cvs.width;
  const H = cvs.height;
  const cx = W / 2;
  const cy = H / 2;
  return (t) => {
    drawBase(ctx, W, H);
    const s = W / 110;
    const loop = t % 4.5;
    const bloom =
      loop < 1
        ? easeOut(loop)
        : easeOut(clamp(1 - (loop - 1) / 3, 0, 1));
    blob(ctx, cx, cy, (28 + bloom * 32) * s, (20 + bloom * 24) * s, loop * 0.06, 250, 190, 80, 0.5 * bloom + 0.05);
    blob(ctx, cx - 4 * s, cy + 3 * s, (22 + bloom * 22) * s, (16 + bloom * 18) * s, -loop * 0.07, 255, 160, 100, 0.45 * bloom + 0.05);
    blob(ctx, cx + 10 * s, cy - 8 * s, (16 + bloom * 16) * s, (10 + bloom * 10) * s, 0.5, 80, 220, 200, 0.4 * bloom);
    const cr = (12 + bloom * 20) * s;
    blob(ctx, cx, cy, cr, cr, 0, 255, 252, 230, 0.5 + bloom * 0.4);
    drawGrain(ctx, W);
  };
}

function makeWait(cvs: HTMLCanvasElement): (t: number) => void {
  const ctx = cvs.getContext("2d");
  if (!ctx) return () => {};
  const W = cvs.width;
  const H = cvs.height;
  const cx = W / 2;
  const cy = H / 2;
  return (t) => {
    drawBase(ctx, W, H);
    const s = W / 110;
    const br = 0.1 + Math.sin(t * 0.28) * 0.05;
    const dx = Math.sin(t * 0.15) * 7 * s;
    const dy = Math.cos(t * 0.19) * 5 * s;
    blob(ctx, cx + dx, cy + dy, 42 * s, 28 * s, t * 0.03, 80, 110, 140, br * 3);
    blob(ctx, cx - dx * 0.4, cy - dy * 0.4, 22 * s, 16 * s, -t * 0.04, 60, 130, 160, br * 2);
    drawGrain(ctx, W);
  };
}

const makers: Array<(cvs: HTMLCanvasElement) => (t: number) => void> = [
  makeIdle,
  makeListen,
  makeThink,
  makeProcess,
  makeComplete,
  makeWait,
];

export function makeLumaTick(
  mood: LumaMood,
  canvas: HTMLCanvasElement,
): (t: number) => void {
  const i = lumaMoodIndex(mood);
  const maker = makers[i >= 0 ? i : 0];
  return maker(canvas);
}
