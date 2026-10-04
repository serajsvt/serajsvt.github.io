#!/usr/bin/env python3
"""Narration → voice.wav + word timings for a scene.

usage: python3 tools/tts.py scenes/<slug>

scenes/<slug>/script.json:
{
  "lines": [                                   # 4–6 lines, ~15–20 s total. Line 0 = hook question, last = CTA question
    {"text": "What if the Moon was ten times closer?"},
    {"text": "Over New York, it would look ten times wider.", "say": null, "ls": 0.95},
    ...
  ],
  "speaker": 23, "lead": 0.25, "gap": 0.32, "tail": 0.6, "ls": 0.97
}
"text" is what captions show; "say" (optional) is the spelling sent to the voice (e.g. "A.I.", "thirty-eight thousand");
"ls" is Piper length_scale (lower = faster). Writes voice.wav, timings.json, data.js in the scene folder.
"""
import json, os, re, subprocess, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.environ.get("YT_TOOLS", os.path.expanduser("~/yt_tools"))
PIPER = f"{TOOLS}/piper/piper"
MODEL = f"{TOOLS}/voice/en-us-libritts-high.onnx"
SR = 22050


def read(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def segments(path):
    out = subprocess.run(["ffmpeg", "-i", path, "-af", "silencedetect=n=-40dB:d=0.08", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", out)]
    en = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", out)]
    total = len(read(path)) / SR
    sil = list(zip(st, en + [total] * (len(st) - len(en))))
    segs, cur = [], 0.0
    for a, b in sil:
        if a - cur > .06: segs.append([cur, a])
        cur = b
    if total - cur > .06: segs.append([cur, total])
    return segs or [[0, total]]


def syll(w):
    w = re.sub(r"[^a-z']", "", w.lower())
    n = len(re.findall(r"[aeiouy]+", w))
    if n > 1 and w.endswith("e") and not w.endswith("le"): n -= 1
    if re.fullmatch(r"[0-9,×x]+", w or "0"): n = 2
    return max(n, 1)


def main(scene):
    cfg = json.load(open(f"{scene}/script.json"))
    spk, gap, lead, tail = cfg.get("speaker", 23), cfg.get("gap", .32), cfg.get("lead", .25), cfg.get("tail", .6)
    os.makedirs(f"{scene}/vo", exist_ok=True)
    clips, t = [], lead
    for i, L in enumerate(cfg["lines"]):
        p = f"{scene}/vo/l{i}.wav"
        subprocess.run([PIPER, "-m", MODEL, "--speaker", str(spk), "--length_scale", str(L.get("ls", cfg.get("ls", .97))), "-f", p],
                       input=(L.get("say") or L["text"]).encode(), capture_output=True, check=True)
        segs = segments(p)
        phrases = [s.strip() for s in re.split(r"(?<=[,;:])\s+", L["text"]) if s.strip()]
        while len(segs) > len(phrases):                       # merge the shortest gaps (plosives etc.)
            gaps = [segs[k + 1][0] - segs[k][1] for k in range(len(segs) - 1)]
            k = int(np.argmin(gaps)); segs[k] = [segs[k][0], segs[k + 1][1]]; del segs[k + 1]
        if len(segs) < len(phrases):                          # not enough pauses: one segment, one phrase
            segs, phrases = [[segs[0][0], segs[-1][1]]], [L["text"]]
        sp0, sp1 = segs[0][0], segs[-1][1]
        a = read(p)
        c0, c1 = max(0, sp0 - .03), min(len(a) / SR, sp1 + .06)
        clip = a[int(c0 * SR):int(c1 * SR)].copy(); f = int(.01 * SR)
        clip[:f] *= np.linspace(0, 1, f); clip[-f:] *= np.linspace(1, 0, f)
        off = t - sp0
        line = {"text": L["text"], "t0": round(t, 3), "t1": round(sp1 + off, 3), "phrases": []}
        for (g0, g1), ph in zip(segs, phrases):
            toks = []
            for tok in ph.split():
                if toks and re.fullmatch(r"[?!:;]", tok): toks[-1] += " " + tok
                else: toks.append(tok)
            wts = [syll(x) + .03 * len(x) for x in toks]; tot = sum(wts); tt = g0 + off; words = []
            for tok, wt in zip(toks, wts):
                d = (g1 - g0) * wt / tot; words.append({"w": tok, "t0": round(tt, 3), "t1": round(tt + d, 3)}); tt += d
            line["phrases"].append({"text": ph, "t0": round(g0 + off, 3), "t1": round(g1 + off, 3), "words": words})
        clips.append((clip, t - (sp0 - c0)))
        cfg_line = line
        cfg.setdefault("_lines", []).append(cfg_line)
        t = sp1 + off + L.get("gap", gap)
    dur = round(max(l["t1"] for l in cfg["_lines"]) + tail, 2)
    dur = round(np.ceil(dur * 30) / 30, 3)
    track = np.zeros(int(dur * SR) + SR, np.float32)
    for clip, at in clips:
        i = int(at * SR); track[i:i + len(clip)] += clip
    track = track[:int(dur * SR)]
    with wave.open(f"{scene}/voice.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes())
    tm = {"dur": dur, "lines": cfg["_lines"]}
    json.dump(tm, open(f"{scene}/timings.json", "w"), indent=1)
    open(f"{scene}/data.js", "w").write("window.TIMINGS=" + json.dumps(tm) + ";\n")
    for i, l in enumerate(tm["lines"]):
        print(f"line {i}: {l['t0']:6.2f}-{l['t1']:6.2f}  " + "  ".join(f"{w['w']}@{w['t0']:.2f}" for p in l["phrases"] for w in p["words"]))
    print(f"duration {dur}s")
    if dur > 30: print("WARNING: longer than 30 s — trim the script for Shorts retention")


if __name__ == "__main__":
    main(sys.argv[1].rstrip("/"))
