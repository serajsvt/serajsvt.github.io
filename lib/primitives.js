/* Visual building blocks for What-If scenes. All drawing is deterministic in t (seeded randomness).
 * Coordinates are 1080x1920 portrait. See scenes/moon_10x_closer/scene.js for a full example.
 *
 *  P.sky(ctx, P.SKY.dusk | [[pos, '#hex'], …], yBottom)    P.mixSky(a, b, k)     P.stars(ctx, t, alpha)
 *  P.nyc({base}) → city.draw(ctx, t, {night, lit, dim})      (layered New York skyline + landmarks)
 *  P.water(ctx, t, {level, amp, bulge, night, glintX, glintColor, bright, foam, spray:{t0,t1}}) → surfaceY(x)
 *  P.moon(ctx, x, y, r, {warm, halo, cool})                  P.sun(ctx, x, y, r, {intensity})
 *  P.globe(ctx, x, y, r, {lon0, tilt, light, nightSide, ice, atmo})   (real Earth map, Natural Earth II)
 *  P.terrain(ctx, {y, amp, seed, color, freq})               P.smoke(ctx, t, {...})   P.particles(ctx, t, {...})
 *  P.glow / P.flash / P.ring / P.chevrons / P.bracket / P.impact
 */
(() => {
const {W, H, clamp, lerp, prog, ss, eOut, eOutBack, eInOut, rng, mixc, hex} = E;
const P = {};
let moonImg, earthData, earthW, earthH;

P.init = async () => {
  moonImg = new Image(); moonImg.src = '/assets/moon.png'; await moonImg.decode();
  const ei = new Image(); ei.src = '/assets/earth.jpg'; await ei.decode();
  const c = document.createElement('canvas'); c.width = earthW = ei.width; c.height = earthH = ei.height;
  const g = c.getContext('2d'); g.drawImage(ei, 0, 0); earthData = g.getImageData(0, 0, earthW, earthH).data;
};

/* ---------- sky ---------- */
P.SKY = {
  day:     [[0, '#3C7DD9'], [.55, '#79AEEA'], [1, '#CFE3F7']],
  dusk:    [[0, '#141F3D'], [.45, '#45386A'], [.78, '#C46A62'], [1, '#F2A06A']],
  night:   [[0, '#03050B'], [.45, '#08112A'], [.78, '#13254A'], [1, '#2A4170']],
  storm:   [[0, '#1A1D24'], [.5, '#2E333D'], [1, '#4A505C']],
  inferno: [[0, '#1A0605'], [.45, '#4A1208'], [.8, '#B3360F'], [1, '#FF8A2A']],
  space:   [[0, '#000003'], [1, '#05060D']],
};
P.mixSky = (a, b, k) => a.map((s, i) => [s[0], mixc(s[1], b[Math.min(i, b.length - 1)][1], k)]);
P.sky = (ctx, stops, y1 = 1400) => {
  const g = ctx.createLinearGradient(0, 0, 0, y1);
  for (const [p, c] of stops) g.addColorStop(p, c.startsWith('#') ? mixc(c, c, 0) : c);
  ctx.fillStyle = g; ctx.fillRect(-80, -80, W + 160, y1 + 160);
  ctx.fillStyle = stops[stops.length - 1][1]; ctx.fillRect(-80, y1, W + 160, H - y1 + 80);
};
const STARS = (() => { const r = rng(21); return Array.from({length: 320}, () => ({x: r() * W, y: r() * 1300, s: .6 + r() * 1.9, ph: r() * 6.28, b: .4 + r() * .6})); })();
P.stars = (ctx, t, alpha = 1, maxY = 1300) => {
  if (alpha <= 0) return;
  for (const s of STARS) {
    if (s.y > maxY) continue;
    ctx.fillStyle = `rgba(230,236,255,${alpha * s.b * (.65 + .35 * Math.sin(t * 3 + s.ph))})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
};

/* ---------- New York skyline ---------- */
function makeLayer(seed, hMin, hMax, wMin, wMax, landmarks) {
  const r = rng(seed), b = []; let x = -40;
  while (x < W + 40) {
    const w = lerp(wMin, wMax, r()), h = lerp(hMin, hMax, Math.pow(r(), 1.6));
    b.push({kind: 'box', x, w, h, cap: r() < .25 ? 'step' : (r() < .15 ? 'ant' : null)});
    x += w + lerp(-6, 10, r());
  }
  return b.concat(landmarks);
}
function buildingPath(p, b, Y0) {
  const x = b.x, w = b.w, top = Y0 - b.h, c = x + w / 2;
  if (b.kind === 'empire') {
    const pts = [[0, 0], [0, .42], [.12, .42], [.12, .62], [.24, .62], [.24, .74], [.35, .74], [.35, .8], [.43, .8], [.45, .86], [.48, .87], [.49, 1], [.51, 1], [.52, .87], [.55, .86], [.57, .8], [.65, .8], [.65, .74], [.76, .74], [.76, .62], [.88, .62], [.88, .42], [1, .42], [1, 0]];
    pts.forEach(([u, v], i) => (i ? p.lineTo : p.moveTo).call(p, x + u * w, Y0 - v * b.h)); p.closePath();
  } else if (b.kind === 'wtc') {
    const bt = Y0 - b.h * .78;
    p.moveTo(x, Y0); p.lineTo(x, Y0 - b.h * .12); p.lineTo(c - w * .2, bt); p.lineTo(c - 2, bt - 4); p.lineTo(c - 1.5, top);
    p.lineTo(c + 1.5, top); p.lineTo(c + 2, bt - 4); p.lineTo(c + w * .2, bt); p.lineTo(x + w, Y0 - b.h * .12); p.lineTo(x + w, Y0); p.closePath();
  } else if (b.kind === 'chrysler') {
    const bt = Y0 - b.h * .74, ct = Y0 - b.h * .9;
    p.moveTo(x, Y0); p.lineTo(x, bt);
    for (let i = 0; i < 4; i++) { const k = i / 4, k2 = (i + 1) / 4; p.lineTo(lerp(x, c - 6, k), lerp(bt, ct, k)); p.quadraticCurveTo(lerp(x, c - 6, k), lerp(bt, ct, k2) - 6, lerp(x, c - 6, k2), lerp(bt, ct, k2)); }
    p.lineTo(c - 1.5, top); p.lineTo(c + 1.5, top); p.lineTo(c + 6, ct);
    for (let i = 3; i >= 0; i--) { const k = i / 4, k2 = (i + 1) / 4; p.quadraticCurveTo(lerp(x + w, c + 6, k2), lerp(bt, ct, k) - 6, lerp(x + w, c + 6, k), lerp(bt, ct, k)); }
    p.lineTo(x + w, Y0); p.closePath();
  } else {
    p.moveTo(x, Y0); p.lineTo(x, top);
    if (b.cap === 'step') { p.lineTo(x + w * .2, top); p.lineTo(x + w * .2, top - 26); p.lineTo(x + w * .8, top - 26); p.lineTo(x + w * .8, top); }
    if (b.cap === 'ant') { p.lineTo(c - 2, top); p.lineTo(c - 1, top - 70); p.lineTo(c + 1, top - 70); p.lineTo(c + 2, top); }
    p.lineTo(x + w, top); p.lineTo(x + w, Y0); p.closePath();
  }
}
P.nyc = ({base = 1360, seed = 0} = {}) => {
  const Y0 = base;
  const layers = [
    {b: makeLayer(3 + seed, 70, 260, 30, 80, []), dusk: '#3A3F5E', night: '#121a30', win: .18},
    {b: makeLayer(7 + seed, 120, 430, 45, 110, [{kind: 'chrysler', x: 830, w: 74, h: 470}]), dusk: '#222842', night: '#0b1122', win: .3},
    {b: makeLayer(13 + seed, 140, 520, 55, 140, [{kind: 'empire', x: 610, w: 128, h: 720}, {kind: 'wtc', x: 220, w: 118, h: 760}]), dusk: '#121625', night: '#05080f', win: .36},
  ];
  const mk = (L, color, shade) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const p = new Path2D(); for (const b of L.b) buildingPath(p, b, Y0);
    g.fillStyle = color; g.fill(p);
    if (shade) { g.save(); g.clip(p); const gr = g.createLinearGradient(0, Y0 - 800, 0, Y0); gr.addColorStop(0, shade); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }
    return c;
  };
  const win = (L, s) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const r = rng(s);
    for (const b of L.b) {
      const top = Y0 - b.h * (b.kind === 'box' ? 1 : .6);
      for (let y = top + 12; y < Y0 - 8; y += 17) for (let x = b.x + 6; x < b.x + b.w - 10; x += 12) {
        if (r() > L.win) continue;
        g.fillStyle = r() < .75 ? `rgba(255,${200 + Math.floor(r() * 40)},${130 + Math.floor(r() * 60)},${.55 + r() * .45})` : `rgba(190,215,255,${.5 + r() * .4})`;
        g.fillRect(x, y, 5, 8);
      }
    }
    return c;
  };
  let LC = null;
  return {
    base: Y0,
    /** night 0..1 (silhouette colors + windows), lit 0..1 (strong moonlight/sunlight on facades), dim 0..1 (power cut) */
    draw(ctx, t, {night = 0, lit = 0, dim = 0, tint = null} = {}) {
      if (!LC) LC = layers.map((L, i) => ({dusk: mk(L, L.dusk), night: mk(L, L.night), lit: mk(L, L.night, 'rgba(120,150,210,.55)'), win: win(L, 100 + i + seed)}));
      LC.forEach((c, i) => {
        ctx.globalAlpha = 1; ctx.drawImage(c.dusk, 0, 0);
        if (night > 0) { ctx.globalAlpha = night; ctx.drawImage(c.night, 0, 0); }
        if (lit > 0) { ctx.globalAlpha = lit * .9; ctx.drawImage(c.lit, 0, 0); }
        const wa = clamp(.15 + .85 * night) * (1 - dim);
        if (wa > 0) { ctx.globalAlpha = wa; ctx.drawImage(c.win, 0, 0); }
      });
      ctx.globalAlpha = 1;
      if (tint) { ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore(); }
    },
  };
};

/* ---------- water ---------- */
const GLINTS = (() => { const r = rng(31); return Array.from({length: 120}, () => ({row: r(), w: 20 + r() * 110, ph: r() * 6.28, sp: 1 + r() * 2.5, off: (r() - .5) * 2})); })();
const SPRAY = (() => { const r = rng(77); return Array.from({length: 140}, () => ({x: r() * W, u: r(), v: 260 + r() * 520, s: 2 + r() * 5, life: .5 + r() * .5})); })();
/** level: y of calm surface; amp: wave height px; bulge: px raised around bulgeX; night 0..1; bright 0..1 boosts glints */
P.water = (ctx, t, {level = 1354, amp = 5, bulge = 0, bulgeX = 540, night = 0, glintX = 540, glintColor = null, bright = 0, foam = .25, spray = null, topAlpha = null} = {}) => {
  const surf = x => level - bulge * Math.exp(-Math.pow((x - bulgeX) / 260, 2)) + amp * (.55 * Math.sin(x / 70 + t * 3.1) + .3 * Math.sin(x / 31 - t * 4.7) + .15 * Math.sin(x / 13 + t * 7.3));
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-80, H + 80);
  for (let x = -80; x <= W + 80; x += 12) ctx.lineTo(x, surf(x));
  ctx.lineTo(W + 80, H + 80); ctx.closePath();
  const g = ctx.createLinearGradient(0, level - 40, 0, H);
  g.addColorStop(0, topAlpha != null ? `rgba(30,40,70,${topAlpha})` : (night < .5 ? 'rgba(70,62,92,.9)' : 'rgba(18,32,62,.8)'));
  g.addColorStop(.18, mixc('#2A2740', '#0A1630', night)); g.addColorStop(1, mixc('#0E0D17', '#02050B', night));
  ctx.fillStyle = g; ctx.fill(); ctx.clip();
  const gc = glintColor || (night > .5 ? [220, 232, 255] : [255, 196, 140]);
  for (const s of GLINTS) {
    const y = level + 14 + Math.pow(s.row, 1.4) * (H - level);
    const spread = lerp(80, 300, Math.pow(s.row, .8)) * lerp(1, 1.4, bright);
    const x = glintX + s.off * spread + 24 * Math.sin(t * s.sp + s.ph);
    const a = (.25 + .75 * Math.abs(Math.sin(t * s.sp * 1.7 + s.ph))) * lerp(.55, 1, bright) * (1 - s.row * .55);
    ctx.fillStyle = `rgba(${gc.join(',')},${a})`;
    ctx.beginPath(); ctx.roundRect(x - s.w / 2, y, s.w * (1 - s.row * .4), 3 + s.row * 4, 3); ctx.fill();
  }
  ctx.strokeStyle = `rgba(255,255,255,${.06 + .05 * night})`; ctx.lineWidth = 2;
  for (let k = 1; k < 9; k++) {
    const yy = level + k * k * 9; ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 16) ctx.lineTo(x, yy + 4 * Math.sin(x / 50 + t * (1.5 + k * .2) + k));
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = `rgba(235,242,255,${foam})`; ctx.lineWidth = 3 + 4 * clamp((foam - .25) / .55); ctx.lineJoin = 'round';
  ctx.beginPath(); for (let x = -40; x <= W + 40; x += 12) ctx.lineTo(x, surf(x) + 1); ctx.stroke();
  if (spray) for (const p of SPRAY) {
    const t0 = lerp(spray.t0, spray.t1, p.u), age = t - t0; if (age < 0 || age > p.life) continue;
    const k = age / p.life, y = surf(p.x) - p.v * age + 900 * age * age;
    ctx.fillStyle = `rgba(235,242,255,${.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(p.x + 30 * age, y, p.s * (1 - .4 * k), 0, 7); ctx.fill();
  }
  return surf;
};

/* ---------- moon & sun ---------- */
const moonCv = document.createElement('canvas'), mctx = moonCv.getContext('2d');
/** warm 0..1 = orange low-sky tint, halo 0..1 = glow strength */
P.moon = (ctx, x, y, r, {warm = 0, halo = .4, cool = 0} = {}) => {
  const haloR = r * lerp(1.7, 2.6, halo);
  const hc = warm > .5 ? '255,190,140' : '200,215,255';
  const hg = ctx.createRadialGradient(x, y, r * .9, x, y, haloR);
  hg.addColorStop(0, `rgba(${hc},${lerp(.25, .55, halo)})`); hg.addColorStop(1, `rgba(${hc},0)`);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, haloR, 0, 7); ctx.fill();
  const D = Math.ceil(r * 2) + 4; if (moonCv.width !== D) moonCv.width = moonCv.height = D;
  mctx.clearRect(0, 0, D, D); mctx.globalCompositeOperation = 'source-over'; mctx.drawImage(moonImg, 2, 2, r * 2, r * 2);
  mctx.globalCompositeOperation = 'source-atop';
  if (warm > 0) { mctx.fillStyle = `rgba(255,155,90,${.26 * warm})`; mctx.fillRect(0, 0, D, D); }
  if (cool > 0) { mctx.fillStyle = `rgba(200,220,255,${.08 * cool})`; mctx.fillRect(0, 0, D, D); }
  ctx.drawImage(moonCv, x - r - 2, y - r - 2);
};
P.sun = (ctx, x, y, r, {intensity = 1} = {}) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
  g.addColorStop(0, `rgba(255,250,235,${intensity})`); g.addColorStop(.16, `rgba(255,236,190,${.9 * intensity})`);
  g.addColorStop(.35, `rgba(255,190,110,${.35 * intensity})`); g.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 6, 0, 7); ctx.fill();
  ctx.fillStyle = `rgba(255,253,245,${intensity})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
};

/* ---------- Earth globe (orthographic, real map) ---------- */
const globeCv = document.createElement('canvas'), gctx2 = globeCv.getContext('2d');
/** lon0: longitude facing viewer (deg, -95 = USA; DECREASE it over time for Earth's real eastward spin), tilt: latitude at center (deg),
 *  light: [x,y,z] direction toward the sun in screen space (x right, y DOWN, z toward viewer), e.g. [-.6,-.35,.75] = upper-left,
 *  nightSide 0..1 darkness of unlit side (city lights appear there), ice 0..1 whitens land, atmo: blue rim */
P.globe = (ctx, x, y, r, {lon0 = -95, tilt = 30, light = [-.5, -.3, .8], nightSide = .9, ice = 0, atmo = true, sea = 0} = {}) => {
  const R = Math.round(r), D = R * 2 + 2;
  if (globeCv.width !== D) globeCv.width = globeCv.height = D;
  const img = gctx2.createImageData(D, D), d = img.data;
  const L = Math.hypot(...light), lx = light[0] / L, ly = light[1] / L, lz = light[2] / L;
  const ct = Math.cos(tilt * Math.PI / 180), st = Math.sin(tilt * Math.PI / 180), l0 = lon0 * Math.PI / 180;
  for (let j = 0; j < D; j++) {
    const ny = (j - R) / R;
    for (let i = 0; i < D; i++) {
      const nx = (i - R) / R, rr = nx * nx + ny * ny; if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      // rotate view vector back by tilt around x axis
      const yy = -ny * ct + nz * st, zz = ny * st + nz * ct;
      const lat = Math.asin(Math.max(-1, Math.min(1, yy))), lon = Math.atan2(nx, zz) + l0;
      let u = ((lon / (2 * Math.PI) + .5) % 1 + 1) % 1, v = .5 - lat / Math.PI;
      const ti = (Math.floor(v * (earthH - 1)) * earthW + Math.floor(u * (earthW - 1))) * 4;
      let rC = earthData[ti], gC = earthData[ti + 1], bC = earthData[ti + 2];
      const isSea = bC > rC + 18 && bC > gC;
      if (ice > 0 && !isSea) { rC = lerp(rC, 240, ice); gC = lerp(gC, 245, ice); bC = lerp(bC, 250, ice); }
      if (sea > 0 && !isSea && (rC + gC) / 2 < 150 + 60 * sea && Math.abs(lat) < 1.2) { rC = lerp(rC, 30, sea * .8); gC = lerp(gC, 70, sea * .8); bC = lerp(bC, 130, sea * .8); }
      const dif = Math.max(0, nx * lx + ny * ly + nz * lz);
      const day = Math.min(1, dif * 1.4 + .06);
      const shade = lerp(1 - nightSide, 1, day) * (1 - .25 * Math.pow(1 - nz, 2));
      const o = (j * D + i) * 4;
      d[o] = rC * shade; d[o + 1] = gC * shade; d[o + 2] = bC * shade;
      d[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(rr)) * R / 1.5);
    }
  }
  gctx2.putImageData(img, 0, 0);
  if (atmo) { const a = ctx.createRadialGradient(x, y, r * .96, x, y, r * 1.12); a.addColorStop(0, 'rgba(110,170,255,.55)'); a.addColorStop(1, 'rgba(110,170,255,0)'); ctx.fillStyle = a; ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, 7); ctx.fill(); }
  ctx.drawImage(globeCv, x - R - 1, y - R - 1);
};

/* ---------- landscape & effects ---------- */
P.terrain = (ctx, {y = 1400, amp = 160, seed = 1, color = '#0b0e16', freq = 1} = {}) => {
  const r = rng(seed), ph = [r() * 6, r() * 6, r() * 6];
  ctx.beginPath(); ctx.moveTo(-80, H + 80);
  for (let x = -80; x <= W + 80; x += 8) ctx.lineTo(x, y - amp * (.5 + .3 * Math.sin(x * freq / 170 + ph[0]) + .15 * Math.sin(x * freq / 61 + ph[1]) + .05 * Math.sin(x * freq / 23 + ph[2])));
  ctx.lineTo(W + 80, H + 80); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
};
P.glow = (ctx, x, y, r, rgb = '255,200,120', a = .6) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
};
P.flash = (ctx, a, rgb = '255,255,255') => { if (a <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); };
P.ring = (ctx, x, y, r, a, rgb = '255,230,200', width = 10) => { if (a <= 0) return; ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); };
P.chevrons = (ctx, t, xs, yFrom, yTo, a = 1, color = '255,216,74') => {
  if (a <= 0) return; ctx.save(); ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const dir = Math.sign(yTo - yFrom) || -1;
  xs.forEach((x, i) => { for (let k = 0; k < 4; k++) {
    const ph = (t * .9 + k / 4 + i * .13) % 1, y = lerp(yFrom, yTo, ph);
    ctx.strokeStyle = `rgba(${color},${a * Math.sin(Math.PI * ph) * .95})`;
    ctx.beginPath(); ctx.moveTo(x - 30, y - 22 * dir); ctx.lineTo(x, y); ctx.lineTo(x + 30, y - 22 * dir); ctx.stroke(); } });
  ctx.restore();
};
P.bracket = (ctx, x1, x2, y, k, color = E.YEL) => {
  if (k <= 0) return; const c = (x1 + x2) / 2, h = (x2 - x1) / 2 * k;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(c - h, y); ctx.lineTo(c + h, y); ctx.moveTo(c - h, y - 26); ctx.lineTo(c - h, y + 26); ctx.moveTo(c + h, y - 26); ctx.lineTo(c + h, y + 26); ctx.stroke(); ctx.restore();
};
/** generic particle field: kind 'snow' | 'ash' | 'rain' | 'embers' | 'dust' */
P.particles = (ctx, t, {kind = 'snow', count = 200, seed = 5, alpha = 1, wind = 40, y0 = -40, y1 = H} = {}) => {
  if (alpha <= 0) return;
  const r = rng(seed);
  const cfg = {snow: [60, 110, 2, 5, '240,245,255'], ash: [40, 90, 2, 6, '140,135,130'], rain: [900, 1300, 1.5, 2.5, '170,190,220'], embers: [-160, -60, 2, 5, '255,150,60'], dust: [20, 50, 1.5, 3.5, '220,200,170']}[kind];
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x0 = r() * (W + 200) - 100, ph = r(), sp = lerp(cfg[0], cfg[1], r()), sz = lerp(cfg[2], cfg[3], r()), span = y1 - y0;
    let y = y0 + ((ph * span + sp * t) % span + span) % span, x = x0 + wind * t * (sp / 100) % 200 + 18 * Math.sin(t * 1.3 + ph * 9);
    if (kind === 'embers') y = y1 - ((ph * span - sp * t) % span + span) % span;
    ctx.fillStyle = `rgba(${cfg[4]},${alpha * (.5 + .5 * r())})`;
    if (kind === 'rain') { ctx.fillRect(x, y, sz, 34); } else { ctx.beginPath(); ctx.arc(x, y, sz, 0, 7); ctx.fill(); }
  }
  ctx.restore();
};
/** billowing smoke / ash plume from (x, y) growing upward between t0 and t1 */
P.smoke = (ctx, t, {x = 540, y = 1300, t0 = 0, t1 = 4, height = 900, spread = 380, color = '70,66,64', seed = 9, alpha = .9} = {}) => {
  const k = eOut(prog(t, t0, t1)); if (k <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < 90; i++) {
    const h = r(), off = (r() - .5) * 2, sz = lerp(60, 170, r()) * (0.6 + h);
    if (h > k) continue;
    const yy = y - h * height, xx = x + off * spread * Math.pow(h, 1.4) + 30 * Math.sin(t * .8 + i);
    const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, sz);
    g.addColorStop(0, `rgba(${color},${alpha * .55})`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, yy, sz, 0, 7); ctx.fill();
  }
};
/** explosion / impact at (x, y) starting at t0: flash, fireball, shock ring, debris */
P.impact = (ctx, t, t0, x, y, scale = 1) => {
  const age = t - t0; if (age < 0) return;
  P.glow(ctx, x, y, 520 * scale * eOut(prog(age, 0, .6)), '255,190,90', .9 * (1 - prog(age, .4, 2.5)));
  P.glow(ctx, x, y, 180 * scale, '255,245,220', 1 - prog(age, 0, 1.2));
  P.ring(ctx, x, y, 900 * scale * eOut(prog(age, 0, 1.6)), .7 * (1 - prog(age, 0, 1.6)), '255,230,200', 14 * scale);
  const r = rng(Math.floor(t0 * 100));
  for (let i = 0; i < 60; i++) {
    const a = r() * 6.28, v = (300 + r() * 900) * scale, life = .6 + r() * .9; if (age > life) continue;
    const px = x + Math.cos(a) * v * age, py = y + Math.sin(a) * v * age + 500 * age * age;
    ctx.fillStyle = `rgba(255,${150 + r() * 80},60,${1 - age / life})`; ctx.beginPath(); ctx.arc(px, py, (3 + r() * 5) * scale, 0, 7); ctx.fill();
  }
};
window.P = P;
})();
