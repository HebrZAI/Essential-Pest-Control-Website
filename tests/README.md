These browser checks validate all 30 enquiry pages (the two information pages are checked separately), mobile form visibility, both enquiry variants, validation, retries, duplicate submission prevention, conversion events, page defaults, the mobile enquiry bar, and the full-form fallback without JavaScript. They verify clean URLs, matching canonical and Open Graph URLs, structured data, and full-row mouse/touch selection. They also check desktop image/form alignment and stable height between steps at 768, 1024, and 1440px, representative layouts from 320 to 1440px, and keyboard access, validation, selection persistence, and submission of multiple pests. External requests are blocked or mocked, so tests never send real leads or conversion events.

Email is required on the commercial hub and nine industry pages only. Checks assert that the other 20 forms omit email from their fields and payloads, including commercial-topic articles that retain company and industry fields. Both JavaScript and native submissions cover required/invalid commercial email and successful general enquiries without email. Image checks cover alternatives, explicit dimensions, eager opening images and sharing-image descriptions, alongside sitemap/canonical agreement. These checks do not verify Formspree account rules or inbox delivery.

Opening `index.html` directly also supports navigation: `quote-form.js` adapts clean page links to local `.html` filenames for file previews. Browser checks cover links on all 30 files and clicking between the home, service, and area pages. JavaScript must be enabled for this file preview support.

Serve the website with Python using the same extensionless HTML routes as GitHub Pages:

```sh
python3 tests/serve.py
```

In another terminal, use Node.js 22+ and install test tools outside the site:

```sh
npm install --prefix /tmp/epc-test-tools playwright
PLAYWRIGHT_BROWSERS_PATH=/tmp/epc-test-browsers /tmp/epc-test-tools/node_modules/.bin/playwright install chromium --only-shell
NODE_PATH=/tmp/epc-test-tools/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/epc-test-browsers node --test tests/*.test.cjs
```

Set `QUOTE_TEST_URL` if the local server uses another address. No package manager or build step is needed to publish the website. Publish all shared scripts/styles with the HTML files; see `TRACKING-SETUP.md` for the rollout checklist.

`tracking-consent.test.cjs` covers all 32 pages: no Google requests before consent or after rejection; consent defaults, acceptance, saved choices, expiry, withdrawal and cookie cleanup; both enquiry variants with one thank-you conversion and a random transaction ID; replay prevention; malformed/expired receipts; contact-click separation; blocked storage and full quotas; cross-tab withdrawal; missing/throwing tracking; native confirmation fallback; privacy address; sitemap/robots; keyboard access and responsive layouts. Google script requests are mocked, so live tag behavior and Ads attribution still require post-deployment Tag Assistant/account checks.

If using an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.

GA4 consent regression checks cover all four Analytics/Advertising combinations, one explicit GA4 page view per page after analytics acceptance, one shared tag initialization, upgrades in either order, selective withdrawal and cookie cleanup, saved legacy records and malformed/expired records.

To test Google’s actual shared tag and its current remote configuration, enable the optional integration suite while the local server is running:

```sh
GOOGLE_TAG_TEST=1 NODE_PATH=/tmp/epc-test-tools/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/epc-test-browsers node --test tests/google-tag.test.cjs
```

This suite allows only Google tag script downloads. It serves the local pages at a virtual production origin and intercepts all collection and conversion requests, including the existing thank-you URL action and the phone/WhatsApp labels. No measurement reaches Google. It checks network payloads rather than GA4 reporting or Ads attribution. The `QUOTE_TEST_URL` override can point at production to check the deployed site using the same interception.
