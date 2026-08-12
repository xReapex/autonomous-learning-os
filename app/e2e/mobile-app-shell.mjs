import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dataDir = mkdtempSync(join(tmpdir(), 'learning-os-mobile-shell-'));
let server;
let browser;
let output = '';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    const modulePath = process.env.PLAYWRIGHT_MODULE;
    if (modulePath) return import(pathToFileURL(modulePath).href);
    throw new Error(`playwright_missing:${error instanceof Error ? error.message : String(error)}`);
  }
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') return reject(new Error('port_missing'));
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}
async function waitFor(url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server_not_ready\n${output}`);
}
function assert(condition, message) { if (!condition) throw new Error(message); }

async function run() {
  const { chromium } = await loadPlaywright();
  const port = await reservePort();
  const baseURL = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(), env: { ...process.env, LEARNING_DATA_DIR: dataDir, STORAGE_DRIVER: 'file' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { output += String(chunk); });
  server.stderr.on('data', chunk => { output += String(chunk); });
  await waitFor(baseURL);
  browser = await chromium.launch({ headless: true });

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await mobile.newPage();
  await page.route(/youtube(?:-nocookie)?\.com/, route => route.abort());
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  assert(await page.locator('.bx-app-header').isVisible().catch(() => false), 'mobile_app_header_missing');
  assert(await page.locator('.bx-mobile-nav').isVisible().catch(() => false), 'mobile_tab_bar_missing');
  assert(!(await page.locator('.bx-sidebar').isVisible().catch(() => false)), 'desktop_sidebar_visible_on_mobile');
  const mobileMetrics = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    navTargets: [...document.querySelectorAll('.bx-mobile-nav a')].map(el => {
      const r = el.getBoundingClientRect(); return { width: r.width, height: r.height };
    }),
    cardTitles: [...document.querySelectorAll('.bx-card-head h2')].map(el => el.textContent?.trim()),
  }));
  assert(mobileMetrics.scrollWidth <= mobileMetrics.width, `mobile_horizontal_overflow:${JSON.stringify(mobileMetrics)}`);
  assert(mobileMetrics.navTargets.length === 5, `mobile_nav_count:${mobileMetrics.navTargets.length}`);
  assert(mobileMetrics.navTargets.every(item => item.width >= 44 && item.height >= 52), `mobile_nav_targets_too_small:${JSON.stringify(mobileMetrics.navTargets)}`);
  assert(!mobileMetrics.cardTitles.some(title => title === 'Objectif' || title === 'Le rythme'), `secondary_dashboard_cards_still_present:${JSON.stringify(mobileMetrics.cardTitles)}`);
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.route(/youtube(?:-nocookie)?\.com/, route => route.abort());
  await desktopPage.goto(baseURL, { waitUntil: 'networkidle' });
  assert(await desktopPage.locator('.bx-sidebar').isVisible().catch(() => false), 'desktop_sidebar_missing');
  assert(!(await desktopPage.locator('.bx-mobile-nav').isVisible().catch(() => false)), 'mobile_tab_bar_visible_on_desktop');
  const desktopOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert(!desktopOverflow, 'desktop_horizontal_overflow');
  await desktop.close();
  console.log('GREEN mobile-app shell and desktop shell satisfy the responsive contract');
}

try { await run(); }
catch (error) { console.error(`RED ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
finally {
  await browser?.close().catch(() => undefined);
  if (server && !server.killed) { server.kill('SIGTERM'); await new Promise(resolve => { server.once('exit', resolve); setTimeout(resolve, 5000); }); }
  rmSync(dataDir, { recursive: true, force: true });
}
