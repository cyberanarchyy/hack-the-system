// Render a story JSON into a 1080x1920 TikTok-ready MP4.
// usage: node render.js stories/<file>.json [out.mp4]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const FPS = 30;
const storyPath = process.argv[2];
if (!storyPath) { console.error('usage: node render.js story.json [out.mp4]'); process.exit(1); }
const name = path.basename(storyPath, '.json');
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
const raw = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
const hasVO = raw.scenes.some(s => s.say) && !process.env.NO_VOICE;
const timedPath = path.join(outDir, name + '.timed.json');
const vo = path.join(outDir, name + '.vo.wav');
if (hasVO) execFileSync('python3', [path.join(__dirname, 'voice.py'), storyPath, outDir], { stdio: 'inherit' });
const story = hasVO ? JSON.parse(fs.readFileSync(timedPath, 'utf8')) : raw;
// resolve photos relative to the story's asset folder; pull credits from <img>.credit.txt
const assetDir = path.resolve(__dirname, raw.assets || '.');
const creditOf = f => { try { return fs.readFileSync(path.join(assetDir, f) + '.credit.txt', 'utf8').split('\n')[0].replace(/ \/ Wikimedia Commons$/, ''); } catch { return ''; } };
const shortCredit = c => c.replace(/^(.*?)( \/ .*)$/, (m, a, b) => a.split(/[,(]/)[0].trim() + b);
for (const sc of story.scenes) {
  const used = [sc.img, sc.bg, ...(sc.people || []).map(p => p.img)].filter(Boolean);
  if (sc.credit === undefined && used.length) sc.credit = [...new Set(used.map(f => shortCredit(creditOf(f))))].filter(Boolean).join(' · ');
  const abs = f => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(assetDir, f)).toString('base64');
  if (sc.img) sc.img = abs(sc.img);
  if (sc.bg) sc.bg = abs(sc.bg);
  for (const p of sc.people || []) p.img = abs(p.img);
}
const outMp4 = process.argv[3] || path.join(outDir, name + '.mp4');
const wav = path.join(outDir, name + '.wav');

(async () => {
  execFileSync('python3', [path.join(__dirname, 'music.py'), hasVO ? timedPath : storyPath, wav], { stdio: 'inherit' });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  await page.goto('file://' + path.join(__dirname, story.template || 'reel.html'));
  await page.evaluate(() => document.fonts.ready);
  const total = await page.evaluate(s => init(s), story);
  const frames = Math.round(total * FPS);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav, ...(hasVO ? ['-i', vo, '-filter_complex',
      // duck the music under the voice, then mix
      '[2:a]aresample=44100,asplit=2[v1][v2];[1:a]volume=0.55[m];[m][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[md];[md][v2]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]',
      '-map', '0:v', '-map', '[a]'] : ['-map', '0:v', '-map', '1:a']),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outMp4],
    { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let f = 0; f < frames; f++) {
    const url = await page.evaluate(t => frame(t, 0.92), f / FPS);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 900 === 0) process.stdout.write(`frame ${f}/${frames}\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();

  // small copy for phone download / upload: smooth the film grain (it bloats files), CRF 26
  const share = outMp4.replace(/\.mp4$/, '-share.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', outMp4, '-vf', 'hqdn3d=4:3:6:4', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', share]);
  console.log('share copy:', share, (fs.statSync(share).size / 1048576).toFixed(1) + ' MB');
  // thumbnail + caption file alongside the video
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(story.thumbAt || 2.5), '-i', outMp4, '-frames:v', '1', outMp4.replace(/\.mp4$/, '.jpg')]);
  fs.writeFileSync(outMp4.replace(/\.mp4$/, '.caption.txt'),
    story.caption + '\n\nSources:\n' + (story.sources || []).join('\n') + '\n');
  console.log('done:', outMp4);
})();
