# Google Analytics, Ads tracking and privacy rollout

Updated 23 October 2026. The site remains static and uses Formspree.

## Website behavior

- Every page loads `privacy.css`, `site-consent.js`, then `google-ads-conversions.js`. There is no unconditional Google tag or GTM installation.
- Basic Consent Mode v2 starts with all four Google consent signals denied. The shared Google tag loader `AW-16967723902` loads only after Analytics or Advertising measurement is accepted. Its live configuration already connects GA4 `G-8BX38H8R3L` and Google Ads `AW-16967723902` (Google tag alias `GT-5TJN9JXS`). Do not install a second tag or add a second GA4 config. The site disables automatic page views globally and sends one explicit `page_view` to GA4 per document only when analytics is accepted. The Ads config runs once, only when advertising is accepted, preserving its existing remote conversion rules. Accept grants both choices; Reject optional denies both; Save preferences applies each separately. `analytics_storage` follows Analytics; `ad_storage` and `ad_user_data` follow Advertising. Advertising personalization and Google signals remain disabled. No enhanced conversions or conversion actions are enabled or rebuilt.
- Accept, Reject optional and Preferences are available in the bottom panel. Cookie settings in every footer reopens preferences. Consent records use schema version 2 in the existing `epc-consent-v1` key, with separate boolean `analytics` and `advertising` fields. Older, incomplete, malformed, future-dated or expired records grant neither permission and display the banner again. Choices expire after 180 days. Withdrawing either granted choice reloads the page to unload Google's running script and avoid further cookieless measurement for that destination. The remaining permission resumes after reload. Accessible cookies for the withdrawn category are removed; unsent form edits are not preserved across that reload.
- Only an accepted Formspree response creates a receipt: a cryptographically random identifier and timestamp, without form fields, in tab session storage. The enhanced form then redirects to `/thank-you`.
- The thank-you page consumes the receipt before measuring, requires advertising consent, expires receipts after 30 minutes, and sends `AW-16967723902/SPEICIfdrfQcEP7W65o_` with the receipt ID as `transaction_id`. Consent may be granted while this confirmation stays open. Refreshes, direct visits and repeated navigation do not generate another conversion. The page is `noindex` and excluded from the sitemap.
- When receipt storage is unavailable, the form shows its existing inline success message, with no conversion. Native submissions without JavaScript retain Formspree's confirmation. Neither case prevents the enquiry from being submitted.
- WhatsApp clicks use the existing separate action `AW-16967723902/tS-cCI3drfQcEP7W65o_`, only with consent.
- Phone links work normally and, with advertising consent, send the dedicated **Website Phone Button Click** conversion `AW-16967723902/svwUCOKJ66YdEP7W65o_`. A phone click measures intent, not a completed call.
- `/privacy-policy` is linked from all forms, footers and the consent panel. It includes Essential Pest Control (Pty) Ltd, Box 24 Murrayfield, Pretoria, 0184, and info@essentialpestcontrol.co.za. Review the draft against actual business retention practices, provider arrangements, and POPIA disclosure requirements before relying on it as a complete compliance notice. The supplied address is presented as a postal address; no physical street address or Information Officer details have been invented.

## Required Google Ads account settings

Website code cannot set an action's Primary/Secondary status or its counting option.

1. In Goals → Conversions → Summary, find the existing form conversion. Verify its installation details match `AW-16967723902/SPEICIfdrfQcEP7W65o_`. Set it to **Primary**, category **Submit lead form**, count **One**.
2. Set WhatsApp, website phone clicks and other call actions to **Secondary**. Review campaign goals and custom goals: custom goals can still use Secondary actions for bidding.
3. Review overlapping lead actions, imported GA4 leads and automatic contact events in the account. The existing thank-you URL rule (`z8qWCKz91qYdEP7W65o_`) is present in the shared tag and is preserved by this website change. Do not remove or recreate it as part of the consent rollout. Account bidding and counting choices need a separate review.
4. Verify **Website Phone Button Click** matches `AW-16967723902/svwUCOKJ66YdEP7W65o_`, with optimisation **Secondary** and count **One**. Its dedicated label is configured as `phoneConversionLabel`.
5. Verify auto-tagging, tag diagnostics and Google tag destinations. Check for unexpected linked properties. Landing-page redirects must preserve advertising click parameters.
6. After publishing, use Tag Assistant to check all four consent signals, one GA4 page view with Analytics accepted (including Advertising rejected), one form event with a transaction ID, the existing thank-you URL rule and the separate WhatsApp/phone actions. Check the absence of Google requests after rejecting both and no Ads measurement with Analytics alone. Confirm actual attribution in Ads reporting separately. A fired test event does not guarantee an attributed conversion.

**Conversions** should reflect the Primary lead action after account settings are applied. **All conversions** can include both a WhatsApp click and an enquiry.

## Publishing and verification

Publish all modified HTML pages and the shared scripts/styles together, including `quote-form.js`, `google-ads-conversions.js`, `site-consent.js`, `privacy.css`, `information-pages.js`, `thank-you.html`, `privacy-policy.html`, and `sitemap.xml`. Publish to the `main` branch of `HebrZAI/Essential-Pest-Control-Website`, which deploys through GitHub Pages. Check that the Pages deployment succeeds and the production home page serves this form implementation.

Run the local browser checks described in `tests/README.md`. The normal suite mocks or blocks external requests. The optional `GOOGLE_TAG_TEST=1` integration suite downloads Google’s actual tag, serves the local site at a virtual production origin to exercise the existing URL rule, and intercepts every measurement request before it reaches Google. Neither suite sends leads or live conversions. The static receipt prevents accidental duplicate measurement; it is not a signed server-side proof against deliberately forged browser storage.

Official references:

- [GA4 manual page views](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google tag configuration](https://developers.google.com/tag-platform/gtagjs/configure)
- [Google Basic Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Consent Mode implementation](https://developers.google.com/tag-platform/security/guides/consent)
- [Google Ads transaction IDs](https://support.google.com/google-ads/answer/6386790?hl=en)
- [Primary and Secondary actions](https://support.google.com/google-ads/answer/11461796?hl=en)
- [Counting options](https://support.google.com/google-ads/answer/3438531?hl=en)
- [Formspree privacy policy](https://formspree.io/legal/privacy-policy/)
- [POPIA](https://www.gov.za/sites/default/files/gcis_document/201409/3706726-11act4of2013popi.pdf)
