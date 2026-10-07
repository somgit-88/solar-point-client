/* Solar Point — front-end behaviour (no dependencies).
   Flow: render instantly from cache/defaults -> fetch fresh data from the
   Apps Script API -> re-render. API failure never blanks the page. */
(() => {
  'use strict';
  const C = window.SP_CONFIG;
  const PAGE = document.body.dataset.page;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lines = (s) => String(s || '').split('|').map((x) => x.trim()).filter(Boolean);
  const isYes = (v) => v === true || /^(yes|true|y|1)$/i.test(String(v || '').trim());

  const state = {
    settings: { ...C.DEFAULTS },
    d: { services: [], products: [], categories: [], projects: [], testimonials: [], faqs: [] },
    live: false,
    filters: { cat: 'all', q: '', gcat: 'all' }
  };

  /* ---------- icons ---------- */
  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    home: '<path d="M3 11 12 3l9 8M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    building: '<path d="M4 21V5l8-2v18M12 8h8v13M4 21h16M7 9h2M7 13h2M7 17h2M15 12h2M15 16h2"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 11v2M7 10v4M11 10v4"/>',
    inverter: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h2l1.5-3 2 6L15 12h1"/>',
    panel: '<path d="M3 17 6 6h15l-3 11zM8.5 6 7 17M14 6l-1.5 11M4.5 11.5h15"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 12.6 12.6 21 3 11.4 11.4 3z" transform="scale(.9) translate(1.3 1.3)"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>'
  };
  const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.sun}</svg>`;

  /* ---------- contact helpers ---------- */
  const digits = (s) => String(s || '').replace(/\D/g, '');
  function e164(n) {
    const d = digits(n);
    if (!d) return '';
    if (d.length === 10) return '91' + d;
    if (d.length === 11 && d[0] === '0') return '91' + d.slice(1);
    return d;
  }
  const waLink = (text) => {
    const n = e164(state.settings.whatsapp || state.settings.phone);
    return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : '';
  };
  const hasWA = () => !!e164(state.settings.whatsapp);
  const mapsDir = () => state.settings.maps_directions_url ||
    `https://www.google.com/maps/dir/?api=1&destination=${C.LAT},${C.LNG}&destination_place_id=${C.PLACE_ID}`;
  const mapsEmbed = () => state.settings.maps_embed_url || `https://www.google.com/maps?q=${C.LAT},${C.LNG}&z=16&output=embed`;

  /* Normalise image URLs; Drive share links are converted but a repo/R2 path is more reliable. */
  function imgUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1200`;
    if (/^(https:\/\/|\/)/.test(u)) return u;
    return '';
  }
  const imgTag = (u, alt, lazy = true) =>
    `<img src="${esc(imgUrl(u))}" alt="${esc(alt)}" ${lazy ? 'loading="lazy"' : ''} decoding="async" onerror="this.remove()">`;

  /* ---------- settings -> DOM ---------- */
  function applySettings() {
    const s = state.settings;
    $$('[data-setting]').forEach((n) => { const v = s[n.dataset.setting]; if (v) n.textContent = v; });
    $$('[data-if-setting]').forEach((n) => { n.hidden = !s[n.dataset.ifSetting]; });
    $$('[data-show-if-no]').forEach((n) => { n.hidden = n.dataset.showIfNo === 'whatsapp' ? hasWA() : !!s[n.dataset.showIfNo]; });

    const tel = e164(s.phone);
    $$('[data-link=call]').forEach((a) => {
      a.hidden = !tel;
      if (tel) a.href = 'tel:+' + tel;
    });
    $$('[data-link=whatsapp]').forEach((a) => {
      const l = waLink(a.dataset.wa || `Hello ${s.business_name}, I would like to enquire about solar solutions.`);
      a.hidden = !l || !hasWA();
      if (l) { a.href = l; a.target = '_blank'; a.rel = 'noopener'; }
    });
    $$('[data-link=email]').forEach((a) => { a.hidden = !s.email; if (s.email) a.href = 'mailto:' + s.email; });
    $$('[data-link=directions]').forEach((a) => { a.href = mapsDir(); });
    $$('iframe[data-map]').forEach((f) => { const u = mapsEmbed(); if (f.getAttribute('src') !== u) f.src = u; });
    // WhatsApp-only copy inside the sticky bar: hide the whole bar item when missing handled above.

    const soc = $('[data-social]');
    if (soc) soc.innerHTML = ['facebook', 'instagram', 'youtube'].filter((k) => /^https?:\/\//.test(s[k] || ''))
      .map((k) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${k[0].toUpperCase() + k.slice(1)}</a>`).join('');

    if (s.business_name) document.querySelectorAll('.brand-name').forEach((n) => (n.textContent = s.business_name));
    if (s.logo_url && imgUrl(s.logo_url)) $$('.brand-mark').forEach((m) => { m.outerHTML = `<img class="brand-mark" src="${esc(imgUrl(s.logo_url))}" alt="" width="34" height="34">`; });
    $$('[data-image-slot]').forEach((n) => { const u = imgUrl(s[n.dataset.imageSlot]); if (u && !$('img', n)) n.innerHTML = imgTag(u, s.business_name || 'Solar Point'); });
    $$('#year').forEach((n) => (n.textContent = new Date().getFullYear()));
    updateSchema();
    loadAnalytics();
  }

  function updateSchema() {
    const s = state.settings; const el = $('#ld-business'); if (!el) return;
    try {
      const o = JSON.parse(el.textContent);
      if (e164(s.phone)) o.telephone = '+' + e164(s.phone);
      if (s.email) o.email = s.email;
      if (s.hours_schema) o.openingHours = lines(s.hours_schema);
      const same = ['facebook', 'instagram', 'youtube'].map((k) => s[k]).filter((u) => /^https?:\/\//.test(u || ''));
      if (same.length) o.sameAs = same;
      const logo = imgUrl(s.logo_url); if (logo) o.image = logo.startsWith('/') ? location.origin + logo : logo;
      el.textContent = JSON.stringify(o);
    } catch (_) { /* ignore */ }
  }

  let analyticsLoaded = false;
  function loadAnalytics() {
    const id = state.settings.ga_id;
    if (analyticsLoaded || !/^G-[A-Z0-9]{4,}$/.test(id || '')) return;
    analyticsLoaded = true;
    const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', id);
  }
  const track = (name, params) => { try { if (window.gtag) gtag('event', name, params || {}); } catch (_) {} };

  /* ---------- renderers ---------- */
  const empty = (title, text, withCta = true) =>
    `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${withCta ? '<div class="cta-row"><a class="btn btn-dark" href="/contact/">Send an enquiry</a><a class="btn btn-line" data-link="whatsapp" hidden>WhatsApp</a></div>' : ''}</div>`;

  function services() { return (state.d.services.length ? state.d.services : (state.live ? [] : C.FALLBACK.services)); }

  function renderServices() {
    const list = services();
    const home = $('#home-services');
    if (home) {
      const top = list.filter((x) => isYes(x.featured)).concat(list.filter((x) => !isYes(x.featured))).slice(0, 5);
      home.innerHTML = top.length ? top.map((x, i) => `
        <article class="svc-row reveal"><span class="svc-no">${String(i + 1).padStart(2, '0')}</span>
          <div><h3>${esc(x.name)}</h3><p>${esc(x.shortDescription)}</p></div>
          <a class="link-arrow" href="/solutions/#${esc(x.slug || x.id)}">Details</a></article>`).join('')
        : empty('Our solutions are being updated', 'Please contact us to discuss what you need.');
    }
    const full = $('#solutions');
    if (full) {
      full.innerHTML = list.length ? list.map((x) => {
        const feats = lines(x.features);
        const q = encodeURIComponent(x.name);
        return `<article class="sol reveal" id="${esc(x.slug || x.id)}">
          <div class="sol-icon">${icon(x.icon)}</div>
          <div><h2 style="font-size:1.7rem">${esc(x.name)}</h2>
            <p>${esc(x.fullDescription || x.shortDescription)}</p>
            ${x.suitableFor ? `<p class="tagline"><b>Suitable for:</b> ${esc(x.suitableFor)}</p>` : ''}
            <div class="cta-row" style="margin-top:14px">
              <a class="btn btn-gold btn-sm" href="/contact/?service=${q}">${esc(x.ctaLabel || 'Get a Quote')}</a>
              <a class="btn btn-wa btn-sm" data-link="whatsapp" data-wa="Hello ${esc(state.settings.business_name)}, I would like to enquire about ${esc(x.name)}." hidden>WhatsApp Us</a>
            </div></div>
          <div>${feats.length ? `<ul class="checks">${feats.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}${imgUrl(x.image) ? `<div class="sol-img">${imgTag(x.image, x.name)}</div>` : ''}</div>
        </article>`;
      }).join('') : empty('Our solutions are being updated', 'Please contact us to discuss what you need.');
    }
    const foot = $('[data-foot-services]');
    if (foot && list.length) foot.innerHTML = list.slice(0, 6).map((x) => `<li><a href="/solutions/#${esc(x.slug || x.id)}">${esc(x.name)}</a></li>`).join('');
    // contact form requirement list
    const sel = $('#f-req');
    if (sel) {
      const have = new Set($$('option', sel).map((o) => o.textContent));
      list.forEach((x) => { if (!have.has(x.name)) sel.insertBefore(new Option(x.name, x.name), sel.lastElementChild); });
      prefillForm();
    }
  }

  function productCard(p) {
    const q = encodeURIComponent(p.productName);
    const msg = `Hello ${state.settings.business_name}, I would like to enquire about ${p.brand ? p.brand + ' ' : ''}${p.productName}${p.model ? ' (' + p.model + ')' : ''}.`;
    const status = String(p.availability || '').toLowerCase();
    const badge = status ? `<span class="badge ${/in stock|available/.test(status) ? 'ok' : ''}">${esc(p.availability)}</span>` : '';
    const price = isYes(p.showPrice) && p.price ? `<div class="p-price">₹ ${esc(p.price)}</div>` : '';
    return `<article class="p-card reveal">
      <div class="p-img">${icon('panel')}${imgUrl(p.image) ? imgTag(p.image, p.productName) : ''}${badge}</div>
      <div class="p-body">${p.brand ? `<span class="p-brand">${esc(p.brand)}</span>` : ''}
        <h3>${esc(p.productName)}</h3>${p.model ? `<p>${esc(p.model)}</p>` : ''}
        <p>${esc(p.shortDescription)}</p>${price}
        <div class="p-actions">
          <button class="btn btn-line" type="button" data-details="${esc(p.productId)}">Details</button>
          ${isYes(p.enquiryEnabled) || p.enquiryEnabled === '' || p.enquiryEnabled === undefined
            ? `<a class="btn btn-wa" data-link="whatsapp" data-wa="${esc(msg)}" hidden>WhatsApp</a><a class="btn btn-gold" href="/contact/?product=${q}">Enquire</a>` : ''}
        </div></div></article>`;
  }

  function renderProducts() {
    const all = state.d.products;
    const home = $('#home-products');
    if (home) {
      const feat = all.filter((p) => isYes(p.featured)).slice(0, 4);
      const sec = $('[data-section=featured-products]');
      if (sec) sec.hidden = !feat.length;
      home.innerHTML = feat.map(productCard).join('');
    }
    const grid = $('#products');
    if (!grid) return;
    const cats = state.d.categories.length ? state.d.categories.map((c) => c.name) : [...new Set(all.map((p) => p.category).filter(Boolean))];
    const bar = $('#p-toolbar');
    if (bar) bar.hidden = !all.length;
    const chips = $('#p-chips');
    if (chips && chips.dataset.sig !== cats.join('|')) {
      chips.dataset.sig = cats.join('|');
      chips.innerHTML = ['all', ...cats].map((c) => `<button class="chip" type="button" aria-pressed="${c === state.filters.cat}" data-cat="${esc(c)}">${c === 'all' ? 'All' : esc(c)}</button>`).join('');
    }
    const q = state.filters.q.toLowerCase();
    const rows = all.filter((p) => (state.filters.cat === 'all' || p.category === state.filters.cat) &&
      (!q || [p.productName, p.brand, p.model, p.shortDescription, p.category].join(' ').toLowerCase().includes(q)));
    grid.innerHTML = rows.length ? rows.map(productCard).join('')
      : (all.length ? empty('No products match', 'Try another category or search term.', false)
        : empty('Our product catalogue is being updated', 'Please contact us for current availability.'));
    const cnt = $('#p-count'); if (cnt) cnt.textContent = all.length ? `${rows.length} product${rows.length === 1 ? '' : 's'}` : '';
  }

  function openProduct(id) {
    const p = state.d.products.find((x) => x.productId === id); if (!p) return;
    const specs = lines(p.specifications).map((s) => s.split(':')).filter((a) => a.length > 1);
    const feats = lines(p.features);
    const msg = `Hello ${state.settings.business_name}, I would like to enquire about ${p.brand ? p.brand + ' ' : ''}${p.productName}.`;
    $('#p-dlg-body').innerHTML = `<div class="p-img">${icon('panel')}${imgUrl(p.image) ? imgTag(p.image, p.productName, false) : ''}</div>
      <div class="dlg-pad">${p.brand ? `<span class="p-brand">${esc(p.brand)}</span>` : ''}<h2 style="font-size:1.6rem">${esc(p.productName)}</h2>
      <p>${esc(p.description || p.shortDescription)}</p>
      ${feats.length ? `<ul class="checks">${feats.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      ${specs.length ? `<table class="specs"><tbody>${specs.map((s) => `<tr><th>${esc(s[0].trim())}</th><td>${esc(s.slice(1).join(':').trim())}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="cta-row"><a class="btn btn-wa" data-link="whatsapp" data-wa="${esc(msg)}" hidden>WhatsApp Enquiry</a><a class="btn btn-gold" href="/contact/?product=${encodeURIComponent(p.productName)}">Request a Quote</a></div></div>`;
    applySettings();
    $('#p-dialog').showModal();
  }

  function projectItem(p) {
    return `<button type="button" class="g-item reveal" data-project="${esc(p.projectId)}" aria-label="View ${esc(p.projectName)}">${imgTag(p.image, p.projectName)}<span class="g-cap">${esc(p.projectName)}${p.location ? ' · ' + esc(p.location) : ''}</span></button>`;
  }
  function renderProjects() {
    const all = state.d.projects.filter((p) => imgUrl(p.image));
    const home = $('#home-projects');
    if (home) {
      const sec = $('[data-section=projects]'); const feat = all.filter((p) => isYes(p.featured)).slice(0, 6);
      if (sec) sec.hidden = !feat.length;
      home.innerHTML = feat.map(projectItem).join('');
    }
    const g = $('#gallery'); if (!g) return;
    const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];
    const bar = $('#g-toolbar'); bar.hidden = cats.length < 2;
    const chips = $('#g-chips');
    if (chips.dataset.sig !== cats.join('|')) { chips.dataset.sig = cats.join('|'); chips.innerHTML = ['all', ...cats].map((c) => `<button class="chip" type="button" aria-pressed="${c === 'all'}" data-gcat="${esc(c)}">${c === 'all' ? 'All' : esc(c)}</button>`).join(''); }
    const rows = all.filter((p) => state.filters.gcat === 'all' || p.category === state.filters.gcat);
    g.style.columns = rows.length ? '' : '1';
    g.innerHTML = rows.length ? rows.map(projectItem).join('') : empty('Photos coming soon', 'We are adding photos of our shop and work. Please visit us or get in touch.');
  }
  function openProject(id) {
    const p = state.d.projects.find((x) => x.projectId === id); if (!p) return;
    $('#g-dlg-body').innerHTML = `${imgTag(p.image, p.projectName, false)}<div class="dlg-pad"><h2 style="font-size:1.5rem">${esc(p.projectName)}</h2>
      <p class="tagline">${[p.location, p.category, p.capacity ? p.capacity : '', p.date].filter(Boolean).map(esc).join(' · ')}</p><p>${esc(p.description)}</p></div>`;
    $('#g-dialog').showModal();
  }

  function renderTestimonials() {
    const sec = $('[data-section=testimonials]'); if (!sec) return;
    const rows = state.d.testimonials.filter((t) => t.review);
    sec.hidden = !rows.length;
    $('#quotes').innerHTML = rows.map((t) => {
      const r = Math.max(0, Math.min(5, parseInt(t.rating, 10) || 0));
      return `<figure class="quote reveal" style="margin:0">${r ? `<div class="stars" aria-label="${r} out of 5">${'★'.repeat(r)}${'☆'.repeat(5 - r)}</div>` : ''}
        <blockquote>“${esc(t.review)}”</blockquote><figcaption class="who"><b>${esc(t.customerName)}</b>${t.location ? ', ' + esc(t.location) : ''}${t.source ? ' · ' + esc(t.source) : ''}</figcaption></figure>`;
    }).join('');
  }

  function renderFaqs() {
    const sec = $('[data-section=faqs]'); if (!sec) return;
    const rows = state.d.faqs.length ? state.d.faqs : (state.live ? [] : C.FALLBACK.faqs);
    sec.hidden = !rows.length;
    $('#faq-list').innerHTML = rows.map((f) => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('');
    document.getElementById('ld-faq')?.remove();
    if (rows.length) {
      const s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'ld-faq';
      s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: rows.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) });
      document.head.appendChild(s);
    }
  }

  function renderMisc() {
    const b = $('[data-section=brands]');
    if (b) { const list = String(state.settings.brands || '').split(',').map((x) => x.trim()).filter(Boolean); b.hidden = !list.length; $('#brand-list').innerHTML = list.map((x) => `<span>${esc(x)}</span>`).join(''); }
    const t = $('[data-section=trust]');
    if (t) { const list = lines(state.settings.trust_points); t.hidden = !list.length; $('#trust-list').innerHTML = list.map((x) => `<li>${esc(x)}</li>`).join(''); }
  }

  function renderAll() {
    applySettings(); renderServices(); renderProducts(); renderProjects(); renderTestimonials(); renderFaqs(); renderMisc();
    applySettings(); observeReveal();
  }

  /* ---------- data loading ---------- */
  const KEY = 'sp_data_v1';
  const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (_) { return null; } };
  const writeCache = (data) => { try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), data })); } catch (_) {} };

  function ingest(data) {
    if (!data) return;
    state.settings = { ...C.DEFAULTS, ...(data.config || {}) };
    ['services', 'products', 'categories', 'projects', 'testimonials', 'faqs'].forEach((k) => { state.d[k] = Array.isArray(data[k]) ? data[k] : []; });
  }

  async function fetchLive() {
    if (!C.API_URL) return null;
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(C.API_URL + (C.API_URL.includes('?') ? '&' : '?') + 'action=getAll', { signal: ctrl.signal });
      const j = await r.json();
      if (!j || !j.success) throw new Error('bad');
      return j.data;
    } finally { clearTimeout(to); }
  }

  async function boot() {
    renderAll();                                   // defaults first: page is never blank
    const cached = readCache();
    if (cached && cached.data) { ingest(cached.data); state.live = true; renderAll(); }
    if (!C.API_URL) { state.live = false; return; }
    if (cached && Date.now() - cached.t < C.CACHE_MINUTES * 60000) return;
    try {
      const fresh = await fetchLive();
      ingest(fresh); state.live = true; writeCache(fresh); renderAll();
    } catch (_) {
      if (!cached) { state.live = false; renderAll(); }   // fallback content, no error text for visitors
    }
  }

  /* ---------- contact form ---------- */
  const formStart = Date.now();
  function prefillForm() {
    const f = $('#lead-form'); if (!f || f.dataset.pre) return;
    const qs = new URLSearchParams(location.search);
    const want = qs.get('service') || qs.get('product');
    if (!want) return;
    const sel = $('#f-req');
    if (![...sel.options].some((o) => o.value === want)) sel.insertBefore(new Option(want, want), sel.lastElementChild);
    sel.value = want; f.dataset.pre = '1';
  }

  function validate(f) {
    let ok = true;
    const set = (name, msg) => {
      const el = f.elements[name]; const box = el.closest('.field'); const err = $('[data-err]', box);
      box.classList.toggle('invalid', !!msg); if (err) err.textContent = msg || ''; if (msg) ok = false;
    };
    const name = f.name.value.trim(); set('name', name.length < 2 ? 'Please enter your name.' : '');
    const ph = digits(f.phone.value).replace(/^(91|0)(?=\d{10}$)/, '');
    set('phone', /^[6-9]\d{9}$/.test(ph) ? '' : 'Enter a valid 10-digit Indian mobile number.');
    const em = f.email.value.trim(); set('email', em && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em) ? 'Enter a valid email address.' : '');
    set('consent', f.consent.checked ? '' : 'Please tick to let us contact you.');
    if (!ok) { const first = $('.invalid input, .invalid select, .invalid textarea', f); first && first.focus(); }
    return ok ? ph : null;
  }

  function status(kind, html) { const s = $('#form-status'); s.innerHTML = html ? `<div class="notice ${kind}">${html}</div>` : ''; s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

  async function submitLead(ev) {
    ev.preventDefault();
    const f = ev.target, btn = $('#f-submit');
    const ph = validate(f); if (!ph) return;
    const clientKey = (f.dataset.key = f.dataset.key || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()));
    const payload = {
      action: 'submitLead', clientKey, website: f.website.value, elapsedMs: Date.now() - formStart,
      name: f.name.value, phone: ph, email: f.email.value, location: f.location.value, customerType: f.customerType.value,
      requirement: f.requirement.value, bill: f.bill.value, message: f.message.value,
      source: new URLSearchParams(location.search).get('product') ? 'Website – product enquiry' : 'Website – quote form', page: location.pathname
    };
    const fallback = () => `We couldn't submit your enquiry right now. Please call or WhatsApp us directly.${e164(state.settings.phone) ? ` <a href="tel:+${e164(state.settings.phone)}">Call ${esc(state.settings.phone)}</a>.` : ''} ${hasWA() ? `<a href="${esc(waLink('Hello ' + state.settings.business_name + ', I would like a solar quote. My name is ' + payload.name + '.'))}">WhatsApp</a>` : ''}`;
    if (!C.API_URL) { status('bad', fallback()); return; }
    btn.disabled = true; btn.textContent = 'Sending…'; status('', '');
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctrl.signal });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || 'failed');
      f.reset(); delete f.dataset.key;
      track('generate_lead', { source: payload.source });
      status('ok', `Thank you, ${esc(payload.name.split(' ')[0])}. We've received your enquiry${j.data && j.data.leadId ? ` (ref ${esc(j.data.leadId)})` : ''} and will contact you soon.${hasWA() ? ` <a href="${esc(waLink('Hello ' + state.settings.business_name + ', I just sent an enquiry on your website.'))}">Chat on WhatsApp</a>` : ''}`);
    } catch (e) {
      status('bad', e && /too many|wait/i.test(e.message) ? esc(e.message) : fallback());
    } finally { clearTimeout(to); btn.disabled = false; btn.textContent = 'Send Enquiry'; applySettings(); }
  }

  /* ---------- UI wiring ---------- */
  let io;
  function observeReveal() {
    if (!('IntersectionObserver' in window)) { $$('.reveal').forEach((n) => n.classList.add('in')); return; }
    io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    $$('.reveal:not(.in)').forEach((n) => io.observe(n));
  }

  function wire() {
    const mb = $('#menuBtn'), nav = $('#nav');
    mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-cat],[data-gcat],[data-details],[data-project],[data-close],[data-link=call],[data-link=whatsapp]'); if (!t) return;
      if (t.dataset.cat) { state.filters.cat = t.dataset.cat; $$('#p-chips .chip').forEach((c) => c.setAttribute('aria-pressed', c === t)); renderProducts(); applySettings(); observeReveal(); }
      else if (t.dataset.gcat) { state.filters.gcat = t.dataset.gcat; $$('#g-chips .chip').forEach((c) => c.setAttribute('aria-pressed', c === t)); renderProjects(); observeReveal(); }
      else if (t.dataset.details) openProduct(t.dataset.details);
      else if (t.dataset.project) openProject(t.dataset.project);
      else if (t.dataset.close) t.closest('dialog').close();
      else track(t.dataset.link === 'call' ? 'click_call' : 'click_whatsapp');
    });
    $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
    const s = $('#p-search'); if (s) s.addEventListener('input', () => { state.filters.q = s.value; renderProducts(); applySettings(); observeReveal(); });
    const f = $('#lead-form'); if (f) { f.addEventListener('submit', submitLead); f.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('invalid')); }
  }

  wire();
  boot();
})();
