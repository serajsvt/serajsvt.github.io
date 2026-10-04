# Daily Shorts — runbook (v2: real facts + real NASA images, built for YouTube monetization)

You are running unattended. Nobody will answer questions: make reasonable choices and keep going.
Goal: **2 original, educational YouTube Shorts per day for a US audience**, published automatically at
**12:30 PM and 7:30 PM America/New_York** on the YouTube channel connected to Metricool (brand blogId `7232524`).
The owner speaks French: all messages to them are in French; all video content is in English with US units.

## Why v2 (read this)
The owner needs the channel to qualify for YouTube monetization. YouTube's monetization policies demonetize
**inauthentic content** (generic, repetitive, template-based or mass-produced videos with little originality,
image slideshows with minimal narration) and **reused content** (other people's material without significant original
commentary). AI help with scripting/production is allowed when each video brings unique value. So every video must:
1. Be about a **real, verified fact** (space, Earth, America-related science), not fiction. "What if" videos are allowed
   at most 1 in 3, and only when grounded in real science and real images.
2. Use **real images**: NASA public-domain photos/maps from `tools/nasa.sh` (the only photo source reachable here) and
   the real Earth map (`P.globe`). Never download or copy images, video, music or text from anywhere else.
3. Add real value on top of the images: original narration, motion (Ken Burns), numbers that count up, highlights,
   comparisons to US things (states, cities, the Empire State Building, mph, °F). **Never a bare slideshow.**
4. Feel different from the previous videos: vary hook style (question / bold statement / "This is…"), color palette,
   layout, music moods and the order of beats. Check the last 6 entries of `topics_log.json` and avoid repeating them.
5. Credit images on screen (`P.credit`) and in the description ("Images: NASA").
6. Have an honest title that matches the video (no bait the video does not deliver).

## 0. Setup (once per run)
1. Attach the repo with push access: tool `mcp__claude-code-remote__add_repo` → owner `serajsvt`, repo `serajsvt.github.io`, access `push`.
2. Clone only this branch (do NOT clone the whole site):
   `git clone --depth 1 --single-branch -b youtube-pipeline https://github.com/serajsvt/serajsvt.github.io ~/yt && cd ~/yt`
3. `bash tools/setup.sh` (Piper TTS + CC BY 4.0 LibriTTS voice from GitHub releases; checks ffmpeg/playwright).
4. Load the Metricool tools with ToolSearch (query `metricool`). Check `getBrandSettings` shows `youtubeData`.

## 1. Pick 2 topics
- Read `topics.md` and `topics_log.json`. Never reuse a logged topic. Prefer the "Real facts" bank.
- Each topic needs at least 2 usable NASA images: `bash tools/nasa.sh list <word>` (see `tools/nasa_catalog.txt`:
  PHOTO = real photograph → `P.photo`; MAP = surface map → `P.planet` sphere; AVOID = unusable).
- Avoid: real people as the subject, brands/logos, copyrighted characters or music, politics, real recent tragedies,
  health/finance/legal advice, fear-mongering.

## 2. Make each video (≈20–30 min each)
a. **Facts**: 2–4 WebSearch queries, prefer NASA / USGS / NOAA / universities. Only state numbers you verified;
   hedge with "about / could / scientists think". US units: miles, mph, feet, °F, gallons. Put the URLs in script.json "sources".
b. **Script** → `scenes/<slug>/script.json` (format: `scenes/moon_footprints/script.json`):
   5–6 lines, 15–20 s, each line ≤ 14 words. Line 0 = hook (surprising statement or question about the image).
   Lines 1–3 = the explanation with numbers. Line 4 = the most surprising detail. Last line = a yes/no question.
   `moods` per line: wonder | calm | dark | tense | epic | question.
c. **Images**: `bash tools/nasa.sh get scenes/<slug> "<path>" <name>.jpg` for each image you use.
d. `python3 tools/tts.py scenes/<slug>` → duration must be 14–22 s (shorten text or lower `ls`). Use `"say"` for pronunciation.
e. **Scene** → `scenes/<slug>/scene.js`. Start from `scenes/moon_footprints/scene.js` (real photos) or
   `scenes/moon_10x_closer/scene.js` (full animation). One image or visual per line, slow motion on every photo,
   a badge for every spoken number, `P.credit` while real images are on screen, timings from `E.word()` / `E.line()`.
   Frame 0 must already show the strongest image + the hook title (`SCENE.title`).
f. **Review stills**: `node tools/render.mjs scenes/<slug> stills 0.2,<one time per line>,<last>` then Read
   `scenes/<slug>/stills/sheet.png`. Fix overlaps, cut-off text, dark/empty frames, anything contradicting the narration.
   Exit code 2 = page errors → fix them. Repeat until it is genuinely good.
g. `node tools/render.mjs scenes/<slug> video` (≈5–8 min; run in background and poll).
h. `scenes/<slug>/cues.json` (see `tools/audio.py` header) then `python3 tools/audio.py scenes/<slug>`.
i. `bash tools/mix.sh scenes/<slug>` → `out/<slug>.mp4`. Read `scenes/<slug>/check/final_sheet.png`. Expect ≈ -14 LUFS.

## 3. Host the files (Metricool needs a public URL)
```
cd ~/yt && rm -rf /tmp/media && mkdir /tmp/media && cp out/<slug1>.mp4 out/<slug2>.mp4 /tmp/media/ && cd /tmp/media
git init -q -b youtube-media && printf "Temporary media for YouTube scheduling (Metricool). Not part of the website.\n" > README.md
git add . && git -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -m "Media for $(date +%F)"
git remote add origin https://github.com/serajsvt/serajsvt.github.io && git push -f origin youtube-media
```
Public URL: `https://raw.githubusercontent.com/serajsvt/serajsvt.github.io/youtube-media/<slug>.mp4`

## 4. Schedule on YouTube with Metricool
`createScheduledPost`, blogId `7232524`, one call per video:
- Times: 12:30 and 19:30 **America/New_York** today. `date` carries the offset from `TZ=America/New_York date +%z`;
  `publicationDate.timezone` = `America/New_York`. If 12:30 PM ET already passed, schedule the first video 20 minutes from now.
- `info`:
```json
{"autoPublish": true, "descendants": [], "draft": false, "firstCommentText": "", "hasNotReadNotes": false,
 "media": ["https://raw.githubusercontent.com/serajsvt/serajsvt.github.io/youtube-media/<slug>.mp4"], "mediaAltText": [],
 "providers": [{"network": "youtube"}], "publicationDate": {"dateTime": "YYYY-MM-DDT12:30:00", "timezone": "America/New_York"},
 "shortener": false, "smartLinkData": {"ids": []},
 "text": "<description>",
 "youtubeData": {"title": "<title>", "type": "short", "privacy": "public", "tags": [ … 8–10 tags … ],
                 "category": "SCIENCE_TECHNOLOGY", "madeForKids": false, "isAiGeneratedContent": <see below>}}
```
- Title ≤ 100 chars, honest, 1–2 emojis, ends with `#shorts`.
- Description: 2 lines restating the fact with its key number + emojis, the comment question ("… Comment YES or NO 👇"),
  1 line "Source: <short source name>", 5 hashtags (#space/#science/#nasa/#shorts + 1 topical), then the credits:
  `Images: NASA (public domain)` and `Voice: Piper TTS, LibriTTS model (CC BY 4.0)`.
- `isAiGeneratedContent`: **true** if a real photo was edited to show something that did not happen (e.g. an impact
  drawn onto a real crater photo) or if a scene looks realistic but is invented; **false** for real photos with
  graphics/labels or clearly stylized animation. YouTube says this label does not reduce reach.
- Verify with `getScheduledPosts` (status PENDING, media copied to static.metricool.com).

## 5. Log and save
- Append to `topics_log.json`: `{"date", "slug", "title", "publish_et", "metricool_id"}`.
- `git add scenes/<slug>/script.json scenes/<slug>/cues.json scenes/<slug>/scene.js topics_log.json topics.md`
  (images, audio and video are git-ignored), commit, `git pull --rebase origin youtube-pipeline`, `git push origin HEAD:youtube-pipeline`.

## 6. Report to the owner (in French)
- `SendUserFile` both MP4s with `status: "proactive"`.
- `SendUserMessage`: the 2 titles, publish times in New York time and Casablanca time, one line per video on the fact used.
- If anything failed, still send whatever videos exist and explain in 2–3 short sentences what to do.

## Quality bar (check before publishing)
- First second: strongest real image + hook title. No blank or slow intro.
- Readable captions, nothing cut off, key text between y=250 and y=1600 (YouTube UI covers the edges).
- Every number verified; narration, badges and description agree. Image credit visible.
- 14–22 s, ends on a question. Clearly different from yesterday's videos.
