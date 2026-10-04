// Reference scene with REAL NASA photos: "This footprint has been on the Moon since 1969".
// Pattern: every line gets its own real photo with slow Ken Burns motion, plus graphics that ADD information
// (badges, highlights, a meteor) so the video is commentary + motion design, never a bare slideshow.
(() => {
const {ss, prog, lerp, eOut, eOutBack, eIn, word, line, YEL, RED} = E;
let img = {};
const fade = (t, a, b, d = .35) => ss(t, a - d / 2, a + d / 2) * (1 - ss(t, b - d / 2, b + d / 2));   // visible between a and b
window.SCENE = {
  title: [['THIS FOOTPRINT IS', '#fff'], ['STILL ON THE MOON', YEL]],
  cta: [['WOULD YOU LEAVE', '#fff'], ['YOUR FOOTPRINT?', YEL]],
  prompt: 'YES or NO?  Comment below',
  async init() {
    for (const n of ['bootprint', 'fullmoon', 'terrain', 'crater', 'earth']) img[n] = await P.sceneImage(n + '.jpg');
  },
  draw(ctx, t) {
    ctx.fillStyle = '#000'; ctx.fillRect(-60, -60, 1200, 2040);
    const L = i => line(i);
    // 0 + 3: the real bootprint (Apollo 11)
    P.photo(ctx, img.bootprint, t, {t0: 0, t1: L(1).t0, z0: 1.0, z1: 1.25, fx0: .55, fy0: .55, fx1: .68, fy1: .72, alpha: fade(t, -1, L(1).t0)});
    // 1: the whole Moon
    const a1 = fade(t, L(1).t0, L(2).t0);
    if (a1 > 0) { P.stars(ctx, t, a1 * .8, 1920); P.photo(ctx, img.fullmoon, t, {t0: L(1).t0, t1: L(2).t0 + .5, x: 40, y: 460, w: 1000, h: 1000, z0: 1.0, z1: 1.08, alpha: a1}); }
    // 2: real lunar terrain, a slow pan
    P.photo(ctx, img.terrain, t, {t0: L(2).t0 - .3, t1: L(3).t0 + .3, z0: 1.1, z1: 1.3, fx0: .3, fy0: .5, fx1: .7, fy1: .45, alpha: fade(t, L(2).t0, L(3).t0)});
    // 3: back to the footprint, closer
    P.photo(ctx, img.bootprint, t, {t0: L(3).t0 - .3, t1: L(4).t0 + .3, z0: 1.35, z1: 1.6, fx0: .68, fy0: .72, fx1: .7, fy1: .78, alpha: fade(t, L(3).t0, L(4).t0)});
    // 4: crater photo + a meteor streaking in and hitting
    const a4 = fade(t, L(4).t0, L(5).t0);
    if (a4 > 0) {
      P.photo(ctx, img.crater, t, {t0: L(4).t0 - .3, t1: L(5).t0, z0: 1.05, z1: 1.2, alpha: a4});
      const hit = word('spot') + .1, k = eIn(prog(t, word('rock') - .1, hit));
      if (t < hit + .05 && k > 0) {
        const x = lerp(1150, 520, k), y = lerp(-80, 980, k);
        ctx.save(); ctx.globalAlpha = a4; ctx.strokeStyle = 'rgba(255,220,170,.9)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 160, y - 280); ctx.lineTo(x, y); ctx.stroke(); P.glow(ctx, x, y, 60, '255,230,190', .9); ctx.restore();
      }
      ctx.save(); ctx.globalAlpha = a4; P.impact(ctx, t, hit, 520, 980, .9); ctx.restore();
    }
    // 5: Earth from space behind the question
    const a5 = ss(t, L(5).t0 - .3, L(5).t0 + .2);
    if (a5 > 0) { P.stars(ctx, t, a5, 1920); P.photo(ctx, img.earth, t, {t0: L(5).t0 - .3, t1: E.DUR, x: 90, y: 560, w: 900, h: 900, z0: 1.15, z1: 1.2, alpha: a5}); }
  },
  overlay(ctx, t) {
    const L = i => line(i);
    // real-image credit, always visible while a photo is on screen
    P.credit(ctx, t < L(1).t0 || (t > L(3).t0 && t < L(4).t0) ? 'Image: NASA / Apollo 11' : 'Images: NASA');
    E.badge(ctx, t, word('1969') - .4, L(1).t0, '', 'SINCE 1969', YEL, 560);
    E.badge(ctx, t, word('wind') - .1, L(3).t0 - .1, '0', 'WIND · RAIN · EROSION', YEL);
    E.badge(ctx, t, word('millions') - .15, L(4).t0 - .1, E.count(t, 1000000, word('millions') - .1, word('years') + .2).toLocaleString('en-US') + '+', 'YEARS');
    E.badge(ctx, t, word('rock') - .1, L(5).t0 - .2, '', 'BIGGEST THREAT: SPACE ROCKS', RED);
  },
};
})();
