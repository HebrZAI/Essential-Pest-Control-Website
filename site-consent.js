(function () {
  'use strict';
  const key = 'epc-consent-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  let choice = readChoice();
  let loaded = false;
  let pageViewed = false;
  let active = { analytics: false, advertising: false };
  let returnFocus;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', analytics_storage: 'denied'
  });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', {
    send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false
  });

  function readChoice() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && saved.version === 2 && typeof saved.analytics === 'boolean' && typeof saved.advertising === 'boolean' && Number.isFinite(saved.savedAt)
        && saved.savedAt <= Date.now() && Date.now() - saved.savedAt < lifetime) return saved;
    } catch (error) { /* Optional storage may be unavailable. */ }
    return null;
  }
  function allowed(category) { return Boolean(choice && choice[category] && Date.now() - choice.savedAt < lifetime); }
  function applyChoice() {
    const analytics = allowed('analytics');
    const advertising = allowed('advertising');
    clearOptionalCookies(analytics, advertising);
    window['ga-disable-G-8BX38H8R3L'] = !analytics;
    window['ga-disable-AW-16967723902'] = !advertising;
    if (loaded && ((active.analytics && !analytics) || (active.advertising && !advertising))) {
      // Unload running destinations: denied consent alone can still send cookieless pings.
      window['ga-disable-G-8BX38H8R3L'] = true;
      window['ga-disable-AW-16967723902'] = true;
      window.gtag = function () {};
      window.dataLayer.length = 0;
      location.reload();
      return;
    }
    window.gtag('consent', 'update', {
      ad_storage: advertising ? 'granted' : 'denied', ad_user_data: advertising ? 'granted' : 'denied',
      ad_personalization: 'denied', analytics_storage: analytics ? 'granted' : 'denied'
    });
    if (!loaded && (analytics || advertising)) {
      loaded = true;
      window.gtag('js', new Date());
      // GA4 is already connected to this shared tag; initialize Ads only with its permission.
      if (advertising) window.gtag('config', 'AW-16967723902', {
        send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false
      });
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-16967723902';
      document.head.append(script);
    } else if (advertising && !active.advertising) {
      // Enable Ads later without reloading the shared tag or replaying the GA4 page view.
      window.gtag('config', 'AW-16967723902', {
        send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false
      });
    }
    if (analytics && !pageViewed) {
      pageViewed = true;
      window.gtag('event', 'page_view', { send_to: 'G-8BX38H8R3L' });
    }
    active = { analytics: analytics, advertising: advertising };
    document.dispatchEvent(new Event('epc:consent-change'));
  }
  function clearOptionalCookies(analytics, advertising) {
    const labels = location.hostname.split('.');
    const domains = [''];
    for (let i = 0; i < labels.length; i++) domains.push(labels.slice(i).join('.'));
    const parts = location.pathname.split('/');
    const paths = new Set(['/']);
    for (let i = 1; i < parts.length; i++) paths.add(parts.slice(0, i).join('/') || '/');
    document.cookie.split(';').forEach(function (cookie) {
      const name = cookie.split('=')[0].trim();
      const analyticsCookie = !analytics && /^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name);
      const advertisingCookie = !advertising && /^(_gcl_|_gac_|_gads|_gpi|__gads|__gpi|__eoi)/.test(name);
      if (!analyticsCookie && !advertisingCookie) return;
      domains.forEach(function (domain) {
        paths.forEach(function (path) {
          document.cookie = name + '=; Max-Age=0; path=' + path + (domain ? '; domain=' + domain : '');
        });
      });
    });
  }

  const panel = document.createElement('section');
  panel.className = 'consent-panel';
  panel.setAttribute('aria-label', 'Cookie preferences');
  panel.hidden = true;
  const root = new URL('.', document.currentScript.src);
  const privacyUrl = new URL(location.protocol === 'file:' ? 'privacy-policy.html' : 'privacy-policy', root);
  panel.innerHTML = '<p class="consent-summary">Optional cookies help us measure visits and enquiries. <a href="' + privacyUrl.href + '">Privacy policy</a></p>'
    + '<div class="consent-options" id="consent-options" hidden><h2>Your privacy choices</h2>'
    + '<p>We use necessary storage to remember your choices and confirm enquiries. With your permission, Google Analytics measures website use and Google Ads measures enquiries and contact clicks. You can choose each separately. Advertising personalization stays off.</p>'
    + '<p><strong>Necessary storage · always on</strong><br>Remembers these choices for 180 days and temporarily confirms a successful enquiry.</p>'
    + '<label><input type="checkbox" id="consent-analytics"> <span><strong>Analytics</strong><br>Allow Google Analytics to measure page visits and website use.</span></label>'
    + '<label><input type="checkbox" id="consent-advertising"> <span><strong>Advertising measurement</strong><br>Allow Google Ads conversion measurement. Advertising personalization stays off.</span></label></div>'
    + '<div class="consent-actions"><button type="button" data-consent="accept">Accept</button><button type="button" data-consent="reject">Reject optional</button>'
    + '<button type="button" data-consent="preferences" aria-expanded="false" aria-controls="consent-options">Preferences</button>'
    + '<button type="button" data-consent="save" hidden>Save preferences</button><button type="button" data-consent="close" hidden>Cancel</button></div>';
  document.body.append(panel);
  const options = panel.querySelector('.consent-options');
  const analyticsCheckbox = panel.querySelector('#consent-analytics');
  const advertisingCheckbox = panel.querySelector('#consent-advertising');
  const preferences = panel.querySelector('[data-consent="preferences"]');
  const save = panel.querySelector('[data-consent="save"]');
  const close = panel.querySelector('[data-consent="close"]');
  const reloadNotice = document.createElement('p');
  reloadNotice.textContent = 'Withdrawing permission reloads this page. Unsent form details will be cleared.';
  options.append(reloadNotice);
  function resize() {
    document.documentElement.style.setProperty('--consent-height', panel.hidden ? '0px' : panel.getBoundingClientRect().height + 'px');
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(panel);
  window.addEventListener('resize', resize);
  function show(expanded) {
    if (!panel.contains(document.activeElement)) returnFocus = document.activeElement;
    panel.classList.toggle('is-expanded', expanded);
    analyticsCheckbox.checked = allowed('analytics');
    advertisingCheckbox.checked = allowed('advertising');
    reloadNotice.hidden = !loaded;
    options.hidden = !expanded;
    preferences.hidden = expanded;
    preferences.setAttribute('aria-expanded', String(expanded));
    save.hidden = !expanded;
    close.hidden = !choice;
    panel.hidden = false;
    document.documentElement.classList.add('consent-open');
    document.documentElement.classList.toggle('consent-expanded', expanded);
    resize();
    if (expanded) analyticsCheckbox.focus({ preventScroll: true });
  }
  function hide() {
    panel.hidden = true;
    document.documentElement.classList.remove('consent-open', 'consent-expanded');
    resize();
    if (returnFocus && panel.contains(document.activeElement)) returnFocus.focus({ preventScroll: true });
  }
  function choose(analytics, advertising) {
    choice = { version: 2, analytics: analytics, advertising: advertising, savedAt: Date.now() };
    try {
      // Remove the previous grant first so a full quota cannot restore withdrawn permission.
      localStorage.removeItem(key);
      localStorage.setItem(key, JSON.stringify(choice));
    }
    catch (error) { /* Consent still applies to this document. */ }
    hide();
    applyChoice();
  }
  panel.addEventListener('click', function (event) {
    const button = event.target.closest('button[data-consent]');
    if (!button) return;
    switch (button.dataset.consent) {
      case 'accept': choose(true, true); break;
      case 'reject': choose(false, false); break;
      case 'save': choose(analyticsCheckbox.checked, advertisingCheckbox.checked); break;
      case 'preferences': show(true); break;
      case 'close': hide(); break;
    }
  });
  panel.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && choice) { hide(); returnFocus.focus({ preventScroll: true }); }
  });
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-cookie-settings]')) { event.preventDefault(); show(true); }
  });
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    choice = readChoice();
    applyChoice();
    if (choice) hide();
    else show(false);
  });
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    choice = readChoice();
    applyChoice();
    if (choice) hide();
    else show(false);
  });
  window.epcConsent = {
    allowsAnalytics: function () { return allowed('analytics'); },
    allowsAdvertising: function () { return allowed('advertising'); }
  };
  applyChoice();
  if (!choice) show(false);
})();
