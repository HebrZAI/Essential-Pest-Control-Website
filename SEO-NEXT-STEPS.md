# Essential Pest Control SEO launch plan

## Priority checklist (21 October 2026)

1. **Publish the complete package.** The live site checked on 21 October still used the older layout and `.html` canonical URLs; its sitemap agreed with those URLs. Publish all revised HTML, CSS, JavaScript, images, fonts, `robots.txt`, `sitemap.xml` and `llms.txt` together. Keep the actual `.html` files: the published links use clean URLs. After upload, check the homepage and a service, area, commercial and blog URL, including their assets and canonical tags.
2. **Verify Google indexing in Search Console.** Submit `https://essentialpestcontrol.co.za/sitemap.xml`, inspect representative clean URLs and check Google's selected canonical after recrawling. An HTTP 200 response does not prove indexing. Review exclusions, 404s and search queries weekly. [Google's Search Console guidance](https://developers.google.com/search/docs/monitor-debug/search-console-start).
3. **Strengthen local credibility.** Confirm the Business Profile's category, phone, hours and genuine service areas match the website. Add original job photos and useful service examples, request honest reviews and display verifiable operator credentials. Existing illustrative images do not establish real jobs, customers or locations. Relevance, distance and prominence affect local ranking. [Google's local-ranking guidance](https://support.google.com/business/answer/7091).
4. **Measure mobile speed and validate structured data.** Run PageSpeed Insights after publishing on the homepage and representative service, commercial and article pages. Check field data where available; local timings cannot prove real-user Core Web Vitals. Run Google's Rich Results Test on the published pages. The current LocalBusiness address identifies a city and region only; confirm genuine business details before extending it, and never invent a street address for eligibility. Valid JSON does not establish rich-result eligibility. [Performance guidance](https://web.dev/articles/optimize-lcp), [LocalBusiness guidance](https://developers.google.com/search/docs/appearance/structured-data/local-business).

All 30 live pages returned HTTP 200 in the initial review, robots.txt allowed crawling, and the checked page assets loaded. Locally, all 30 pages have a title, unique description, one H1, structured data and matching canonical/sitemap URLs. These checks establish technical foundations, not rankings.

## Forms and image alternatives

- Email is required only on the commercial hub and its nine industry pages. The other 20 forms omit the email field and submit no email value, including the three articles that retain company and industry fields.
- Keep the existing Formspree endpoint. Check its account settings for any email-required validation or workflow, and verify receipt of a controlled enquiry after publishing. Local browser checks mock submissions and cannot prove inbox delivery or account-side acceptance.
- Image alternatives were checked against the visuals and describe pests, settings or equipment without claiming unverified locations or completed treatments. Social sharing alternatives now describe their actual images. Logo alternatives remain concise.
- Descriptive alt text supports accessibility and helps Google understand images. It is not a ranking shortcut; adding lists of places or repeated keywords is inappropriate. [Google's image guidance](https://developers.google.com/search/docs/appearance/google-images).
- Opening lead images load eagerly with automatic browser priority. Lower-page images remain lazy-loaded, and explicit image dimensions are retained.
- The existing form script is preloaded before the fonts, allowing the two-step form to initialise promptly on slow connections while keeping the complete form available without JavaScript.
- Search Console, Business Profile access, Formspree account rules and real enquiry delivery were not verified. No external account changes or real submissions were made. Rankings cannot be guaranteed.

## Clean URLs and canonical tags (21 October 2026)

- Public links now use extensionless URLs, for example `https://essentialpestcontrol.co.za/rodents`.
- Keep the actual `.html` files when publishing. GitHub Pages serves those files at the clean URLs; this was verified on the live site, including nested area and blog pages.
- Canonicals, Open Graph URLs, structured-data identifiers, quote-form page URLs, the sitemap and `llms.txt` now use the same clean addresses.
- The homepage canonical remains exactly `https://essentialpestcontrol.co.za/`. Links to the homepage use `/`, including links with section anchors.
- Existing `.html` addresses still work as aliases. Canonical tags identify the preferred clean version; this package does not create HTTP 301 redirects.
- Submit the revised sitemap in Search Console after publishing and inspect the homepage and representative service, area and blog URLs. Watch for canonical conflicts and 404s as Google recrawls.
- For local previews, run `python3 tests/serve.py`; a plain Python HTTP server does not reproduce GitHub Pages' extensionless routing.

## Direction implemented in this package

The homepage and residential service pages now lead with Pretoria, Pretoria East and Centurion. Sandton, Randburg and Kempton Park remain indexable service-area pages because they are genuine operating areas. Commercial and industry pages retain their broader Gauteng positioning.

This is a hub-and-spoke structure rather than a collection of interchangeable city pages:

- The homepage explains the primary region and wider Gauteng coverage.
- Six service pages link directly to all six location pages.
- Pretoria and Pretoria East have different page purposes and content.
- Every location page has its own property context, decision guidance, preparation steps and FAQs.
- Shared navigation and footer links connect the site without repeating location phrases throughout every paragraph.

## Before publishing

1. Upload the complete package, including the new `areas/pretoria-east` file.
2. Confirm that all six area URLs return HTTP 200 rather than 404.
3. Keep the existing HTTPS, non-www domain format used by the canonical tags.
4. Do not publish only selected HTML files. The stylesheet, sitemap, `llms.txt` and linked pages work together.
5. If the live site already has a different URL for Pretoria East, choose one URL and redirect the other rather than publishing duplicates.

## Google Search Console

1. Submit `https://essentialpestcontrol.co.za/sitemap.xml`.
2. Inspect the homepage, six service pages and six location pages after deployment.
3. Request indexing for the new Pretoria East page and the revised homepage.
4. Review the Pages report weekly for 404s, canonical conflicts and crawled-but-not-indexed location pages.
5. Compare queries and landing pages for Pretoria, Pretoria East, Centurion, Sandton, Randburg and Kempton Park rather than judging performance only at domain level.

## Google Business Profile

- Keep one genuine business identity and do not create virtual offices for location rankings.
- Use service areas that reflect the routes the business actually accepts.
- Link the profile to the homepage unless the verified location and search intent clearly justify a specific area page.
- Add original job photographs and ask for honest reviews after completed work without scripting keyword-heavy wording.

## Content expansion rule

Do not create a page for every suburb. Add a city-plus-service page only when all three conditions are met:

1. Search Console, enquiry records or Google Ads data shows real demand.
2. The service is commercially important enough to justify a dedicated page.
3. The page can provide genuinely different evidence, preparation, process, FAQ or case-study content.

If those conditions are not met, improve the relevant service page and area hub instead.

## Suggested 12-week programme

| Week | Priority | Purpose |
| --- | --- | --- |
| 1 | Deploy the refreshed package and submit the sitemap | Technical launch |
| 2 | Add one genuine Pretoria or Centurion job example to the relevant service page | Local proof |
| 3 | Improve the restaurant page with preparation and reporting detail | Commercial conversion |
| 4 | Publish a Pretoria East termite-planning guide only if supported by real project knowledge | High-value intent |
| 5 | Add original service photos with descriptive, factual alt text | Trust and image search |
| 6 | Publish a Centurion complex pest-control checklist | Body-corporate intent |
| 7 | Improve the rodent page with real inspection observations | Residential conversion |
| 8 | Add a Sandton apartment or facilities case example when available | Secondary-area proof |
| 9 | Improve the warehouse page with monitoring-zone examples | Logistics conversion |
| 10 | Add a Randburg roof-access example when available | Secondary-area proof |
| 11 | Improve termite-stage comparisons and internal links | High-value service clarity |
| 12 | Add a Kempton Park operational-site example when available | Secondary-area proof |

## Monthly measurement

- Organic calls, WhatsApp clicks and submitted forms by landing page
- Search Console clicks, impressions, click-through rate and position by location query
- Enquiries and booked revenue by area and service
- Google Business Profile calls, messages and website clicks
- Reviews and legitimate referring domains gained

The decision to expand or create additional pages should be based on qualified enquiries and booked work, not keyword volume alone.
