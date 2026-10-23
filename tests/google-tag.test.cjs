// Optional integration check: use Google's real shared tag, intercept all measurement requests.
// GOOGLE_TAG_TEST=1 enables network access to gtag.js; no leads or conversions reach Google.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.QUOTE_TEST_URL || 'http://127.0.0.1:8765';
const site = 'https://essentialpestcontrol.co.za';
const ga = 'G-8BX38H8R3L';
const aw = 'AW-16967723902';

function gaViews(requests) {
  return requests.filter(request => request.params.get('tid') === ga && request.params.get('en') === 'page_view');
}
async function settle(page) {
  await page.waitForTimeout(1500); // Allow the real tag to flush after collection is observed.
}
async function waitViews(page, requests, count) {
  for (let i = 0; i < 100 && gaViews(requests).length < count; i++) await page.waitForTimeout(100);
  await settle(page);
  assert.equal(gaViews(requests).length, count, JSON.stringify({ requests: requests.map(r => r.url), calls: await page.evaluate(() => dataLayer.filter(x => x.length).map(x => Array.from(x))) }));
}
async function preferences(page, analytics, advertising) {
  if (!await page.locator('.consent-panel').isVisible()) await page.locator('.footer-privacy [data-cookie-settings]').click();
  if (!await page.locator('#consent-analytics').isVisible()) await page.locator('[data-consent="preferences"]').click();
  await page.locator('#consent-analytics').setChecked(analytics);
  await page.locator('#consent-advertising').setChecked(advertising);
  await page.locator('[data-consent="save"]').click();
}

test('real shared Google tag respects independent choices, emits one GA4 view and retains Ads actions', { skip: process.env.GOOGLE_TAG_TEST !== '1' }, async t => {
  const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  try {
    for (const [analytics, advertising] of [[false, false], [true, false], [false, true], [true, true]]) {
      await t.test(`analytics=${analytics}, advertising=${advertising}`, async () => {
        const context = await browser.newContext();
        const requests = [], scripts = [], errors = [];
        try {
          await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin === site) {
              const response = await route.fetch({ url: base + url.pathname + url.search });
              return route.fulfill({ response });
            }
            if (url.origin === 'https://www.googletagmanager.com' && url.pathname === '/gtag/js') {
              scripts.push(request.url());
              return route.continue();
            }
            requests.push({ url: request.url(), params: new URLSearchParams(url.search + '&' + (request.postData() || '')) });
            return route.fulfill({ status: 204 });
          });
          const page = await context.newPage();
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(site + '/');
          assert.equal(requests.length, 0);
          assert.equal(scripts.length, 0);
          await preferences(page, analytics, advertising);
          await waitViews(page, requests, Number(analytics));
          assert.equal(scripts.filter(url => new URL(url).searchParams.get('id') === aw).length, Number(analytics || advertising));
          assert.equal(gaViews(requests).length, Number(analytics));
          if (analytics) assert.equal(gaViews(requests)[0].params.get('gcs'), advertising ? 'G111' : 'G101');
          if (!advertising) assert.equal(requests.filter(r => r.params.get('tid') === aw || /pagead|ccm/.test(r.url)).length, 0);
          if (!analytics) assert.equal(requests.filter(r => r.params.get('tid') === ga).length, 0);
          await preferences(page, analytics, advertising);
          await settle(page);
          assert.equal(gaViews(requests).length, Number(analytics), 'saving unchanged choices must not replay a view');
          const cookies = (await context.cookies()).map(cookie => cookie.name);
          assert.equal(cookies.includes('_ga'), analytics);
          assert.equal(cookies.includes('_gcl_au'), advertising);
          if (analytics && !advertising) {
            await preferences(page, true, true);
            await settle(page);
            assert.equal(gaViews(requests).length, 1, 'granting Ads later must not replay a GA4 view');
            assert.equal(scripts.filter(url => new URL(url).searchParams.get('id') === aw).length, 1, 'reuse the already loaded shared tag');
            await Promise.all([page.waitForEvent('load'), preferences(page, true, false)]);
            await waitViews(page, requests, 2);
            assert.equal(gaViews(requests).length, 2, 'withdrawal reload keeps the remaining Analytics permission');
          }
          requests.length = 0;
          scripts.length = 0;
          await page.goto(site + '/thank-you');
          await waitViews(page, requests, Number(analytics));
          assert.equal(gaViews(requests).length, Number(analytics));
          const urlConversion = requests.filter(r => r.params.get('label') === 'z8qWCKz91qYdEP7W65o_');
          assert.equal(urlConversion.length > 0, advertising, 'existing remotely configured thank-you URL action');
          // Observe click requests while preventing WhatsApp/dialler navigation.
          await page.evaluate(() => document.addEventListener('click', event => event.preventDefault()));
          await page.locator('a[href*="wa.me"]').first().evaluate(el => el.click());
          await page.locator('a[href^="tel:"]').first().evaluate(el => el.click());
          await settle(page);
          for (const label of ['tS-cCI3drfQcEP7W65o_', 'svwUCOKJ66YdEP7W65o_']) {
            assert.equal(requests.some(r => r.params.get('label') === label), advertising, label);
          }
          if (analytics || advertising) {
            await page.locator('.footer-privacy [data-cookie-settings]').click();
            await Promise.all([page.waitForEvent('load'), page.locator('[data-consent="reject"]').click()]);
            requests.length = 0;
            scripts.length = 0;
            await page.reload();
            await settle(page);
            assert.equal(requests.length, 0);
            assert.equal(scripts.length, 0);
            assert.deepEqual((await context.cookies()).filter(cookie => /^_ga|^_gcl_/.test(cookie.name)), []);
          }
          assert.deepEqual(errors, []);
        } finally { await context.close(); }
      });
    }
  } finally { await browser.close(); }
});
