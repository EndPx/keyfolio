import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.KEYFOLIO_LANDING_URL ?? 'http://localhost:3100/';
const out = 'docs/evidence/KF-08/landing-separation';
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
  }));
  const cta = await page.getByRole('button', { name: /Open the demo|Demo opened|Wallet unavailable|Connect NEAR wallet/ }).count();
  const scenario = await page.getByText('Choose trader').count();
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
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
