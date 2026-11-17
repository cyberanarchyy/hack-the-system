// Export YouTube channel art from brand.html.
// usage: node brand/render-brand.js ['{"first":"DAILY","second":"DROP","tagline":"..."}']
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const out = path.join(__dirname, '..', 'out', 'brand'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2700, height: 2600 } });
  await p.goto('file://' + path.join(__dirname, 'brand.html') + '?brand=' + encodeURIComponent(process.argv[2] || '{}'));
  await p.evaluate(() => document.fonts.ready);
  await (await p.$('#avatar')).screenshot({ path: path.join(out, 'youtube-profile-800.png') });
  await (await p.$('#banner')).screenshot({ path: path.join(out, 'youtube-banner-2560x1440.png') });
  await p.evaluate(() => document.body.style.background = 'transparent');
  await (await p.$('#watermark')).screenshot({ path: path.join(out, 'youtube-watermark-150.png'), omitBackground: true });
  // preview with the safe-area guide visible
  await p.evaluate(() => document.getElementById('guide').style.display = 'block');
  await (await p.$('#banner')).screenshot({ path: path.join(out, 'banner-safe-area-check.png') });
  await b.close();
  console.log('wrote', fs.readdirSync(out).join(', '));
})();
