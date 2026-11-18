// Export channel art from brand.html.  usage: node brand/render-brand.js ['{"tagline":"..."}']
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const out = path.join(__dirname, '..', 'out', 'brand'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2700, height: 4200 } });
  await p.goto('file://' + path.join(__dirname, 'brand.html') + '?brand=' + encodeURIComponent(process.argv[2] || '{}'));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const shot = async (sel, file, transparent) => { if (transparent) await p.evaluate(() => document.body.style.background = 'transparent'); await (await p.$(sel)).screenshot({ path: path.join(out, file), omitBackground: !!transparent }); };
  await shot('#avatar', 'youtube-profile-800.png'); await shot('#banner', 'youtube-banner-2560x1440.png'); await shot('#logo', 'logo-wide.png');
  await p.evaluate(() => document.getElementById('guide').style.display = 'block'); await shot('#banner', 'banner-safe-area-check.png');
  await shot('#watermark', 'youtube-watermark-150.png', true); await shot('#stamp', 'stamp-seal.png', true);
  await b.close(); console.log('wrote', fs.readdirSync(out).join(', '));
})();
