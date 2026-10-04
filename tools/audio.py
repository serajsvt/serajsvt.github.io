#!/usr/bin/env python3
"""Original score + sound design for a scene (no samples, no licensed audio).

usage: python3 tools/audio.py scenes/<slug>

Reads timings.json, script.json ("moods": one per line, optional) and cues.json (optional):
  moods: "wonder" | "calm" | "tense" | "epic" | "dark" | "question"   (default: wonder…, tense, epic, question)
  cues.json: [{"type": "boom", "word": "massive"}, {"type": "ticks", "word": "hundred", "end_word": "brighter", "n": 16},
              {"type": "rumble", "t": 8.6, "t1": 15.8}, {"type": "ocean", "word": "tides", "t1": 17}, …]
  types: boom, whoosh, chime, pop, ticks, rumble, riser, ocean, wind, fire, splash, glitch
  "word"/"end_word" resolve to the spoken word's start time (use "after": seconds to pick a later occurrence).
Automatic: opening hit, a whoosh into every line, a chime on the final question.
Writes music.wav and sfx.wav (48 kHz stereo).
"""
import json, os, re, sys, wave
import numpy as np
from scipy.signal import lfilter, fftconvolve

SR = 48000
rng = np.random.default_rng(8)


def lp(x, fc): a = np.exp(-2 * np.pi * fc / SR); return lfilter([1 - a], [1, -a], x)
def hp(x, fc): return x - lp(x, fc)
def bp(x, lo, hi): return lp(hp(x, lo), hi)
def midi(n): return 440 * 2 ** ((n - 69) / 12)
def saw(f, n, det=0.0): return 2 * ((np.arange(n) * f * (1 + det) / SR) % 1) - 1
def env(n, a, r):
    e = np.ones(n); ai, ri = max(1, int(a * SR)), max(1, int(r * SR)); e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
def reverb(x, secs, wet):
    L = int(secs * SR); ir = rng.standard_normal(L) * np.exp(-np.linspace(0, 6, L)); ir = lp(ir, 4500); ir /= np.sqrt((ir ** 2).sum())
    return x * (1 - wet) + fftconvolve(x, ir)[:len(x)] * wet * 1.5


def main(scene):
    tm = json.load(open(f"{scene}/timings.json")); cfg = json.load(open(f"{scene}/script.json"))
    cues = json.load(open(f"{scene}/cues.json")) if os.path.exists(f"{scene}/cues.json") else []
    DUR = tm["dur"]; N = int(DUR * SR); lines = tm["lines"]
    words = [w for l in lines for p in l["phrases"] for w in p["words"]]
    norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
    def wt(txt, after=0, end=False):
        for w in words:
            if w["t0"] >= after and norm(w["w"]) == norm(txt): return w["t1"] if end else w["t0"]
        print("WARNING cue word not found:", txt); return None
    def add(buf, sig, at, g=1.0):
        i = int(at * SR); j = min(len(buf), i + len(sig))
        if j > i >= 0: buf[i:j] += sig[:j - i] * g

    nL = len(lines)
    moods = cfg.get("moods") or (["wonder"] * max(1, nL - 3) + ["tense", "epic"] + ["question"])[-nL:]
    moods = (moods + ["question"] * nL)[:nL]; moods[-1] = moods[-1] if cfg.get("moods") else "question"
    CH = {"wonder": ([50, 57, 62, 65], .85), "calm": ([53, 60, 65, 69], .7), "dark": ([46, 53, 58, 61], .9),
          "tense": ([43, 50, 55, 58], 1.05), "epic": ([38, 50, 53, 57], 1.25), "question": ([41, 53, 57, 60], .8)}

    # ---------------- music ----------------
    mus = np.zeros(N)
    bounds = [0.0] + [l["t0"] - .1 for l in lines[1:]] + [DUR]
    for i, m in enumerate(moods):
        t0, t1 = bounds[i], bounds[i + 1]; ch, inten = CH.get(m, CH["wonder"])
        n = int((t1 - t0 + 1.2) * SR)
        pad = sum(saw(midi(k), n, d) for k in ch for d in (-.003, .0021, .0047)) / 12
        add(mus, lp(lp(pad, 700 + 500 * inten), 1500) * env(n, .45, 1.1), t0, .55 * inten)
        add(mus, np.sin(2 * np.pi * midi(ch[0] - 12) * np.arange(n) / SR) * env(n, .3, 1.0), t0, .35 * inten)
        if m in ("wonder", "calm", "question"):
            arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12]
            k = 0; at = t0
            while at < t1 - .1:
                f = midi(arp[k % 4] + 12); n2 = int(.6 * SR); tt = np.arange(n2) / SR
                add(mus, (np.sin(2 * np.pi * f * tt) + .3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 7), at, .07 * (1 if k % 2 == 0 else .7))
                k += 1; at += .3
        if m in ("tense", "epic", "dark"):
            at, step = t0 + .05, (.75 if m == "tense" else .6)
            while at < t1 - .05:
                n3 = int(.35 * SR); tt = np.arange(n3) / SR
                kick = np.sin(2 * np.pi * np.cumsum(42 + 70 * np.exp(-tt * 26)) / SR) * np.exp(-tt * 9)
                add(mus, kick, at, .7 if m == "epic" else .55); add(mus, kick, at + .22, .35)
                at += step
        if m == "tense":
            n4 = int((t1 - t0) * SR); tt = np.arange(n4) / SR
            trem = (saw(midi(69), n4) + saw(midi(70), n4, .002)) * (.5 + .5 * np.sin(2 * np.pi * 9 * tt)) * np.linspace(0, 1, n4) ** 2
            add(mus, lp(trem, 2500), t0, .1)
    mus = reverb(mus, 2.4, .32)
    fade = np.ones(N); fade[-int(1.0 * SR):] = np.linspace(1, 0, int(1.0 * SR)); mus *= fade

    # ---------------- sound design ----------------
    fx = np.zeros(N)
    def whoosh(d=.6, lo=300, hi=3500): n = int(d * SR); tt = np.arange(n) / SR; return bp(rng.standard_normal(n), lo, hi) * np.sin(np.pi * tt / d) ** 2
    def boom(d=2.4, f0=30, depth=80):
        n = int(d * SR); tt = np.arange(n) / SR
        return np.sin(2 * np.pi * np.cumsum(f0 + depth * np.exp(-tt * 14)) / SR) * np.exp(-tt * 2.2) + lp(rng.standard_normal(n), 700) * np.exp(-tt * 6) * .7
    def tick(f=2400): n = int(.03 * SR); tt = np.arange(n) / SR; return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 200)
    def chime(f, d=2.0): n = int(d * SR); tt = np.arange(n) / SR; return sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * k) for m, a, k in [(1, 1, 2.5), (2.76, .35, 4), (5.4, .15, 6)])
    def pop(f=700): n = int(.12 * SR); tt = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(f * (1 + .6 * np.exp(-tt * 60))) / SR) * np.exp(-tt * 38)
    def bed(t0, t1, lo, hi, swell=2.2, g=.5):
        n = int((t1 - t0) * SR); tt = np.arange(n) / SR
        return bp(rng.standard_normal(n), lo, hi) * np.minimum(1, tt / .8) * np.minimum(1, (t1 - t0 - tt) / .8) * (.55 + .45 * np.sin(2 * np.pi * tt / swell) ** 2) * g

    add(fx, boom(2.6, 30, 70), 0.0, .6); add(fx, whoosh(.9, 200, 2500), 0.0, .35)
    for l in lines[1:]: add(fx, whoosh(.55), max(0, l["t0"] - .3), .38)
    add(fx, chime(midi(81), 2.2), lines[-1]["t0"] - .1, .15)
    for c in cues:
        t = c.get("t"); t = wt(c["word"], c.get("after", 0)) if "word" in c else t
        if t is None: continue
        t1 = c.get("t1"); t1 = wt(c["end_word"], t, end=True) if "end_word" in c else t1
        g = c.get("gain", 1.0); ty = c["type"]
        if ty == "boom": add(fx, boom(2.8, 26, 90), t - .03, 1.0 * g)
        elif ty == "whoosh": add(fx, whoosh(.6), t - .3, .5 * g)
        elif ty == "chime": add(fx, chime(midi(c.get("note", 88))), t, .12 * g)
        elif ty == "pop": add(fx, pop(c.get("f", 700)), t, .35 * g)
        elif ty == "ticks":
            n = c.get("n", 14); t1 = t1 or t + 1
            for k in range(n): add(fx, tick(2000 + 60 * k), t + (t1 - t) * (k / n) ** .7, .12 * g)
        elif ty == "rumble":
            n = int(((t1 or t + 4) - t) * SR); tt = np.arange(n) / SR
            add(fx, lp(rng.standard_normal(n), 120) * np.minimum(1, tt / 2.5) ** 2 * 6, t, .55 * g)
        elif ty == "riser":
            n = int(((t1 or t + 1.5) - t) * SR); tt = np.arange(n) / SR
            add(fx, bp(rng.standard_normal(n), 400, 5000) * (tt / tt[-1]) ** 2, t, .35 * g)
        elif ty == "ocean": add(fx, bed(t, t1 or DUR, 150, 2200, 2.2, .6), t, g)
        elif ty == "wind": add(fx, bed(t, t1 or DUR, 300, 1400, 3.1, .5), t, g)
        elif ty == "fire":
            seg = bed(t, t1 or DUR, 200, 3000, 1.3, .35); n = len(seg)
            cr = np.zeros(n); idx = rng.integers(0, n, int(n / SR * 40)); cr[idx] = rng.standard_normal(len(idx))
            add(fx, seg + hp(cr, 1500) * .8, t, g)
        elif ty == "splash": add(fx, whoosh(1.1, 250, 5000), t, .55 * g)
        elif ty == "glitch":
            n = int(.4 * SR); s = np.sign(np.sin(2 * np.pi * 220 * np.arange(n) / SR)) * (rng.random(n) > .5); add(fx, lp(s, 3000) * .4, t, g)
    fx = reverb(fx, 1.4, .18)

    def write(path, x):
        x = np.clip(x, -1, 1); st = np.stack([x, x], 1)
        with wave.open(path, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
    write(f"{scene}/music.wav", mus / max(1e-6, np.abs(mus).max()) * .5)
    write(f"{scene}/sfx.wav", fx / max(1e-6, np.abs(fx).max()) * .75)
    print("music + sfx written; moods:", moods)


if __name__ == "__main__":
    main(sys.argv[1].rstrip("/"))
