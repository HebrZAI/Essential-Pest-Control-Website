// No real enquiries or Google events are sent: all external requests are mocked or blocked.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('playwright');
const base = process.env.QUOTE_TEST_URL || 'http://127.0.0.1:8765';
const root = join(__dirname, '..');
const consentKey = 'epc-consent-v1';
const receiptKey = 'epc-enquiry-receipt-v1';
const formAction = 'AW-16967723902/SPEICIfdrfQcEP7W65o_';
let browser;
before(async () => {
  browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { if (browser) await browser.close(); });
async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const requests = [], conversions = [], errors = [];
  await context.exposeBinding('recordTestConversion', (_, args) => conversions.push(args));
  await context.route('**/*', route => {
    const url = route.request().url();
    if (new URL(url).origin === new URL(base).origin) return route.continue();
    requests.push(url);
    if (url.startsWith('https://www.googletagmanager.com/gtag/js?')) return route.fulfill({ contentType: 'text/javascript', body: `
      function record(args) { if (args[0] === 'event' && args[1] === 'conversion') window.recordTestConversion(args[2]); }
      window.dataLayer.forEach(record);
      const originalPush = window.dataLayer.push.bind(window.dataLayer);
      window.dataLayer.push = function (...args) { args.forEach(record); return originalPush(...args); };
    ` });
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, requests, conversions, errors };
}
async function visit(page, path = '/') {
  await page.goto(base + path);
  await page.evaluate(() => document.fonts.ready);
}
async function choose(page, value) {
  if (!await page.locator('.consent-panel').isVisible()) await page.locator('.footer-privacy [data-cookie-settings]').click();
  await page.locator(`[data-consent="${value}"]`).click();
}
async function fill(page, commercial = false) {
  if (commercial) {
    await page.locator('#company').fill('Test business');
    await page.locator('#industry').selectOption('warehousing');
  } else {
    await page.locator('#sector').selectOption('residential');
    await page.locator('#pest-type-toggle').click();
    await page.locator('#pest-type-options input[value="ants"]').check();
    await page.locator('#pest-type-toggle').click();
  }
  await page.locator('.quote-next').click();
  await page.locator('#name').fill('Test enquiry');
  await page.locator('#phone').fill('082 000 0000');
  if (commercial) await page.locator('#email').fill('test@example.com');
  await page.locator('#message').fill('TEST ONLY: pest control in Pretoria.');
}
async function waitCount(array, count) {
  await assert.doesNotReject(async () => {
    for (let i = 0; i < 100 && array.length !== count; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(array.length, count);
  });
}

test('all 32 pages block Google before consent and after rejection and expose privacy controls', async () => {
  const { context, page, requests, errors } = await setup();
  const files = readdirSync(root).filter(f => f.endsWith('.html')).concat(
    ['areas', 'blog'].flatMap(dir => readdirSync(join(root, dir)).filter(f => f.endsWith('.html')).map(f => dir + '/' + f)));
  assert.equal(files.length, 32);
  try {
    for (const file of files) {
      await visit(page, '/' + file);
      assert.equal(await page.locator('.footer-privacy [data-cookie-settings]').count(), 1, file);
      assert.ok(await page.locator('.footer-privacy a').getAttribute('href').then(href => href.endsWith('privacy-policy')));
      if (await page.locator('#quoteForm').count()) assert.equal(await page.locator('#quoteForm .quote-privacy a').count(), 1);
      if (await page.locator('.consent-panel').isVisible()) await choose(page, 'reject');
      assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0, file);
    }
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('acceptance sets Consent Mode defaults first; preferences, withdrawal, cookies and saved rejection work', async () => {
  const { context, page, requests, conversions, errors } = await setup();
  try {
    await visit(page);
    assert.deepEqual(requests, []);
    await page.locator('[data-consent="preferences"]').click();
    assert.equal(await page.locator('#consent-advertising').isChecked(), false);
    assert.equal(await page.locator('#consent-advertising').evaluate(el => el === document.activeElement), true);
    await page.locator('#consent-advertising').check();
    await page.locator('[data-consent="save"]').click();
    await waitCount(requests, 1);
    const calls = await page.evaluate(() => window.dataLayer.map(args => Array.from(args)));
    assert.deepEqual(calls[0], ['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }]);
    assert.equal(calls[2][1], 'update');
    assert.equal(calls[2][2].ad_storage, 'granted');
    assert.equal(calls[2][2].ad_personalization, 'denied');
    assert.equal(calls[2][2].analytics_storage, 'denied');
    assert.equal(calls.filter(call => call[0] === 'config').length, 1);
    await page.evaluate(() => { document.cookie = '_gcl_aw=test; path=/'; });
    await page.locator('.footer-privacy [data-cookie-settings]').click();
    await page.locator('#consent-advertising').uncheck();
    await Promise.all([page.waitForEvent('load'), page.locator('[data-consent="save"]').click()]);
    assert.equal(await page.evaluate(() => document.cookie.includes('_gcl_aw')), false);
    assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
    await visit(page, '/areas/pretoria');
    assert.equal(await page.locator('.consent-panel').isVisible(), false);
    assert.equal(requests.length, 1, 'saved rejection blocks further Google loads');
    assert.deepEqual(conversions, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const commercial of [false, true]) test(`${commercial ? 'commercial' : 'general'} success counts once on thank-you only, with no replay`, async () => {
  const { context, page, conversions, errors } = await setup();
  let posts = 0, release;
  try {
    await page.route('https://formspree.io/**', async route => {
      posts++;
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await visit(page, commercial ? '/commercial' : '/');
    await choose(page, 'accept');
    await fill(page, commercial);
    await page.locator('[type="submit"]').evaluate(el => { el.click(); el.click(); });
    await page.waitForFunction(() => document.querySelector('#quoteForm').getAttribute('aria-busy') === 'true');
    while (!release) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(posts, 1);
    assert.deepEqual(conversions, [], 'no conversion in the form handler');
    release();
    await page.waitForURL(base + '/thank-you');
    await page.locator('[data-enquiry-confirmation]').waitFor({ state: 'visible' });
    await waitCount(conversions, 1);
    assert.equal(conversions[0].send_to, formAction);
    assert.match(conversions[0].transaction_id, /^[a-f0-9]{32}$/);
    assert.doesNotMatch(JSON.stringify(conversions[0]), /Test enquiry|082|test@example/);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), receiptKey), null);
    await page.reload();
    assert.equal(await page.locator('[data-enquiry-unconfirmed]').isVisible(), true);
    await page.goBack();
    await page.goForward();
    await visit(page, '/thank-you');
    const another = await context.newPage();
    await visit(another, '/thank-you');
    assert.equal(await another.locator('[data-enquiry-confirmation]').isVisible(), false);
    assert.equal(conversions.length, 1);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a successful enquiry works after rejection, and direct, expired, future or malformed receipts never count', async () => {
  const { context, page, conversions, requests } = await setup();
  try {
    await page.route('https://formspree.io/**', route => route.fulfill({ status: 200, body: '{}' }));
    await visit(page);
    await choose(page, 'reject');
    await fill(page);
    await page.locator('[type="submit"]').click();
    await page.waitForURL(base + '/thank-you');
    assert.equal(await page.locator('[data-enquiry-confirmation]').isVisible(), true);
    assert.deepEqual(requests, []);
    assert.deepEqual(conversions, []);
    await choose(page, 'accept');
    await waitCount(conversions, 1);
    for (const receipt of [null, {id: 'a'.repeat(32), createdAt: Date.now() - 1800001}, {id: 'a'.repeat(32), createdAt: Date.now() + 60000}, {id: 'bad', createdAt: Date.now()}, '{bad']) {
      await page.evaluate(({ key, receipt }) => sessionStorage.setItem(key, typeof receipt === 'string' ? receipt : JSON.stringify(receipt)), {key: receiptKey, receipt});
      await visit(page, '/thank-you');
      assert.equal(await page.locator('[data-enquiry-unconfirmed]').isVisible(), true);
      assert.equal(conversions.length, 1);
    }
  } finally { await context.close(); }
});

test('consent can be given on thank-you after submission; repeated consent updates do not replay', async () => {
  const { context, page, conversions } = await setup();
  try {
    await page.route('https://formspree.io/**', route => route.fulfill({ status: 200, body: '{}' }));
    await visit(page);
    await fill(page);
    await page.locator('[type="submit"]').click();
    await page.waitForURL(base + '/thank-you');
    assert.equal(conversions.length, 0);
    await choose(page, 'accept');
    await waitCount(conversions, 1);
    await choose(page, 'accept');
    assert.equal(conversions.length, 1);
  } finally { await context.close(); }
});

test('blocked storage leaves the successful inline fallback available without measurement', async () => {
  const { context, page, conversions, errors } = await setup();
  try {
    await context.addInitScript(() => {
      Storage.prototype.setItem = Storage.prototype.getItem = Storage.prototype.removeItem = () => { throw new Error('Storage blocked'); };
    });
    await page.route('https://formspree.io/**', route => route.fulfill({ status: 200, body: '{}' }));
    await visit(page);
    await choose(page, 'reject');
    await fill(page);
    await page.locator('[type="submit"]').click();
    await page.locator('#quoteSuccess').waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).pathname, '/');
    assert.deepEqual(conversions, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('contact clicks need consent and use their own actions', async () => {
  const { context, page, conversions } = await setup();
  try {
    await visit(page);
    // Prevent navigation at document level, after the tracker's listener.
    await page.evaluate(() => document.addEventListener('click', event => { if (event.target.closest('a[href^="tel:"], a[href*="wa.me"]')) event.preventDefault(); }));
    const fire = selector => page.locator(selector).first().evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    await fire('a[href*="wa.me"]');
    await fire('a[href^="tel:"]');
    assert.deepEqual(conversions, []);
    await choose(page, 'reject');
    await fire('a[href*="wa.me"]');
    await fire('a[href^="tel:"]');
    assert.deepEqual(conversions, []);
    await choose(page, 'accept');
    await fire('a[href*="wa.me"]');
    await waitCount(conversions, 1);
    assert.equal(conversions[0].send_to, 'AW-16967723902/tS-cCI3drfQcEP7W65o_');
    await fire('a[href^="tel:"]');
    await waitCount(conversions, 2);
    assert.equal(conversions[1].send_to, 'AW-16967723902/svwUCOKJ66YdEP7W65o_');
    assert.ok(conversions.every(event => event.send_to !== formAction));
  } finally { await context.close(); }
});

test('expired consent asks again; saved acceptance loads one tag on a new page', async () => {
  const { context, page, requests } = await setup();
  try {
    await visit(page);
    await choose(page, 'accept');
    await waitCount(requests, 1);
    await visit(page, '/privacy-policy');
    await waitCount(requests, 2);
    assert.equal(await page.locator('.consent-panel').isVisible(), false);
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify({advertising: true, savedAt: Date.now() - 181 * 86400000})), consentKey);
    await page.reload();
    assert.equal(await page.locator('.consent-panel').isVisible(), true);
    assert.equal(requests.length, 2);
  } finally { await context.close(); }
});

test('privacy address, robots, sitemap, keyboard and mobile/desktop layouts are correct', async () => {
  const { context, page } = await setup();
  try {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/privacy-policy', '/thank-you']) {
        await visit(page, path);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}`);
        await page.locator('[data-consent="preferences"]').click();
        await page.locator('#consent-advertising').press('Tab');
        assert.equal(await page.locator('[data-consent="accept"]').evaluate(el => el === document.activeElement), true);
        assert.ok(await page.locator('.consent-panel').evaluate(el => el.getBoundingClientRect().height <= innerHeight * .8 + 1));
        await choose(page, 'reject');
        await page.locator('.footer-privacy [data-cookie-settings]').click();
        await page.locator('#consent-advertising').press('Escape');
        assert.equal(await page.locator('.footer-privacy [data-cookie-settings]').evaluate(el => el === document.activeElement), true);
        await page.evaluate(key => localStorage.removeItem(key), consentKey);
      }
    }
    await visit(page, '/privacy-policy');
    assert.match(await page.locator('address').textContent(), /Box 24 Murrayfield,\s*Pretoria, 0184/);
    assert.match(await page.locator('main').textContent(), /info@essentialpestcontrol.co.za/);
    await visit(page, '/thank-you');
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
    const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
    assert.match(sitemap, /privacy-policy/);
    assert.doesNotMatch(sitemap, /thank-you/);
  } finally { await context.close(); }
});

test('every phone link on all 32 pages sends one dedicated conversion and preserves default behaviour', async () => {
  const { context, page, conversions, errors } = await setup();
  const files = readdirSync(root).filter(f => f.endsWith('.html')).concat(
    ['areas', 'blog'].flatMap(dir => readdirSync(join(root, dir)).filter(f => f.endsWith('.html')).map(f => dir + '/' + f)));
  try {
    await visit(page);
    await choose(page, 'accept');
    assert.equal(files.length, 32);
    let clicks = 0;
    for (const file of files) {
      await visit(page, '/' + file);
      await page.evaluate(() => {
        window.phoneDefaultsPrevented = [];
        // Observe normal behaviour after the tracker, then suppress the test's dialler navigation.
        document.addEventListener('click', event => {
          if (event.target.closest('a[href^="tel:"]')) {
            window.phoneDefaultsPrevented.push(event.defaultPrevented);
            event.preventDefault();
          }
        });
      });
      const links = page.locator('a[href^="tel:"]');
      const count = await links.count();
      assert.ok(count > 0, file);
      for (const link of await links.all()) {
        await link.evaluate(el => (el.firstElementChild || el).dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true})));
        await waitCount(conversions, ++clicks);
        assert.deepEqual(conversions[clicks - 1], { send_to: 'AW-16967723902/svwUCOKJ66YdEP7W65o_' }, file);
      }
      assert.deepEqual(await page.evaluate(() => window.phoneDefaultsPrevented), Array(count).fill(false), file);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('withdrawal in another tab unloads tracking in an already open page', async () => {
  const { context, page, requests } = await setup();
  try {
    await visit(page);
    await choose(page, 'accept');
    await waitCount(requests, 1);
    const other = await context.newPage();
    await visit(other, '/privacy-policy');
    await waitCount(requests, 2);
    const reloaded = page.waitForEvent('load');
    await choose(other, 'reject');
    await reloaded;
    assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
    assert.equal(await page.evaluate(() => window.epcConsent.allowsAdvertising()), false);
    assert.equal(requests.length, 2);
  } finally { await context.close(); }
});

test('thank-you without JavaScript shows the thank-you message and no Google load', async () => {
  const { context, page, requests } = await setup({ javaScriptEnabled: false });
  try {
    await page.goto(base + '/thank-you');
    assert.equal(await page.locator('[data-enquiry-confirmation]').isVisible(), false);
    assert.equal(await page.locator('[data-enquiry-unconfirmed]').isVisible(), true);
    assert.deepEqual(requests, []);
  } finally { await context.close(); }
});

test('withdrawal cannot restore an old grant when saving preferences hits storage quota', async () => {
  const { context, page, requests } = await setup();
  try {
    await visit(page);
    await choose(page, 'accept');
    await waitCount(requests, 1);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'epc-consent-v1') throw new DOMException('Storage full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await Promise.all([page.waitForEvent('load'), choose(page, 'reject')]);
    assert.equal(await page.evaluate(() => window.epcConsent.allowsAdvertising()), false);
    assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
    assert.equal(requests.length, 1);
  } finally { await context.close(); }
});

test('missing or throwing tracking on thank-you cannot interrupt the confirmation', async () => {
  for (const mode of ['missing', 'throws']) {
    const { context, page, conversions, errors } = await setup();
    try {
      await page.route('**/google-ads-conversions.js', route => route.fulfill({
        contentType: 'text/javascript',
        body: `if (location.pathname === '/thank-you') window.gtag = ${mode === 'missing' ? 'undefined' : 'function () { throw new Error("Tracking blocked"); }'};\n` + readFileSync(join(root, 'google-ads-conversions.js'), 'utf8')
      }));
      await page.route('https://formspree.io/**', route => route.fulfill({status: 200, body: '{}'}));
      await visit(page);
      await choose(page, 'accept');
      await fill(page);
      await page.locator('[type="submit"]').click();
      await page.waitForURL(base + '/thank-you');
      assert.equal(await page.locator('[data-enquiry-confirmation]').isVisible(), true);
      assert.deepEqual(conversions, []);
      assert.deepEqual(errors, []);
      const contrast = await page.locator('.confirmation-layout p').first().evaluate(el => getComputedStyle(el).color);
      assert.equal(contrast, 'rgb(255, 255, 255)');
    } finally { await context.close(); }
  }
});
