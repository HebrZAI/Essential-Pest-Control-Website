# Google Ads tracking and privacy rollout

Implemented 22 October 2026. The site remains static and uses Formspree.

## Website behavior

- Every page loads `privacy.css`, `site-consent.js`, then `google-ads-conversions.js`. There is no unconditional Google tag, GTM or GA4 installation.
- Basic Consent Mode v2 starts with all four Google consent signals denied. Google Ads tag `AW-16967723902` loads only after advertising measurement is accepted. Analytics and advertising personalization remain denied.
- Accept, Reject optional and Preferences are available in the bottom panel. Cookie settings in every footer reopens preferences. Choices expire after 180 days. Changing a granted choice to rejected reloads the page to unload Google's running script and avoid further cookieless measurement; unsent form edits are not preserved across that reload.
- Only an accepted Formspree response creates a receipt: a cryptographically random identifier and timestamp, without form fields, in tab session storage. The enhanced form then redirects to `/thank-you`.
- The thank-you page consumes the receipt before measuring, requires advertising consent, expires receipts after 30 minutes, and sends `AW-16967723902/SPEICIfdrfQcEP7W65o_` with the receipt ID as `transaction_id`. Consent may be granted while this confirmation stays open. Refreshes, direct visits and repeated navigation do not generate another conversion. The page is `noindex` and excluded from the sitemap.
- When receipt storage is unavailable, the form shows its existing inline success message, with no conversion. Native submissions without JavaScript retain Formspree's confirmation. Neither case prevents the enquiry from being submitted.
- WhatsApp clicks use the existing separate action `AW-16967723902/tS-cCI3drfQcEP7W65o_`, only with consent.
- Phone links work normally. Measurement is deliberately inactive until the dedicated phone action label is entered as `phoneConversionLabel` in `google-ads-conversions.js`. A phone click measures intent, not a completed call.
- `/privacy-policy` is linked from all forms, footers and the consent panel. It includes Essential Pest Control (Pty) Ltd, Box 24 Murrayfield, Pretoria, 0184, and info@essentialpestcontrol.co.za. Review the draft against actual business retention practices, provider arrangements, and POPIA disclosure requirements before relying on it as a complete compliance notice. The supplied address is presented as a postal address; no physical street address or Information Officer details have been invented.

## Required Google Ads account settings

Website code cannot set an action's Primary/Secondary status or its counting option.

1. In Goals → Conversions → Summary, find the existing form conversion. Verify its installation details match `AW-16967723902/SPEICIfdrfQcEP7W65o_`. Set it to **Primary**, category **Submit lead form**, count **One**.
2. Set WhatsApp, website phone clicks and other call actions to **Secondary**. Review campaign goals and custom goals: custom goals can still use Secondary actions for bidding.
3. Remove overlapping Primary lead actions, including a separate thank-you URL conversion, imported GA4 leads and automatic contact events. The existing form action should be the sole Primary website lead action.
4. Create a dedicated Secondary website phone-click conversion if desired. Copy its label into `phoneConversionLabel`. Do not reuse the form or WhatsApp label.
5. Verify auto-tagging, tag diagnostics and Google tag destinations. Check for unexpected linked properties. Landing-page redirects must preserve advertising click parameters.
6. After publishing, use Tag Assistant to check consent, one form event with a transaction ID, WhatsApp's separate event, and the absence of tracking after rejection. Confirm actual attribution in Ads reporting separately. A fired test event does not guarantee an attributed conversion.

**Conversions** should reflect the Primary lead action after account settings are applied. **All conversions** can include both a WhatsApp click and an enquiry.

## Publishing and verification

Publish all modified HTML pages and the shared scripts/styles together, including `quote-form.js`, `google-ads-conversions.js`, `site-consent.js`, `privacy.css`, `information-pages.js`, `thank-you.html`, `privacy-policy.html`, and `sitemap.xml`. Publish to the `main` branch of `HebrZAI/Essential-Pest-Control-Website`, which deploys through GitHub Pages. Check that the Pages deployment succeeds and the production home page serves this form implementation.

Run the local browser checks described in `tests/README.md`. External requests are mocked or blocked, so they do not send leads or live conversions. The static receipt prevents accidental duplicate measurement; it is not a signed server-side proof against deliberately forged browser storage.

Official references:

- [Google Basic Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Consent Mode implementation](https://developers.google.com/tag-platform/security/guides/consent)
- [Google Ads transaction IDs](https://support.google.com/google-ads/answer/6386790?hl=en)
- [Primary and Secondary actions](https://support.google.com/google-ads/answer/11461796?hl=en)
- [Counting options](https://support.google.com/google-ads/answer/3438531?hl=en)
- [Formspree privacy policy](https://formspree.io/legal/privacy-policy/)
- [POPIA](https://www.gov.za/sites/default/files/gcis_document/201409/3706726-11act4of2013popi.pdf)
