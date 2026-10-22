(function () {
  'use strict';
  const media = window.matchMedia('(max-width: 760px)');
  const headings = document.querySelectorAll('.footer-heading');
  function sync() {
    headings.forEach(function (button) {
      button.setAttribute('aria-expanded', String(!media.matches));
      document.getElementById(button.getAttribute('aria-controls')).classList.toggle('open', !media.matches);
    });
  }
  headings.forEach(function (button) {
    button.addEventListener('click', function () {
      if (!media.matches) return;
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      document.getElementById(button.getAttribute('aria-controls')).classList.toggle('open', open);
    });
  });
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  sync();
  media.addEventListener('change', sync);
})();
