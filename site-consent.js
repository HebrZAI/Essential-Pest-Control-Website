(function () {
  'use strict';
  const key = 'epc-consent-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  let choice = readChoice();
  let loaded = false;
  let returnFocus;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', analytics_storage: 'denied'
  });
  window.gtag('set', 'ads_data_redaction', true);

  function readChoice() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && typeof saved.advertising === 'boolean' && Number.isFinite(saved.savedAt)
        && saved.savedAt <= Date.now() && Date.now() - saved.savedAt < lifetime) return saved;
    } catch (error) { /* Optional storage may be unavailable. */ }
    return null;
  }
  function allowed() { return Boolean(choice && choice.advertising && Date.now() - choice.savedAt < lifetime); }
  function loadTag() {
    if (loaded || !allowed()) return;
    loaded = true;
    window.gtag('consent', 'update', {
      ad_storage: 'granted', ad_user_data: 'granted',
      ad_personalization: 'denied', analytics_storage: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', 'AW-16967723902', {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-16967723902';
    document.head.append(script);
  }
  function clearAdvertisingCookies() {
    const labels = location.hostname.split('.');
    const domains = [''];
    for (let i = 0; i < labels.length; i++) domains.push(labels.slice(i).join('.'));
    const parts = location.pathname.split('/');
    const paths = new Set(['/']);
    for (let i = 1; i < parts.length; i++) paths.add(parts.slice(0, i).join('/') || '/');
    document.cookie.split(';').forEach(function (cookie) {
      const name = cookie.split('=')[0].trim();
      if (!/^(_gcl_|_gac_|_gads|_gpi|__gads|__gpi|__eoi)/.test(name)) return;
      domains.forEach(function (domain) {
        paths.forEach(function (path) {
          document.cookie = name + '=; Max-Age=0; path=' + path + (domain ? '; domain=' + domain : '');
        });
      });
    });
  }

  const panel = document.createElement('section');
  panel.className = 'consent-panel';
  panel.setAttribute('aria-labelledby', 'consent-title');
  panel.hidden = true;
  const root = new URL('.', document.currentScript.src);
  const privacyUrl = new URL(location.protocol === 'file:' ? 'privacy-policy.html' : 'privacy-policy', root);
  panel.innerHTML = '<div class="consent-copy"><h2 id="consent-title">Your privacy choices</h2>'
    + '<p>We use necessary storage to remember your choices and confirm enquiries. With your permission, Google Ads measures enquiries and contact clicks. <a href="' + privacyUrl.href + '">Privacy policy</a></p></div>'
    + '<div class="consent-options" id="consent-options" hidden><p><strong>Necessary storage · always on</strong><br>Remembers these choices for 180 days and temporarily confirms a successful enquiry.</p>'
    + '<label><input type="checkbox" id="consent-advertising"> <span><strong>Advertising measurement</strong><br>Allow Google Ads conversion measurement. Analytics and advertising personalization stay off.</span></label></div>'
    + '<div class="consent-actions"><button type="button" data-consent="accept">Accept</button><button type="button" data-consent="reject">Reject optional</button>'
    + '<button type="button" data-consent="preferences" aria-expanded="false" aria-controls="consent-options">Preferences</button>'
    + '<button type="button" data-consent="save" hidden>Save preferences</button><button type="button" data-consent="close" hidden>Cancel</button></div>';
  document.body.append(panel);
  const options = panel.querySelector('.consent-options');
  const checkbox = panel.querySelector('input');
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
    checkbox.checked = allowed();
    reloadNotice.hidden = !loaded;
    options.hidden = !expanded;
    preferences.hidden = expanded;
    preferences.setAttribute('aria-expanded', String(expanded));
    save.hidden = !expanded;
    close.hidden = !choice;
    panel.hidden = false;
    document.documentElement.classList.add('consent-open');
    resize();
    if (expanded) checkbox.focus({ preventScroll: true });
  }
  function hide() {
    panel.hidden = true;
    document.documentElement.classList.remove('consent-open');
    resize();
    if (returnFocus && panel.contains(document.activeElement)) returnFocus.focus({ preventScroll: true });
  }
  function choose(advertising) {
    choice = { advertising: advertising, savedAt: Date.now() };
    try {
      // Remove an old grant first so a full storage quota cannot restore it after withdrawal.
      if (!advertising) localStorage.removeItem(key);
      localStorage.setItem(key, JSON.stringify(choice));
    }
    catch (error) { /* Consent still applies to this document. */ }
    hide();
    if (!advertising) {
      clearAdvertisingCookies();
      if (loaded) {
        // Unload the running tag: a denied update alone can still send cookieless pings.
        window['ga-disable-AW-16967723902'] = true;
        window.gtag = function () {};
        window.dataLayer.length = 0;
        location.reload();
        return;
      }
    } else loadTag();
    document.dispatchEvent(new Event('epc:consent-change'));
  }
  panel.addEventListener('click', function (event) {
    const button = event.target.closest('button[data-consent]');
    if (!button) return;
    switch (button.dataset.consent) {
      case 'accept': choose(true); break;
      case 'reject': choose(false); break;
      case 'save': choose(checkbox.checked); break;
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
    if (loaded && !allowed()) {
      window['ga-disable-AW-16967723902'] = true;
      clearAdvertisingCookies();
      location.reload();
    } else if (choice) { hide(); loadTag(); document.dispatchEvent(new Event('epc:consent-change')); }
    else show(false);
  });
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    choice = readChoice();
    if (loaded && !allowed()) { location.reload(); return; }
    if (!choice) show(false);
  });
  window.epcConsent = { allowsAdvertising: allowed };
  if (!choice) { clearAdvertisingCookies(); show(false); }
  else if (allowed()) loadTag();
  else clearAdvertisingCookies();
})();
