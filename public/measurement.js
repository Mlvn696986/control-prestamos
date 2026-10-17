/* GA4 is optional and isolated from business data. Only fixed event names leave ERMIF. */
(() => {
  'use strict';
  const ID = 'G-12SC7RHS97';
  const EVENTS = new Set(['page_view', 'click_create_account', 'click_how_it_works', 'sign_up_start', 'view_plans', 'begin_subscription']);
  const MILESTONES = ['sign_up', 'first_client_created', 'first_loan_created', 'subscription_paid'];
  const SOURCES = new Set(['directo','google','bing','duckduckgo','chatgpt','facebook','instagram','tiktok','youtube','linkedin','whatsapp','email','otro']);
  const MEDIA = new Set(['direct','organic','paid_search','paid_social','social','email','referral','other']);
  const CAMPAIGNS = new Set(['','lanzamiento-ermif','contenido-educativo']);
  const CONTENTS = new Set(['','menu','portada','precios','video-demo','guia','calculadora','enlace-perfil']);
  const PAGES = {'/':'Inicio', '/precios/':'Precios', '/como-funciona/':'Cómo funciona', '/contacto/':'Contacto', '/seguridad/':'Seguridad', '/privacidad/':'Privacidad', '/terminos/':'Términos', '/app/':'Aplicación'};
  let enabled = false;
  let loaded = false;
  let viewed = false;
  let context = {};
  const gtag = function () { (window.dataLayer ||= []).push(arguments); };
  const canMeasure = () => enabled && location.hostname === 'ermif.com' && !window.__PRESTAMOS_TEST__;
  function emit(name) {
    if (!canMeasure()) return false;
    try { gtag('event', name, { ...context, send_to: ID }); return true; }
    catch { return false; } // Optional analytics never interrupts an operation.
  }
  function clearCookies() {
    // Delete only this property's Analytics cookies, including its shared _ga ID.
    for (const name of ['_ga', '_ga_12SC7RHS97']) {
      for (const domain of ['', '; domain=ermif.com', '; domain=.ermif.com']) {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax; Secure' + domain;
      }
    }
  }
  function setConsent(accepted, attribution) {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const callback = ['code','access_token','refresh_token','token','token_hash','error','error_code','error_description','billing'].some(key => query.has(key) || hash.has(key)) || hash.get('type') === 'recovery';
    enabled = accepted === true && !callback && Boolean(attribution) && Object.hasOwn(PAGES, location.pathname)
      && SOURCES.has(attribution.source) && MEDIA.has(attribution.medium)
      && CAMPAIGNS.has(attribution.campaign_id) && CONTENTS.has(attribution.content_id || '');
    window['ga-disable-' + ID] = !enabled;
    if (!enabled) { clearCookies(); return; }
    // URLs/titles/referrers are supplied explicitly; never use the document title,
    // raw location, query, hash, DOM text, form fields or account identifiers.
    context = {
      page_location: 'https://ermif.com' + location.pathname,
      page_title: 'ERMIF | ' + PAGES[location.pathname], page_referrer: '',
      campaign_source: attribution.source === 'directo' ? '(direct)' : attribution.source,
      campaign_medium: attribution.medium === 'direct' ? '(none)' : attribution.medium,
      campaign_name: attribution.campaign_id || '(not set)',
      campaign_content: attribution.content_id || '(not set)', campaign_term: '',
    };
    if (!canMeasure()) return;
    if (!loaded) {
      loaded = true;
      gtag('consent', 'default', {analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
      gtag('js', new Date());
      gtag('config', ID, { ...context, send_page_view:false, allow_google_signals:false,
        allow_ad_personalization_signals:false, cookie_expires:15552000, cookie_update:false,
        cookie_flags:'SameSite=Lax;Secure', ignore_referrer:true });
      const script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
      document.head.append(script);
    }
    if (!viewed) {
      viewed = true;
      emit('page_view');
      if (location.pathname === '/precios/') emit('view_plans');
    }
  }
  async function milestones(visitorId, flags) {
    if (!canMeasure() || !/^[0-9a-f-]{36}$/i.test(visitorId) || !flags) return;
    const capture = () => {
      if (!canMeasure()) return;
      const key = 'ermif-ga4-milestones-v1';
      let saved;
      try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { return; }
      const record = saved?.visitor === visitorId && saved.expires > Date.now() ? saved : {visitor:visitorId, events:[], expires:Date.now()+15552000000};
      const done = new Set(Array.isArray(record.events) ? record.events.filter(name => MILESTONES.includes(name)) : []);
      for (const name of MILESTONES) {
        if (flags[name] !== true || done.has(name)) continue;
        done.add(name);
        // Persist first to avoid duplicate conversions across concurrent tabs.
        try { localStorage.setItem(key, JSON.stringify({visitor:visitorId, events:[...done], expires:record.expires})); } catch { return; }
        emit(name);
      }
    };
    if (navigator.locks?.request) await navigator.locks.request('ermif-ga4-milestones', capture);
    else capture();
  }
  window.ERMIFAnalytics = Object.freeze({ setConsent, milestones, track(name) { if (EVENTS.has(name)) emit(name); } });
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    let url; try { url = new URL(link.getAttribute('href'), location.origin); } catch { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === '/app/' && url.searchParams.get('mode') === 'signup') emit('click_create_account');
    else if (url.pathname === '/como-funciona/') emit('click_how_it_works');
  });
})();
