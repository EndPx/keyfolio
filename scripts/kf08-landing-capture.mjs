import { chromium } from 'playwright';
import { mkdir, rename, copyFile } from 'node:fs/promises';

const url = process.env.KEYFOLIO_LANDING_URL ?? 'http://localhost:3100/';
const out = '.deploy-local/motion-audit-cleanup';
const evidenceOut = 'docs/evidence/KF-08/landing-cleanup';
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
await mkdir(out, { recursive: true });
await mkdir(evidenceOut, { recursive: true });

async function journeyPositions(page) {
  return page.evaluate(() => {
    const section = document.querySelector('#journey');
    if (!section) throw new Error('journey section missing');
    const top = section.getBoundingClientRect().top + scrollY;
    const height = section.offsetHeight;
    return Array.from({ length: 5 }, (_, index) => Math.round(top + height * ((index + 0.5) / 5) - innerHeight * 0.5));
  });
}

async function stateProbe(page) {
  return page.evaluate(() => ({
    step: Number(document.querySelector('.landing')?.getAttribute('data-step') ?? -1),
    state: document.querySelector('.scene-stage')?.getAttribute('data-scene-state') ?? null,
    card: document.querySelector('.scene-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    stageVisible: (() => { const el = document.querySelector('.scene-stage'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 100 && r.height > 100 && r.bottom > 0 && r.top < innerHeight; })(),
    artVisible: (() => { const el = document.querySelector('.scene-art'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < innerHeight; })(),
    cardVisible: (() => { const el = document.querySelector('.scene-card'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 100 && r.height > 40 && r.bottom > 0 && r.top < innerHeight; })(),
  }));
}

async function captureVideo(reducedMotion, filename) {
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference', recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const positions = await journeyPositions(page);
  const probes = [];
  const scrollTargets = [0, ...positions, await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)];
  for (const target of scrollTargets) {
    await page.evaluate((value) => window.scrollTo({ top: value, behavior: 'auto' }), target);
    await page.waitForTimeout(1450);
    probes.push({ target, ...(await stateProbe(page)) });
  }
  const video = page.video();
  await context.close();
  await browser.close();
  const raw = await video?.path();
  if (!raw) throw new Error('video path missing');
  await rename(raw, `${out}/${filename}`);
  return { filename, reducedMotion, probes, durationMs: 700 + scrollTargets.length * 1450 };
}

async function capturePngs(reducedMotion) {
  const browser = await chromium.launch({ headless: true, executablePath });
  for (const [name, width, height] of reducedMotion ? [['landing-390-reduced', 390, 844]] : [['landing-1440', 1440, 900], ['landing-390', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${evidenceOut}/${name}.png`, fullPage: true });
    await page.close();
  }
  await browser.close();
}

const reduced = process.env.ONLY_REDUCED === '1';
const result = reduced
  ? await captureVideo(true, 'landing-reduced.webm')
  : await captureVideo(false, 'landing-normal.webm');
await capturePngs(reduced);
console.log(JSON.stringify(result, null, 2));
