(function () {
  'use strict';

  // Direct file previews need real filenames and a site-relative home directory.
  if (window.location.protocol !== 'file:') return;
  const root = new URL('.', document.currentScript.src);
  document.querySelectorAll('a[href]').forEach(function (link) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(href)) return;
    const url = href.startsWith('/') ? new URL(href.slice(1), root) : new URL(href, window.location.href);
    if (url.pathname.endsWith('/')) url.pathname += 'index.html';
    else if (!url.pathname.split('/').pop().includes('.')) url.pathname += '.html';
    link.href = url.href;
  });
})();

(function () {
  'use strict';

  const form = document.getElementById('quoteForm');
  if (!form) return;

  const panel = document.getElementById('contact');
  const steps = Array.from(form.querySelectorAll('[data-quote-step]'));
  const next = form.querySelector('.quote-next');
  const back = form.querySelector('.quote-back');
  const progress = form.querySelector('.quote-progress');
  const progressTrack = form.querySelector('.quote-progress-track');
  const stepStatus = document.getElementById('quoteStepStatus');
  const stepName = document.getElementById('quoteStepName');
  const message = document.getElementById('formMessage');
  const submit = form.querySelector('[type="submit"]');
  const success = document.getElementById('quoteSuccess');
  const bar = document.querySelector('.quote-bar');
  const mobile = window.matchMedia('(max-width: 760px)');
  const pestSelect = form.querySelector('#pest-type');
  let activeStep = 0;
  let sending = false;
  let completed = false;
  let panelVisible = true;
  const pestPicker = pestSelect ? createPestPicker(pestSelect) : null;

  function createPestPicker(select) {
    const field = select.closest('.quote-field');
    const label = field.querySelector('label');
    const options = Array.from(select.options).filter(function (option) { return option.value; });
    const toggle = document.createElement('button');
    const summary = document.createElement('span');
    const list = document.createElement('div');
    const error = document.createElement('p');
    const checkboxes = [];

    field.classList.add('quote-pest-field');
    label.id = 'pest-type-label';
    label.htmlFor = 'pest-type-toggle';
    toggle.type = 'button';
    toggle.id = 'pest-type-toggle';
    toggle.className = 'quote-pest-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'pest-type-options');
    toggle.setAttribute('aria-labelledby', 'pest-type-label pest-type-summary');
    summary.id = 'pest-type-summary';
    toggle.append(summary);
    list.id = 'pest-type-options';
    list.className = 'quote-pest-options';
    list.setAttribute('role', 'group');
    list.setAttribute('aria-labelledby', label.id);
    list.hidden = true;
    error.id = 'pest-type-error';
    error.className = 'quote-pest-error';
    error.textContent = 'Select at least one pest or service.';
    error.hidden = true;
    error.setAttribute('role', 'alert');

    function close() {
      list.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }

    function sync() {
      const selected = options.filter(function (option) { return option.selected; });
      summary.textContent = selected.length === 0 ? 'Select one or more'
        : selected.length === 1 ? selected[0].textContent : selected.length + ' selected';
      checkboxes.forEach(function (checkbox, index) { checkbox.checked = options[index].selected; });
      if (selected.length) {
        error.hidden = true;
        toggle.removeAttribute('aria-invalid');
        toggle.removeAttribute('aria-describedby');
      }
    }

    options.forEach(function (option) {
      const choice = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = option.value;
      checkbox.addEventListener('change', function () {
        option.selected = checkbox.checked;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      choice.append(checkbox, document.createTextNode(option.textContent));
      list.append(choice);
      checkboxes.push(checkbox);
    });

    toggle.addEventListener('click', function () {
      if (!list.hidden) return close();
      const rect = toggle.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const upwards = below < 280 && above > below;
      list.classList.toggle('opens-up', upwards);
      list.style.maxHeight = Math.max(100, Math.min(280, (upwards ? above : below) - 16)) + 'px';
      list.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    });
    field.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !list.hidden) {
        event.preventDefault();
        close();
        toggle.focus();
      }
    });
    field.addEventListener('focusout', function (event) {
      // Label clicks briefly clear focus before activating their checkbox.
      if (event.relatedTarget && !field.contains(event.relatedTarget)) close();
    });
    document.addEventListener('pointerdown', function (event) {
      if (!field.contains(event.target)) close();
    });
    window.addEventListener('resize', close);
    select.addEventListener('change', sync);
    form.addEventListener('reset', function () { window.setTimeout(sync, 0); });

    field.append(toggle, list, error);
    select.hidden = true;
    sync();
    return {
      close: close,
      showError: function () {
        error.hidden = false;
        toggle.setAttribute('aria-invalid', 'true');
        toggle.setAttribute('aria-describedby', error.id);
        toggle.focus();
      }
    };
  }

  function updateBar() {
    if (!bar) return;
    const editing = document.activeElement && document.activeElement.matches('input, select, textarea');
    bar.hidden = !mobile.matches || panelVisible || editing || completed;
  }

  function showStep(index, moveFocus) {
    if (pestPicker) pestPicker.close();
    activeStep = index;
    steps.forEach(function (step, i) {
      step.classList.toggle('is-active', i === index);
      step.inert = i !== index;
      step.setAttribute('aria-hidden', String(i !== index));
    });
    stepStatus.textContent = 'Step ' + (index + 1) + ' of 2';
    stepName.textContent = steps[index].dataset.stepName;
    progressTrack.classList.toggle('is-final-step', index === 1);
    if (moveFocus) steps[index].querySelector('input:not([type="hidden"]), select:not([hidden]), textarea, button').focus();
    updateBar();
  }

  function validateStep(index) {
    const invalid = Array.from(steps[index].querySelectorAll('input, select, textarea'))
      .find(function (field) { return !field.checkValidity(); });
    if (!invalid) return true;
    if (activeStep !== index) showStep(index, false);
    if (invalid === pestSelect && pestPicker) pestPicker.showError();
    else invalid.reportValidity();
    return false;
  }

  next.addEventListener('click', function () {
    if (validateStep(0)) showStep(1, true);
  });
  back.addEventListener('click', function () {
    if (!sending) showStep(0, true);
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sending || completed) return;
    if (activeStep === 0) {
      if (validateStep(0)) showStep(1, true);
      return;
    }
    if (!validateStep(0) || !validateStep(1)) return;

    sending = true;
    submit.disabled = true;
    back.disabled = true;
    submit.textContent = 'Sending your request…';
    form.setAttribute('aria-busy', 'true');
    message.hidden = false;
    message.classList.remove('error');
    message.textContent = 'Sending your quote request…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) {
        let detail;
        try {
          const data = await response.json();
          detail = data.error || (Array.isArray(data.errors) && data.errors.map(function (error) {
            return error.message;
          }).filter(Boolean).join(' '));
        } catch (error) {
          // A non-JSON server error must still leave the enquiry ready to retry.
        }
        throw new Error(detail || 'We couldn’t send your request. Please try again, or call 068 602 2225.');
      }

      completed = true;
      form.reset();
      form.hidden = true;
      success.hidden = false;
      document.getElementById('quote-heading').textContent = 'Quote request received';
      panel.querySelector('.quote-intro').hidden = true;
      panel.classList.add('is-success');
      success.focus();
      updateBar();
      // Keep the completed state intact if Back restores this page or storage is unavailable.
      if (window.epcEnquiry && window.epcEnquiry.remember()) {
        const root = new URL('.', document.querySelector('script[src$="quote-form.js"]').src);
        window.location.assign(new URL(window.location.protocol === 'file:' ? 'thank-you.html' : 'thank-you', root).href);
        return;
      }
    } catch (error) {
      message.classList.add('error');
      message.textContent = error instanceof TypeError
        ? 'We couldn’t connect. Your details are still here. Please try again, or call 068 602 2225.'
        : error.message;
    } finally {
      sending = false;
      submit.disabled = false;
      back.disabled = false;
      submit.textContent = 'Request my free quote';
      form.removeAttribute('aria-busy');
    }
  });

  // Enhance the complete HTML form only after its handlers are ready.
  form.noValidate = true;
  form.classList.add('is-enhanced');
  next.hidden = false;
  back.hidden = false;
  progress.hidden = false;
  progressTrack.hidden = false;
  showStep(0, false);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      panelVisible = entries[0].isIntersecting;
      updateBar();
    }).observe(panel);
  } else {
    const checkPanel = function () {
      const rect = panel.getBoundingClientRect();
      panelVisible = rect.bottom > 0 && rect.top < window.innerHeight;
      updateBar();
    };
    window.addEventListener('scroll', checkPanel, { passive: true });
    window.addEventListener('resize', checkPanel);
    checkPanel();
  }
  document.addEventListener('focusin', updateBar);
  document.addEventListener('focusout', function () { window.requestAnimationFrame(updateBar); });
  mobile.addEventListener('change', updateBar);
})();
