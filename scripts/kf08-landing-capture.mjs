import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.KEYFOLIO_LANDING_URL ?? 'http://localhost:3100/';
const out = '.deploy-local/motion-audit-cleanup';
await mkdir(out, { recursive: true });
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function capture(name, reducedMotion) {
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference', recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(650);
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const fraction of [0, 0.18, 0.38, 0.58, 0.78, 1]) {
    await page.evaluate((value) => window.scrollTo({ top: value, behavior: 'auto' }), Math.round(maxScroll * fraction));
    await page.waitForTimeout(2100);
  }
  await page.screenshot({ path: `${out}/${name}-final.png`, fullPage: true });
  const video = page.video();
  await context.close();
  await browser.close();
  const path = await video?.path();
  console.log(JSON.stringify({ name, reducedMotion, path, durationMs: 650 + 6 * 2100 }));
}

if (process.env.ONLY_REDUCED === '1') await capture('keyfolio-landing-cleanup-reduced', true);
else await capture('keyfolio-landing-cleanup', false);
