/* What-If Shorts engine — deterministic 1080x1920 canvas renderer.
 *
 * A scene file (scenes/<slug>/scene.js) sets window.SCENE = {
 *   title:  [['WHAT IF THE MOON', '#fff'], ['WAS 10× CLOSER?', E.YEL]],  // hook text shown from frame 0 during line 0
 *   cta:    [['WOULD YOU LIVE', '#fff'], ['UNDER THIS MOON?', E.YEL]],   // shown during the last line
 *   prompt: 'YES or NO?  Comment below',                                   // small line under the CTA
 *   async init() {},                    // preload / precompute (optional)
 *   draw(ctx, t) {},                    // the world, drawn under a camera transform (zoom + shake)
 *   overlay(ctx, t) {},                 // screen-space extras: badges, brackets… (optional)
 *   zoom(t) { return 1 + .05 * t / E.DUR; },   // optional
 *   shake(t) { return 0; },                    // optional, pixels
 * }
 * Timing comes from window.TIMINGS (written by tools/tts.py). Never hard-code seconds when a word
 * can be used: E.word('closer'), E.line(2).t0 …
 */
(() => {
const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ss = (t, a, b) => { const k = prog(t, a, b); return k * k * (3 - 2 * k); };
const eOut = k => 1 - Math.pow(1 - k, 3);
const eIn = k => k * k * k;
const eOutBack = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const eInOut = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mixc = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`; };
const norm = s => s.replace(/[^A-Za-z0-9']/g, '').toLowerCase();

const TM = window.TIMINGS;
const LINES = TM.lines;
const WORDS = LINES.flatMap(l => l.phrases.flatMap(p => p.words));
const DUR = TM.dur;

const E = {
  W, H, DUR, YEL: '#FFD84A', RED: '#FF5A4A',
  clamp, lerp, prog, ss, eOut, eIn, eOutBack, eInOut, rng, mixc, hex,
  lines: LINES, words: WORDS,
  line: i => LINES[i < 0 ? LINES.length + i : i],
  /** start time of the first spoken word matching txt at or after `after` seconds */
  word(txt, after = 0) { const w = WORDS.find(w => w.t0 >= after && norm(w.w) === norm(txt)); if (!w) console.error('word not found: ' + txt); return w ? w.t0 : 0; },
  wordEnd(txt, after = 0) { const w = WORDS.find(w => w.t0 >= after && norm(w.w) === norm(txt)); return w ? w.t1 : 0; },
  count(t, to, t0, t1, from = 1) { return Math.max(from, Math.round(lerp(from, to, eOut(prog(t, t0, t1))))); },
};

/* ---------- text ---------- */
E.label = (ctx, txt, x, y, size, color, align = 'left', weight = 800, stroke = .2) => {
  ctx.save(); ctx.font = `${weight} ${size}px Geist`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = size * stroke; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = color; ctx.fillText(txt, x, y); ctx.restore();
};
function fitBlock(ctx, rows, size, maxW) {         // shrink a stack of big lines so the widest fits
  ctx.font = `900 ${size}px Geist`;
  const w = Math.max(...rows.map(r => ctx.measureText(r[0]).width));
  return w > maxW ? Math.floor(size * maxW / w) : size;
}
E.bigText = (ctx, rows, cy, size, alpha = 1, scale = 1) => {
  const s = fitBlock(ctx, rows, size, 960);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(540, cy); ctx.scale(scale, scale);
  const lh = s * 1.12, y0 = -(rows.length - 1) * lh / 2 + s * .36;
  rows.forEach((r, i) => E.label(ctx, r[0], 0, y0 + i * lh, s, r[1] || '#fff', 'center', 900));
  ctx.restore();
};

/* ---------- badge: big counter pill, e.g. "100× BRIGHTER" ---------- */
E.badge = (ctx, t, t0, t1, value, label, color = E.YEL, y = 300) => {
  const a = ss(t, t0 - .05, t0 + .2) * (1 - ss(t, t1 - .2, t1));
  if (a <= 0) return;
  const pop = eOutBack(prog(t, t0 - .05, t0 + .35));
  const numTxt = value === '' || value == null ? '' : String(value);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(540, y); ctx.scale(pop, pop);
  ctx.font = '900 112px Geist'; const nw = numTxt ? ctx.measureText(numTxt).width : 0;
  ctx.font = '800 50px Geist'; let lw = ctx.measureText(label).width;
  const gap = numTxt ? 26 : 0; let wTot = nw + gap + lw; const padX = 44;
  const k = Math.min(1, 900 / (wTot + padX * 2)); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(6,8,14,.62)'; ctx.beginPath(); ctx.roundRect(-wTot / 2 - padX, -88, wTot + padX * 2, 150, 34); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if (numTxt) { ctx.font = '900 112px Geist'; ctx.fillStyle = color; ctx.fillText(numTxt, -wTot / 2, 30); }
  ctx.font = '800 50px Geist'; ctx.fillStyle = numTxt ? '#ffffff' : color; ctx.fillText(label, -wTot / 2 + nw + gap, numTxt ? 24 : 18);
  ctx.restore();
};

/* ---------- captions: 1–3 word chunks, active word yellow ---------- */
const CHUNKS = [];
LINES.forEach((l, li) => {
  if (li === 0 || li === LINES.length - 1) return;           // hook + CTA use big type instead
  for (const p of l.phrases) {
    let cur = [];
    p.words.forEach((w, i) => {
      cur.push(w);
      if (/[,.?!:;]$/.test(w.w) || cur.length === 3 || i === p.words.length - 1) { CHUNKS.push(cur); cur = []; }
    });
  }
});
E.captions = (ctx, t, y = 1500) => {
  CHUNKS.forEach((c, i) => {
    const t0 = c[0].t0 - .04, next = CHUNKS[i + 1] ? CHUNKS[i + 1][0].t0 - .04 : c[c.length - 1].t1 + .3;
    const end = Math.min(next, c[c.length - 1].t1 + .45);
    if (t < t0 || t >= end) return;
    const pop = eOutBack(prog(t, t0, t0 + .16));
    ctx.save(); ctx.translate(540, y); ctx.scale(lerp(.82, 1, pop), lerp(.82, 1, pop));
    let size = 84; ctx.font = `900 ${size}px Geist`; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const words = c.map(w => w.w.toUpperCase());
    let sp = 24, widths = words.map(w => ctx.measureText(w).width), total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    if (total > 940) { const f = 940 / total; size = Math.floor(84 * f); ctx.font = `900 ${size}px Geist`; sp *= f; widths = words.map(w => ctx.measureText(w).width); total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1); }
    let x = -total / 2;
    words.forEach((w, j) => {
      const on = t >= c[j].t0 - .02 && t < (c[j + 1] ? c[j + 1].t0 : end);
      ctx.textAlign = 'left'; ctx.lineWidth = size * .19; ctx.strokeStyle = 'rgba(0,0,0,.92)'; ctx.strokeText(w, x, 0);
      ctx.fillStyle = on ? E.YEL : '#ffffff'; ctx.fillText(w, x, 0);
      x += widths[j] + sp;
    });
    ctx.restore();
  });
};

/* ---------- frame ---------- */
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
E.ctx = ctx;
window.E = E;

function frame(t) {
  const S = window.SCENE;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.clearRect(0, 0, W, H);
  const z = S.zoom ? S.zoom(t) : 1 + .05 * t / DUR;
  const a = S.shake ? S.shake(t) : 0;
  const sx = a * (Math.sin(t * 41) + Math.sin(t * 67 + 1)) / 2, sy = a * (Math.sin(t * 53 + 2) + Math.sin(t * 29)) / 2;
  ctx.setTransform(z, 0, 0, z, 540 * (1 - z) + sx, 960 * (1 - z) + sy);
  S.draw(ctx, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  const vg = ctx.createRadialGradient(540, 900, 520, 540, 900, 1250);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (S.overlay) S.overlay(ctx, t);
  // hook title: visible from the very first frame until the second line starts
  const hookEnd = LINES[1].t0 - .05;
  const ha = 1 - ss(t, hookEnd - .25, hookEnd);
  if (S.title && ha > 0) E.bigText(ctx, S.title, 330, 98, ha, lerp(.94, 1, eOut(prog(t, 0, .35))));
  E.captions(ctx, t);
  // CTA
  const ct = LINES[LINES.length - 1].t0 - .15;
  const ca = ss(t, ct, ct + .3);
  if (S.cta && ca > 0) {
    ctx.fillStyle = `rgba(3,5,10,${.35 * ca})`; ctx.fillRect(0, 0, W, H);
    E.bigText(ctx, S.cta, 370, 92, ca, eOutBack(prog(t, ct, ct + .45)));
    const b = ss(t, ct + .5, ct + .8);
    if (S.prompt && b > 0) {
      ctx.save(); ctx.globalAlpha = b;
      E.label(ctx, S.prompt, 540, 1400, 56, '#ffffff', 'center', 800);
      const yb = 1440 + 12 * Math.abs(Math.sin(t * 5));
      ctx.strokeStyle = E.YEL; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(540, yb); ctx.lineTo(540, yb + 60); ctx.moveTo(512, yb + 34); ctx.lineTo(540, yb + 62); ctx.lineTo(568, yb + 34); ctx.stroke();
      ctx.restore();
    }
  }
}

window.seek = t => frame(t);
window.READY = (async () => {
  if (document.readyState !== 'complete') await new Promise(r => window.addEventListener('load', r));  // all scripts executed
  await Promise.all(['900 100px Geist', '800 50px Geist', '600 40px Geist'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  if (window.P && P.init) await P.init();
  if (window.SCENE.init) await window.SCENE.init();
  frame(0);
  return true;
})();
})();
