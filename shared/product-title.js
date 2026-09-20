/* Deles af HTML-siderne og Ugeplan-appens offentlige produktsider. */
(() => {
  if (window.flangoProductTitle) return;
  const mounted = new WeakMap();
  const measure = document.createElement('canvas').getContext('2d');

  function mount(hero) {
    if (mounted.has(hero)) return mounted.get(hero);
    const product = hero.querySelector('.flango-product-name');
    const word = hero.querySelector('.flango-product-word');
    const baseline = hero.querySelector('.flango-product-baseline');
    if (!product || !word || !baseline) return () => {};
    let active = true;

    function align() {
      if (!active || !hero.isConnected) return;
      const type = getComputedStyle(product);
      if (measure) {
        measure.font = `${type.fontStyle} ${type.fontWeight} ${type.fontSize} ${type.fontFamily}`;
        measure.textAlign = 'left';
        if ('letterSpacing' in measure) measure.letterSpacing = type.letterSpacing;
        // Justér den synlige bogstavkant, ikke kun tekstens CSS-boks.
        const offset = measure.measureText(product.textContent.trim()).actualBoundingBoxLeft;
        if (Number.isFinite(offset)) hero.style.setProperty('--flango-product-offset', `${offset}px`);
      }
      // Frugten stopper på grundlinjen; underlængden på fx y er ikke med.
      const height = baseline.getBoundingClientRect().top - word.getBoundingClientRect().top;
      if (height > 0) hero.style.setProperty('--flango-fruit-height', `${height}px`);
    }

    const cleanup = () => {
      active = false;
      window.removeEventListener('resize', align);
      mounted.delete(hero);
    };
    mounted.set(hero, cleanup);
    align();
    document.fonts.ready.then(align);
    window.addEventListener('resize', align);
    return cleanup;
  }

  window.flangoProductTitle = { mount };
  const init = () => document.querySelectorAll('.flango-product-hero').forEach(mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
