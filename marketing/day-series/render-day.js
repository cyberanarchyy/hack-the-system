// Usage: node render-day.js <html> <bg.mp4> <out-silent.mp4> '<json params>'
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const [html, bg, out, params] = process.argv.slice(2);
const DUR = 18, FPS = 30;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + html + '#' + encodeURIComponent(params || '{}'));
  await p.waitForTimeout(800);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-i', bg, '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-filter_complex', '[0:v]scale=1080:1920,setsar=1[b];[b][1:v]overlay=0:0:shortest=1[v]', '-map', '[v]', '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-t', String(DUR), out]);
  for (let i = 0; i < DUR * FPS; i++) {
    await p.evaluate((t) => window.renderFrame(t), i / FPS);
    const buf = await p.screenshot({ type: 'png', omitBackground: true });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
  console.log('rendered', out);
})().catch((e) => { console.error(e); process.exit(1); });
