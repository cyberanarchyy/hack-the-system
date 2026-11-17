// Render a story JSON into a 1080x1920 TikTok-ready MP4.
// usage: node render.js stories/<file>.json [out.mp4]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const FPS = 30;
const storyPath = process.argv[2];
if (!storyPath) { console.error('usage: node render.js story.json [out.mp4]'); process.exit(1); }
const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
const name = path.basename(storyPath, '.json');
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
const outMp4 = process.argv[3] || path.join(outDir, name + '.mp4');
const wav = path.join(outDir, name + '.wav');

(async () => {
  execFileSync('python3', [path.join(__dirname, 'music.py'), storyPath, wav], { stdio: 'inherit' });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  await page.goto('file://' + path.join(__dirname, 'reel.html'));
  await page.evaluate(() => document.fonts.ready);
  const total = await page.evaluate(s => init(s), story);
  const frames = Math.round(total * FPS);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav, '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outMp4],
    { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let f = 0; f < frames; f++) {
    const url = await page.evaluate(t => frame(t, 0.93), f / FPS);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) process.stdout.write(`frame ${f}/${frames}\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();

  // thumbnail + caption file alongside the video
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2.5', '-i', outMp4, '-frames:v', '1', outMp4.replace(/\.mp4$/, '.jpg')]);
  fs.writeFileSync(outMp4.replace(/\.mp4$/, '.caption.txt'),
    story.caption + '\n\nSources:\n' + (story.sources || []).join('\n') + '\n');
  console.log('done:', outMp4);
})();
