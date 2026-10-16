import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const viteBin = path.resolve('node_modules/vite/bin/vite.js');

const DEV_PORT = 41741;
const PREVIEW_PORT = 41742;
const DEV_ORIGIN = `http://127.0.0.1:${DEV_PORT}`;
const PREVIEW_ORIGIN = `http://127.0.0.1:${PREVIEW_PORT}`;

function findChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/local/bin/google-chrome',
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => existsSync(candidate));
}

const chromePath = findChrome();

describe('dialog chunk retry', { skip: chromePath ? false : 'Chrome is not installed', concurrency: false }, () => {
  describe('dev server', () => {
    let vite: ChildProcess | undefined;
    let viteLogs = '';
    let browser: Browser | undefined;

    before(async () => {
      vite = spawnVite(['--port', String(DEV_PORT), '--host', '127.0.0.1', '--strictPort']);
      vite.stdout?.on('data', (chunk: Buffer) => {
        viteLogs += chunk.toString();
      });
      vite.stderr?.on('data', (chunk: Buffer) => {
        viteLogs += chunk.toString();
      });
      await waitForHttp(DEV_ORIGIN, vite, () => viteLogs);

      browser = await puppeteer.launch({
        executablePath: chromePath,
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
      await stopChild(vite);
    });

    it('recovers a blocked dialog chunk when Try again is clicked', { timeout: 60_000 }, async () => {
      const session = await openBlockedApp(browser, DEV_ORIGIN);
      try {
        await openCourseDialog(session.page);
        await waitForLoadError(session.page);
        assert.ok(session.blockedUrls.length > 0, 'the course dialog chunk was never requested');
        assert.equal(await session.page.$('#course-modal-title'), null);

        await session.setBlockCourse(false);
        await clickButton(session.page, 'Try again');
        await waitForCourseModal(session.page);
        assert.equal(await session.page.$('#dialog-load-error-title'), null);
        await assertNoLeakedImportRejections(session.page);
      } finally {
        await session.page.close();
      }
    });

    it('retries a blocked dialog chunk when the dialog is opened again', { timeout: 60_000 }, async () => {
      const session = await openBlockedApp(browser, DEV_ORIGIN);
      try {
        await openCourseDialog(session.page);
        await waitForLoadError(session.page);

        await clickButton(session.page, 'Close');
        await session.page.waitForSelector('#dialog-load-error-title', { hidden: true, timeout: 10_000 });

        await session.setBlockCourse(false);
        await openCourseDialog(session.page);
        await waitForCourseModal(session.page);
        assert.equal(await session.page.$('#dialog-load-error-title'), null);
        await assertNoLeakedImportRejections(session.page);
      } finally {
        await session.page.close();
      }
    });
  });

  describe('production preview', () => {
    let preview: ChildProcess | undefined;
    let previewLogs = '';
    let browser: Browser | undefined;

    before(async () => {
      const buildLogs = { text: '' };
      const build = spawnVite(['build']);
      build.stdout?.on('data', (chunk: Buffer) => {
        buildLogs.text += chunk.toString();
      });
      build.stderr?.on('data', (chunk: Buffer) => {
        buildLogs.text += chunk.toString();
      });
      const code = await new Promise<number>((resolve, reject) => {
        build.on('error', reject);
        build.on('exit', (exitCode) => resolve(exitCode ?? 1));
      });
      if (code !== 0) throw new Error(`vite build exited ${code}\n${buildLogs.text}`);

      const sw = readFileSync('dist/sw.js', 'utf8');
      assert.ok(sw.includes('/^utm_/'), 'precache still ignores utm_ params');
      assert.ok(sw.includes('/^fbclid$/'), 'precache still ignores fbclid');
      assert.ok(sw.includes('/^retry$/'), 'precache ignores the retry param');
      assert.ok(
        sw.includes('(?:xlsx|firebase|GoogleCalendarSync)-[^/]+\\.js(?:\\?.*)?$'),
        'deferred-js route matches a .js URL with a query',
      );
      assert.ok(sw.includes('searchParams.delete("retry")'), 'deferred-js cache key drops retry');

      preview = spawnVite(['preview', '--port', String(PREVIEW_PORT), '--host', '127.0.0.1', '--strictPort']);
      preview.stdout?.on('data', (chunk: Buffer) => {
        previewLogs += chunk.toString();
      });
      preview.stderr?.on('data', (chunk: Buffer) => {
        previewLogs += chunk.toString();
      });
      await waitForHttp(PREVIEW_ORIGIN, preview, () => previewLogs);

      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
    }, { timeout: 180_000 });

    after(async () => {
      await browser?.close();
      await stopChild(preview);
    });

    it('opens a dialog offline after its chunk failed once and was cached again', { timeout: 90_000 }, async () => {
      if (!browser) throw new Error('browser was not launched');
      const page = await browser.newPage();
      const notes: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.text().includes('CourseModal')) {
          notes.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        notes.push(`pageerror: ${message}`);
      });
      try {
        page.setDefaultTimeout(20_000);
        await page.setCacheEnabled(false);
        await page.setViewport({ width: 1280, height: 800 });
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.evaluateOnNewDocument(installRejectionCollector);
        // Keep the precached chunk out of Chrome's module map until the dialog asks for it.
        await page.evaluateOnNewDocument(() => {
          window.requestIdleCallback = () => 0;
        });
        const client = await page.createCDPSession();
        await client.send('Network.enable');
        await page.goto(PREVIEW_ORIGIN, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#btn-add-course');
        await page.waitForFunction(() => !document.getElementById('app-launch-splash'));
        const welcome = await page.waitForSelector('#btn-welcome-close', { timeout: 5_000 }).catch(() => null);
        if (welcome) await welcome.click();

        await page.waitForFunction(courseChunkIsPrecached, { timeout: 30_000 });
        const removed = await page.evaluate(removePrecachedCourseChunk);
        assert.match(removed, /CourseModal-/);
        await client.send('Network.clearBrowserCache');
        const leftover = await page.evaluate(precachedCourseChunkUrls);
        assert.deepEqual(leftover, [], `course chunk still precached: ${leftover.join(', ')}`);
        notes.push(`removed ${removed}`);

        await client.send('Network.setBlockedURLs', { urls: ['*CourseModal*'] });
        await page.setOfflineMode(true);
        await openCourseDialog(page);
        await waitForLoadError(page, notes);

        await page.evaluate(restorePrecachedCourseChunk);
        await client.send('Network.setBlockedURLs', { urls: [] });
        await clickButton(page, 'Try again');
        await waitForCourseModal(page, notes);
        assert.equal(await page.$('#dialog-load-error-title'), null);
        await assertNoLeakedImportRejections(page);
      } catch (error) {
        const state = await debugState(page).catch(() => 'unavailable');
        throw new Error(`${error instanceof Error ? error.message : String(error)}\n${state}\n${notes.join('\n')}`, {
          cause: error,
        });
      } finally {
        await page.setOfflineMode(false).catch(() => {});
        await page.close();
      }
    });
  });
});

function spawnVite(args: string[]): ChildProcess {
  return spawn(process.execPath, [viteBin, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
}

async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
}

let activeNotes: string[] = [];

async function openBlockedApp(browser: Browser | undefined, origin: string): Promise<{
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
    if (text.includes('CourseModal') || message.type() === 'error') {
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
  await page.evaluateOnNewDocument(installRejectionCollector);
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
  });
  client.on('Network.loadingFailed', (event) => {
    const url = urlsById.get(event.requestId) ?? '';
    if (url.includes('CourseModal')) blockedUrls.push(`${url} ${event.errorText}`);
  });
  await client.send('Network.setBlockedURLs', { urls: ['*CourseModal*'] });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
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

function installRejectionCollector(): void {
  const notes: { message: string; prevented: boolean }[] = [];
  (window as unknown as { __unhandled: typeof notes }).__unhandled = notes;
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? '');
    window.setTimeout(() => {
      notes.push({ message, prevented: event.defaultPrevented });
    }, 0);
  });
}

async function assertNoLeakedImportRejections(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => window.setTimeout(resolve, 50)));
  const leaked = await page.evaluate(() => {
    const notes = (window as unknown as { __unhandled?: { message: string; prevented: boolean }[] }).__unhandled ?? [];
    return notes.filter((item) => {
      if (item.prevented) return false;
      return (
        item.message.includes('retry=') ||
        item.message.includes('dynamically imported module') ||
        item.message.includes('Importing a module script failed')
      );
    });
  });
  assert.deepEqual(leaked, []);
}

async function courseChunkIsPrecached(): Promise<boolean> {
  if (!navigator.serviceWorker?.controller) return false;
  const names = await caches.keys();
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (request.url.includes('CourseModal-') && request.url.includes('.js')) return true;
    }
  }
  return false;
}

async function precachedCourseChunkUrls(): Promise<string[]> {
  const found: string[] = [];
  const names = await caches.keys();
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (request.url.includes('CourseModal-') && request.url.includes('.js')) found.push(request.url);
    }
  }
  return found;
}

async function removePrecachedCourseChunk(): Promise<string> {
  const names = await caches.keys();
  let removed = '';
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (!request.url.includes('CourseModal-') || !request.url.includes('.js')) continue;
      const response = await cache.match(request);
      if (!response) continue;
      if (!removed) {
        const saved = (window as unknown as {
          __courseChunk?: { name: string; request: Request; response: Response };
        });
        saved.__courseChunk = { name, request, response: response.clone() };
        removed = request.url;
      }
      const deleted = await cache.delete(request);
      if (!deleted) throw new Error(`could not remove ${request.url}`);
    }
  }
  if (!removed) throw new Error('course chunk was not precached');
  return removed;
}

async function restorePrecachedCourseChunk(): Promise<void> {
  const saved = (window as unknown as {
    __courseChunk?: { name: string; request: Request; response: Response };
  }).__courseChunk;
  if (!saved) throw new Error('missing stashed course chunk');
  const cache = await caches.open(saved.name);
  await cache.put(saved.request, saved.response);
}

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

async function waitForLoadError(page: Page, notes: string[] = activeNotes): Promise<void> {
  try {
    await page.waitForSelector('#dialog-load-error-title', { timeout: 15_000 });
  } catch (error) {
    throw new Error(`dialog load error did not appear (${await debugState(page)})\n${notes.join('\n')}`, { cause: error });
  }
  const text = await page.$eval('#dialog-load-error-title', (element) => element.textContent?.trim());
  assert.equal(text, "Couldn't open this dialog");
}

async function waitForCourseModal(page: Page, notes: string[] = activeNotes): Promise<void> {
  try {
    await page.waitForSelector('#course-modal-title', { timeout: 20_000 });
  } catch (error) {
    throw new Error(`course dialog did not recover (${await debugState(page)})\n${notes.join('\n')}`, { cause: error });
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
      online: navigator.onLine,
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
