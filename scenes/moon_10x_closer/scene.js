// Reference scene: "What if the Moon was 10x closer?" — copy this file to start a new scene.
(() => {
const {ss, prog, lerp, eOut, eOutBack, eInOut, word, wordEnd, line, YEL, RED} = E;
const MOON = {x: 540, y: 905, r: 430};
let city;
// story beats, all derived from the narration timing
const B = () => ({
  night: [line(2).t0 - .1, line(2).t0 + 1.2],
  bright: [word('hundred'), wordEnd('brighter') + .3],
  pull: [line(3).t0 + .4, line(3).t1 + .2],
  flood: [word('tides') - .1, line(4).t1 + .1],
});
let b;
window.SCENE = {
  title: [['WHAT IF THE MOON', '#fff'], ['WAS 10× CLOSER?', YEL]],
  cta: [['WOULD YOU LIVE', '#fff'], ['UNDER THIS MOON?', YEL]],
  prompt: 'YES or NO?  Comment below',
  init() { city = P.nyc({base: 1360}); b = B(); },
  shake(t) { return 2.5 * ss(t, b.pull[0], b.pull[1]) + 7 * ss(t, b.flood[0], b.flood[0] + .6) * (1 - ss(t, b.flood[1] - .3, b.flood[1] + .7)); },
  draw(ctx, t) {
    const night = ss(t, ...b.night), bright = ss(t, ...b.bright);
    P.sky(ctx, P.mixSky(P.SKY.dusk, P.SKY.night, night), 1360);
    P.stars(ctx, t, night * (1 - .5 * bright), 1150);
    // moon: rises a little during the hook, pulses when the pull is announced
    const pulse = 1 + .015 * Math.sin(Math.PI * prog(t, word('thousand'), word('thousand') + .6));
    P.moon(ctx, MOON.x, MOON.y + lerp(40, 0, eOut(prog(t, 0, 2.6))), MOON.r * pulse, {warm: 1 - night, cool: night, halo: lerp(.4, 1, bright)});
    const hz = ctx.createLinearGradient(0, 1030, 0, 1360);
    hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, night < .5 ? `rgba(240,150,100,${.45 * (1 - night)})` : `rgba(40,70,120,${.35 * night})`);
    ctx.fillStyle = hz; ctx.fillRect(0, 1030, 1080, 330);
    city.draw(ctx, t, {night, lit: bright, dim: .55 * ss(t, b.flood[0] + 1, b.flood[1])});
    // water: slight bulge toward the Moon, then the flood
    const level = 1354 - lerp(0, 55, eInOut(prog(t, ...b.pull))) - lerp(0, 420, eInOut(prog(t, ...b.flood)));
    const amp = 5 + 10 * prog(t, ...b.pull) + 26 * ss(t, b.flood[0], b.flood[0] + 1.1) * (1 - .7 * ss(t, b.flood[1] + .3, b.flood[1] + 2));
    const surf = P.water(ctx, t, {level, amp, night, bright, bulge: 26 * ss(t, b.pull[0], b.pull[1]) * (1 - ss(t, b.flood[0] + .5, b.flood[0] + 1.5)),
      foam: .25 + .55 * ss(t, b.flood[0], b.flood[0] + 1.1), spray: {t0: b.flood[0] + .4, t1: b.flood[1]}});
    P.chevrons(ctx, t, [300, 540, 780], surf(540) - 40, 1000, ss(t, b.pull[0], b.pull[0] + .5) * (1 - ss(t, b.flood[0], b.flood[0] + .4)));
    if (bright > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(90,120,170,${.22 * bright * (1 - .6 * ss(t, b.flood[0], b.flood[0] + 1))})`; ctx.fillRect(-60, -60, 1200, 2040); ctx.restore(); }
  },
  overlay(ctx, t) {
    // "today" moon vs 10x closer
    const l1 = line(1), a = ss(t, l1.t0 - .1, l1.t0 + .25) * (1 - ss(t, line(2).t0 - .1, line(2).t0 + .2));
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a;
      const pop = eOutBack(prog(t, l1.t0 - .1, l1.t0 + .35)), sr = MOON.r / 10;
      P.glow(ctx, 175, 330, sr * 2.4 * pop, '255,240,220', .25);
      P.moon(ctx, 175, 330, sr * pop, {halo: 0});
      E.label(ctx, 'TODAY', 175, 330 + sr + 46, 34, '#fff', 'center');
      P.bracket(ctx, MOON.x - MOON.r, MOON.x + MOON.r, MOON.y - 20, eOut(prog(t, word('ten', l1.t0) - .1, word('wider') + .2)));
      ctx.restore();
    }
    E.badge(ctx, t, l1.t0 + .1, line(2).t0 - .05, E.count(t, 10, word('ten', l1.t0) - .05, word('wider')) + '×', 'WIDER');
    E.badge(ctx, t, word('hundred') - .25, line(3).t0 - .1, E.count(t, 100, word('hundred') - .1, word('brighter')) + '×', 'BRIGHTER');
    E.badge(ctx, t, word('pull') - .1, b.flood[0] - .05, E.count(t, 1000, word('thousand') - .25, word('stronger')).toLocaleString('en-US') + '×', 'PULL');
    E.badge(ctx, t, word('tides'), line(-1).t0 - .1, '', 'FLOOD WARNING', RED);
  },
};
})();
