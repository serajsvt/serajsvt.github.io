// Frame-accurate renderer: drives player.html with Playwright and pipes PNG frames into ffmpeg.
// usage:  node tools/render.mjs scenes/<slug> stills 0.5,3,7.2   → scenes/<slug>/stills/t*.png + sheet.png
//         node tools/render.mjs scenes/<slug> video               → scenes/<slug>/silent.mp4 (30 fps)
import { createRequire } from 'module';
import { spawn, spawnSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);

function loadPlaywright() {
  for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) {
    try { return require(p); } catch {}
  }
  throw new Error('playwright not found — run: npm i -g playwright');
}
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const base of ['/opt/pw-browsers', path.join(process.env.HOME || '', '.cache/ms-playwright')]) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base).sort().reverse()) {
      const c = path.join(base, d, 'chrome-linux', 'chrome');
      if (d.startsWith('chromium-') && fs.existsSync(c)) return c;
    }
  }
  return undefined;   // let Playwright pick its default
}

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const [sceneDir, mode, arg] = process.argv.slice(2);
const slug = path.basename(path.resolve(sceneDir));
const SC = path.join(ROOT, 'scenes', slug);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: findChrome(), args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) { errors.push(m.text()); console.log('console:', m.text()); } });
page.on('pageerror', e => { errors.push(e.message); console.log('pageerror:', e.message); });
await page.goto(`http://127.0.0.1:${port}/player.html?scene=${slug}`);
await page.evaluate(() => window.READY);
const dur = await page.evaluate(() => window.E.DUR);
const stage = await page.$('#stage');

if (mode === 'stills') {
  const out = path.join(SC, 'stills'); fs.mkdirSync(out, { recursive: true });
  const ts = (arg || '').split(',').filter(Boolean).map(Number);
  const files = [];
  for (const t of ts) {
    await page.evaluate(t => window.seek(t), t);
    const f = path.join(out, `t${t.toFixed(2)}.png`); await stage.screenshot({ path: f }); files.push(f);
  }
  // contact sheet for quick review
  spawnSync('python3', ['-c', `
import sys
from PIL import Image
fs = sys.argv[1:]; ims = [Image.open(f).resize((300, 533)) for f in fs]
sh = Image.new('RGB', (306 * len(ims) - 6, 533), 'white')
for i, im in enumerate(ims): sh.paste(im, (i * 306, 0))
sh.save('${path.join(out, 'sheet.png')}')`, ...files], { stdio: 'inherit' });
  console.log(`stills → ${out}/sheet.png  (duration ${dur}s)`);
} else {
  const FPS = 30, N = Math.round(dur * FPS);
  const outFile = path.join(SC, 'silent.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < N; f++) {
    await page.evaluate(t => window.seek(t), f / FPS);
    const buf = await stage.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 90 === 0) console.log(`frame ${f}/${N}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`video → ${outFile}`);
}
await browser.close(); server.close();
if (errors.length) { console.log(`${errors.length} page error(s) — fix the scene`); process.exitCode = 2; }
