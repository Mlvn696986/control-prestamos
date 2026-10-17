const { renderLegalContent } = require('./legal.cjs');
const { productPages } = require('./product-pages.cjs');
const { ORIGIN, PUBLIC_PLANS, structuredData, socialMetadata } = require('./metadata.cjs');

const SIGNUP = '/app/?mode=signup';
const LOGIN = '/app/?mode=login';
const icons = {
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h3"/>',
  chart: '<path d="M3 3v18h18M7 14l4-4 4 3 6-8"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  wallet: '<path d="M20 8V5H6a3 3 0 0 0 0 6h15v9H6a3 3 0 0 1-3-3V8m18 5h-6v4h6"/>',
  play: '<path d="m9 5 11 7-11 7V5Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  shield: '<path d="m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7l8-4Z"/><path d="m8 12 3 3 5-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>';
const link = (href, label, style = 'primary') => '<a class="button button--' + style + '" href="' + href + '">' + label + icon('arrow') + '</a>';
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function header(path) {
  return '<a class="skip-link" href="#contenido">Saltar al contenido</a><header class="site-header"><div class="container nav-bar">' +
    '<a class="brand" href="/" aria-label="ERMIF, inicio"><img src="/ermif-mark-small.png" width="37" height="37" alt=""/><span>ERMIF<span class="brand-dot">.</span></span></a>' +
    '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menú">' + icon('menu') + '</button>' +
    '<nav class="main-nav" id="main-nav" aria-label="Navegación principal"><a href="/#funciones">Funciones</a>' +
    '<a href="/como-funciona/"' + (path === '/como-funciona/' ? ' aria-current="page"' : '') + '>Cómo funciona</a>' +
    '<a href="/precios/"' + (path === '/precios/' ? ' aria-current="page"' : '') + '>Precios</a><a href="/contacto/">Contacto</a>' +
    '<div class="nav-actions"><a class="login-link" href="' + LOGIN + '">Entrar a mi cuenta</a>' + link(SIGNUP, 'Empezar gratis') + '</div></nav></div></header>';
}

// Public trust navigation is shared by the landing and information pages.
const trustPages = [
  ['/contacto/', 'Contacto y titular', 'mail'],
  ['/privacidad/', 'Privacidad', 'people'],
  ['/terminos/', 'Términos y condiciones', 'layers'],
  ['/seguridad/', 'Seguridad', 'shield'],
  ['/reclamaciones/', 'Reclamaciones', 'mail'],
];
function trustNavigation(currentPath = '') {
  return '<nav class="trust-links" aria-label="Información y confianza">' + trustPages.map(([href, label, name]) =>
    '<a href="' + href + '"' + (href === currentPath ? ' aria-current="page"' : '') + '>' + icon(name) + '<span>' + label + '</span></a>'
  ).join('') + '</nav>';
}
function trustOverview() {
  return '<section class="container trust-overview"><div><span class="eyebrow">INFORMACIÓN A TU ALCANCE</span><h2>Conoce ERMIF antes de empezar.</h2><p>Consulta quién presta el servicio, las condiciones de uso y cómo se trata tu información.</p></div>' + trustNavigation() + '</section>';
}
function trustPageNavigation(path) {
  return '<div class="container trust-navigation">' + trustNavigation(path) + '</div>';
}

function footer() {
  return '<footer class="site-footer"><div class="container footer-grid"><div><a class="brand" href="/">ERMIF<span class="brand-dot">.</span></a><p>Claridad para administrar<br>tu cartera de préstamos.</p><p class="small">Software de gestión. ERMIF no otorga préstamos.</p></div>' +
    '<div><h2>Producto</h2><a href="/#funciones">Funciones</a><a href="/control-de-cobranzas/">Control de cobranzas</a><a href="/ampliaciones-de-prestamos/">Gestión de ampliaciones</a><a href="/como-funciona/">Cómo funciona</a><a href="/precios/">Planes y precios</a><a href="' + LOGIN + '">Entrar al sistema</a></div>' +
    '<div><h2>Hablemos</h2><a href="mailto:ventas@ermif.com">ventas@ermif.com</a><a href="/contacto/">Todos los canales</a><a href="https://wa.me/51984096252">Consultar por WhatsApp</a></div>' +
    '<div><h2>Información</h2><a href="/privacidad/">Política de privacidad</a><a href="/terminos/">Términos y condiciones</a><a href="/seguridad/">Seguridad</a><a href="/app/?dialog=privacy-request">Privacidad y mis datos</a><a href="/reclamaciones/">Reclamaciones y atención</a><a href="/app/?dialog=claims">Abrir Libro de Reclamaciones</a></div></div>' +
    '<div class="container footer-bottom"><span>© ERMIF · HOYOS BUENO MELVIN · RUC 10735063818</span><span>Hecho para llevar el control.</span></div></footer>';
}

function page({ path, title, description, body, extraClass = '' }) {
  const metadata = { path, title, description };
  const data = structuredData(metadata);
  return '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>' +
    '<title>' + escape(title) + '</title><meta name="description" content="' + escape(description) + '"/><link rel="canonical" href="' + ORIGIN + path + '"/>' +
    '<meta name="theme-color" content="#093b39"/><link rel="icon" type="image/png" sizes="96x96" href="/favicon.png"/>' +
    socialMetadata(metadata, escape) +
    '<link rel="stylesheet" href="/landing.css"/><link rel="stylesheet" href="/acquisition.css"/><script src="/landing.js" defer></script><script src="/acquisition.js" defer></script><script type="application/ld+json">' + JSON.stringify(data).replace(/</g,'\\u003c') + '</script></head>' +
    '<body class="' + extraClass + '">' + header(path) + '<main id="contenido">' + body + '</main>' + footer() + '</body></html>\n';
}

const features = [
  ['people','El historial de cada persona','Consulta cuánto prestaste, qué pagos recibiste y qué sigue pendiente. Ten el detalle a mano cuando un cliente te consulte por su saldo.','clientes'],
  ['layers','Ampliaciones bien identificadas','Si entregas dinero adicional, vincúlalo al préstamo original. Conserva cada movimiento para entender cómo cambió el capital pendiente.','prestamos'],
  ['calendar','Intereses y capital por separado','Registra el interés mensual y, cuando corresponda, el abono voluntario al capital. Identifica próximos cobros y atrasos sin mezclar los conceptos.','cobros'],
  ['chart','Analítica detallada, fácil de leer','Consulta capital disponible y prestado, ganancias cobradas, proyecciones y atrasos. Usa gráficos y filtros de fecha para entender cómo va tu cartera.','resumen'],
];
function featureCards() {
  const destinations = { prestamos: ['/ampliaciones-de-prestamos/', 'Gestionar ampliaciones'], cobros: ['/control-de-cobranzas/', 'Organizar cobranzas'] };
  return '<div class="feature-grid">' + features.map(([i,h,p,id]) => {
    const [href, label] = destinations[id] || ['/como-funciona/#' + id, 'Ver cómo funciona'];
    return '<article class="feature-card"><span class="icon-box">' + icon(i) + '</span><h3>' + h + '</h3><p>' + p + '</p><a class="text-link" href="' + href + '">' + label + ' ' + icon('arrow') + '</a></article>';
  }).join('') + '</div>';
}

function pricing() {
  return '<div class="pricing-grid">' + PUBLIC_PLANS.map(p => '<article class="price-card ' + p.style + '"><div class="plan-top"><h3>' + p.name + '</h3>' + (p.style === 'featured' ? '<span class="plan-label">Más capacidad</span>' : '') + '</div><p class="plan-description">' + p.text + '</p><p class="price"><span class="currency">S/</span> ' + p.price + '<span class="period">' + (p.price ? '/ mes' : 'sin costo') + '</span></p><p class="capacity">' + icon('people') + p.capacity + '</p><ul class="check-list"><li>' + icon('check') + 'Préstamos y ampliaciones</li><li>' + icon('check') + 'Cobros e historial de pagos</li><li>' + icon('check') + 'Resumen de tu cartera</li><li>' + icon('check') + 'Exportación a Excel y respaldo</li></ul>' + link(SIGNUP,p.button,p.style === 'featured' ? 'primary' : 'outline') + '<p class="plan-note">' + (p.price ? 'Contrata el plan desde tu cuenta.' : 'No necesitas tarjeta para empezar.') + '</p></article>').join('') + '</div><p class="pricing-note">Precios en soles peruanos. Básico y Pro se cobran mensualmente. Pro está sujeto a uso razonable. <a href="/terminos/">Consulta las condiciones del servicio.</a></p>';
}

const questions = [
  ['¿Necesito configurar el sistema antes de empezar?','No necesitas instalaciones ni configuración técnica previa. Crea tu cuenta y registra tus clientes y préstamos. Tú indicas los datos de cada operación, como el capital, el interés y las fechas; los formularios y el resumen ya están preparados.'],
  ['¿Sirve si presto a personas de mi misma organización?','Sí. Está pensado también para personas que prestan a compañeros o miembros de su organización y necesitan controlar su propia cartera. Registra a cada persona como cliente y consulta sus préstamos, pagos y saldos desde su ficha.'],
  ['¿Puedo cobrar intereses mensuales sin cuotas fijas de capital?','Sí. Si así lo has acordado con tu cliente, registra el interés que corresponde pagar cada mes y los abonos voluntarios al capital por separado. Puedes registrar un pago solo de intereses, dejando el capital pagado en cero. El capital sigue pendiente hasta su devolución.'],
  ['¿ERMIF me presta dinero?','No. ERMIF es un software para personas que administran préstamos. Te ayuda a organizar clientes, operaciones, pagos y cobranzas; no otorga créditos.'],
  ['¿Qué puedo hacer con el plan Gratis?','Puedes registrar hasta 10 clientes y utilizar las funciones de préstamos, ampliaciones, cobros, historial, resumen de cartera, exportación a Excel y respaldo. No necesitas tarjeta para crear tu cuenta.'],
  ['¿Cuál es la diferencia entre los planes?','La capacidad de clientes: Gratis permite hasta 10; Básico, hasta 50; Pro permite clientes ilimitados, sujeto a uso razonable. Los tres incluyen las funciones de gestión indicadas.'],
  ['¿Puedo usarlo desde mi celular?','Sí. ERMIF se utiliza desde el navegador y su interfaz se adapta a computadora, tablet y celular. Necesitas conexión a Internet para acceder a tu cuenta y sincronizar tu información.'],
  ['¿Puedo registrar pagos parciales y ampliaciones?','Sí. Puedes registrar abonos indicando los importes de capital e intereses recibidos, y gestionar ampliaciones vinculadas al préstamo.'],
  ['¿Cómo recibo ayuda o consulto una suscripción?','Escríbenos desde la página de contacto. Para cobros, renovaciones o cancelaciones de tu suscripción, utiliza facturacion@ermif.com y consulta las condiciones del servicio.'],
];
function faq() {
  return '<div class="faq-list">' + questions.map(([q,a]) => '<details><summary>' + q + '<span aria-hidden="true">+</span></summary><p>' + a + '</p></details>').join('') + '</div>';
}
function finalCta() {
  return '<section class="container final-cta"><div><span class="eyebrow">TU PRÓXIMO PASO</span><h2>Tu cartera en orden.<br>Fácil desde el inicio.</h2><p>Sin configuración técnica previa. Registra hasta 10 clientes gratis.</p></div><div>' + link(SIGNUP,'Crear mi cuenta gratis','white') + '<span class="cta-note">Sin tarjeta para empezar.</span></div></section>';
}

function audienceSection() {
  const items = [
    ['people', 'Préstamos dentro de tu organización', 'Para quienes prestan a compañeros o miembros de una misma organización. Lleva el historial de cada persona y consulta sus saldos desde tu cuenta.'],
    ['calendar', 'Intereses mensuales y abonos voluntarios', 'Si tu acuerdo es cobrar intereses cada mes y recibir abonos al capital sin cuotas fijas, registra ambos conceptos por separado y conserva lo que sigue pendiente.'],
    ['check', 'Empieza sin configuración técnica', 'Abre tu cuenta y registra los datos de tus clientes y préstamos. Los formularios, gráficos y resúmenes ya están preparados para que empieces a llevar el control.'],
  ];
  return '<section class="container audience-section" id="para-quien"><div class="section-heading"><div><span class="eyebrow">PENSADO PARA TU DÍA A DÍA</span><h2>Para tu forma de prestar.</h2></div><p>Un sistema amigable para llevar tu propia cartera y entender cada movimiento, desde el primer registro.</p></div><div class="audience-grid">' + items.map(([i,h,p]) => '<article><span class="icon-box">' + icon(i) + '</span><h3>' + h + '</h3><p>' + p + '</p></article>').join('') + '</div><a class="text-link audience-link" href="/control-de-cobranzas/#intereses-mensuales">Ver un ejemplo de intereses y abonos al capital ' + icon('arrow') + '</a></section>';
}
function intro(kicker, title, description) {
  return '<section class="container page-intro"><a class="breadcrumb" href="/">Inicio ' + icon('arrow') + '</a><span class="eyebrow">' + kicker + '</span><h1>' + title + '</h1><p>' + description + '</p></section>';
}
function screenshot(extraClass = '') {
  const hero = extraClass === 'hero-window';
  const sizes = hero
    ? '(max-width: 590px) calc(100vw - 36px), (max-width: 850px) min(650px, calc(90vw - 43px)), (max-width: 1100px) calc(51.22vw - 26px), (min-width: 1500px) 698px, min(673px, calc(55.24vw - 35px))'
    : '(max-width: 590px) calc(100vw - 66px), (max-width: 1100px) calc(100vw - 126px), min(1122px, calc(100vw - 158px))';
  return '<figure class="product-window ' + extraClass + '"><div class="window-top"><span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>ERMIF / Resumen financiero</span><span class="window-secure">' + icon('shield') + 'Tu espacio de trabajo</span></div><img src="/dashboard-preview-hd.webp" srcset="/dashboard-preview-hd.webp 1280w, /dashboard-preview-1920.webp 1920w, /dashboard-preview-2560.webp 2560w" sizes="' + sizes + '" width="2560" height="1728" decoding="async" alt="Pantalla real del resumen de ERMIF con capital disponible, préstamos y ganancias; todos los datos son ficticios" ' + (hero ? 'fetchpriority="high"' : 'loading="lazy"') + '/><figcaption><span>Vista real del sistema · Datos ficticios de demostración</span><a class="preview-expand" href="/dashboard-preview-2560.webp" target="_blank" rel="noopener" aria-label="Ampliar imagen del resumen financiero en otra pestaña">' + icon('expand') + 'Ampliar imagen</a></figcaption></figure>';
}

function home() {
  return page({path:'/',title:'Sistema de control de préstamos fácil de usar | ERMIF',description:'Controla préstamos con intereses mensuales y abonos voluntarios al capital. Analítica detallada y sin configuración técnica. Hasta 10 clientes gratis en ERMIF.',body:
    '<section class="hero"><div class="container hero-grid"><div class="hero-copy"><span class="eyebrow"><span class="status-dot"></span> CONTROL DE PRÉSTAMOS FÁCIL DE USAR</span><h1>Tus préstamos,<br><span>bajo control.<br>Sin complicarte.</span></h1><p class="hero-description">Controla intereses mensuales, abonos voluntarios al capital y ganancias con una analítica clara. Empieza sin instalaciones ni configuración técnica.</p><div class="hero-actions">' + link(SIGNUP,'Empezar gratis') + '<a class="button button--subtle" href="/como-funciona/#demostracion">' + icon('play') + 'Ver cómo funciona</a></div><p class="hero-promise">' + icon('check') + 'Hasta 10 clientes gratis <span>·</span> Sin tarjeta</p><p class="lender-note">ERMIF es un software de gestión. No otorga préstamos.</p></div><div class="hero-visual"><div class="visual-orbit" aria-hidden="true"></div>' + screenshot('hero-window') + '<div class="visual-caption"><span class="caption-icon">' + icon('chart') + '</span><div>Analítica que se entiende.<small>Tu capital, tus ganancias y tus atrasos a la vista.</small></div></div></div></div></section>' +
    '<div class="container benefit-strip"><div>' + icon('check') + '<span>Sin configuración técnica</span></div><div>' + icon('calendar') + '<span>Intereses y capital separados</span></div><div>' + icon('chart') + '<span>Analítica detallada y clara</span></div></div>' + audienceSection() +
    '<section class="container section" id="funciones"><div class="section-heading"><div><span class="eyebrow">RESPUESTAS PARA LLEVAR EL CONTROL</span><h2>Entiende lo que tienes.<br>Ubica lo que falta cobrar.</h2></div><p>Saldos, historial y gráficos en un solo lugar para revisar tu cartera sin reconstruir cada cuenta a mano.</p></div>' + featureCards() + '<div class="export-note">' + icon('download') + '<p><strong>Conserva una copia y revisa tus datos cuando la necesites.</strong> Exporta a Excel y descarga un respaldo desde el sistema.</p></div></section>' +
    '<section class="workflow-section"><div class="container"><div class="section-heading"><div><span class="eyebrow">EMPEZAR ES SENCILLO</span><h2>Registra tus datos.<br>El sistema ya está preparado.</h2></div><a class="text-link" href="/como-funciona/">Conoce el recorrido completo ' + icon('arrow') + '</a></div><ol class="steps"><li><span>01</span><h3>Crea tu cuenta</h3><p>Abre ERMIF desde tu navegador y empieza con el plan Gratis.</p></li><li><span>02</span><h3>Añade tus préstamos</h3><p>Registra a cada cliente, el capital, el interés y las fechas acordadas.</p></li><li><span>03</span><h3>Consulta y registra</h3><p>Registra intereses y abonos al capital. Revisa saldos, atrasos y gráficos.</p></li></ol></div></section>' +
    '<section class="container section" id="planes"><div class="section-heading centered"><span class="eyebrow">UN PLAN PARA TU CARTERA</span><h2>Empieza gratis.<br>Crece a tu ritmo.</h2><p>Las herramientas de gestión en todos los planes.<br>Elige la capacidad que necesitas.</p></div>' + pricing() + '<div class="center-link"><a class="text-link" href="/precios/">Comparar planes en detalle ' + icon('arrow') + '</a></div></section>' +
    '<section class="container section faq-section" id="preguntas"><div><span class="eyebrow">ANTES DE EMPEZAR</span><h2>Respuestas claras.</h2><p>Conoce el servicio y elige con tranquilidad.</p><a class="text-link" href="/contacto/">Hablemos ' + icon('arrow') + '</a></div>' + faq() + '</section>' + trustOverview() + finalCta()
  });
}

function prices() {
  return page({path:'/precios/',title:'Planes y precios | ERMIF',description:'Compara los planes de ERMIF: Gratis hasta 10 clientes, Básico hasta 50 por S/29 al mes y Pro por S/59 al mes. Empieza sin tarjeta.',body:
    intro('PLANES Y PRECIOS','Tu cartera crece.<br>Tu plan te acompaña.','Intereses mensuales, abonos al capital y analítica de tu cartera desde el plan Gratis. Empieza con hasta 10 clientes, sin configuración técnica previa.') +
    '<section class="container section section--compact" aria-label="Planes disponibles">' + pricing() + '</section>' +
    '<section class="container section"><div class="section-heading"><div><span class="eyebrow">COMPARA LO QUE INCLUYE</span><h2>Mismas herramientas.<br>Distinta capacidad.</h2></div></div><div class="comparison-wrap"><table class="comparison"><caption>Funciones incluidas en cada plan de ERMIF</caption><thead><tr><th scope="col">Función</th><th scope="col">Gratis</th><th scope="col">Básico</th><th scope="col">Pro</th></tr></thead><tbody><tr><th scope="row">Clientes</th><td>Hasta 10</td><td>Hasta 50</td><td>Ilimitados*</td></tr>' + ['Préstamos y ampliaciones','Cobros e historial de pagos','Resumen e indicadores de cartera','Exportación a Excel','Descarga de respaldo'].map(x=>'<tr><th scope="row">'+x+'</th><td>Incluido</td><td>Incluido</td><td>Incluido</td></tr>').join('') + '</tbody></table></div><p class="small">* Sujeto a uso razonable y a las condiciones del servicio.</p><div class="info-panel"><h3>¿Cómo contrato o consulto mi suscripción?</h3><p>Primero crea tu cuenta. Encontrarás las opciones de contratación dentro de <strong>Planes</strong>. Para consultas sobre cobros, renovaciones o cancelaciones, escribe a <a href="mailto:facturacion@ermif.com">facturacion@ermif.com</a>. Revisa los <a href="/terminos/">términos y condiciones</a> antes de contratar.</p></div></section>' + finalCta()
  });
}

function how() {
  return page({path:'/como-funciona/',title:'Cómo controlar préstamos e intereses fácilmente | ERMIF',description:'Empieza sin configuración técnica: registra clientes, intereses mensuales y abonos al capital. Conoce el historial y la analítica detallada de ERMIF.',body:
    intro('CONOCE EL SISTEMA','Fácil para empezar.<br>Claro para llevar el control.','Sin instalaciones ni configuración técnica previa. Crea tu cuenta, registra tus préstamos y consulta una analítica detallada de tus movimientos.') +
    '<section class="container demo-section" id="demostracion"><div class="demo-heading"><span class="eyebrow">ASÍ SE VE ERMIF</span><h2>Una vista de tu negocio.</h2><p>Esta captura muestra la interfaz real con datos ficticios. Los indicadores de tu cuenta reflejarán las operaciones que registres.</p></div>' + screenshot() + '</section>' +
    '<section class="container section walkthrough">' + [
      ['clientes','01','Registra a las personas a quienes prestas','Si prestas a compañeros o miembros de tu organización, registra a cada persona como cliente. Su ficha reúne sus préstamos, ampliaciones y pagos.','Consulta el historial de cada persona cuando necesites explicar un saldo o revisar un movimiento.'],
      ['prestamos','02','Define el préstamo y sus ampliaciones','Registra el capital, la modalidad de interés y las fechas. Si entregas una ampliación, agrégala vinculada a la operación correspondiente.','Cada operación conserva sus datos para que puedas consultar el detalle. <a href="/ampliaciones-de-prestamos/">Conoce cómo gestionar ampliaciones.</a>'],
      ['cobros','03','Registra intereses y abonos voluntarios al capital','Si acuerdas intereses mensuales sin cuotas fijas de capital, puedes registrar solo los intereses del mes. Cuando el cliente devuelva parte del capital, registra también ese abono.','Pagar intereses no reduce por sí solo el capital pendiente. <a href="/control-de-cobranzas/#intereses-mensuales">Mira un ejemplo de ambos movimientos.</a>'],
      ['resumen','04','Entiende tu cartera con analítica detallada','Consulta capital disponible y prestado, ganancias cobradas, proyecciones, vencimientos y morosidad. Revisa gráficos, filtra por fechas y compara períodos desde Resumen.','Distingue el dinero que puedes volver a prestar del que sigue pendiente de devolución. La ganancia proyectada se muestra aparte de la ya cobrada.'],
    ].map(([id,n,h,p,example])=>'<article class="walkthrough-step" id="'+id+'"><span class="step-number">'+n+'</span><div><h2>'+h+'</h2><p>'+p+'</p><p class="example-note">'+example+'</p></div></article>').join('') + '</section>' +
    '<section class="container info-panel"><h2>Trabaja desde tu navegador</h2><p>Accede desde computadora, tablet o celular con conexión a Internet. También puedes exportar información a Excel o descargar un respaldo. Las condiciones de cada préstamo las defines tú; ERMIF es una herramienta para registrarlas y llevar su control.</p></section>' + finalCta()
  });
}

function contact() {
  return page({path:'/contacto/',title:'Contacto y atención | ERMIF',description:'Contacta con ERMIF para consultas sobre planes, facturación, privacidad, reclamaciones o seguridad. Encuentra el canal adecuado para tu solicitud.',body:
    intro('ESTAMOS PARA ORIENTARTE','Una consulta.<br>El canal correcto.','Cuéntanos qué necesitas y utiliza el correo correspondiente para que tu consulta llegue al área adecuada.') + trustPageNavigation('/contacto/') +
    '<section class="container section section--compact contact-grid">' + [
      ['mail','Planes y demostraciones','ventas@ermif.com','Para conocer el sistema o consultar qué plan se adapta a tu cartera.'],
      ['wallet','Facturación y suscripción','facturacion@ermif.com','Para consultas sobre cobros, renovaciones, comprobantes o cancelaciones de ERMIF.'],
      ['shield','Privacidad y datos','privacidad@ermif.com','Para solicitudes relacionadas con tus datos personales.'],
      ['mail','Reclamaciones','reclamaciones@ermif.com','Para consultas y seguimiento de reclamaciones sobre el servicio.'],
      ['shield','Seguridad','seguridad@ermif.com','Para reportar accesos sospechosos o posibles fallos de seguridad.'],
    ].map(([i,h,email,p])=>'<article class="contact-card"><span class="icon-box">'+icon(i)+'</span><h2>'+h+'</h2><p>'+p+'</p><a href="mailto:'+email+'">'+email+'</a></article>').join('') +
    '<article class="contact-card contact-card--dark"><span class="eyebrow">CONVERSEMOS</span><h2>También por WhatsApp.</h2><p>Horario de atención: 8:00 a. m. a 6:00 p. m.</p>' + link('https://wa.me/51984096252','Abrir WhatsApp','white') + '</article></section>' +
    '<section class="container info-panel" id="titular"><h2>Quién presta el servicio</h2><p><strong>ERMIF</strong> es un servicio de software de <strong>HOYOS BUENO MELVIN</strong>, RUC <strong>10735063818</strong>.</p><p>Puedes utilizar el <a href="/app/?dialog=claims">Libro de Reclamaciones</a> o el formulario de <a href="/app/?dialog=privacy-request">Privacidad y mis datos</a> para registrar tu solicitud y recibir seguimiento por los canales correspondientes.</p></section>'
  });
}

function security() {
  const cards = [
    ['shield', 'Acceso a tu cuenta', 'El sistema requiere iniciar sesión para acceder a tu cartera. Si olvidas tu contraseña, puedes solicitar un enlace de recuperación desde la pantalla de acceso.'],
    ['people', 'Información por cuenta', 'Los clientes, préstamos y pagos se vinculan a la cuenta que los registra. El sistema utiliza controles de acceso por usuario para separar la información de cada cartera.'],
    ['check', 'Conexión cifrada', 'La web de ERMIF utiliza HTTPS para proteger la información durante su envío entre tu navegador y el servicio. Comprueba que estás en https://ermif.com antes de iniciar sesión.'],
    ['download', 'Copias bajo tu control', 'En el menú Seguridad de datos puedes consultar el estado de tus copias y usar Descargar copia para guardar una en tu dispositivo. Conserva ese archivo en un lugar al que solo tú o las personas autorizadas puedan acceder.'],
  ];
  return page({
    path: '/seguridad/',
    title: 'Seguridad de tu cuenta y tus datos | ERMIF',
    description: 'Conoce las medidas de acceso y protección de datos de ERMIF, cómo descargar una copia y dónde reportar un problema de seguridad.',
    body: intro('SEGURIDAD Y CONFIANZA', 'Tu información merece<br>un cuidado claro.', 'Conoce las medidas del sistema, las herramientas a tu alcance y el canal para comunicar un problema de seguridad.') +
      trustPageNavigation('/seguridad/') +
      '<section class="container security-grid" aria-label="Medidas y herramientas de seguridad">' + cards.map(([name, title, text]) =>
        '<article class="security-card"><span class="icon-box">' + icon(name) + '</span><h2>' + title + '</h2><p>' + text + '</p></article>'
      ).join('') + '</section>' +
      '<section class="container security-report" id="reportar"><div><span class="eyebrow">UN CANAL DIRECTO</span><h2>¿Detectaste algo sospechoso?</h2><p>Si observas un acceso que no reconoces o un posible fallo de seguridad, escribe a <a href="mailto:seguridad@ermif.com">seguridad@ermif.com</a>.</p>' + link('mailto:seguridad@ermif.com', 'Reportar un problema', 'white') + '</div><div class="security-report-details"><h3>Qué incluir en tu reporte</h3><ul><li>Qué ocurrió y en qué sección lo observaste.</li><li>La fecha aproximada y el navegador que utilizabas.</li><li>Si adjuntas una captura, oculta los datos de tus clientes.</li></ul><p>No envíes contraseñas, códigos de acceso ni copias completas de tu cartera.</p></div></section>' +
      '<section class="container security-help"><div><h2>Cuida también tu acceso</h2><p>Utiliza una contraseña exclusiva para tu cuenta, mantén actualizado tu navegador y cierra la sesión al terminar en un equipo compartido.</p><a class="text-link" href="' + LOGIN + '">Ir al acceso de mi cuenta ' + icon('arrow') + '</a></div><div><h2>Tu privacidad y tus solicitudes</h2><p>Consulta la <a href="/privacidad/">política de privacidad</a> para conocer el uso de tus datos y el <a href="/contacto/#titular">titular del servicio</a> para saber a quién dirigirte.</p><div class="security-help-links"><a href="/app/?dialog=privacy-request">Privacidad y mis datos</a><a href="/app/?dialog=claims">Libro de Reclamaciones</a></div></div></section>',
  });
}

function renderPages(appHtml) {
  return {
    ...productPages({ page, intro, icon, link, finalCta, trustPageNavigation }),
    'index.html': home(),
    'precios/index.html': prices(),
    'como-funciona/index.html': how(),
    'contacto/index.html': contact(),
    'seguridad/index.html': security(),
    'privacidad/index.html': page({path:'/privacidad/',title:'Política de privacidad | ERMIF',description:'Consulta la política de privacidad de ERMIF y los canales para ejercer tus derechos sobre tus datos personales.',body:intro('INFORMACIÓN DEL SERVICIO','Política de privacidad','Conoce el tratamiento de datos y los canales disponibles para tus solicitudes.')+trustPageNavigation('/privacidad/')+'<article class="container legal-document">'+renderLegalContent(appHtml,'privacy')+'</article>'}),
    'terminos/index.html': page({path:'/terminos/',title:'Términos y condiciones | ERMIF',description:'Consulta las condiciones de uso, planes, pagos y atención del servicio de gestión de préstamos ERMIF.',body:intro('INFORMACIÓN DEL SERVICIO','Términos y condiciones','Condiciones aplicables al uso del software y a la contratación del servicio.')+trustPageNavigation('/terminos/')+'<article class="container legal-document">'+renderLegalContent(appHtml,'terms')+'</article>'}),
  };
}
module.exports = { renderPages };
