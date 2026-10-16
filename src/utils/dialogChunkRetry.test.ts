import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const viteBin = path.resolve('node_modules/vite/bin/vite.js');

const PORT = 41741;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function chromeExecutable(): string {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/local/bin/google-chrome',
  ].filter((value): value is string => Boolean(value));
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Chrome not found. Set CHROME_PATH. Looked in ${candidates.join(', ')}`);
  }
  return found;
}

describe('dialog chunk retry', () => {
  let vite: ChildProcess | undefined;
  let viteLogs = '';
  let browser: Browser | undefined;

  before(async () => {
    vite = spawn(process.execPath, [viteBin, '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' },
    });
    vite.stdout?.on('data', (chunk: Buffer) => {
      viteLogs += chunk.toString();
    });
    vite.stderr?.on('data', (chunk: Buffer) => {
      viteLogs += chunk.toString();
    });
    await waitForHttp(ORIGIN, vite, () => viteLogs);

    browser = await puppeteer.launch({
      executablePath: chromeExecutable(),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-features=Translate,ServiceWorker',
      ],
    });
  });

  after(async () => {
    await browser?.close();
    if (vite && vite.exitCode === null) {
      vite.kill('SIGTERM');
      await new Promise((resolve) => vite?.once('exit', resolve));
    }
  });

  it('recovers a blocked dialog chunk when Try again is clicked', { timeout: 60_000 }, async () => {
    const session = await openApp();
    try {
      await openCourseDialog(session.page);
      await waitForLoadError(session.page);
      assert.ok(session.blockedUrls.length > 0, 'the course dialog chunk was never requested');
      assert.equal(await session.page.$('#course-modal-title'), null);

      await session.setBlockCourse(false);
      await clickButton(session.page, 'Try again');
      await waitForCourseModal(session.page);
      assert.equal(await session.page.$('#dialog-load-error-title'), null);
    } finally {
      await session.page.close();
    }
  });

  it('retries a blocked dialog chunk when the dialog is opened again', { timeout: 60_000 }, async () => {
    const session = await openApp();
    try {
      await openCourseDialog(session.page);
      await waitForLoadError(session.page);

      await clickButton(session.page, 'Close');
      await session.page.waitForSelector('#dialog-load-error-title', { hidden: true, timeout: 10_000 });

      await session.setBlockCourse(false);
      await openCourseDialog(session.page);
      await waitForCourseModal(session.page);
      assert.equal(await session.page.$('#dialog-load-error-title'), null);
    } finally {
      await session.page.close();
    }
  });

  async function openApp(): Promise<{
    page: Page;
    blockedUrls: string[];
    setBlockCourse: (blocked: boolean) => Promise<void>;
  }> {
    if (!browser) throw new Error('browser was not launched');
    const page = await browser.newPage();
    const blockedUrls: string[] = [];
    const consoleNotes: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('CourseModal') || text.includes('dialog-retry') || message.type() === 'error') {
        consoleNotes.push(`${message.type()}: ${text}`);
      }
    });
    page.on('pageerror', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      consoleNotes.push(`pageerror: ${message}`);
    });
    page.setDefaultTimeout(20_000);
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 800 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(() => {
      // An online chunk miss reloads the page. This failure should reach the dialog instead.
      try {
        sessionStorage.setItem('uniplan-preload-reload', String(Date.now()));
      } catch {
        // sessionStorage can be unavailable; the dialog boundary still has to catch the rejection.
      }
    });
    const client = await page.createCDPSession();
    await client.send('Network.enable');
    const urlsById = new Map<string, string>();
    client.on('Network.requestWillBeSent', (event) => {
      urlsById.set(event.requestId, event.request.url);
      if (event.request.url.includes('CourseModal')) consoleNotes.push(`request ${event.request.url}`);
    });
    client.on('Network.loadingFailed', (event) => {
      const url = urlsById.get(event.requestId) ?? '';
      if (url.includes('CourseModal')) {
        blockedUrls.push(`${url} ${event.errorText}`);
        consoleNotes.push(`failed ${event.errorText} ${url}`);
      }
    });
    client.on('Network.responseReceived', (event) => {
      const url = event.response?.url ?? '';
      if (url.includes('CourseModal')) consoleNotes.push(`response ${event.response.status} ${url}`);
    });
    await client.send('Network.setBlockedURLs', { urls: ['*CourseModal*'] });
    await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#btn-add-course');
    await page.waitForFunction(() => !document.getElementById('app-launch-splash'));
    const welcome = await page.waitForSelector('#btn-welcome-close', { timeout: 5_000 }).catch(() => null);
    if (welcome) await welcome.click();
    activeNotes = consoleNotes;
    return {
      page,
      blockedUrls,
      setBlockCourse(blocked: boolean) {
        return client.send('Network.setBlockedURLs', { urls: blocked ? ['*CourseModal*'] : [] });
      },
    };
  }
});

let activeNotes: string[] = [];

async function openCourseDialog(page: Page): Promise<void> {
  await dismissViteOverlay(page);
  await page.click('#btn-add-course');
}

async function clickButton(page: Page, label: string): Promise<void> {
  await dismissViteOverlay(page);
  const clicked = await page.evaluate((name) => {
    const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.trim() === name);
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  }, label);
  assert.equal(clicked, true, `did not find a "${label}" button`);
}

async function waitForLoadError(page: Page): Promise<void> {
  try {
    await page.waitForSelector('#dialog-load-error-title', { timeout: 15_000 });
  } catch (error) {
    throw new Error(`dialog load error did not appear (${await debugState(page)})\n${activeNotes.join('\n')}`, { cause: error });
  }
  const text = await page.$eval('#dialog-load-error-title', (element) => element.textContent?.trim());
  assert.equal(text, "Couldn't open this dialog");
}

async function waitForCourseModal(page: Page): Promise<void> {
  try {
    await page.waitForSelector('#course-modal-title', { timeout: 20_000 });
  } catch (error) {
    throw new Error(`course dialog did not recover (${await debugState(page)})\n${activeNotes.join('\n')}`, { cause: error });
  }
  const text = await page.$eval('#course-modal-title', (element) => element.textContent?.trim());
  assert.equal(text, 'Add course');
}

async function dismissViteOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('vite-error-overlay').forEach((node) => node.remove());
  });
}

async function debugState(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify({
      href: location.href,
      loadError: document.getElementById('dialog-load-error-title')?.textContent?.trim() ?? null,
      course: document.getElementById('course-modal-title')?.textContent?.trim() ?? null,
      overlay: Boolean(document.querySelector('vite-error-overlay')),
    }),
  );
}

async function waitForHttp(url: string, child: ChildProcess, logs: () => string): Promise<void> {
  const deadline = Date.now() + 40_000;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`vite exited ${child.exitCode}\n${logs()}`);
    }
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`vite did not start (${lastError})\n${logs()}`);
}
