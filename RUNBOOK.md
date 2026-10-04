# Daily What-If Shorts — runbook

You are running unattended. Nobody will answer questions: make reasonable choices and keep going.
Goal: **2 original "What if…?" YouTube Shorts per day for a US audience**, published automatically at
**12:30 PM and 7:30 PM America/New_York** on the YouTube channel connected to Metricool (brand blogId `7232524`).
The owner speaks French: all messages to them are in French; all video content is in English with US units.

## 0. Setup (once per run)
1. Attach the repo with push access: tool `mcp__claude-code-remote__add_repo` → owner `serajsvt`, repo `serajsvt.github.io`, access `push`.
2. Clone only this branch (do NOT clone the whole site):
   `git clone --depth 1 --single-branch -b youtube-pipeline https://github.com/serajsvt/serajsvt.github.io ~/yt && cd ~/yt`
3. `bash tools/setup.sh` (downloads Piper TTS + CC BY 4.0 LibriTTS voice from GitHub releases; checks ffmpeg/playwright).
4. Load the Metricool tools with ToolSearch (query `metricool`). Check `getBrandSettings` shows `youtubeData`.

## 1. Pick 2 topics
- Read `topics.md` and `topics_log.json`. Never reuse a topic already in the log.
- Pick the 2 unused topics with the strongest US appeal, one "space" and one "Earth / US place" when possible.
- You may add new topics to `topics.md` (same rules). Avoid: real people, brands/logos, copyrighted characters or music,
  politics, real recent tragedies, medical advice, fear-mongering. Hypotheticals only, grounded in real science.

## 2. Make each video (≈20–30 min each)
a. **Facts**: 2–4 WebSearch queries per topic, prefer NASA / USGS / NOAA / universities. Only state numbers you verified.
   Hedge with "would / could". Use US units: miles, mph, feet, °F, gallons.
b. **Script** → `scenes/<slug>/script.json` (copy the format of `scenes/moon_10x_closer/script.json`):
   - 5–6 lines, 15–20 s total, each line ≤ 14 words, simple words.
   - Line 0 = hook question ("What if …?"). Lines 1–3 = escalating facts, each with a big number.
     Line 4 = the scariest / most surprising payoff. Last line = a yes/no question that invites comments.
   - `moods` per line: wonder | calm | dark | tense | epic | question.
c. `python3 tools/tts.py scenes/<slug>` → check the printed duration is 14–22 s (adjust `ls` per line or shorten text).
   Use `"say"` to fix pronunciations (e.g. numbers, "A.I.").
d. **Scene** → `scenes/<slug>/scene.js`, start from `scenes/moon_10x_closer/scene.js`.
   - Primitives (see top of `lib/primitives.js`): sky presets, stars, `P.nyc` skyline, `P.water` (rising/flooding),
     `P.moon`, `P.sun`, `P.globe` (real Earth map, USA at lon0 -95), `P.terrain`, `P.smoke`, `P.particles`
     (snow/ash/rain/embers/dust), `P.impact`, `P.glow`, `P.flash`, `P.ring`, `P.chevrons`, `P.bracket`.
     You can also draw anything custom with the canvas API.
   - Frame 0 must already show the payoff visual + the hook title (`SCENE.title`). Something big changes every ~3 s.
   - Every number spoken gets an `E.badge` counter. Never hard-code seconds: use `E.word('x')`, `E.line(i)`.
   - `SCENE.cta` = the last question in big type, `SCENE.prompt` = "YES or NO?  Comment below".
e. **Review stills**: `node tools/render.mjs scenes/<slug> stills 0.2,<one time per line>,<last>` then Read
   `scenes/<slug>/stills/sheet.png`. Fix: text overlapping or cut off, empty/boring frames, unreadable contrast,
   visuals that contradict the narration. Repeat until it looks like something a viewer would stop scrolling for.
   The command exits with code 2 if the page logged errors — fix them.
f. `node tools/render.mjs scenes/<slug> video` (≈5–8 min, run it in the background and poll).
g. `scenes/<slug>/cues.json` (sound effects on key words, see `tools/audio.py` header) then `python3 tools/audio.py scenes/<slug>`.
h. `bash tools/mix.sh scenes/<slug>` → `out/<slug>.mp4`. Read `scenes/<slug>/check/final_sheet.png`.
   Expect ≈ -14 LUFS, 1080x1920, h264 + aac.

## 3. Host the files (Metricool needs a public URL)
```
cd ~/yt && rm -rf /tmp/media && mkdir /tmp/media && cp out/<slug1>.mp4 out/<slug2>.mp4 /tmp/media/ && cd /tmp/media
git init -q -b youtube-media && printf "Temporary media for YouTube scheduling (Metricool). Not part of the website.\n" > README.md
git add . && git -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -m "Media for $(date +%F)"
git remote add origin https://github.com/serajsvt/serajsvt.github.io && git push -f origin youtube-media
```
Public URL: `https://raw.githubusercontent.com/serajsvt/serajsvt.github.io/youtube-media/<slug>.mp4`
(force-push replaces yesterday's files; Metricool copies the video at scheduling time, so that is fine).

## 4. Schedule on YouTube with Metricool
`createScheduledPost`, blogId `7232524`, one call per video:
- Times: 12:30 and 19:30 **America/New_York** today. `date` must carry the right offset — get it with
  `TZ=America/New_York date +%z` (EDT -04:00 / EST -05:00). `publicationDate.timezone` = `America/New_York`.
  If 12:30 PM ET already passed, schedule the first video 20 minutes from now.
- `info`:
```json
{"autoPublish": true, "descendants": [], "draft": false, "firstCommentText": "", "hasNotReadNotes": false,
 "media": ["https://raw.githubusercontent.com/serajsvt/serajsvt.github.io/youtube-media/<slug>.mp4"], "mediaAltText": [],
 "providers": [{"network": "youtube"}], "publicationDate": {"dateTime": "YYYY-MM-DDT12:30:00", "timezone": "America/New_York"},
 "shortener": false, "smartLinkData": {"ids": []},
 "text": "<description>",
 "youtubeData": {"title": "<title>", "type": "short", "privacy": "public", "tags": [ … 8–10 tags … ],
                 "category": "SCIENCE_TECHNOLOGY", "madeForKids": false, "isAiGeneratedContent": false}}
```
- Title ≤ 100 chars: `What If <…>? <1–2 emojis> #shorts`.
- Description: 2 punchy lines with emojis restating the most shocking number, then the comment question
  ("Would you…? Comment YES or NO 👇"), then 5 hashtags (#whatif #shorts + 3 topical), then this credit line
  (required by the voice license): `Voice: Piper TTS, LibriTTS model (CC BY 4.0)`.
- `isAiGeneratedContent` stays false: these are stylized animations, not realistic footage.
- Verify with `getScheduledPosts` (status PENDING, media copied to static.metricool.com).

## 5. Log and save
- Append to `topics_log.json`: `{"date", "slug", "title", "publish_et", "metricool_id"}`.
- `git add scenes/<slug>/script.json scenes/<slug>/cues.json scenes/<slug>/scene.js topics_log.json topics.md`
  (generated audio/video files are git-ignored), commit, `git pull --rebase origin youtube-pipeline`, `git push origin HEAD:youtube-pipeline`.

## 6. Report to the owner (in French)
- `SendUserFile` both MP4s with `status: "proactive"`.
- `SendUserMessage`: the 2 titles, publish times in New York time and Casablanca time, one line per video on why the topic was chosen.
- If anything failed (Metricool, GitHub push, render), still send whatever videos exist and explain in 2–3 short sentences
  what the owner must do (e.g. post manually from the YouTube app).

## Quality bar (check before publishing)
- The first second shows something surprising + the hook title. No blank or slow intro.
- Captions readable, nothing cut off at the edges, nothing hidden under the YouTube UI (keep key text between y=250 and y=1600).
- Every fact is verified; numbers in narration, badges and description agree.
- 14–22 s, ends on a question.
