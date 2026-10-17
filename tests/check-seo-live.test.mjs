import test from 'node:test';
import assert from 'node:assert/strict';
import { options, metadata, hasNoindex, matchesRobotsContract, matchesSpoofedPage } from '../scripts/check-seo-live.mjs';

const html = (directives = '') => '<!doctype html><html><head><title>ERMIF</title><link rel="canonical" href="https://ermif.com/">' + directives + '</head><body><h1>Control de préstamos</h1></body></html>';
const response = (robotsHeader = '') => ({ status: 200, contentType: 'text/html; charset=utf-8', robotsHeader });
const robots = 'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://ermif.com/sitemap.xml\n';

test('baseline helpers accept normal public HTML and the current robots contract without network requests', () => {
  const page = metadata(html());
  assert.equal(hasNoindex(page, response()), false);
  assert.equal(matchesSpoofedPage(page, response(), 'ERMIF'), true);
  assert.equal(matchesRobotsContract(robots), true);
  assert.equal(matchesRobotsContract('# ERMIF\r\n  USER-AGENT : * # public\r\n Allow : /\r\n\r\n Disallow: /api/  \r\n Sitemap: https://ermif.com/sitemap.xml # canonical\r\n'), true);
  assert.equal(hasNoindex(metadata(html('<meta name="robots" content="noindex">')), response(), true), true);
});

test('a later index tag never hides an earlier noindex restriction', () => {
  const page = metadata(html('<meta name="robots" content="noindex"><meta name="robots" content="index">'));
  assert.equal(hasNoindex(page, response()), true);
  assert.equal(matchesSpoofedPage(page, response(), 'ERMIF'), false);
  assert.equal(hasNoindex(metadata(html('<meta name="GOOGLEBOT" content="none">')), response()), true);
});

test('matching title and canonical do not approve a bot response carrying noindex', () => {
  const page = metadata(html());
  assert.equal(matchesSpoofedPage(page, response('noindex'), 'ERMIF'), false);
  assert.equal(matchesSpoofedPage(page, response('googlebot: noindex, nofollow'), 'ERMIF'), false);
  assert.equal(matchesSpoofedPage(page, { ...response(), contentType: 'text/plain' }, 'ERMIF'), false);
  assert.equal(matchesSpoofedPage(metadata(html('<link rel="canonical" href="https://ermif.com/">')), response(), 'ERMIF'), false);
});

test('application exclusion must apply generally rather than only to one named bot', () => {
  const page = metadata(html('<meta name="googlebot" content="noindex">'));
  assert.equal(hasNoindex(page, response('googlebot: noindex, nofollow'), true), false);
  assert.equal(hasNoindex(page, response('noindex'), true), true);
  assert.equal(hasNoindex(metadata(html('<meta name="robots" content="none">')), response(), true), true);
});

test('robots rejects new public-page blocks, unexpected groups and other contract changes', () => {
  for (const changed of [
    robots + 'Disallow: /precios/\n',
    robots.replace('Disallow: /api/', 'Disallow: /precios/'),
    robots + 'User-agent: Googlebot\nDisallow: /\n',
    robots + 'Crawl-delay: 1\n',
    robots.replace('User-agent: *', 'User-agent: Googlebot'),
    robots.replace('https://ermif.com/sitemap.xml', 'https://example.invalid/sitemap.xml'),
    robots.replace('Allow: /\n', ''),
    'Allow: /\n' + robots.replace('Allow: /\n', ''),
  ]) assert.equal(matchesRobotsContract(changed), false, changed);
});

test('base URL validation rejects external or credential-bearing destinations before requesting anything', () => {
  assert.equal(options([]).baseUrl, 'https://ermif.com');
  assert.equal(options(['--base-url', 'http://localhost:3000']).local, true);
  for (const base of [
    'https://example.invalid', 'https://ermif.com.example.invalid', 'http://ermif.com',
    'https://user:fixture@ermif.com', 'https://ermif.com/?token=fixture', 'http://localhost:3000/api/',
  ]) assert.throws(() => options(['--base-url', base]), /base URL must be/);
});
