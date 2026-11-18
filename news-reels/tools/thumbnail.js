// YouTube thumbnail (1280x720). usage: node tools/thumbnail.js image.jpg out.png '{"k":"26 APRIL 1986","big":"1:23 AM","sub":"The test that destroyed Chernobyl","pos":"50% 40%"}'
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [, , img, out, json] = process.argv; const q = JSON.parse(json);
q.img = 'data:image/jpeg;base64,' + fs.readFileSync(img).toString('base64');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('file://' + path.resolve(__dirname, '..', 'thumb.html') + '#' + encodeURIComponent(JSON.stringify(q)));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200); await p.screenshot({ path: out }); await b.close(); console.log('wrote', out); })();
