const { chromium } = require('playwright');
const { prepare } = require('./preview');

(async () => {
  const base = process.argv[2] || 'http://localhost:8099';
  const browser = await chromium.launch();
  const pages = ['index.html','course.html','work.html','faq.html'];
  const sizes = [{w:1440,h:900,tag:'desktop'},{w:834,h:1000,tag:'tablet'},{w:390,h:844,tag:'mobile'}];
  let bad = 0;

  for (const p of pages) {
    for (const s of sizes) {
      const ctx = await prepare(await browser.newContext({ viewport:{width:s.w,height:s.h}, deviceScaleFactor:1 }));
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', m => { if (m.type()==='error' && !/ERR_TUNNEL|fonts.g/.test(m.text())) errs.push(m.text()); });
      page.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
      await page.goto(`${base}/${p}`, { waitUntil:'networkidle' });
      await page.waitForTimeout(2600);
      // scroll through the whole page to trigger every reveal / scroll system
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (errs.length || overflow > 1) {
        bad++;
        console.log(`✗ ${p} @${s.tag}  overflowX=${overflow}`);
        errs.slice(0,6).forEach(e => console.log('    ', e.slice(0,220)));
      } else {
        console.log(`✓ ${p} @${s.tag}`);
      }
      if (s.tag === 'desktop') await page.screenshot({ path:`/home/claude/km-dev-course/build/shot-${p.replace('.html','')}.png`, fullPage:false });
      await ctx.close();
    }
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
