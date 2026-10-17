const ORIGIN = 'https://ermif.com';
const SOCIAL_IMAGE = {
  path: '/ermif-social.jpg',
  width: 1200,
  height: 630,
  type: 'image/jpeg',
  alt: 'ERMIF: software para prestamistas, con una vista real del resumen financiero y datos ficticios de demostración.',
};

// One source for the visible price cards and their structured offers.
// Regression tests also compare these amounts and limits with PLAN_CATALOG.
const PUBLIC_PLANS = [
  { name:'Gratis', price:0, capacity:'Hasta 10 clientes', text:'Para conocer ERMIF y empezar a organizar tu cartera.', button:'Crear cuenta gratis', style:'light' },
  { name:'Básico', price:29, capacity:'Hasta 50 clientes', text:'Más espacio para una cartera que está creciendo.', button:'Empezar con mi cuenta', style:'featured' },
  { name:'Pro', price:59, capacity:'Clientes ilimitados', text:'Para administrar una cartera de mayor tamaño.', button:'Empezar con mi cuenta', style:'light' },
];

function structuredData({ path, title, description }) {
  const url = ORIGIN + path;
  const organization = { '@id': ORIGIN + '/#organization' };
  const website = { '@id': ORIGIN + '/#website' };
  const webpage = {
    '@type': path === '/contacto/' ? 'ContactPage' : 'WebPage',
    '@id': url + '#webpage', url, name: title, description,
    inLanguage: 'es-PE', isPartOf: website, publisher: organization,
  };
  const graph = [
    {
      '@type': 'Organization', ...organization, name: 'ERMIF', url: ORIGIN + '/',
      logo: ORIGIN + '/ermif-logo-960.webp', email: 'ventas@ermif.com',
    },
    {
      '@type': 'WebSite', ...website, name: 'ERMIF', url: ORIGIN + '/',
      inLanguage: 'es-PE', publisher: organization,
    },
    webpage,
  ];
  if (path !== '/') {
    webpage.breadcrumb = { '@id': url + '#breadcrumb' };
    graph.push({
      '@type': 'BreadcrumbList', ...webpage.breadcrumb,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: title.split(' | ')[0], item: url },
      ],
    });
  }
  // Product markup belongs on product pages, not on legal or contact documents.
  if (['/', '/precios/', '/como-funciona/'].includes(path)) {
    webpage.mainEntity = { '@id': ORIGIN + '/#software' };
    const software = {
      '@type': 'WebApplication', ...webpage.mainEntity, name: 'ERMIF', url: ORIGIN + '/',
      applicationCategory: 'BusinessApplication', inLanguage: 'es-PE',
      description: 'Sistema de control de préstamos fácil de usar, sin configuración técnica previa. Gestiona intereses mensuales, abonos voluntarios al capital y analítica detallada de tu cartera. ERMIF no otorga préstamos.',
      publisher: organization,
    };
    if (path !== '/precios/') {
      software.browserRequirements = 'Navegador web y conexión a Internet.';
      software.screenshot = ORIGIN + '/dashboard-preview-2560.webp';
    }
    // Full pricing is visible on these two pages. No invented reviews or ratings:
    // truthful Schema.org markup alone does not guarantee Google app rich results.
    if (['/', '/precios/'].includes(path)) {
      software.offers = PUBLIC_PLANS.map(plan => ({
        '@type': 'Offer', name: 'Plan ' + plan.name, url: ORIGIN + '/precios/',
        price: plan.price, priceCurrency: 'PEN', seller: organization,
        description: plan.capacity + (plan.price ? '. Cobro mensual.' : '. Sin costo.') +
          (plan.name === 'Pro' ? ' Sujeto a uso razonable.' : ''),
        ...(plan.price ? { priceSpecification: {
          '@type': 'UnitPriceSpecification', price: plan.price, priceCurrency: 'PEN',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON', unitText: 'mes' },
        } } : {}),
      }));
    }
    graph.push(software);
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function socialMetadata({ path, title, description }, escape) {
  const imageUrl = ORIGIN + SOCIAL_IMAGE.path;
  const og = {
    type: 'website', locale: 'es_PE', site_name: 'ERMIF', title, description, url: ORIGIN + path,
    image: imageUrl, 'image:secure_url': imageUrl, 'image:type': SOCIAL_IMAGE.type,
    'image:width': SOCIAL_IMAGE.width, 'image:height': SOCIAL_IMAGE.height, 'image:alt': SOCIAL_IMAGE.alt,
  };
  const twitter = {
    card: 'summary_large_image', title, description, image: imageUrl, 'image:alt': SOCIAL_IMAGE.alt,
  };
  return Object.entries(og).map(([key, value]) => '<meta property="og:' + key + '" content="' + escape(value) + '"/>').join('') +
    Object.entries(twitter).map(([key, value]) => '<meta name="twitter:' + key + '" content="' + escape(value) + '"/>').join('');
}

module.exports = { ORIGIN, SOCIAL_IMAGE, PUBLIC_PLANS, structuredData, socialMetadata };
