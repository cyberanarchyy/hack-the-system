# DAILY DROP: how to make one reel (for scheduled runs)

Work from `news-reels/` on branch `claude/charming-noether-dkzhj4`.

## 1. Pick the story
- Search the news for the last 12 hours (WebSearch, mode "extended"). Prefer stories that are
  surprising, easy to explain in 30 s, and have a clear "twist" or a question people will argue about in the comments.
- Skip anything already covered: check the topics in `stories/*.json` from the last 3 days.
- Confirm every fact with at least 2 reputable outlets (wire services, major papers, broadcasters, official filings).
  Leave out anything you can't confirm. Allegations about real people must be worded as "reports say..." / "accused of...",
  and include any denial. No graphic violence, no tragedy as entertainment, no medical or financial advice.

## 2. Photos (licensed only)
- `python3 tools/photos.py search "<query>" 10` lists Wikimedia Commons files that are public domain / CC0 / CC BY / CC BY-SA.
- `python3 tools/photos.py get "File:..." assets/<story-name>/<short>.jpg` downloads and writes the credit.
- Good sources: US government (White House, military, NASA) = public domain; kremlin.ru = CC BY 4.0.
- NEVER use AP / Reuters / Getty / AFP / news-site images or anything scraped from the web.
- Wikimedia rate-limits hard (HTTP 429). The tool backs off, but limit yourself to ~6 downloads.
  If photos fail, build the reel from graphic scenes (`hook`, `big`, `list`, `stamp`, `cta`) instead. That's fine.
- Label old photos with place and date in the name tag (`"role": "Busan · Oct 2025"`) so viewers don't think they're from today.
- Check where the faces are (make a contact sheet) and set each scene's `focus` so faces aren't cropped.

## 3. Write the story JSON
Copy `stories/2026-11-17-apec-big-three.json` (photo style) as the template. Name it `stories/YYYY-MM-DD-<slug>.json`.
- 6–7 scenes, total voiceover about 30–40 s. Scene 1 = hook in under 3 s of speech. Last scene = `cta` with a question.
- On-screen `title` is short (2–5 words); the full sentence goes in `say` (voice) and appears as live captions.
- Spell hard names phonetically in `say` ("Shee Jin-ping", "A-peck"), and put the real spelling in `display`.
- Fill `caption` (TikTok caption with 5–8 hashtags incl. #dailydrop) and `sources` (URLs).

## 4. Render and check
```
node render.js stories/<file>.json
```
Then pull 7 frames (one per scene) with ffmpeg into a contact sheet and look at it: text must not overflow,
faces must be in frame, nothing important below y=1500 or in the right 170 px. Fix and re-render if needed.

## 5. Deliver
- Send the user `out/<file>-share.mp4` (the small copy; the full-size file is too big to download in the app) with SendUserFile (status "proactive").
- In your final message: the TikTok caption, a YouTube Shorts title (`... #shorts #news`, under 100 chars),
  a one-line "post by" note if the story is time-sensitive, and the sources as links.
- Commit the story JSON + `assets/<story-name>/` and push to `claude/charming-noether-dkzhj4`
  (if rejected: `git fetch origin claude/charming-noether-dkzhj4 && git merge --no-edit FETCH_HEAD`, then push again).
