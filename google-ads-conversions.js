(function () {
  'use strict';

  if (window.__googleAdsWhatsAppTrackingInstalled) return;
  window.__googleAdsWhatsAppTrackingInstalled = true;

  function isWhatsAppLink(link) {
    const href = link.getAttribute('href');
    if (!href) return false;

    const normalizedHref = href.trim().toLowerCase();
    if (normalizedHref.startsWith('whatsapp://')) return true;

    try {
      const url = new URL(href, document.baseURI);
      return url.hostname === 'wa.me' || url.hostname === 'api.whatsapp.com';
    } catch (error) {
      return false;
    }
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented) return;

    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    const link = target && target.closest('a[href]');
    if (!link || !isWhatsAppLink(link) || typeof window.gtag !== 'function') return;

    let finished = false;
    let fallbackTimer;
    const finishTracking = function () {
      if (finished) return;
      finished = true;
      window.clearTimeout(fallbackTimer);
    };

    fallbackTimer = window.setTimeout(finishTracking, 300);

    try {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-16967723902/tS-cCI3drfQcEP7W65o_',
        'event_callback': finishTracking,
        'event_timeout': 300
      });
    } catch (error) {
      finishTracking();
    }
  });
})();
