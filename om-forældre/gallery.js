(() => {
  'use strict';

  const gallery = document.querySelector('[data-portal-gallery]');
  if (!gallery) return;
  const slides = [...gallery.querySelectorAll('[data-gallery-slide]')];
  if (slides.length < 2) return;

  let current = 0;
  let timer;

  function show(index) {
    current = index % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
      slide.classList.toggle('is-active', i === current);
    });
    gallery.dataset.slide = String(current + 1);
  }

  function schedule() {
    window.clearInterval(timer);
    gallery.dataset.playing = String(!document.hidden);
    if (!document.hidden) {
      timer = window.setInterval(() => show(current + 1), 5000);
    }
  }

  document.addEventListener('visibilitychange', schedule);
  show(0);
  schedule();
})();
