// Quick layout check without audio: one frame from the middle of each scene -> contact sheet.
// usage: node tools/preview.js stories/x.json out.png [fraction=0.6]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'); const { execFileSync } = require('child_process');
const [, , sp, outPng, frac = '0.6'] = process.argv;
const story = JSON.parse(fs.readFileSync(sp, 'utf8')); const dir = path.resolve(__dirname, '..', story.assets || '.');
for (const sc of story.scenes) for (const k of ['img', 'bg']) if (sc[k]) sc[k] = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, sc[k])).toString('base64');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, '..', story.template || 'reel.html')); await p.evaluate(() => document.fonts.ready);
  await p.evaluate(s => init(s), story);
  const tmp = fs.mkdtempSync('/tmp/claude-0/prev-'); let t = 0; const files = [];
  for (const [i, sc] of story.scenes.entries()) {
    const url = await p.evaluate(x => frame(x, .85), t + sc.dur * +frac); const f = path.join(tmp, `${String(i).padStart(2, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); files.push(f); t += sc.dur;
  }
  await b.close();
  const cols = 5, args = []; files.forEach(f => args.push('-i', f));
  const n = files.length, rows = Math.ceil(n / cols), layout = files.map((_, i) => `${(i % cols) * 384}_${Math.floor(i / cols) * 216}`).join('|');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args, '-filter_complex', files.map((_, i) => `[${i}]scale=384:216[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${n}:layout=${layout}:fill=black`, outPng]);
  console.log('preview', outPng, n, 'scenes');
})();
