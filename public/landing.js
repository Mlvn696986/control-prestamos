(() => {
  'use strict';

  // Los enlaces de acceso antiguos regresan a la raiz autorizada en Supabase.
  // Reenviar sin leer, guardar ni transmitir los tokens a otro origen.
  if (location.pathname === '/' || location.pathname === '/index.html') {
    const hash = new URLSearchParams(location.hash.slice(1));
    const callback = ['access_token', 'refresh_token', 'error', 'error_code', 'error_description'].some(key => hash.has(key)) || hash.get('type') === 'recovery';
    if (callback) {
      location.replace('/app/' + location.search + location.hash);
      return;
    }
  }

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-nav');
  if (!toggle || !nav) return;
  document.documentElement.classList.add('nav-ready');

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    nav.classList.toggle('is-open', open);
  }
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
})();
