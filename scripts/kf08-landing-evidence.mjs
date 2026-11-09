import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.KEYFOLIO_LANDING_URL ?? 'http://localhost:3100/';
const out = 'docs/evidence/KF-08/landing-cleanup';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });

for (const [name, width, height, reduced] of [
  ['landing-1440', 1440, 900, false],
  ['landing-390', 390, 844, false],
  ['landing-390-reduced', 390, 844, true],
]) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    marketingNav: Boolean(document.querySelector('.landing-nav')),
    appShell: Boolean(document.querySelector('.sidebar, .banner')),
    heroScenario: document.querySelectorAll('.hero-scenario').length,
    heroImage: Boolean(document.querySelector('.hero-stage .hero-art')),
    bannedCopy: Array.from(document.querySelectorAll('.landing-hero *:not(.sr-only)')).some((node) => node.children.length === 0 && /Demo mode is (simulated|open)\./.test(node.textContent ?? '')),
    visibleStatus: (() => {
      const node = document.querySelector('[role="status"]');
      if (!node) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.clip !== 'rect(0px, 0px, 0px, 0px)' && node.getBoundingClientRect().width > 1;
    })(),
  }));
  const cta = await page.getByRole('button', { name: /Open the demo|Demo opened|Wallet unavailable|Connect NEAR wallet/ }).count();
  const scenario = await page.locator('.hero-scenario span').count();
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const fraction of [0, 0.35, 0.7, 1]) {
    await page.evaluate((value) => window.scrollTo({ top: value, behavior: 'auto' }), Math.round(maxScroll * fraction));
    await page.waitForTimeout(180);
  }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  if (result.heroScenario !== 0 || scenario !== 0 || result.bannedCopy || result.visibleStatus || !result.heroImage) throw new Error('hero cleanup failed for ' + name + ': ' + JSON.stringify({ ...result, cta, scenario, reduced }));
  console.log(name, JSON.stringify({ ...result, cta, scenario, reduced }));
  await page.close();
}

for (const width of [375, 390, 768, 1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`responsive-${width}`, JSON.stringify({ overflow }));
  await page.close();
}
await browser.close();
