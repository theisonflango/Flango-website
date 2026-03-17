/* Flango shared navigation — burger menu toggle */
(function() {
  var nav = document.querySelector('.flango-nav');
  var burger = document.querySelector('.flango-burger');
  var menu = document.getElementById('flangoMobileMenu');
  var open = false;

  if (!nav || !burger || !menu) return;

  // Scroll shadow
  window.addEventListener('scroll', function() {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Toggle
  burger.addEventListener('click', function() {
    open = !open;
    burger.classList.toggle('active', open);
    burger.setAttribute('aria-expanded', open);
    menu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // Close on link click
  menu.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      open = false;
      burger.classList.remove('active');
      burger.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
})();
