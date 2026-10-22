(function () {
  'use strict';
  const receiptKey = 'epc-enquiry-receipt-v1';
  const receiptLifetime = 30 * 60 * 1000;
  const formAction = 'AW-16967723902/SPEICIfdrfQcEP7W65o_';
  const whatsappAction = 'AW-16967723902/tS-cCI3drfQcEP7W65o_';
  // Supply the dedicated Secondary phone action's label after creating it in Google Ads.
  const phoneConversionLabel = '';

  function canTrack() {
    return window.epcConsent && window.epcConsent.allowsAdvertising() && typeof window.gtag === 'function';
  }
  window.epcEnquiry = {
    remember: function () {
      try {
        const random = new Uint8Array(16);
        crypto.getRandomValues(random);
        const receipt = JSON.stringify({
          id: Array.from(random, function (byte) { return byte.toString(16).padStart(2, '0'); }).join(''),
          createdAt: Date.now()
        });
        sessionStorage.setItem(receiptKey, receipt);
        return sessionStorage.getItem(receiptKey) === receipt;
      } catch (error) { return false; }
    }
  };

  const confirmation = document.querySelector('[data-enquiry-confirmation]');
  if (confirmation) {
    let receipt;
    let sent = false;
    try {
      const saved = JSON.parse(sessionStorage.getItem(receiptKey));
      sessionStorage.removeItem(receiptKey);
      if (sessionStorage.getItem(receiptKey) === null && saved && /^[a-f0-9]{32}$/.test(saved.id)
        && Number.isFinite(saved.createdAt) && saved.createdAt <= Date.now()
        && Date.now() - saved.createdAt < receiptLifetime) receipt = saved;
    } catch (error) { /* A direct visit or blocked storage cannot confirm an enquiry. */ }
    if (receipt) {
      document.querySelector('[data-enquiry-unconfirmed]').hidden = true;
      confirmation.hidden = false;
      document.title = 'Request received | Essential Pest Control';
    }
    function trackEnquiry() {
      if (!receipt || sent || Date.now() - receipt.createdAt >= receiptLifetime || !canTrack()) return;
      sent = true;
      try {
        window.gtag('event', 'conversion', { send_to: formAction, transaction_id: receipt.id });
      } catch (error) { /* Measurement must never interrupt the confirmation. */ }
    }
    trackEnquiry();
    document.addEventListener('epc:consent-change', trackEnquiry);
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || !canTrack()) return;
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    const link = target && target.closest('a[href]');
    if (!link) return;
    let url;
    try { url = new URL(link.href, document.baseURI); } catch (error) { return; }
    let action;
    if (url.protocol === 'whatsapp:' || (url.protocol === 'https:'
      && (url.hostname === 'wa.me' || url.hostname === 'api.whatsapp.com'))) action = whatsappAction;
    else if (url.protocol === 'tel:' && phoneConversionLabel) action = 'AW-16967723902/' + phoneConversionLabel;
    if (!action) return;
    try { window.gtag('event', 'conversion', { send_to: action }); }
    catch (error) { /* Contact links work even when tracking is blocked. */ }
  });
})();
