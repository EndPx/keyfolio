import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const out = 'docs/evidence/KF-08';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [name, width, height, reduced] of [['landing-1440',1440,900,false],['landing-390',390,844,false],['landing-390-reduced',390,844,true]]) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const cta = await page.getByRole('button', { name: /Preview wallet|Preview connected/ }).count();
  console.log(name, JSON.stringify({ overflow, cta }));
  await page.close();
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/marketplace', { waitUntil: 'networkidle' });
console.log('marketplace', await page.getByRole('heading', { name: 'Marketplace' }).count(), await page.url());
await page.screenshot({ path: `${out}/marketplace-1440.png`, fullPage: true });
await browser.close();
