# "Day N of using Clip Heist" series

Template for the daily challenge reels (1080×1920, 18s).

1. **Background:** a 2×2 collage of clips (`bg.mp4`, built with ffmpeg `xstack` from footage you have the rights to use).
2. **Overlay:** `day.html` takes its numbers from the URL hash:
   `{"day":2,"followers":120,"views":15400,"earned":0,"goal":10000,"handle":"@clipheist"}`
3. **Render:** `node render-day.js $PWD/day.html bg.mp4 out-silent.mp4 '<json>'`
4. **Voice:** `python vo2.py bm_george vo.wav dayN-lines.json 18 en-gb` (Kokoro TTS; each line is `[start, maxSeconds, text]`)
5. **Music + mix:** `python mix2.py vo.wav mix.wav 18 '[[time, gain], ...]'`, then mux with ffmpeg (`loudnorm=I=-14`).
