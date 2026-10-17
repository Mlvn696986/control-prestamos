// Read-only, on-demand HTTP baseline. No authentication, cookies, APIs or scheduled runs.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://ermif.com';
const PUBLIC_PATHS = ['/', '/precios/', '/como-funciona/', '/contacto/', '/seguridad/', '/privacidad/', '/terminos/'];
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const DEFAULT_UA = 'ERMIF-SEO-Baseline/1.0 (read-only HTTP verification)';
const LIMITATIONS = [
  'This checks public HTTP responses and source HTML only; it does not execute JavaScript or measure Core Web Vitals.',
  'A successful HTTP response is not evidence of indexing, rankings, real crawler visits or AI citations.',
  'Googlebot, bingbot and OAI-SearchBot requests use spoofed User-Agent headers. They do not prove access for verified bots or validate Cloudflare firewall rules.',
  'Metadata and JSON-LD presence do not establish eligibility for rich results or guarantee how search/social services display a page.',
  'Robots is checked against the current ERMIF contract (one wildcard group, public access and /api/ exclusion), not with a general robots.txt interpreter.',
  'No credentials, cookies, private customer data, database access or analytics events are used. Nothing is submitted to search engines.',
];

function options(args) {
  const result = { baseUrl: ORIGIN, output: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--help') {
      console.log('Usage: node scripts/check-seo-live.mjs [--output docs/seo-baseline-YYYY-MM-DD.json] [--base-url http://localhost:3000]');
      process.exit(0);
    }
    if (!['--output', '--base-url'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error(`Unknown option or missing value: ${args[i]}`);
    }
    const key = args[i] === '--output' ? 'output' : 'baseUrl';
    result[key] = args[++i];
  }
  const url = new URL(result.baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (!local && url.origin !== ORIGIN) || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('The base URL must be https://ermif.com or a localhost origin, without credentials, path, query or fragment.');
  }
  return { ...result, baseUrl: url.origin, local };
}

function decode(text = '') {
  return text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([, key, , value]) => [key.toLowerCase(), decode(value)]));
}
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => attrs(match[0]));
}
function textContent(html = '') {
  return decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function metadata(html) {
  const metaTags = tags(html, 'meta');
  const meta = Object.fromEntries(metaTags.map(tag => [tag.name || tag.property, tag.content || '']));
  // Restrictions are cumulative: a later index must not hide an earlier noindex.
  const robotsDirectives = metaTags.filter(tag => ['robots', 'googlebot', 'bingbot', 'oai-searchbot'].includes((tag.name || '').toLowerCase()))
    .map(tag => ({ agent: tag.name.toLowerCase(), content: tag.content || '' }));
  const links = tags(html, 'link');
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => textContent(match[1]));
  const jsonLd = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => attrs(match[1]).type === 'application/ld+json').map(match => JSON.parse(match[2]));
  const resources = [
    ...tags(html, 'script').map(tag => tag.src).filter(Boolean),
    ...links.filter(tag => /^(stylesheet|preload|modulepreload)$/i.test(tag.rel || '')).map(tag => tag.href),
  ];
  const nav = [...html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi)].flatMap(match => tags(match[1], 'a').map(a => a.href).filter(Boolean));
  return {
    title: textContent(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
    description: meta.description || '', canonical: links.filter(tag => tag.rel === 'canonical').map(tag => tag.href),
    h1, meta, robotsDirectives, jsonLd, resources, nav,
    favicon: links.find(tag => (tag.rel || '').split(/\s+/).includes('icon'))?.href || '',
  };
}

function hasNoindex(page, response, generalOnly = false) {
  const restricted = value => /\b(noindex|none)\b/i.test(value);
  if (page.robotsDirectives.some(item => (!generalOnly || item.agent === 'robots') && restricted(item.content))) return true;
  // An agent prefix applies to subsequent comma-separated directives too.
  let agent = '';
  return response.robotsHeader.split(',').some(value => {
    const scoped = value.trim().match(/^([a-z][a-z0-9_-]*)\s*:\s*(.*)$/i);
    if (scoped) { agent = scoped[1].toLowerCase(); value = scoped[2]; }
    return (!generalOnly || !agent) && restricted(value);
  });
}

function matchesRobotsContract(body) {
  // Deliberately reject extra directives/groups instead of guessing their effect.
  const lines = body.split(/\r?\n/).map(line => line.replace(/#.*$/, '').trim()).filter(Boolean);
  const expected = new Map([
    ['user-agent', '*'], ['allow', '/'], ['disallow', '/api/'], ['sitemap', ORIGIN + '/sitemap.xml'],
  ]);
  const entries = lines.map(line => line.match(/^([a-z-]+)\s*:\s*(.*?)\s*$/i));
  if (entries.length !== expected.size || entries.some(entry => !entry)) return false;
  const normalized = entries.map(([, name, value]) => [name.toLowerCase(), value]);
  if (new Set(normalized.map(([name]) => name)).size !== expected.size ||
      normalized.some(([name, value]) => expected.get(name) !== value)) return false;
  const group = normalized.findIndex(([name]) => name === 'user-agent');
  return ['allow', 'disallow'].every(rule => normalized.findIndex(([name]) => name === rule) > group);
}

function matchesSpoofedPage(page, response, expectedTitle) {
  return response.status === 200 && /^text\/html\b/i.test(response.contentType) &&
    page.canonical.length === 1 && page.canonical[0] === ORIGIN + '/' &&
    Boolean(page.title) && page.title === expectedTitle && !hasNoindex(page, response);
}

async function request(url, ua = DEFAULT_UA) {
  const started = Date.now();
  const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': ua } });
  const reader = response.body?.getReader();
  const chunks = [];
  let length = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error(`Response exceeds ${MAX_BODY_BYTES} bytes`);
      }
      chunks.push(value);
    }
  }
  const bytes = Buffer.concat(chunks);
  return {
    url, status: response.status, contentType: response.headers.get('content-type') || '',
    location: response.headers.get('location'), robotsHeader: response.headers.get('x-robots-tag') || '',
    bytes: length, elapsedMs: Date.now() - started, body: bytes.toString('utf8'), binary: bytes,
  };
}

async function main() {
  const config = options(process.argv.slice(2));
  const report = { observedAt: new Date().toISOString(), baseUrl: config.baseUrl, canonicalOrigin: ORIGIN, limitations: LIMITATIONS, checks: [] };
  const pages = new Map();
  const url = path => new URL(path, config.baseUrl).href;
  const add = (name, ok, detail = {}) => report.checks.push({ name, status: ok ? 'pass' : 'fail', ...detail });
  const httpInfo = response => ({ url: response.url, httpStatus: response.status, contentType: response.contentType, bytes: response.bytes, elapsedMs: response.elapsedMs });
  async function check(name, work) {
    try { await work(); }
    catch (error) { add(name, false, { error: error.name === 'TimeoutError' ? `Request timed out after ${TIMEOUT_MS} ms` : error.message }); }
  }

  await check('robots', async () => {
    const response = await request(url('/robots.txt'));
    add('robots', response.status === 200 && /^text\/plain\b/i.test(response.contentType) &&
      matchesRobotsContract(response.body), httpInfo(response));
  });
  await check('sitemap', async () => {
    const response = await request(url('/sitemap.xml'));
    const locations = [...response.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(match => decode(match[1].trim()));
    const expected = PUBLIC_PATHS.map(path => ORIGIN + path);
    add('sitemap', response.status === 200 && /(?:application|text)\/xml\b/i.test(response.contentType) &&
      /<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/.test(response.body) &&
      /<\/urlset>\s*$/.test(response.body) && locations.length === expected.length && new Set(locations).size === expected.length &&
      expected.every(item => locations.includes(item)), { ...httpInfo(response), locations });
  });
  for (const path of PUBLIC_PATHS) {
    await check(`page:${path}`, async () => {
      const response = await request(url(path));
      const page = metadata(response.body);
      pages.set(path, page);
      const canonical = ORIGIN + path;
      const checks = {
        httpHtml: response.status === 200 && /^text\/html\b/i.test(response.contentType),
        canonical: page.canonical.length === 1 && page.canonical[0] === canonical,
        title: Boolean(page.title), description: Boolean(page.description), h1: page.h1.length === 1 && Boolean(page.h1[0]),
        crawlableNavigation: ['/precios/', '/como-funciona/', '/contacto/'].every(href => page.nav.includes(href)),
        openGraph: ['og:title', 'og:description', 'og:image', 'og:site_name', 'og:type'].every(key => Boolean(page.meta[key])) && page.meta['og:url'] === canonical,
        socialCard: page.meta['twitter:card'] === 'summary_large_image' && Boolean(page.meta['twitter:image']),
        jsonLd: page.jsonLd.some(data => data['@context'] === 'https://schema.org' && Array.isArray(data['@graph']) && data['@graph'].length > 0),
        favicon: page.favicon === '/favicon.png',
        indexableDirective: !hasNoindex(page, response),
        isolatedPublicResources: page.resources.length > 0 && !page.resources.some(resource => /(?:supabase|(?:^|\/)app\.js(?:[?#]|$)|(?:^|\/)styles\.css(?:[?#]|$)|assets\/summary\.css)/i.test(resource)),
      };
      add(`page:${path}`, Object.values(checks).every(Boolean), { ...httpInfo(response), checks, title: page.title, description: page.description, canonical: page.canonical, h1: page.h1, resources: page.resources });
    });
  }
  add('unique-titles-and-descriptions', pages.size === PUBLIC_PATHS.length &&
    new Set([...pages.values()].map(page => page.title)).size === PUBLIC_PATHS.length &&
    new Set([...pages.values()].map(page => page.description)).size === PUBLIC_PATHS.length);
  await check('favicon-resource', async () => {
    const response = await request(url('/favicon.png'));
    const png = response.binary;
    const isPng = png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const width = isPng ? png.readUInt32BE(16) : 0;
    const height = isPng ? png.readUInt32BE(20) : 0;
    add('favicon-resource', response.status === 200 && /^image\/png\b/i.test(response.contentType) && isPng && width === height && width >= 48,
      { ...httpInfo(response), width, height });
  });
  await check('missing-page', async () => {
    const response = await request(url('/__ermif_seo_baseline_missing__/'));
    add('missing-page', response.status === 404, httpInfo(response));
  });
  await check('app-noindex', async () => {
    const response = await request(url('/app/'));
    const page = metadata(response.body);
    add('app-noindex', response.status === 200 && hasNoindex(page, response, true),
      { ...httpInfo(response), metaRobots: page.meta.robots || '', robotsHeader: response.robotsHeader });
  });
  if (config.local) report.checks.push({ name: 'www-consolidation', status: 'skip', reason: 'Production-host redirect is intentionally not requested in localhost mode.' });
  else await check('www-consolidation', async () => {
    const response = await request('https://www.ermif.com/precios/?seo_baseline=1');
    add('www-consolidation', response.status === 301 && response.location === `${ORIGIN}/precios/?seo_baseline=1`,
      { ...httpInfo(response), location: response.location });
  });
  for (const agent of ['Googlebot', 'bingbot', 'OAI-SearchBot']) {
    await check(`spoofed-user-agent:${agent}`, async () => {
      const response = await request(url('/'), agent);
      const page = metadata(response.body);
      add(`spoofed-user-agent:${agent}`, matchesSpoofedPage(page, response, pages.get('/')?.title),
        { ...httpInfo(response), userAgent: agent, verifiedBot: false });
    });
  }
  report.summary = Object.fromEntries(['pass', 'fail', 'skip'].map(status => [status, report.checks.filter(check => check.status === status).length]));
  if (config.output) {
    const output = resolve(config.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Evidence saved: ${config.output}`);
  }
  for (const item of report.checks) console.log(`${item.status.toUpperCase()} ${item.name}${item.error ? `: ${item.error}` : ''}`);
  console.log(JSON.stringify(report.summary));
  console.log('HTTP baseline only: indexing, real verified-bot access, rich results and performance are not established.');
  process.exitCode = report.summary.fail ? 1 : 0;
}

export { options, metadata, hasNoindex, matchesRobotsContract, matchesSpoofedPage };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`SEO baseline could not run: ${error.message}`); process.exitCode = 1; });
}
