const { renderLegalContent } = require('./legal.cjs');
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

// Public trust navigation is shared by the landing and all four information pages.
const trustPages = [
  ['/contacto/', 'Contacto y titular', 'mail'],
  ['/privacidad/', 'Privacidad', 'people'],
  ['/terminos/', 'Términos y condiciones', 'layers'],
  ['/seguridad/', 'Seguridad', 'shield'],
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
    '<div><h2>Producto</h2><a href="/#funciones">Funciones</a><a href="/como-funciona/">Cómo funciona</a><a href="/precios/">Planes y precios</a><a href="' + LOGIN + '">Entrar al sistema</a></div>' +
    '<div><h2>Hablemos</h2><a href="mailto:ventas@ermif.com">ventas@ermif.com</a><a href="/contacto/">Todos los canales</a><a href="https://wa.me/51984096252">Consultar por WhatsApp</a></div>' +
    '<div><h2>Información</h2><a href="/privacidad/">Política de privacidad</a><a href="/terminos/">Términos y condiciones</a><a href="/seguridad/">Seguridad</a><a href="/app/?dialog=privacy-request">Privacidad y mis datos</a><a href="/app/?dialog=claims">Libro de Reclamaciones</a></div></div>' +
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
  ['people','Clientes e historial','La información de cada cliente, sus préstamos y sus pagos, reunida para consultar sin perder el contexto.','clientes'],
  ['layers','Préstamos y ampliaciones','Registra una nueva operación o una ampliación y sigue su relación con el préstamo original.','prestamos'],
  ['calendar','Cobros y vencimientos','Identifica los próximos cobros y los préstamos vencidos. Registra cuánto recibiste de capital e intereses.','cobros'],
  ['chart','Capital y ganancias','Consulta tu capital disponible, el que tienes prestado y la diferencia entre ganancia cobrada y proyectada.','resumen'],
];
function featureCards() {
  return '<div class="feature-grid">' + features.map(([i,h,p,id]) => '<article class="feature-card"><span class="icon-box">' + icon(i) + '</span><h3>' + h + '</h3><p>' + p + '</p><a class="text-link" href="/como-funciona/#' + id + '">Ver cómo funciona ' + icon('arrow') + '</a></article>').join('') + '</div>';
}

function pricing() {
  return '<div class="pricing-grid">' + PUBLIC_PLANS.map(p => '<article class="price-card ' + p.style + '"><div class="plan-top"><h3>' + p.name + '</h3>' + (p.style === 'featured' ? '<span class="plan-label">Más capacidad</span>' : '') + '</div><p class="plan-description">' + p.text + '</p><p class="price"><span class="currency">S/</span> ' + p.price + '<span class="period">' + (p.price ? '/ mes' : 'sin costo') + '</span></p><p class="capacity">' + icon('people') + p.capacity + '</p><ul class="check-list"><li>' + icon('check') + 'Préstamos y ampliaciones</li><li>' + icon('check') + 'Cobros e historial de pagos</li><li>' + icon('check') + 'Resumen de tu cartera</li><li>' + icon('check') + 'Exportación a Excel y respaldo</li></ul>' + link(SIGNUP,p.button,p.style === 'featured' ? 'primary' : 'outline') + '<p class="plan-note">' + (p.price ? 'Contrata el plan desde tu cuenta.' : 'No necesitas tarjeta para empezar.') + '</p></article>').join('') + '</div><p class="pricing-note">Precios en soles peruanos. Básico y Pro se cobran mensualmente. Pro está sujeto a uso razonable. <a href="/terminos/">Consulta las condiciones del servicio.</a></p>';
}

const questions = [
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
  return '<section class="container final-cta"><div><span class="eyebrow">TU PRÓXIMO PASO</span><h2>Empieza con una cartera<br>mejor organizada.</h2><p>Crea tu cuenta y registra hasta 10 clientes gratis.</p></div><div>' + link(SIGNUP,'Crear mi cuenta gratis','white') + '<span class="cta-note">Sin tarjeta para empezar.</span></div></section>';
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
  return page({path:'/',title:'Software para prestamistas y control de préstamos | ERMIF',description:'Organiza clientes, préstamos, ampliaciones y cobranzas con ERMIF. Consulta tu capital y ganancias. Empieza gratis con hasta 10 clientes.',body:
    '<section class="hero"><div class="container hero-grid"><div class="hero-copy"><span class="eyebrow"><span class="status-dot"></span> SOFTWARE PARA PRESTAMISTAS</span><h1>Tus préstamos,<br><span>bajo control.</span></h1><p class="hero-description">Clientes, pagos, ampliaciones y vencimientos en un solo lugar. La claridad que necesitas para administrar tu cartera.</p><div class="hero-actions">' + link(SIGNUP,'Empezar gratis') + '<a class="button button--subtle" href="/como-funciona/#demostracion">' + icon('play') + 'Ver cómo funciona</a></div><p class="hero-promise">' + icon('check') + 'Hasta 10 clientes gratis <span>·</span> Sin tarjeta</p><p class="lender-note">ERMIF es un software de gestión. No otorga préstamos.</p></div><div class="hero-visual"><div class="visual-orbit" aria-hidden="true"></div>' + screenshot('hero-window') + '<div class="visual-caption"><span class="caption-icon">' + icon('chart') + '</span><div>Tu cartera, en perspectiva.<small>Capital, ganancias y vencimientos a la vista.</small></div></div></div></div></section>' +
    '<div class="container benefit-strip"><div>' + icon('people') + '<span>Organiza tus clientes</span></div><div>' + icon('calendar') + '<span>Ubica tu próximo cobro</span></div><div>' + icon('wallet') + '<span>Entiende tu capital</span></div></div>' +
    '<section class="container section" id="funciones"><div class="section-heading"><div><span class="eyebrow">CADA MOVIMIENTO CUENTA</span><h2>De cada cliente<br>al próximo cobro.</h2></div><p>Una misma herramienta para el detalle del día a día y la visión general de tu negocio.</p></div>' + featureCards() + '<div class="export-note">' + icon('download') + '<p><strong>Tu información también puede acompañarte.</strong> Exporta a Excel y descarga un respaldo de tus datos desde el sistema.</p></div></section>' +
    '<section class="workflow-section"><div class="container"><div class="section-heading"><div><span class="eyebrow">EMPEZAR ES SENCILLO</span><h2>Un orden claro.<br>Desde el primer préstamo.</h2></div><a class="text-link" href="/como-funciona/">Conoce el recorrido completo ' + icon('arrow') + '</a></div><ol class="steps"><li><span>01</span><h3>Crea tu cuenta</h3><p>Registra tu negocio y empieza con el plan Gratis.</p></li><li><span>02</span><h3>Organiza tu cartera</h3><p>Añade tus clientes, registra préstamos y define fechas de cobro.</p></li><li><span>03</span><h3>Sigue cada movimiento</h3><p>Registra pagos y ampliaciones. Consulta saldos e indicadores.</p></li></ol></div></section>' +
    '<section class="container section" id="planes"><div class="section-heading centered"><span class="eyebrow">UN PLAN PARA TU CARTERA</span><h2>Empieza gratis.<br>Crece a tu ritmo.</h2><p>Las herramientas de gestión en todos los planes.<br>Elige la capacidad que necesitas.</p></div>' + pricing() + '<div class="center-link"><a class="text-link" href="/precios/">Comparar planes en detalle ' + icon('arrow') + '</a></div></section>' +
    '<section class="container section faq-section" id="preguntas"><div><span class="eyebrow">ANTES DE EMPEZAR</span><h2>Respuestas claras.</h2><p>Conoce el servicio y elige con tranquilidad.</p><a class="text-link" href="/contacto/">Hablemos ' + icon('arrow') + '</a></div>' + faq() + '</section>' + trustOverview() + finalCta()
  });
}

function prices() {
  return page({path:'/precios/',title:'Planes y precios | ERMIF',description:'Compara los planes de ERMIF: Gratis hasta 10 clientes, Básico hasta 50 por S/29 al mes y Pro por S/59 al mes. Empieza sin tarjeta.',body:
    intro('PLANES Y PRECIOS','Tu cartera crece.<br>Tu plan te acompaña.','Empieza con hasta 10 clientes gratis. Cuando necesites más capacidad, contrata un plan desde tu cuenta.') +
    '<section class="container section section--compact" aria-label="Planes disponibles">' + pricing() + '</section>' +
    '<section class="container section"><div class="section-heading"><div><span class="eyebrow">COMPARA LO QUE INCLUYE</span><h2>Mismas herramientas.<br>Distinta capacidad.</h2></div></div><div class="comparison-wrap"><table class="comparison"><caption>Funciones incluidas en cada plan de ERMIF</caption><thead><tr><th scope="col">Función</th><th scope="col">Gratis</th><th scope="col">Básico</th><th scope="col">Pro</th></tr></thead><tbody><tr><th scope="row">Clientes</th><td>Hasta 10</td><td>Hasta 50</td><td>Ilimitados*</td></tr>' + ['Préstamos y ampliaciones','Cobros e historial de pagos','Resumen e indicadores de cartera','Exportación a Excel','Descarga de respaldo'].map(x=>'<tr><th scope="row">'+x+'</th><td>Incluido</td><td>Incluido</td><td>Incluido</td></tr>').join('') + '</tbody></table></div><p class="small">* Sujeto a uso razonable y a las condiciones del servicio.</p><div class="info-panel"><h3>¿Cómo contrato o consulto mi suscripción?</h3><p>Primero crea tu cuenta. Encontrarás las opciones de contratación dentro de <strong>Planes</strong>. Para consultas sobre cobros, renovaciones o cancelaciones, escribe a <a href="mailto:facturacion@ermif.com">facturacion@ermif.com</a>. Revisa los <a href="/terminos/">términos y condiciones</a> antes de contratar.</p></div></section>' + finalCta()
  });
}

function how() {
  return page({path:'/como-funciona/',title:'Cómo funciona el control de préstamos | ERMIF',description:'Conoce cómo ERMIF organiza clientes, préstamos, ampliaciones, pagos y vencimientos. Mira el sistema con datos de ejemplo antes de registrarte.',body:
    intro('CONOCE EL SISTEMA','Menos información dispersa.<br>Más claridad en tu cartera.','Sigue el recorrido de un préstamo: desde registrar al cliente hasta consultar sus pagos y el capital pendiente.') +
    '<section class="container demo-section" id="demostracion"><div class="demo-heading"><span class="eyebrow">ASÍ SE VE ERMIF</span><h2>Una vista de tu negocio.</h2><p>Esta captura muestra la interfaz real con datos ficticios. Los indicadores de tu cuenta reflejarán las operaciones que registres.</p></div>' + screenshot() + '</section>' +
    '<section class="container section walkthrough">' + [
      ['clientes','01','Registra a tus clientes','Guarda la información de cada cliente y consulta sus operaciones desde su ficha. Así puedes seguir varios préstamos sin mezclar sus historiales.','Ejemplo: un cliente puede tener un préstamo y ampliaciones vinculadas.'],
      ['prestamos','02','Define el préstamo y sus ampliaciones','Registra el capital, la modalidad de interés y las fechas. Si entregas una ampliación, agrégala vinculada a la operación correspondiente.','Cada operación conserva sus datos para que puedas consultar el detalle.'],
      ['cobros','03','Registra lo que realmente cobras','Indica cuánto del pago corresponde a capital y cuánto a intereses. Consulta los próximos vencimientos y los préstamos atrasados.','Si recibes S/120 y registras S/100 de capital y S/20 de intereses, ambos conceptos quedan separados en el pago.'],
      ['resumen','04','Consulta tu capital y tus resultados','El resumen reúne los indicadores de cartera: capital disponible y prestado, ganancia real, ganancia proyectada y vencimientos.','Ganancia cobrada y ganancia proyectada se muestran por separado: una proyección no equivale a dinero recibido.'],
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
