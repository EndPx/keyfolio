import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.KEYFOLIO_LANDING_URL ?? 'http://localhost:3100/';
const out = 'docs/evidence/KF-08/landing-cleanup';
await mkdir(out, { recursive: true });
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath });
const observations = [];

async function probeJourney(page) {
  const positions = await page.evaluate(() => {
    const section = document.querySelector('#journey');
    if (!section) throw new Error('journey section missing');
    const top = section.getBoundingClientRect().top + scrollY;
    return Array.from({ length: 5 }, (_, index) => Math.round(top + section.offsetHeight * ((index + 0.5) / 5) - innerHeight * 0.5));
  });
  const states = [];
  for (const target of positions) {
    await page.evaluate((value) => window.scrollTo({ top: value, behavior: 'auto' }), target);
    await page.waitForTimeout(160);
    states.push(await page.evaluate(() => {
      const visible = (selector) => { const node = document.querySelector(selector); if (!node) return false; const r = node.getBoundingClientRect(); return r.width > 40 && r.height > 30 && r.bottom > 0 && r.top < innerHeight; };
      return { step: Number(document.querySelector('.landing')?.getAttribute('data-step') ?? -1), state: document.querySelector('.scene-stage')?.getAttribute('data-scene-state') ?? null, card: document.querySelector('.scene-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? '', stageVisible: visible('.scene-stage'), artVisible: visible('.scene-art'), relationshipVisible: visible('.scene-connection'), cardVisible: visible('.scene-card') };
    }));
  }
  return states;
}

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
    heroImage: Boolean(document.querySelector('.hero-stage .hero-art')),
    relationshipMap: Boolean(document.querySelector('.hero-stage .relationship-map')),
    bannedCopy: Array.from(document.querySelectorAll('.landing-hero *:not(.sr-only)')).some((node) => node.children.length === 0 && /Demo mode is (simulated|open)\./.test(node.textContent ?? '')),
    visibleStatus: (() => { const node = document.querySelector('[role="status"]'); if (!node) return false; const style = getComputedStyle(node); return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 1; })(),
  }));
  const states = await probeJourney(page);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  if (result.bannedCopy || result.visibleStatus || !result.heroImage || !result.relationshipMap || states.some((state) => !state.stageVisible || !state.artVisible || !state.relationshipVisible || !state.cardVisible)) throw new Error(`landing evidence failed for ${name}: ${JSON.stringify({ result, states })}`);
  observations.push({ name, ...result, states });
  console.log(name, JSON.stringify({ ...result, states }));
  await page.close();
}

for (const width of [375, 390, 768, 1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`responsive-${width}`, JSON.stringify({ overflow }));
  if (overflow) throw new Error(`horizontal overflow at ${width}`);
  await page.close();
}
await browser.close();
