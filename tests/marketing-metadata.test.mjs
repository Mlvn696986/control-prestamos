import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { renderPages } = require('../marketing/site.cjs');
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const pages = renderPages(read('index.html'));
const origin = 'https://ermif.com';
const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const normalized = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const graphOf = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
const pathOf = file => '/' + file.replace(/index\.html$/, '');

test('every social card matches its canonical document and uses a published, correctly described JPEG', async () => {
  const imagePath = '/ermif-social.jpg';
  const image = fs.readFileSync(new URL('../public' + imagePath, import.meta.url));
  const actual = await sharp(image).metadata();
  assert.equal(actual.format, 'jpeg');
  assert.equal(actual.width, 1200);
  assert.equal(actual.height, 630);
  assert.ok(image.length < 200 * 1024, 'social previews remain small for crawlers');
  for (const [file, html] of Object.entries(pages)) {
    const metadata = new Map();
    for (const [, key, value] of html.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)"\/>/g)) {
      assert.ok(!metadata.has(key), file + ': no conflicting metadata for ' + key);
      metadata.set(key, value);
    }
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)[1];
    assert.equal(metadata.get('og:url'), canonical);
    assert.equal(metadata.get('og:type'), 'website');
    assert.equal(metadata.get('og:locale'), 'es_PE');
    assert.equal(metadata.get('og:site_name'), 'ERMIF');
    for (const prefix of ['og:', 'twitter:']) {
      assert.equal(metadata.get(prefix + 'title'), title);
      assert.equal(metadata.get(prefix + 'description'), metadata.get('description'));
      assert.equal(metadata.get(prefix + 'image'), origin + imagePath);
      assert.match(metadata.get(prefix + 'image:alt'), /ERMIF.*datos ficticios/);
    }
    assert.equal(metadata.get('twitter:card'), 'summary_large_image');
    assert.equal(metadata.get('og:image:type'), 'image/jpeg');
    assert.equal(Number(metadata.get('og:image:width')), actual.width);
    assert.equal(Number(metadata.get('og:image:height')), actual.height);
    assert.equal(metadata.get('og:image:secure_url'), origin + imagePath);
    assert.ok(!metadata.has('twitter:site') && !metadata.has('twitter:creator'), 'no unverified social accounts');
    assert.doesNotMatch(html.slice(html.indexOf('<body')), /ermif-social\.jpg/, 'card adds no image request to the website itself');
  }
});

test('each JSON-LD graph connects the canonical page, site, publisher and real breadcrumb destinations', () => {
  const publicUrls = new Set(Object.keys(pages).map(file => origin + pathOf(file)));
  for (const [file, html] of Object.entries(pages)) {
    const url = origin + pathOf(file);
    const graph = graphOf(html);
    const byId = new Map(graph.map(entity => [entity['@id'], entity]));
    assert.equal(byId.size, graph.length, file + ': unique entity IDs');
    const references = value => {
      if (!value || typeof value !== 'object') return;
      if (value['@id']) assert.ok(byId.has(value['@id']), file + ': no dangling reference ' + value['@id']);
      Object.values(value).forEach(references);
    };
    references(graph);
    const webpage = byId.get(url + '#webpage');
    assert.ok(['WebPage', 'ContactPage'].includes(webpage['@type']));
    assert.equal(webpage.url, url);
    assert.equal(webpage.name, html.match(/<title>([^<]+)<\/title>/)[1]);
    assert.equal(webpage.description, html.match(/name="description" content="([^"]+)"/)[1]);
    assert.equal(webpage.isPartOf['@id'], origin + '/#website');
    assert.equal(webpage.publisher['@id'], origin + '/#organization');
    assert.match(html, /mailto:ventas@ermif\.com/);
    assert.equal(byId.get(origin + '/#organization').email, 'ventas@ermif.com');
    if (file !== 'index.html') {
      const breadcrumb = byId.get(webpage.breadcrumb['@id']);
      assert.equal(breadcrumb['@type'], 'BreadcrumbList');
      assert.deepEqual(breadcrumb.itemListElement.map(item => item.position), [1, 2]);
      assert.deepEqual(breadcrumb.itemListElement.map(item => item.item), [origin + '/', url]);
      for (const item of breadcrumb.itemListElement) assert.ok(publicUrls.has(item.item));
    } else assert.ok(!webpage.breadcrumb);
  }
});

test('software facts are limited to relevant product pages without invented reputation or offers hidden from visitors', () => {
  for (const [file, html] of Object.entries(pages)) {
    const graph = graphOf(html);
    assert.doesNotMatch(JSON.stringify(graph), /"(?:aggregateRating|review|ratingValue|sameAs|award)"/);
    const application = graph.find(entity => entity['@type'] === 'WebApplication');
    const product = ['index.html', 'precios/index.html', 'como-funciona/index.html'].includes(file);
    assert.equal(Boolean(application), product, file);
    if (!product) continue;
    assert.equal(application.name, 'ERMIF');
    assert.equal(application.applicationCategory, 'BusinessApplication');
    assert.match(application.description, /no otorga préstamos/);
    const webpage = graph.find(entity => entity.url === origin + pathOf(file) && /Page$/.test(entity['@type']));
    assert.equal(webpage.mainEntity['@id'], application['@id']);
    if (file === 'como-funciona/index.html') assert.ok(!application.offers, 'this page does not display all paid prices');
    if (application.screenshot) {
      assert.ok(html.includes(new URL(application.screenshot).pathname), 'the declared demo is visible on this page');
      assert.match(plain(html), /datos ficticios/i);
    }
  }
});

test('structured offers agree with visible cards and the business catalog, including currency, monthly charges and fair use', () => {
  const source = read('app.js').match(/const PLAN_CATALOG = (\{[\s\S]*?\n\});/)[1];
  const plans = Object.values(vm.runInNewContext('(' + source + ')', Object.create(null), { timeout: 1000 }));
  for (const file of ['index.html', 'precios/index.html']) {
    const html = pages[file];
    const application = graphOf(html).find(entity => entity['@type'] === 'WebApplication');
    assert.equal(application.offers.length, plans.length);
    for (const plan of plans) {
      const offer = application.offers.find(item => normalized(item.name) === normalized('Plan ' + plan.label));
      assert.ok(offer, plan.label);
      assert.equal(offer.price, Number(plan.price.replace(/[^\d.]/g, '')));
      assert.equal(offer.priceCurrency, 'PEN');
      assert.equal(offer.url, origin + '/precios/');
      const card = [...html.matchAll(/<article class="price-card [^"]*">([\s\S]*?)<\/article>/g)]
        .find(match => normalized(match[1].match(/<h3>([^<]+)<\/h3>/)[1]) === normalized(plan.label))[1];
      const capacity = plain(card.match(/<p class="capacity">([\s\S]*?)<\/p>/)[1]);
      assert.ok(offer.description.startsWith(capacity));
      if (offer.price > 0) {
        assert.match(plain(card), /\/ mes/);
        assert.match(offer.description, /Cobro mensual/);
        assert.equal(offer.priceSpecification.price, offer.price);
        assert.equal(offer.priceSpecification.priceCurrency, 'PEN');
        assert.deepEqual(offer.priceSpecification.referenceQuantity, {
          '@type': 'QuantitativeValue', value: 1, unitCode: 'MON', unitText: 'mes',
        });
      } else {
        assert.match(offer.description, /Sin costo/);
        assert.ok(!offer.priceSpecification, 'the free plan is not described as a monthly charge');
      }
      if (plan.clientLimit === null) assert.match(offer.description, /Sujeto a uso razonable/);
    }
  }
});
