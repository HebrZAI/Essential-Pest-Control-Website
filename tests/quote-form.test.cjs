// Run with Playwright installed and the website served at QUOTE_TEST_URL (default localhost:8765).
// Every external request is blocked or mocked: these checks never send real enquiries.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const base = process.env.QUOTE_TEST_URL || 'http://127.0.0.1:8765';
const origin = new URL(base).origin;
const root = join(__dirname, '..');
const commercialEmailPages = new Set([
  'commercial.html', 'restaurants.html', 'construction.html', 'body-corporates.html',
  'schools-creches.html', 'warehousing-logistics.html', 'offices-retail.html',
  'healthcare-aged-care.html', 'hospitality-guesthouses.html', 'horse-stables-equestrian.html'
]);
const files = readdirSync(root).filter(file => file.endsWith('.html') && !['privacy-policy.html', 'thank-you.html'].includes(file)).concat(
  ['areas', 'blog'].flatMap(dir => readdirSync(join(root, dir))
    .filter(file => file.endsWith('.html')).map(file => dir + '/' + file))
);
let browser;

before(async () => {
  browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { if (browser) await browser.close(); });

async function open(file = 'index.html', options = {}) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, ...options });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  await context.addInitScript(() => {
    Object.defineProperty(window, 'testConversions', { get: () => (window.dataLayer || []).filter(args => args[0] === 'event' && args[1] === 'conversion') });
  });
  const page = await context.newPage();
  await page.goto(base + '/' + file, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator('[data-consent="reject"]').isVisible()) await page.locator('[data-consent="reject"]').click();
  return { context, page };
}

async function advance(page, commercial = false) {
  if (commercial) {
    await page.locator('#company').fill('Test site');
    await page.locator('#industry').selectOption('warehousing');
  } else {
    await page.locator('#sector').selectOption('residential');
    await selectPests(page, ['cockroaches']);
  }
  await page.locator('.quote-next').click();
}

async function selectPests(page, values) {
  const toggle = page.locator('#pest-type-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const choices = page.locator('#pest-type-options input');
  for (const checkbox of await choices.all()) {
    await checkbox.setChecked(values.includes(await checkbox.inputValue()));
  }
  await toggle.click();
}

async function selectedPests(page) {
  return page.locator('#pest-type').evaluate(select => Array.from(select.selectedOptions, option => option.value));
}

async function contact(page) {
  await page.locator('#name').fill('Test enquiry');
  await page.locator('#phone').fill('082 000 0000');
  if (await page.locator('#email').count()) await page.locator('#email').fill('test@example.com');
  await page.locator('#suburb').fill('Murrayfield');
  await page.locator('#message').fill('TEST ONLY: pest activity in the kitchen in Pretoria.');
}

async function captureConversions(page) {
  await page.locator('[data-cookie-settings]').click();
  await page.locator('[data-consent="accept"]').click();
}

test('all 30 pages expose a valid local quote form in the first mobile screen', async t => {
  assert.equal(files.length, 30);
  let pestForms = 0;
  let emailForms = 0;
  const { context, page } = await open();
  try {
    const sitemapUrls = await page.evaluate(async () => {
      const xml = await (await fetch('/sitemap.xml')).text();
      return Array.from(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('loc'), node => node.textContent);
    });
    assert.deepEqual(sitemapUrls.sort(), [...files, 'privacy-policy.html'].map(file => 'https://essentialpestcontrol.co.za/' +
      (file === 'index.html' ? '' : file.replace(/\.html$/, ''))).sort());
    for (const file of files) {
      await t.test(file, async () => {
        const errors = [];
        const onError = error => errors.push(error.message);
        page.on('pageerror', onError);
        const cleanPath = file === 'index.html' ? '' : file.replace(/\.html$/, '');
        const response = await page.goto(base + '/' + cleanPath, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200, 'clean URL must resolve');
        await page.evaluate(() => document.fonts.ready);
        const result = await page.evaluate(() => {
          const form = document.querySelector('#quoteForm');
          const next = document.querySelector('.quote-next').getBoundingClientRect();
          const ids = Array.from(document.querySelectorAll('[id]'), node => node.id);
          return {
            headings: document.querySelectorAll('h1').length,
            forms: document.forms.length,
            idsUnique: new Set(ids).size === ids.length,
            action: form.action,
            required: form.querySelectorAll('[required]').length,
            suburbFields: form.querySelectorAll('[name="suburb"]').length,
            suburbRequired: Boolean(form.querySelector('[data-quote-step="2"] input#suburb[name="suburb"][type="text"][required]')),
            suburbLabels: form.querySelectorAll('label[for="suburb"]').length,
            suburbBeforeMessage: Boolean(form.querySelector('#suburb').closest('.quote-field').nextElementSibling?.querySelector('#message')),
            emailFields: form.querySelectorAll('[name="email"], input[type="email"]').length,
            emailRequired: Boolean(form.querySelector('input[name="email"][type="email"][required]')),
            emailInPayload: new FormData(form).has('email'),
            emailLabels: form.querySelectorAll('label[for="email"]').length,
            commercial: Boolean(form.querySelector('#company')),
            pestPicker: form.querySelectorAll('#pest-type-toggle').length,
            pestOptions: form.querySelectorAll('#pest-type-options input[type="checkbox"]').length,
            multiplePests: Boolean(form.querySelector('select[name="pest_type"][multiple][required]')),
            nextBottom: next.bottom,
            nextVisible: next.height > 0,
            panelTop: document.querySelector('#contact').getBoundingClientRect().top,
            width: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
            source: form.elements.page_url.value,
            canonical: document.querySelector('link[rel="canonical"]').href,
            canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
            ogUrl: document.querySelector('meta[property="og:url"]').content,
            leadLoading: document.querySelector('.lead-media img').loading,
            formScriptPreload: document.querySelector('link[rel="preload"][as="script"]')?.href,
            formScript: document.querySelector('script[src$="quote-form.js"]').src,
            imagesHaveAlternatives: Array.from(document.images).every(img => img.hasAttribute('alt') && img.alt.trim()),
            imageDimensions: Array.from(document.images).every(img => img.width > 0 && img.height > 0 && img.hasAttribute('width') && img.hasAttribute('height')),
            ogImageAlt: document.querySelector('meta[property="og:image:alt"]').content,
            sharingImageAlt: Array.from(document.images).find(img => new URL(img.src).pathname ===
              new URL(document.querySelector('meta[property="og:image"]').content).pathname)?.alt,
            schemas: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), node => JSON.parse(node.textContent)),
            legacyLinks: Array.from(document.querySelectorAll('a[href]'), node => node.getAttribute('href'))
              .filter(href => /\.html(?:[?#]|$)/.test(href)),
            badAnchors: Array.from(document.querySelectorAll('a[href^="#"]'))
              .filter(link => !document.getElementById(link.hash.slice(1))).map(link => link.hash)
          };
        });
        assert.equal(result.headings, 1);
        assert.equal(result.forms, 1);
        assert.equal(result.idsUnique, true);
        assert.equal(result.action, 'https://formspree.io/f/xjgnewdj');
        const hasEmail = commercialEmailPages.has(file);
        assert.equal(result.required, hasEmail ? 7 : 6);
        assert.equal(result.suburbFields, 1);
        assert.equal(result.suburbRequired, true);
        assert.equal(result.suburbLabels, 1);
        assert.equal(result.suburbBeforeMessage, true);
        assert.equal(result.emailFields, hasEmail ? 1 : 0);
        assert.equal(result.emailRequired, hasEmail);
        assert.equal(result.emailInPayload, hasEmail);
        assert.equal(result.emailLabels, hasEmail ? 1 : 0);
        if (hasEmail) emailForms++;
        assert.equal(result.pestPicker, result.commercial ? 0 : 1);
        assert.equal(result.pestOptions, result.commercial ? 0 : 7);
        assert.equal(result.multiplePests, !result.commercial);
        if (result.multiplePests) pestForms++;
        assert.equal(result.source, result.canonical);
        assert.equal(result.canonicalCount, 1);
        assert.equal(result.canonical, 'https://essentialpestcontrol.co.za/' + cleanPath);
        assert.equal(result.ogUrl, result.canonical);
        assert.equal(result.leadLoading, 'eager');
        assert.equal(result.formScriptPreload, result.formScript);
        assert.equal(result.imagesHaveAlternatives, true);
        assert.equal(result.imageDimensions, true);
        assert.equal(result.ogImageAlt, result.sharingImageAlt);
        assert.deepEqual(result.legacyLinks, []);
        assert.ok(result.schemas.length > 0);
        assert.ok(!JSON.stringify(result.schemas).includes('.html'), 'schema URLs must be clean');
        assert.equal(result.nextVisible, true);
        assert.ok(result.panelTop < 800, 'quote panel starts above fold');
        assert.ok(result.nextBottom <= 800, 'Continue below fold: ' + result.nextBottom);
        assert.ok(result.width <= result.viewport, 'horizontal overflow');
        assert.deepEqual(result.badAnchors, []);
        assert.deepEqual(errors, []);
        page.off('pageerror', onError);
      });
    }
    assert.equal(pestForms, 17);
    assert.equal(emailForms, 10);
    assert.equal(files.length - emailForms, 20);
  } finally { await context.close(); }
});

test('direct file previews resolve navigation on all 30 pages', async () => {
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).protocol === 'file:'
    ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const file of files) {
      await page.goto(pathToFileURL(join(root, file)).href, { waitUntil: 'domcontentloaded' });
      const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => ({
        raw: node.getAttribute('href'), url: node.href
      })));
      for (const link of links) {
        if (link.url.startsWith('file:')) {
          assert.ok(existsSync(fileURLToPath(link.url)), file + ' has a missing target: ' + link.raw);
        }
      }
      assert.equal(await page.locator('.quote-next').count(), 1);
    }
    const home = pathToFileURL(join(root, 'index.html')).href;
    await page.goto(home);
    await page.locator('.btn-learn-more[href$="/ants.html"]').click();
    assert.equal(page.url(), pathToFileURL(join(root, 'ants.html')).href);
    await page.locator('.lead-breadcrumb a').click();
    assert.equal(page.url(), home);
    await page.goto(pathToFileURL(join(root, 'areas/centurion.html')).href);
    await page.locator('.nav-links a[href$="index.html#areas"]').click();
    assert.equal(page.url(), home + '#areas');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('pest picker validates, supports the keyboard, and closes without resizing the hero', async () => {
  for (const width of [320, 1440]) {
    const { context, page } = await open('index.html', { viewport: { width, height: 1000 } });
    try {
      await page.locator('#sector').selectOption('residential');
      await page.locator('.quote-next').click();
      const toggle = page.locator('#pest-type-toggle');
      assert.equal(await page.locator('#pest-type-error').isVisible(), true);
      assert.equal(await toggle.getAttribute('aria-invalid'), 'true');
      assert.equal(await toggle.evaluate(node => node === document.activeElement), true);
      const height = await page.locator('.lead-hero').evaluate(node => node.getBoundingClientRect().height);
      await toggle.press('Enter');
      const list = page.locator('#pest-type-options');
      assert.equal(await list.isVisible(), true);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      const bounds = await list.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      assert.ok(Math.abs(await page.locator('.lead-hero').evaluate(node => node.getBoundingClientRect().height) - height) <= 2,
        'opening the dropdown must not resize the hero');
      await toggle.press('Tab');
      const ants = list.locator('input[value="ants"]');
      assert.equal(await ants.evaluate(node => node === document.activeElement), true);
      await ants.press('Space');
      assert.deepEqual(await selectedPests(page), ['ants']);
      assert.equal(await page.locator('#pest-type-summary').textContent(), 'Ants');
      assert.equal(await page.locator('#pest-type-error').isVisible(), false);
      const validHeight = await page.locator('.lead-hero').evaluate(node => node.getBoundingClientRect().height);
      await list.locator('input[value="rodents"]').focus();
      await page.keyboard.press('Space');
      assert.deepEqual(await selectedPests(page), ['ants', 'rodents']);
      assert.equal(await page.locator('#pest-type-summary').textContent(), '2 selected');
      assert.equal(await list.isVisible(), true, 'choosing a pest keeps the dropdown open');
      await page.keyboard.press('Escape');
      assert.equal(await list.isVisible(), false);
      assert.equal(await toggle.evaluate(node => node === document.activeElement), true);
      await toggle.press('Enter');
      await toggle.press('Tab');
      for (let i = 0; i < 7; i++) await page.keyboard.press('Tab');
      assert.equal(await list.isVisible(), false, 'Tab out closes the dropdown');
      assert.equal(await page.locator('.quote-next').evaluate(node => node === document.activeElement), true);
      await toggle.click();
      await page.locator('.quote-heading-row').click();
      assert.equal(await list.isVisible(), false, 'outside click closes the dropdown');
      assert.ok(Math.abs(await page.locator('.lead-hero').evaluate(node => node.getBoundingClientRect().height) - validHeight) <= 2,
        'dropdown interactions must not resize the hero');
      await selectPests(page, []);
      assert.equal(await page.locator('#pest-type-summary').textContent(), 'Select one or more');
      await page.locator('.quote-next').click();
      assert.equal(await page.locator('#pest-type-error').isVisible(), true);
      assert.equal(await page.locator('[data-quote-step="1"]').isVisible(), true);
    } finally { await context.close(); }
  }
});

test('the whole pest row toggles once with mouse and touch, including its empty right edge', async () => {
  for (const touch of [false, true]) {
    const { context, page } = await open('index.html', {
      viewport: { width: touch ? 360 : 1440, height: 1000 }, hasTouch: touch
    });
    try {
      const toggle = page.locator('#pest-type-toggle');
      await toggle.click();
      await page.evaluate(() => {
        window.pestChanges = 0;
        document.querySelector('#pest-type').addEventListener('change', () => window.pestChanges++);
      });
      const row = page.locator('#pest-type-options label').first();
      const checkbox = row.locator('input');
      const bounds = await row.boundingBox();
      let changes = 0;
      for (const x of [bounds.width - 8, 65]) {
        for (const checked of [true, false]) {
          if (touch) await row.tap({ position: { x, y: bounds.height / 2 } });
          else await row.click({ position: { x, y: bounds.height / 2 } });
          assert.equal(await checkbox.isChecked(), checked);
          assert.deepEqual(await selectedPests(page), checked ? ['ants'] : []);
          assert.equal(await page.locator('#pest-type-summary').textContent(), checked ? 'Ants' : 'Select one or more');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
          assert.equal(await page.evaluate(() => window.pestChanges), ++changes);
        }
      }
      await checkbox.click();
      assert.deepEqual(await selectedPests(page), ['ants']);
      assert.equal(await page.evaluate(() => window.pestChanges), ++changes);
      await page.locator('.quote-heading-row').click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    } finally { await context.close(); }
  }
});

test('multiple pests survive navigation and retries and are submitted once per selected value', async () => {
  const { context, page } = await open();
  try {
    const values = ['ants', 'cockroaches', 'rodents'];
    const requests = [];
    await captureConversions(page);
    await page.route('https://formspree.io/**', route => {
      requests.push(route.request().postData());
      return route.fulfill({ status: requests.length === 1 ? 503 : 200, contentType: 'application/json', body: '{}' });
    });
    await page.locator('#sector').selectOption('residential');
    await selectPests(page, values);
    await page.locator('.quote-next').click();
    await contact(page);
    await page.locator('.quote-back').click();
    assert.deepEqual(await selectedPests(page), values);
    await page.locator('.quote-next').click();
    await page.locator('[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('#formMessage').classList.contains('error'));
    assert.deepEqual(await selectedPests(page), values);
    assert.equal(await page.locator('#phone').inputValue(), '082 000 0000');
    await page.locator('[type="submit"]').click();
    await page.locator('[data-enquiry-confirmation]').waitFor({ state: 'visible' });
    assert.equal(requests.length, 2);
    for (const payload of requests) {
      assert.equal((payload.match(/name="pest_type"/g) || []).length, values.length);
      for (const value of values) assert.ok(payload.includes('\r\n\r\n' + value + '\r\n'));
    }
    assert.equal(await page.evaluate(() => window.testConversions.length), 1);
  } finally { await context.close(); }
});

test('representative templates fit phone, tablet, and desktop widths', async () => {
  const { context, page } = await open();
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 400 ? 800 : 1000 });
      for (const file of ['index.html', 'ants.html', 'commercial.html', 'construction.html',
        'areas/centurion.html', 'blog.html', 'blog/pest-control-for-restaurants-gauteng.html']) {
        await page.goto(base + '/' + file, { waitUntil: 'domcontentloaded' });
        const result = await page.evaluate(() => {
          const panel = document.querySelector('#contact');
          const next = document.querySelector('.quote-next').getBoundingClientRect();
          return {
            width: document.documentElement.scrollWidth,
            panelWidth: panel.scrollWidth,
            panelClient: panel.clientWidth,
            nextWidth: next.width,
            nextRight: next.right
          };
        });
        assert.ok(result.width <= width, file + ' overflows at ' + width);
        assert.ok(result.panelWidth <= result.panelClient, file + ' form overflows');
        assert.ok(result.nextWidth >= 200 && result.nextRight <= width, file + ' CTA clipped');
        await advance(page, await page.locator('#company').count() > 0);
        assert.equal(await page.locator('[data-quote-step="2"]').isVisible(), true);
        const secondStep = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          panelWidth: document.querySelector('#contact').scrollWidth,
          panelClient: document.querySelector('#contact').clientWidth,
          name: document.querySelector('#name').getBoundingClientRect().toJSON(),
          phone: document.querySelector('#phone').getBoundingClientRect().toJSON()
        }));
        assert.ok(secondStep.width <= width, file + ' contact step overflows at ' + width);
        assert.ok(secondStep.panelWidth <= secondStep.panelClient, file + ' contact panel overflows');
        if (width > 760) assert.ok(Math.abs(secondStep.name.top - secondStep.phone.top) <= 2);
        else assert.ok(secondStep.phone.top > secondStep.name.bottom, 'mobile fields remain stacked');
      }
    }
  } finally { await context.close(); }
});

test('all 30 desktop heroes keep their height and align the image with both form steps', async t => {
  const { context, page } = await open();
  try {
    for (const width of [768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const file of files) {
        await t.test(file + ' at ' + width, async () => {
          await page.goto(base + '/' + file, { waitUntil: 'domcontentloaded' });
          await page.evaluate(() => document.fonts.ready);
          const measure = () => page.evaluate(() => ({
            hero: document.querySelector('.lead-hero').getBoundingClientRect().height,
            panel: document.querySelector('#contact').getBoundingClientRect().bottom,
            image: document.querySelector('.lead-media img').getBoundingClientRect().bottom,
            imageTop: document.querySelector('.lead-media img').getBoundingClientRect().top,
            extras: Array.from(document.querySelectorAll('.lead-details, .lead-breadcrumb'), node => node.getBoundingClientRect().bottom)
          }));
          const first = await measure();
          assert.ok(Math.abs(first.panel - first.image) <= 2, 'first-step image alignment');
          assert.ok(first.extras.every(bottom => bottom <= first.imageTop), 'metadata stays above image');
          await advance(page, await page.locator('#company').count() > 0);
          const second = await measure();
          assert.ok(Math.abs(second.hero - first.hero) <= 2, 'hero grows on Continue');
          assert.ok(Math.abs(second.panel - second.image) <= 2, 'second-step image alignment');
          assert.equal(await page.locator('[data-quote-step="1"]').getAttribute('inert'), '');
          assert.equal(await page.locator('[data-quote-step="1"]').getAttribute('aria-hidden'), 'true');
          await page.locator('.quote-back').click();
          const back = await measure();
          assert.ok(Math.abs(back.hero - first.hero) <= 2, 'hero changes on Back');
          assert.equal(await page.locator('[data-quote-step="2"]').getAttribute('inert'), '');
        });
      }
    }
  } finally { await context.close(); }
});

for (const commercial of [false, true]) {
  test((commercial ? 'commercial' : 'general') + ' form validates, preserves edits, and submits once', async () => {
    const { context, page } = await open(commercial ? 'commercial.html' : 'index.html');
    try {
      await captureConversions(page);
      const requests = [];
      let release;
      await page.route('https://formspree.io/**', async route => {
        requests.push(route.request().postData());
        await new Promise(resolve => { release = resolve; });
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      });
      await page.locator('.quote-next').click();
      assert.equal(await page.locator('[data-quote-step="1"]').isVisible(), true);
      assert.equal(requests.length, 0);
      await advance(page, commercial);
      await contact(page);
      await page.locator('#suburb').fill('');
      await page.locator('[type="submit"]').click();
      assert.equal(requests.length, 0);
      assert.equal(await page.locator('#suburb').evaluate(field => field === document.activeElement), true);
      await page.locator('#suburb').fill('Murrayfield');
      if (commercial) {
        for (const value of ['', 'invalid']) {
          await page.locator('#email').fill(value);
          await page.locator('[type="submit"]').click();
          assert.equal(requests.length, 0);
          assert.equal(await page.locator('#email').evaluate(field => field === document.activeElement), true);
        }
        await page.locator('#email').fill('test@example.com');
      } else {
        await page.locator('#name').fill('');
        await page.locator('[type="submit"]').click();
        assert.equal(requests.length, 0);
        await page.locator('#name').fill('Test enquiry');
      }
      await page.locator('.quote-back').click();
      assert.equal(await page.locator('#name').inputValue(), 'Test enquiry');
      await page.locator('.quote-next').click();
      assert.equal(await page.locator('#suburb').inputValue(), 'Murrayfield');
      // A value invalidated in the hidden first step must reveal that step for correction.
      await page.locator(commercial ? '#company' : '#sector').evaluate(field => { field.value = ''; });
      await page.locator('[type="submit"]').click();
      assert.equal(await page.locator('[data-quote-step="1"]').isVisible(), true);
      assert.equal(requests.length, 0);
      await advance(page, commercial);
      await page.locator('[type="submit"]').evaluate(button => { button.click(); button.click(); });
      await page.waitForFunction(() => document.querySelector('#quoteForm').getAttribute('aria-busy') === 'true');
      while (!release) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(requests.length, 1);
      assert.equal(await page.locator('[type="submit"]').isDisabled(), true);
      release();
      await page.locator('[data-enquiry-confirmation]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#quoteForm').count(), 0);
      assert.equal(new URL(page.url()).pathname, '/thank-you');
      assert.match(requests[0], /name="page_url"/);
      if (commercial) assert.match(requests[0], /name="email"\r\n\r\ntest@example.com/);
      else assert.doesNotMatch(requests[0], /name="email"/);
      assert.match(requests[0], /name="phone"\r\n\r\n082 000 0000/);
      assert.match(requests[0], /name="suburb"\r\n\r\nMurrayfield/);
      assert.match(requests[0], commercial ? /warehousing/ : /cockroaches/);
      const conversions = await page.evaluate(() => window.testConversions);
      assert.equal(conversions.length, 1);
      assert.equal(conversions[0][2].send_to, 'AW-16967723902/SPEICIfdrfQcEP7W65o_');
      assert.match(await page.locator('[data-enquiry-confirmation]').textContent(), /A member of our team will reach out to you shortly\./);
    } finally { await context.close(); }
  });
}

test('server and network failures retain the enquiry and never count a conversion', async () => {
  const { context, page } = await open();
  try {
    await captureConversions(page);
    let attempt = 0;
    await page.route('https://formspree.io/**', route => {
      attempt++;
      if (attempt === 1) return route.fulfill({ status: 500, contentType: 'text/html', body: 'Unavailable' });
      if (attempt === 2) return route.abort();
      if (attempt === 3) return route.fulfill({ status: 422, contentType: 'application/json', body: '{"errors":[{"message":"Please check your phone number."}]}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await advance(page);
    await contact(page);
    for (const text of [/try again/, /couldn’t connect/, /check your phone number/]) {
      await page.locator('[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('#formMessage').classList.contains('error'));
      assert.match(await page.locator('#formMessage').textContent(), text);
      assert.equal(await page.locator('#phone').inputValue(), '082 000 0000');
      assert.equal(await page.locator('#suburb').inputValue(), 'Murrayfield');
      assert.equal(await page.locator('[type="submit"]').isDisabled(), false);
      assert.equal(await page.evaluate(() => window.testConversions.length), 0);
    }
    await page.locator('[type="submit"]').click();
    await page.locator('[data-enquiry-confirmation]').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.testConversions.length), 1);
  } finally { await context.close(); }
});

test('tracking failure cannot interrupt a successful enquiry', async () => {
  for (const tracking of ['missing', 'throws']) {
    const { context, page } = await open();
    try {
      await page.evaluate(mode => {
        window.gtag = mode === 'missing' ? undefined : () => { throw new Error('Tracking blocked'); };
      }, tracking);
      await page.route('https://formspree.io/**', route => route.fulfill({ status: 200, body: '{}' }));
      await advance(page);
      await contact(page);
      await page.locator('[type="submit"]').click();
      await page.locator('[data-enquiry-confirmation]').waitFor({ state: 'visible' });
    } finally { await context.close(); }
  }
});

test('Enter advances step one without sending a partial enquiry', async () => {
  const { context, page } = await open('commercial.html');
  try {
    let requests = 0;
    await page.route('https://formspree.io/**', route => { requests++; return route.abort(); });
    await page.locator('#company').fill('Test site');
    await page.locator('#industry').selectOption('other');
    await page.locator('#company').press('Enter');
    await page.locator('[data-quote-step="2"]').waitFor({ state: 'visible' });
    assert.equal(requests, 0);
  } finally { await context.close(); }
});

test('page defaults remain editable, including the new equestrian industry', async () => {
  const pestPage = await open('ants.html');
  try {
    assert.deepEqual(await selectedPests(pestPage.page), ['ants']);
    assert.equal(await pestPage.page.locator('#pest-type-summary').textContent(), 'Ants');
    await selectPests(pestPage.page, ['ants', 'other']);
    assert.deepEqual(await selectedPests(pestPage.page), ['ants', 'other']);
    assert.equal(await pestPage.page.locator('#pest-type-summary').textContent(), '2 selected');
  } finally { await pestPage.context.close(); }
  for (const [file, selector, value, alternative] of [
    ['horse-stables-equestrian.html', '#industry', 'horse-stables-equestrian', 'other'],
    ['blog/pre-construction-termite-treatment-gauteng.html', '#industry', 'construction', 'other']
  ]) {
    const { context, page } = await open(file);
    try {
      assert.equal(await page.locator(selector).inputValue(), value);
      await page.locator(selector).selectOption(alternative);
      assert.equal(await page.locator(selector).inputValue(), alternative);
    } finally { await context.close(); }
  }
});

test('mobile enquiry bar follows visibility and editing, and is absent on desktop', async () => {
  const { context, page } = await open();
  try {
    assert.equal(await page.locator('.quote-bar').isVisible(), false);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 1800); });
    await page.locator('.quote-bar').waitFor({ state: 'visible' });
    await page.locator('#sector').evaluate(field => field.focus({ preventScroll: true }));
    await page.locator('.quote-bar').waitFor({ state: 'hidden' });
    await page.evaluate(() => document.activeElement.blur());
    await page.locator('.quote-bar').waitFor({ state: 'visible' });
    await page.locator('.quote-bar .quote-button').click();
    await page.locator('.quote-bar').waitFor({ state: 'hidden' });
    assert.equal(new URL(page.url()).hash, '#contact');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 1800));
    assert.equal(await page.locator('.quote-bar').isVisible(), false);
  } finally { await context.close(); }
});

for (const commercial of [false, true]) {
  test((commercial ? 'commercial' : 'general') + ' form submits natively without JavaScript', async () => {
    const { context, page } = await open(commercial ? 'commercial.html' : 'index.html', {
      javaScriptEnabled: false, reducedMotion: 'reduce'
    });
    try {
      assert.equal(await page.locator('[data-quote-step="1"]').isVisible(), true);
      assert.equal(await page.locator('[data-quote-step="2"]').isVisible(), true);
      assert.equal(await page.locator('.quote-next').isVisible(), false);
      let payload;
      await page.route('https://formspree.io/**', route => {
        payload = route.request().postData();
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Mock enquiry received</p>' });
      });
      if (commercial) {
        await page.locator('#company').fill('Test site');
        await page.locator('#industry').selectOption('warehousing');
      } else {
        await page.locator('#sector').selectOption('residential');
        await page.locator('#pest-type').selectOption(['ants', 'rodents']);
      }
      await contact(page);
      await page.locator('#suburb').fill('');
      await page.locator('[type="submit"]').click();
      assert.equal(payload, undefined);
      await page.locator('#suburb').fill('Murrayfield');
      if (commercial) {
        for (const value of ['', 'invalid']) {
          await page.locator('#email').fill(value);
          await page.locator('#email').press('Enter');
          assert.equal(payload, undefined);
        }
        await page.locator('#email').fill('test@example.com');
      }
      await page.locator('[type="submit"]').click();
      await page.waitForURL('https://formspree.io/**');
      const fields = new URLSearchParams(payload);
      if (commercial) {
        assert.equal(fields.get('email'), 'test@example.com');
        assert.equal(fields.get('company'), 'Test site');
        assert.equal(fields.get('industry'), 'warehousing');
      } else {
        assert.equal(fields.has('email'), false);
        assert.deepEqual(fields.getAll('pest_type'), ['ants', 'rodents']);
      }
      assert.equal(fields.get('phone'), '082 000 0000');
      assert.equal(fields.get('suburb'), 'Murrayfield');
      assert.match(payload, /page_url=/);
    } finally { await context.close(); }
  });
}
