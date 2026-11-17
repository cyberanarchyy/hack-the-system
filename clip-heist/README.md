# Clip Heist 🎬

> **Layout:** `index.html` + `assets/` is the marketing website (landing page, pricing, waitlist). The app lives in [`app/`](app/). `terms.html` and `privacy.html` are drafts. Brand files and promo reels are in `brand/`.
>
> **Waitlist:** set `WAITLIST_ENDPOINT` in `assets/site.js` to a Formspree form URL to start collecting emails.
>
> **Free vs Pro:** limits live in `app/plan.js`. Until payments are connected, Pro is a local test switch: in the app, open Settings and tap the bottom text 5 times to show Developer options.

Turn long GTA 6 gameplay recordings into YouTube Shorts on your phone. It finds the best moments, makes them vertical, adds captions and effects, and exports a 1080×1920 video ready to post.
There's no account and no server. Your videos never leave your phone.

## Features

- **Highlight finder**: scans each recording for sudden loud sounds (gunfire, crashes, explosions), overall loudness, fast motion and bright flashes, then ranks the top moments. A heat strip shows where the action is across the whole video.
- **One-tap shorts**: tap *Make short* on a highlight, or *Make all* to turn every highlight into a draft.
- **Vertical framing**: full-screen crop, fit with a blurred background, or fit with black bars. Zoom in, then drag the video in the preview to follow the action.
- **Trim**: drag the handles on the timeline, set the start or end at the playhead, or nudge by half a second.
- **The 💥 hit**: mark the big moment. Effects fire on it: punch-in zoom, slow-mo, camera shake and a white flash. A reaction caption (for example "NAH 😭") appears at the hit.
- **Captions**: add timed captions at the playhead while you watch, set where each one starts and ends, and tap *Split* to turn a long line into fast 2–3 word captions that pop in. Choose the style, size and position, and ALL CAPS on or off.
- **Text**: hook line on top in six styles (Classic, Gold, Neon, Sunset, Boxed, Alert), plus your @handle and a progress bar. Tap 🎲 for hook ideas.
- **Speed**: 0.5× to 2×.
- **Safe zones**: shows where YouTube's buttons and caption cover the video.
- **Upload kit**: a suggested title (100 characters max, includes #shorts) and a description with your hashtags. Copy buttons included.
- **Export**: MP4 on iPhone and recent Chrome, WebM elsewhere (YouTube accepts both). Then *Share → YouTube* or *Save video*. *Export all* processes the whole queue.
- **Templates**: *Use this look for all new shorts* saves your framing, text style and effects as the default.

## Getting footage onto your phone

- **PS5**: press Create and save a recent gameplay video. Turn on auto-upload in the PS App, then download it from Game Captures.
- **Xbox**: press Share and record what happened. Captures appear in the Xbox app; save them to your camera roll.
- **PC**: record with ShadowPlay or OBS, then AirDrop the file or move it through iCloud or Google Drive.

Use your own gameplay. Re-uploading other creators' videos gets Shorts claimed or removed.

## Put it on your phone

It's plain HTML/CSS/JS, so any static host works. With GitHub Pages:

1. On GitHub, go to **Settings → Pages** and deploy from your branch, `/ (root)` folder.
2. Open `https://<your-username>.github.io/hack-the-system/clip-heist/` for the website, or `.../clip-heist/app/` for the app.
3. Add it to your home screen: **iPhone (Safari)** Share → *Add to Home Screen*. **Android (Chrome)** ⋮ → *Install app*.

### Run locally

```bash
cd clip-heist
python3 -m http.server 8000   # website at /, app at /app/
```

## Notes and limits

- Exports record in real time: a 30-second short takes about 30 seconds. Close and reopen a short from the *Shorts* tab to keep editing it, then export again. Keep the app open and the screen on (it tries to keep the screen awake).
- Sound analysis has to load the whole file into memory, so it's skipped for files over ~250 MB on iPhone (~700 MB elsewhere), and highlights then come from the picture only. If a scan crashes the page, the app retries without sound, and gives up after 3 tries. Shorter recordings (under ~20 minutes) scan fastest.
- Videos are stored in the browser's storage on the device. Delete old gameplay in the app to free space. Clearing website data deletes everything.
- Not affiliated with Rockstar Games or YouTube.
