/* Admin-only acquisition report. The API independently verifies administrator access. */
(() => {
  'use strict';
  const sources = { directo: 'Directo', google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', email: 'Correo', otro: 'Otro' };
  const media = { direct: 'Directo', organic: 'Búsqueda orgánica', paid_search: 'Búsqueda de pago', paid_social: 'Redes de pago', social: 'Redes sociales', email: 'Correo', referral: 'Referencia', other: 'Otro' };
  const campaigns = { 'lanzamiento-ermif': 'Lanzamiento ERMIF', 'contenido-educativo': 'Contenido educativo' };
  const numberFormat = new Intl.NumberFormat('es-PE');
  const percentFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' });
  const timeFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' });
  let fetchReport = null;
  let generation = 0;
  let bound = false;

  const count = value => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; };
  const ratio = (payments, registrations) => registrations > 0 ? percentFormat.format(payments / registrations * 100) + '%' : '—';
  const lookup = (map, key, fallback) => Object.hasOwn(map, key) ? map[key] : fallback;
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }
  function elements() {
    return { root: document.getElementById('acquisitionReport'), body: document.getElementById('acquisitionReportBody'), period: document.getElementById('acquisitionPeriod'), refresh: document.getElementById('acquisitionRefresh') };
  }
  function bind() {
    const ui = elements();
    if (!ui.body || !ui.period || !ui.refresh) return null;
    if (!bound) {
      ui.period.addEventListener('change', () => { if (fetchReport) void reload(); });
      ui.refresh.addEventListener('click', () => { if (fetchReport) void reload(); });
      bound = true;
    }
    return ui;
  }
  function busy(ui, value) {
    ui.body.setAttribute('aria-busy', String(value));
    ui.refresh.disabled = value;
    ui.refresh.textContent = value ? 'Actualizando…' : 'Actualizar medición';
  }
  function status(ui, message, error = false) {
    const box = node('div', undefined, 'acquisition-report-status' + (error ? ' acquisition-report-error' : ''));
    box.append(node('p', message));
    if (error) {
      const retry = node('button', 'Reintentar', 'acquisition-report-retry');
      retry.type = 'button';
      retry.addEventListener('click', () => { if (fetchReport) void reload(); });
      box.append(retry);
    }
    ui.body.replaceChildren(box);
  }
  function card(label, value, subtitle, progress, total) {
    const item = node('article', undefined, 'acquisition-report-card');
    item.append(node('span', label, 'acquisition-report-card-label'), node('strong', value, 'acquisition-report-value'));
    if (progress !== undefined) {
      const track = node('div', undefined, 'acquisition-report-track');
      const fill = node('span');
      fill.style.width = (total > 0 ? Math.min(100, progress / total * 100) : 0) + '%';
      track.setAttribute('aria-hidden', 'true');
      track.append(fill);
      item.append(track);
    }
    item.append(node('small', subtitle));
    return item;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  function render(ui, report) {
    if (!report || typeof report.totals !== 'object' || !report.totals || !Array.isArray(report.rows)) throw Error('Invalid report');
    const totals = Object.fromEntries(['visitors', 'registrations', 'activated', 'first_payments'].map(key => [key, count(report.totals[key])]));
    const content = document.createDocumentFragment();
    const cards = node('div', undefined, 'acquisition-report-cards');
    cards.append(
      card('Visitantes medidos', numberFormat.format(totals.visitors), 'Con consentimiento', totals.visitors, totals.visitors),
      card('Registros confirmados', numberFormat.format(totals.registrations), 'Cuentas nuevas atribuidas', totals.registrations, totals.visitors),
      card('Cuentas activadas', numberFormat.format(totals.activated), 'Primer préstamo guardado', totals.activated, totals.visitors),
      card('Primer pago', numberFormat.format(totals.first_payments), 'Suscripción confirmada', totals.first_payments, totals.visitors),
      card('Registro → primer pago', ratio(totals.first_payments, totals.registrations), totals.registrations ? 'De las cuentas registradas' : 'Aún no hay registros para calcularlo'),
    );
    content.append(cards);
    content.append(node('p', 'Las barras comparan cada etapa con el total de visitantes medidos. El porcentaje compara primeros pagos con registros.', 'acquisition-report-caption'));
    if (!report.rows.length) {
      content.append(node('p', 'Todavía no hay visitas medidas en este período. Aquí aparecerán los orígenes y sus conversiones cuando haya datos reales.', 'acquisition-report-empty'));
    } else {
      const scroll = node('div', undefined, 'acquisition-report-table-scroll');
      scroll.tabIndex = 0;
      scroll.setAttribute('role', 'region');
      scroll.setAttribute('aria-label', 'Conversiones por origen y página de entrada; tabla desplazable');
      const table = node('table', undefined, 'acquisition-report-table');
      const caption = node('caption', 'Origen de las visitas y conversiones posteriores del mismo grupo');
      const head = node('thead');
      const header = node('tr');
      for (const title of ['Origen / medio / campaña', 'Página de entrada', 'Visitantes', 'Registros', 'Activados', 'Primer pago', 'Registro → pago']) {
        const th = node('th', title); th.scope = 'col'; header.append(th);
      }
      head.append(header);
      const body = node('tbody');
      for (const row of report.rows) {
        const record = row && typeof row === 'object' ? row : {};
        const tr = node('tr');
        const origin = node('td');
        origin.append(node('strong', lookup(sources, record.source, 'Otro')), node('small', lookup(media, record.medium, 'Otro')));
        if (record.campaign_id) origin.append(node('small', lookup(campaigns, record.campaign_id, 'Campaña no reconocida')));
        const path = typeof record.landing_path === 'string' ? record.landing_path.slice(0, 120) : 'Sin página';
        const registrations = count(record.registrations);
        const payments = count(record.first_payments);
        tr.append(origin, node('td', path, 'acquisition-report-path'), node('td', numberFormat.format(count(record.visitors))), node('td', numberFormat.format(registrations)), node('td', numberFormat.format(count(record.activated))), node('td', numberFormat.format(payments)), node('td', ratio(payments, registrations)));
        body.append(tr);
      }
      table.append(caption, head, body);
      scroll.append(table);
      content.append(scroll);
    }
    const since = validDate(report.since);
    const cutover = validDate(report.cutover_at);
    const details = [];
    if (since) details.push('Primera visita desde el ' + dateFormat.format(since));
    if (cutover) details.push('Medición disponible desde el ' + dateFormat.format(cutover));
    details.push('Actualizado: ' + timeFormat.format(new Date()) + ' (Lima)');
    content.append(node('p', details.join(' · '), 'acquisition-report-updated'));
    ui.body.replaceChildren(content);
  }

  async function reload() {
    const ui = bind();
    if (!ui || !fetchReport) return false;
    const currentFetch = fetchReport;
    const current = ++generation;
    const days = ['30', '90', '180'].includes(ui.period.value) ? ui.period.value : '30';
    busy(ui, true);
    status(ui, 'Cargando visitas y conversiones…');
    let timeout;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => currentFetch('/api/admin/acquisition?days=' + days)),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Timeout')), 12000); }),
      ]);
      if (current !== generation || !fetchReport) return false;
      render(ui, result);
      return true;
    } catch {
      if (current !== generation || !fetchReport) return false;
      status(ui, 'No pudimos cargar la medición. Puedes reintentar; las demás funciones de administración siguen disponibles.', true);
      return false;
    } finally {
      clearTimeout(timeout);
      if (current === generation) busy(ui, false);
    }
  }
  function load(loader) {
    if (typeof loader !== 'function') return Promise.resolve(false);
    fetchReport = loader;
    return reload();
  }
  function reset() {
    generation++;
    fetchReport = null;
    const ui = elements();
    if (!ui.body) return;
    if (ui.period) ui.period.value = '30';
    if (ui.refresh) busy(ui, false);
    status(ui, 'La medición se carga al entrar como administrador.');
  }
  window.ERMIFAcquisitionReport = Object.freeze({ load, reset });
})();
