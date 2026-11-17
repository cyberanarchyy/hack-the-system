# News Reels

Animated 1080x1920 TikTok/Reels/Shorts videos made from a short story script.

```
node render.js stories/2026-11-17-suneung-ai-glasses.json
```

Writes `out/<name>.mp4` (30 fps, H.264, about 32 s), a `.jpg` cover, and a `.caption.txt` with the post caption, hashtags and sources.

## Making a new reel
Copy a file in `stories/` and edit it. Scene types:

| type   | fields                                   | what it shows                        |
|--------|------------------------------------------|--------------------------------------|
| hook   | icon, kicker, text                       | big animated icon + headline          |
| big    | icon, kicker, big, text                  | one huge fact (date, number) + detail |
| list   | title, items[], mark (`x` or `check`)    | items pop in one by one               |
| stamp  | title, stamp, text                       | slammed "stamp" moment                |
| cta    | text, sub, follow                        | question + comment prompt             |

Wrap words in `*stars*` to highlight them. Icons: `glasses`, `calendar`, `alert`.
The music is a synth beat (`music.py`) generated from scratch, so it's royalty-free, with a whoosh on every cut.
For a voice, use TikTok's built-in text-to-speech on the on-screen text, or record a voiceover.

## Voiceover
Add a `"say"` line to each scene, plus optional `"voice"` and `"speed"` at the top of the story.
Each scene is stretched to fit its line, and the music ducks under the voice. Audio is normalized to about -14 LUFS.
Voices come from Kokoro TTS, which runs offline. One-time setup:

```
pip install kokoro-onnx soundfile
mkdir -p models && cd models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.fp16.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

Good voices: `af_heart`, `af_bella`, `am_michael`, `am_puck`. Spell tricky words phonetically in `say` (e.g. "Soo-nung").
Set `NO_VOICE=1` to render without narration.
