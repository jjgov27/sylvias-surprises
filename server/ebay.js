// ── eBay integration: connect, list items, sync sales ──
// Keys come from Railway env vars only (EBAY_ENV, EBAY_APP_ID, EBAY_CERT_ID, EBAY_RUNAME).
// Seller tokens are stored in a private file on the server volume, never in the database.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function setupEbay(app, db, requireAuth, opts) {
  const ENV = (process.env.EBAY_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const API = ENV === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
  const AUTH = ENV === 'production' ? 'https://auth.ebay.com' : 'https://auth.sandbox.ebay.com';
  const VIEW = ENV === 'production' ? 'https://www.ebay.co.uk/itm/' : 'https://sandbox.ebay.com/itm/';
  const MKT = 'EBAY_GB';
  const LOCATION_KEY = 'SYLVIAS_SHOP';
  const SCOPES = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  ].join(' ');
  const STORE = path.join(path.dirname(opts.dbPath), 'ebay-' + ENV + '.json');
  const configured = () => !!(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID);
  const basic = () => 'Basic ' + Buffer.from(process.env.EBAY_APP_ID + ':' + process.env.EBAY_CERT_ID).toString('base64');

  // ── tables ──
  db.exec(`CREATE TABLE IF NOT EXISTS sylvias_ebay_listings (id INTEGER PRIMARY KEY AUTOINCREMENT, stock_id INTEGER NOT NULL, sku TEXT NOT NULL UNIQUE, offer_id TEXT NOT NULL DEFAULT '', listing_id TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', price REAL NOT NULL DEFAULT 0, qty INTEGER NOT NULL DEFAULT 1, category_id TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'listed', note TEXT NOT NULL DEFAULT '', listed_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS sylvias_ebay_orders (order_id TEXT PRIMARY KEY, sale_id INTEGER, buyer TEXT NOT NULL DEFAULT '', total REAL NOT NULL DEFAULT 0, postage REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))`);

  for (const sql of [
    "ALTER TABLE sylvias_ebay_listings ADD COLUMN postage REAL",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN ship_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN ship_address TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN ship_phone TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN buyer_username TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN line_items TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN status TEXT NOT NULL DEFAULT 'to_post'",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN carrier TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN tracking TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN posted_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE sylvias_ebay_orders ADD COLUMN posted_by TEXT NOT NULL DEFAULT ''",
  ]) { try { db.exec(sql); } catch (e) { /* column exists */ } }

  // ── private store (tokens + setup) ──
  function load() { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return {}; } }
  function save(s) { fs.writeFileSync(STORE, JSON.stringify(s, null, 2), { mode: 0o600 }); }

  // ── tokens ──
  let appTok = { token: null, expires: 0 };
  async function appToken() {
    if (!configured()) throw new Error('eBay keys not set on this site');
    if (appTok.token && Date.now() < appTok.expires - 60000) return appTok.token;
    const r = await fetch(API + '/identity/v1/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic() }, body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope') });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) throw new Error('eBay rejected the keys: ' + (d.error_description || d.error || r.status));
    appTok = { token: d.access_token, expires: Date.now() + (d.expires_in || 7200) * 1000 };
    return appTok.token;
  }
  async function userToken() {
    const s = load();
    if (!s.refresh_token) throw new Error('Not connected to an eBay seller account yet');
    if (s.access_token && Date.now() < (s.access_expires || 0) - 60000) return s.access_token;
    const r = await fetch(API + '/identity/v1/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic() }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refresh_token) + '&scope=' + encodeURIComponent(SCOPES) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) throw new Error('eBay sign-in has expired — click Connect to eBay again (' + (d.error_description || d.error || r.status) + ')');
    s.access_token = d.access_token; s.access_expires = Date.now() + (d.expires_in || 7200) * 1000; save(s);
    return s.access_token;
  }

  // ── API helper ──
  async function ebay(method, p, body, useApp) {
    const token = useApp ? await appToken() : await userToken();
    const headers = { Authorization: 'Bearer ' + token, 'Content-Language': 'en-GB', 'Accept-Language': 'en-GB', 'X-EBAY-C-MARKETPLACE-ID': MKT };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(API + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!r.ok) {
      const msgs = (data.errors || []).map(e => e.longMessage || e.message).filter(Boolean);
      const err = new Error(msgs.length ? msgs.join(' • ') : ('eBay error ' + r.status));
      err.status = r.status; err.data = data; throw err;
    }
    return data;
  }
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req, res)); } catch (e) { res.status(e.httpStatus || 400).json({ error: e.message }); } };

  // ── status ──
  app.get('/api/ebay/status', requireAuth, async (req, res) => {
    const s = load();
    const out = { configured: configured(), env: ENV, appIdHint: configured() ? String(process.env.EBAY_APP_ID).slice(0, 18) + '…' : null, hasRuName: !!process.env.EBAY_RUNAME, keysOk: false, apiOk: false, categoryTreeId: null, connected: !!s.refresh_token, connectedAt: s.connected_at || null, setup: s.setup || null, lastSync: s.last_sync || null, error: null };
    if (!out.configured) return res.json(out);
    try {
      await appToken(); out.keysOk = true;
      const d = await ebay('GET', '/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=' + MKT, undefined, true);
      out.apiOk = true; out.categoryTreeId = d.categoryTreeId || null;
    } catch (e) { out.error = e.message; }
    res.json(out);
  });

  // ── connect (OAuth) ──
  const pendingStates = new Map();
  app.get('/api/ebay/connect', requireAuth, (req, res) => {
    if (!configured() || !process.env.EBAY_RUNAME) return res.status(400).send('eBay keys or RuName not set on this site');
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, Date.now());
    const url = AUTH + '/oauth2/authorize?client_id=' + encodeURIComponent(process.env.EBAY_APP_ID) + '&response_type=code&redirect_uri=' + encodeURIComponent(process.env.EBAY_RUNAME) + '&scope=' + encodeURIComponent(SCOPES) + '&state=' + state + '&prompt=login';
    res.redirect(url);
  });
  app.get('/api/ebay/callback', async (req, res) => {
    const { code, state } = req.query;
    const back = (msg) => res.redirect('/?ebay=' + encodeURIComponent(msg));
    if (!code) return back('declined');
    const t = pendingStates.get(state);
    if (!t || Date.now() - t > 15 * 60 * 1000) return back('expired');
    pendingStates.delete(state);
    try {
      const r = await fetch(API + '/identity/v1/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic() }, body: 'grant_type=authorization_code&code=' + encodeURIComponent(code) + '&redirect_uri=' + encodeURIComponent(process.env.EBAY_RUNAME) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.refresh_token) throw new Error(d.error_description || d.error || 'token exchange failed');
      const s = load();
      Object.assign(s, { access_token: d.access_token, access_expires: Date.now() + (d.expires_in || 7200) * 1000, refresh_token: d.refresh_token, refresh_expires: Date.now() + (d.refresh_token_expires_in || 0) * 1000, connected_at: new Date().toISOString() });
      save(s);
      back('connected');
    } catch (e) { console.error('eBay callback error:', e.message); back('failed'); }
  });
  app.post('/api/ebay/disconnect', requireAuth, wrap(async () => { const s = load(); delete s.access_token; delete s.refresh_token; delete s.access_expires; delete s.refresh_expires; delete s.connected_at; save(s); return { ok: true }; }));

  // ── seller setup: business policies + shop location ──
  async function listPolicies() {
    const [f, p, r] = await Promise.all([
      ebay('GET', '/sell/account/v1/fulfillment_policy?marketplace_id=' + MKT).catch(e => ({ _err: e })),
      ebay('GET', '/sell/account/v1/payment_policy?marketplace_id=' + MKT).catch(e => ({ _err: e })),
      ebay('GET', '/sell/account/v1/return_policy?marketplace_id=' + MKT).catch(e => ({ _err: e })),
    ]);
    const firstErr = [f, p, r].find(x => x._err);
    if (firstErr) throw firstErr._err;
    return {
      fulfillment: (f.fulfillmentPolicies || []).map(x => ({ id: x.fulfillmentPolicyId, name: x.name })),
      payment: (p.paymentPolicies || []).map(x => ({ id: x.paymentPolicyId, name: x.name })),
      return: (r.returnPolicies || []).map(x => ({ id: x.returnPolicyId, name: x.name })),
    };
  }
  app.post('/api/ebay/setup', requireAuth, wrap(async (req) => {
    const steps = [];
    try { await ebay('POST', '/sell/account/v1/program/opt_in', { programType: 'SELLING_POLICY_MANAGEMENT' }); steps.push('Business policies switched on'); }
    catch (e) { steps.push('Business policies: ' + (/already/i.test(e.message) ? 'already on' : e.message)); }
    let pol = await listPolicies();
    // On the practice site only, create simple default policies if none exist
    if (ENV === 'sandbox') {
      const cat = [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }];
      if (!pol.fulfillment.length) { await ebay('POST', '/sell/account/v1/fulfillment_policy', { name: 'Sylvias Standard Postage', marketplaceId: MKT, categoryTypes: cat, handlingTime: { value: 2, unit: 'DAY' }, shippingOptions: [{ optionType: 'DOMESTIC', costType: 'FLAT_RATE', shippingServices: [{ sortOrder: 1, shippingServiceCode: 'UK_RoyalMailSecondClassStandard', shippingCost: { value: '3.95', currency: 'GBP' } }] }] }); steps.push('Practice postage policy created'); }
      if (!pol.payment.length) { await ebay('POST', '/sell/account/v1/payment_policy', { name: 'Sylvias Payment', marketplaceId: MKT, categoryTypes: cat, immediatePay: true }); steps.push('Practice payment policy created'); }
      if (!pol.return.length) { await ebay('POST', '/sell/account/v1/return_policy', { name: 'Sylvias 30 Day Returns', marketplaceId: MKT, categoryTypes: cat, returnsAccepted: true, returnPeriod: { value: 30, unit: 'DAY' }, returnShippingCostPayer: 'BUYER' }); steps.push('Practice returns policy created'); }
      pol = await listPolicies();
    }
    // Shop location
    let locOk = false;
    try { await ebay('GET', '/sell/inventory/v1/location/' + LOCATION_KEY); locOk = true; steps.push('Shop location already set'); }
    catch (e) {
      if (e.status !== 404) throw e;
      await ebay('POST', '/sell/inventory/v1/location/' + LOCATION_KEY, { name: "Sylvia's Surprises", merchantLocationStatus: 'ENABLED', locationTypes: ['STORE'], location: { address: { addressLine1: 'Memorial Hall, Main Road', city: 'Union Mills', stateOrProvince: 'Isle of Man', postalCode: 'IM4 4AD', country: 'GB' } } });
      locOk = true; steps.push('Shop location added (Union Mills, IM4 4AD)');
    }
    const s = load();
    const prev = s.setup || {};
    const pick = (list, id) => (list.find(x => x.id === id) || list[0] || null);
    const chosen = (req.body && req.body.choose) || {};
    s.setup = {
      fulfillment: pick(pol.fulfillment, chosen.fulfillment || prev.fulfillment?.id),
      payment: pick(pol.payment, chosen.payment || prev.payment?.id),
      return: pick(pol.return, chosen.return || prev.return?.id),
      location: locOk ? LOCATION_KEY : null,
    };
    s.setup.ready = !!(s.setup.fulfillment && s.setup.payment && s.setup.return && s.setup.location);
    save(s);
    if (!s.setup.ready) steps.push('Missing: ' + ['fulfillment', 'payment', 'return'].filter(k => !s.setup[k]).map(k => k === 'fulfillment' ? 'postage policy' : k + ' policy').join(', ') + ' — create in eBay → Account settings → Business policies, then run setup again');
    return { steps, setup: s.setup, policies: pol };
  }));

  // ── category + item details helpers (app token) ──
  let treeId = null;
  async function tree() { if (!treeId) { const d = await ebay('GET', '/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=' + MKT, undefined, true); treeId = d.categoryTreeId; } return treeId; }
  app.get('/api/ebay/categories', requireAuth, wrap(async (req) => {
    const q = String(req.query.q || '').trim(); if (!q) return { suggestions: [] };
    const t = await tree();
    try {
      const d = await ebay('GET', `/commerce/taxonomy/v1/category_tree/${t}/get_category_suggestions?q=${encodeURIComponent(q)}`, undefined, true);
      return { suggestions: (d.categorySuggestions || []).slice(0, 10).map(c => ({ id: c.category.categoryId, name: c.category.categoryName, path: (c.categoryTreeNodeAncestors || []).map(a => a.categoryName).reverse().join(' › ') })) };
    } catch (e) { return { suggestions: [], note: 'eBay could not suggest categories here (' + e.message + '). You can type an eBay category number instead.' }; }
  }));
  const COND = { '1000': 'NEW', '1500': 'NEW_OTHER', '1750': 'NEW_WITH_DEFECTS', '2000': 'CERTIFIED_REFURBISHED', '2500': 'SELLER_REFURBISHED', '2750': 'LIKE_NEW', '3000': 'USED_EXCELLENT', '4000': 'USED_VERY_GOOD', '5000': 'USED_GOOD', '6000': 'USED_ACCEPTABLE', '7000': 'FOR_PARTS_OR_NOT_WORKING' };
  app.get('/api/ebay/category-details', requireAuth, wrap(async (req) => {
    const id = String(req.query.id || '').replace(/\D/g, ''); if (!id) throw new Error('No category');
    const t = await tree();
    let aspects = [], conditions = [], condRequired = false, notes = [];
    try {
      const d = await ebay('GET', `/commerce/taxonomy/v1/category_tree/${t}/get_item_aspects_for_category?category_id=${id}`, undefined, true);
      aspects = (d.aspects || []).filter(a => a.aspectConstraint && a.aspectConstraint.aspectRequired).map(a => ({ name: a.localizedAspectName, mode: a.aspectConstraint.aspectMode, values: (a.aspectValues || []).slice(0, 60).map(v => v.localizedValue) }));
    } catch (e) { notes.push('Item details: ' + e.message); }
    try {
      const d = await ebay('GET', `/sell/metadata/v1/marketplace/${MKT}/get_item_condition_policies?filter=categoryIds:%7B${id}%7D`, undefined, true);
      const pol = (d.itemConditionPolicies || [])[0];
      if (pol) { condRequired = !!pol.itemConditionRequired; conditions = (pol.itemConditions || []).map(c => ({ value: COND[c.conditionId], label: c.conditionDescription })).filter(c => c.value); }
    } catch (e) { notes.push('Conditions: ' + e.message); }
    return { aspects, conditions, condRequired, notes };
  }));

  // ── public photo for eBay to fetch ──
  app.get('/ebay-photo/:id.jpg', (req, res) => {
    const row = db.prepare('SELECT photo FROM sylvias_stock WHERE id = ?').get(Number(req.params.id));
    const photo = row && row.photo;
    if (!photo) return res.status(404).end();
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(photo);
    if (m) { res.set('Content-Type', m[1]); res.set('Cache-Control', 'public, max-age=3600'); return res.send(Buffer.from(m[2], 'base64')); }
    if (/^https?:\/\//.test(photo)) return res.redirect(photo);
    res.status(404).end();
  });
  app.get('/ebay-photo/:id/:pid.jpg', (req, res) => {
    const row = db.prepare('SELECT photo FROM sylvias_stock_photos WHERE id = ? AND stock_id = ?').get(Number(req.params.pid), Number(req.params.id));
    const photo = row && row.photo;
    if (!photo) return res.status(404).end();
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(photo);
    if (m) { res.set('Content-Type', m[1]); res.set('Cache-Control', 'public, max-age=3600'); return res.send(Buffer.from(m[2], 'base64')); }
    if (/^https?:\/\//.test(photo)) return res.redirect(photo);
    res.status(404).end();
  });
  function imageUrls(req, stock) {
    let rows = [];
    try { rows = db.prepare('SELECT id, photo FROM sylvias_stock_photos WHERE stock_id = ? ORDER BY is_main DESC, sort_order, id').all(stock.id); } catch (e) { rows = []; }
    if (!rows.length) { const one = photoUrl(req, stock.id, stock.photo); return one ? [one] : []; }
    const host = req.get('host');
    return rows.slice(0, 12).map(r => /^https:\/\//.test(r.photo) ? r.photo : 'https://' + host + '/ebay-photo/' + stock.id + '/' + r.id + '.jpg?v=' + crypto.createHash('md5').update(r.photo).digest('hex').slice(0, 8));
  }
  function photoUrl(req, stockId, photo) {
    if (!photo) return null;
    if (/^https:\/\//.test(photo)) return photo;
    const host = req.get('host');
    return 'https://' + host + '/ebay-photo/' + stockId + '.jpg?v=' + crypto.createHash('md5').update(photo).digest('hex').slice(0, 8);
  }

  // ── list an item ──
  app.post('/api/ebay/list', requireAuth, wrap(async (req) => {
    const b = req.body || {};
    const s = load();
    if (!s.setup || !s.setup.ready) throw new Error('Run “Set up seller account” first');
    const stock = db.prepare('SELECT * FROM sylvias_stock WHERE id = ?').get(Number(b.stock_id));
    if (!stock) throw new Error('Stock item not found');
    const qty = Math.floor(Number(b.qty)); const price = Number(b.price);
    if (!(qty >= 1)) throw new Error('Quantity must be at least 1');
    if (qty > stock.qty) throw new Error('Only ' + stock.qty + ' in stock');
    if (!(price > 0)) throw new Error('Enter a price');
    const title = String(b.title || '').trim().slice(0, 80); if (!title) throw new Error('Enter a title');
    const categoryId = String(b.category_id || '').replace(/\D/g, ''); if (!categoryId) throw new Error('Choose an eBay category');
    const description = String(b.description || title).trim();
    const sku = 'SS-' + stock.id;
    const imgs = imageUrls(req, stock);
    const aspects = {};
    for (const [k, v] of Object.entries(b.aspects || {})) { const val = String(v || '').trim(); if (val) aspects[k] = [val]; }
    const product = { title, description, aspects };
    if (imgs.length) product.imageUrls = imgs;
    const item = { availability: { shipToLocationAvailability: { quantity: qty } }, product };
    if (b.condition) item.condition = b.condition;
    await ebay('PUT', '/sell/inventory/v1/inventory_item/' + encodeURIComponent(sku), item);
    const postage = b.postage === '' || b.postage == null ? null : Number(b.postage);
    if (postage != null && !(postage >= 0)) throw new Error('Postage must be a number (0 for free postage)');
    const offer = { sku, marketplaceId: MKT, format: 'FIXED_PRICE', availableQuantity: qty, categoryId, listingDescription: description, merchantLocationKey: s.setup.location, pricingSummary: { price: { value: price.toFixed(2), currency: 'GBP' } }, listingPolicies: { fulfillmentPolicyId: s.setup.fulfillment.id, paymentPolicyId: s.setup.payment.id, returnPolicyId: s.setup.return.id } };
    if (postage != null) offer.listingPolicies.shippingCostOverrides = [{ priority: 1, shippingServiceType: 'DOMESTIC', shippingCost: { value: postage.toFixed(2), currency: 'GBP' } }];
    let offerId;
    const existing = await ebay('GET', '/sell/inventory/v1/offer?sku=' + encodeURIComponent(sku) + '&marketplace_id=' + MKT).catch(() => ({}));
    if (existing.offers && existing.offers[0]) { offerId = existing.offers[0].offerId; await ebay('PUT', '/sell/inventory/v1/offer/' + offerId, offer); }
    else { const d = await ebay('POST', '/sell/inventory/v1/offer', offer); offerId = d.offerId; }
    let listingId = '';
    try { const d = await ebay('POST', '/sell/inventory/v1/offer/' + offerId + '/publish'); listingId = d.listingId || ''; }
    catch (e) {
      db.prepare(`INSERT INTO sylvias_ebay_listings (stock_id, sku, offer_id, title, price, qty, category_id, condition, status, note, listed_by) VALUES (?,?,?,?,?,?,?,?,'error',?,?) ON CONFLICT(sku) DO UPDATE SET offer_id=excluded.offer_id, title=excluded.title, price=excluded.price, qty=excluded.qty, category_id=excluded.category_id, condition=excluded.condition, status='error', note=excluded.note, updated_at=datetime('now')`).run(stock.id, sku, offerId, title, price, qty, categoryId, b.condition || '', e.message.slice(0, 500), req.session.user?.initials || '');
      throw new Error('eBay would not publish it: ' + e.message);
    }
    db.prepare(`INSERT INTO sylvias_ebay_listings (stock_id, sku, offer_id, listing_id, title, price, qty, category_id, condition, status, note, listed_by, postage) VALUES (?,?,?,?,?,?,?,?,?,'listed','',?,?) ON CONFLICT(sku) DO UPDATE SET offer_id=excluded.offer_id, listing_id=excluded.listing_id, title=excluded.title, price=excluded.price, qty=excluded.qty, category_id=excluded.category_id, condition=excluded.condition, status='listed', note='', postage=excluded.postage, updated_at=datetime('now')`).run(stock.id, sku, offerId, listingId, title, price, qty, categoryId, b.condition || '', req.session.user?.initials || '', postage);
    return { ok: true, listingId, url: listingId ? VIEW + listingId : null, photo: imgs.length > 0, photos: imgs.length };
  }));

  // ── end a listing ──
  async function endListing(row, note) {
    try { await ebay('POST', '/sell/inventory/v1/offer/' + row.offer_id + '/withdraw'); }
    catch (e) { if (!/not.*published|already|ended/i.test(e.message)) throw e; }
    db.prepare(`UPDATE sylvias_ebay_listings SET status='ended', note=?, updated_at=datetime('now') WHERE id=?`).run(note, row.id);
  }
  app.post('/api/ebay/end', requireAuth, wrap(async (req) => {
    const row = db.prepare('SELECT * FROM sylvias_ebay_listings WHERE id = ?').get(Number(req.body?.id));
    if (!row) throw new Error('Listing not found');
    await endListing(row, 'Ended by ' + (req.session.user?.initials || 'staff'));
    return { ok: true };
  }));
  app.post('/api/ebay/remove-record', requireAuth, wrap(async (req) => {
    db.prepare(`DELETE FROM sylvias_ebay_listings WHERE id = ? AND status IN ('error','ended','sold')`).run(Number(req.body?.id));
    return { ok: true };
  }));

  app.get('/api/ebay/listings', requireAuth, wrap(async () => {
    const rows = db.prepare(`SELECT l.*, s.part_number, s.description AS stock_description, s.qty AS stock_qty FROM sylvias_ebay_listings l LEFT JOIN sylvias_stock s ON s.id = l.stock_id ORDER BY CASE l.status WHEN 'listed' THEN 0 WHEN 'error' THEN 1 ELSE 2 END, l.updated_at DESC LIMIT 300`).all();
    const orders = db.prepare(`SELECT o.*, sa.invoice_number FROM sylvias_ebay_orders o LEFT JOIN sylvias_sales sa ON sa.id = o.sale_id WHERE o.sale_id IS NOT NULL ORDER BY CASE o.status WHEN 'to_post' THEN 0 ELSE 1 END, o.created_at DESC LIMIT 50`).all();
    const alert = db.prepare(`SELECT value FROM sylvias_settings WHERE key = 'ebay_alert_webhook'`).get();
    return { listings: rows.map(r => ({ ...r, url: r.listing_id ? VIEW + r.listing_id : null })), orders, alertSet: !!(alert && alert.value) };
  }));

  // ── sync: eBay sales → Sylvia's, and shop sales → end eBay listings ──
  function nextInvoice() {
    const now = new Date();
    const prefix = 'SS-' + String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + '-';
    const row = db.prepare(`SELECT invoice_number FROM sylvias_sales WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`).get(prefix + '%');
    let n = 1; if (row) { const v = parseInt(String(row.invoice_number).replace(prefix, ''), 10); if (!isNaN(v)) n = v + 1; }
    return prefix + String(n).padStart(4, '0');
  }
  const recordOrder = db.transaction((order) => {
    const lines = (order.lineItems || []).map(li => {
      const listing = db.prepare('SELECT * FROM sylvias_ebay_listings WHERE sku = ?').get(li.sku || '');
      const stock = listing ? db.prepare('SELECT * FROM sylvias_stock WHERE id = ?').get(listing.stock_id) : null;
      const q = Number(li.quantity || 1);
      const lineTotal = Number(li.lineItemCost?.value || li.total?.value || 0);
      return { li, listing, stock, q, lineTotal, unit: q ? lineTotal / q : lineTotal };
    }).filter(x => x.listing);
    if (!lines.length) return null; // not one of ours
    const total = Math.round(lines.reduce((a, x) => a + x.lineTotal, 0) * 100) / 100;
    const postage = Number(order.pricingSummary?.deliveryCost?.value || 0);
    const buyer = order.buyer?.username || 'eBay buyer';
    const shipTo = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.fullName || '';
    const custName = 'eBay: ' + (shipTo || buyer);
    const inv = nextInvoice();
    const saleDate = String(order.creationDate || new Date().toISOString()).replace('T', ' ').slice(0, 19);
    const notes = 'eBay order ' + order.orderId + ' (buyer ' + buyer + ')' + (postage ? ' — postage paid by buyer £' + postage.toFixed(2) + ' not included' : '');
    const info = db.prepare(`INSERT INTO sylvias_sales (customer_name, customer_id, payment_method, total, sold_by, invoice_number, notes, amount_paid, balance_due, status, sale_type, due_date, sale_date, discount) VALUES (?, NULL, 'ebay', ?, 'eBay', ?, ?, ?, 0, 'paid', 'receipt', '', ?, 0)`).run(custName, total, inv, notes, total, saleDate);
    const saleId = Number(info.lastInsertRowid);
    for (const x of lines) {
      db.prepare(`INSERT INTO sylvias_sale_items (sale_id, stock_id, part_number, description, qty, unit_price, line_total) VALUES (?,?,?,?,?,?,?)`).run(saleId, x.listing.stock_id, x.stock?.part_number || '', x.stock?.description || x.li.title || '', x.q, x.unit, x.lineTotal);
      if (x.stock) db.prepare('UPDATE sylvias_stock SET qty = MAX(0, qty - ?) WHERE id = ?').run(x.q, x.stock.id);
      const left = Math.max(0, (x.listing.qty || 1) - x.q);
      db.prepare(`UPDATE sylvias_ebay_listings SET qty = ?, status = CASE WHEN ? <= 0 THEN 'sold' ELSE status END, note = ?, updated_at = datetime('now') WHERE id = ?`).run(left, left, 'Sold on eBay — ' + inv, x.listing.id);
    }
    db.prepare(`INSERT INTO sylvias_payments (sale_id, payment_date, amount, payment_method, notes, entered_by) VALUES (?, ?, ?, 'ebay', ?, 'eBay')`).run(saleId, saleDate.slice(0, 10), total, 'eBay order ' + order.orderId);
    const st = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo || {};
    const a = st.contactAddress || {};
    const addr = [a.addressLine1, a.addressLine2, a.city, a.stateOrProvince, a.postalCode, a.countryCode && a.countryCode !== 'GB' ? a.countryCode : ''].map(x => String(x || '').trim()).filter(Boolean).join('\n');
    const phone = st.primaryPhone?.phoneNumber || '';
    const li = lines.map(x => ({ lineItemId: x.li.lineItemId, quantity: x.q, title: x.stock?.description || x.li.title || '', part_number: x.stock?.part_number || '', unit: x.unit, total: x.lineTotal }));
    db.prepare(`INSERT INTO sylvias_ebay_orders (order_id, sale_id, buyer, total, postage, note, ship_name, ship_address, ship_phone, buyer_username, line_items, status) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'to_post')`).run(order.orderId, saleId, custName, total, postage, inv, st.fullName || '', addr, phone, buyer, JSON.stringify(li));
    return { invoice: inv, total, postage, buyer: st.fullName || buyer, address: addr, items: li.map(x => (x.part_number ? x.part_number + ' ' : '') + x.title + (x.quantity > 1 ? ' ×' + x.quantity : '')) };
  });

  let syncing = false;
  async function sync() {
    if (syncing) return { skipped: true };
    syncing = true;
    const result = { at: new Date().toISOString(), newSales: [], ended: [], qtyUpdated: 0, errors: [] };
    try {
      const s = load(); if (!s.refresh_token) throw new Error('Not connected');
      // 1. New paid eBay orders (last 30 days)
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const d = await ebay('GET', '/sell/fulfillment/v1/order?limit=100&filter=' + encodeURIComponent('creationdate:[' + since + '..]'));
      for (const order of d.orders || []) {
        if (db.prepare('SELECT 1 FROM sylvias_ebay_orders WHERE order_id = ?').get(order.orderId)) continue;
        if (order.orderPaymentStatus !== 'PAID' || order.cancelStatus?.cancelState === 'CANCELED') continue;
        try { const r = recordOrder(order); if (r) result.newSales.push(r); else db.prepare(`INSERT OR IGNORE INTO sylvias_ebay_orders (order_id, note) VALUES (?, 'not a Sylvias listing')`).run(order.orderId); }
        catch (e) { result.errors.push('Order ' + order.orderId + ': ' + e.message); }
      }
      // 2. Items sold in the shop → end or reduce eBay listing
      await checkShopSales(result);
    } catch (e) { result.errors.push(e.message); }
    finally {
      syncing = false;
      const s = load(); s.last_sync = result; save(s);
    }
    if (result.newSales.length) notifySales(result.newSales).catch(e => console.error('eBay alert:', e.message));
    return result;
  }

  async function checkShopSales(result) {
      const live = db.prepare(`SELECT l.*, s.qty AS stock_qty FROM sylvias_ebay_listings l LEFT JOIN sylvias_stock s ON s.id = l.stock_id WHERE l.status = 'listed'`).all();
      for (const row of live) {
        try {
          const have = row.stock_qty == null ? 0 : row.stock_qty;
          if (have <= 0) { await endListing(row, row.stock_qty == null ? 'Stock item deleted — eBay listing ended' : 'Sold in shop — eBay listing ended'); result.ended.push(row.title); }
          else if (have < row.qty) {
            await ebay('POST', '/sell/inventory/v1/bulk_update_price_quantity', { requests: [{ sku: row.sku, shipToLocationAvailability: { quantity: have }, offers: [{ offerId: row.offer_id, availableQuantity: have }] }] });
            db.prepare(`UPDATE sylvias_ebay_listings SET qty = ?, note = 'Quantity reduced to match shop stock', updated_at = datetime('now') WHERE id = ?`).run(have, row.id);
            result.qtyUpdated++;
          }
        } catch (e) { result.errors.push(row.title + ': ' + e.message); }
      }
  }

  // ── alert (email via Tasklet webhook link saved in Admin → eBay) ──
  async function notifySales(sales) {
    const row = db.prepare(`SELECT value FROM sylvias_settings WHERE key = 'ebay_alert_webhook'`).get();
    const url = row && String(row.value || '').trim();
    if (!url || !/^https:\/\//.test(url)) return;
    const testMode = process.env.TEST_MODE === 'true';
    for (const x of sales) {
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'ebay_sale', site: testMode ? 'TEST site' : 'LIVE shop', ebay: ENV, invoice: x.invoice, total: x.total, postage: x.postage || 0, buyer: x.buyer, address: x.address, items: x.items }) }).catch(e => console.error('eBay alert send:', e.message));
    }
  }

  // ── shop sale → end eBay listing straight away (called when stock changes) ──
  let shopTimer = null, shopBusy = false;
  function stockChanged() {
    if (!configured() || !load().refresh_token) return;
    clearTimeout(shopTimer);
    shopTimer = setTimeout(async () => {
      if (shopBusy || syncing) return;
      if (!db.prepare(`SELECT 1 FROM sylvias_ebay_listings l LEFT JOIN sylvias_stock s ON s.id = l.stock_id WHERE l.status = 'listed' AND (s.id IS NULL OR s.qty < l.qty) LIMIT 1`).get()) return;
      shopBusy = true;
      const r = { ended: [], qtyUpdated: 0, errors: [] };
      try { await checkShopSales(r); } catch (e) { console.error('eBay end-on-sale:', e.message); }
      finally { shopBusy = false; }
      if (r.ended.length || r.qtyUpdated) console.log('eBay: ended ' + r.ended.length + ' listing(s) after shop sale');
    }, 2000);
  }

  // ── orders: packing slip details + mark as posted ──
  app.get('/api/ebay/order/:id', requireAuth, wrap(async (req) => {
    const o = db.prepare(`SELECT o.*, sa.invoice_number, sa.sale_date FROM sylvias_ebay_orders o LEFT JOIN sylvias_sales sa ON sa.id = o.sale_id WHERE o.order_id = ?`).get(String(req.params.id));
    if (!o) throw new Error('Order not found');
    let items = []; try { items = JSON.parse(o.line_items || '[]'); } catch {}
    if (!items.length && o.sale_id) items = db.prepare('SELECT part_number, description AS title, qty AS quantity, unit_price AS unit, line_total AS total FROM sylvias_sale_items WHERE sale_id = ?').all(o.sale_id);
    return { ...o, items };
  }));
  const CARRIERS = { 'Isle of Man Post': '', 'Royal Mail': 'ROYAL_MAIL', 'Parcelforce': 'PARCELFORCE', 'DPD': 'DPD', 'Evri': 'HERMES', 'Other': 'OTHER' };
  app.post('/api/ebay/mark-posted', requireAuth, wrap(async (req) => {
    const b = req.body || {};
    const o = db.prepare('SELECT * FROM sylvias_ebay_orders WHERE order_id = ?').get(String(b.order_id || ''));
    if (!o) throw new Error('Order not found');
    const carrier = String(b.carrier || 'Isle of Man Post');
    const tracking = String(b.tracking || '').replace(/\s+/g, '').toUpperCase();
    let items = []; try { items = JSON.parse(o.line_items || '[]'); } catch {}
    const body = { lineItems: items.filter(x => x.lineItemId).map(x => ({ lineItemId: x.lineItemId, quantity: x.quantity || 1 })), shippedDate: new Date().toISOString() };
    if (tracking) { body.trackingNumber = tracking; body.shippingCarrierCode = CARRIERS[carrier] || 'OTHER'; if (!body.shippingCarrierCode) body.shippingCarrierCode = 'OTHER'; }
    let note = '';
    if (body.lineItems.length) {
      try { await ebay('POST', '/sell/fulfillment/v1/order/' + encodeURIComponent(o.order_id) + '/shipping_fulfillment', body); note = 'eBay told — buyer notified'; }
      catch (e) {
        if (!tracking) throw new Error('eBay would not mark it posted: ' + e.message);
        // retry without tracking if eBay doesn't recognise the carrier
        delete body.trackingNumber; delete body.shippingCarrierCode;
        await ebay('POST', '/sell/fulfillment/v1/order/' + encodeURIComponent(o.order_id) + '/shipping_fulfillment', body);
        note = 'Marked posted on eBay without tracking (eBay did not accept the tracking number: ' + e.message + ')';
      }
    } else note = 'Older order — mark it posted in eBay too';
    db.prepare(`UPDATE sylvias_ebay_orders SET status = 'posted', carrier = ?, tracking = ?, posted_at = datetime('now'), posted_by = ? WHERE order_id = ?`).run(carrier, tracking, req.session.user?.initials || '', o.order_id);
    return { ok: true, note };
  }));
  app.post('/api/ebay/alert-link', requireAuth, wrap(async (req) => {
    const url = String(req.body?.url || '').trim();
    if (url && !/^https:\/\/webhooks\.tasklet\.ai\//.test(url)) throw new Error('That doesn’t look like the alert link — it should start https://webhooks.tasklet.ai/');
    db.prepare(`INSERT OR REPLACE INTO sylvias_settings (key, value) VALUES ('ebay_alert_webhook', ?)`).run(url);
    return { ok: true, set: !!url };
  }));
  app.post('/api/ebay/alert-test', requireAuth, wrap(async () => {
    const row = db.prepare(`SELECT value FROM sylvias_settings WHERE key = 'ebay_alert_webhook'`).get();
    if (!row || !row.value) throw new Error('No alert link saved');
    const r = await fetch(row.value, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'ebay_sale', test: true, site: process.env.TEST_MODE === 'true' ? 'TEST site' : 'LIVE shop', ebay: ENV, invoice: 'TEST', total: 0, postage: 0, buyer: 'Test alert', address: '', items: ['This is a test — no sale has happened'] }) });
    if (!r.ok) throw new Error('The alert link was rejected (' + r.status + ') — check it was copied in full');
    return { ok: true };
  }));
  app.post('/api/ebay/sync', requireAuth, wrap(async () => sync()));
  setInterval(() => { if (configured() && load().refresh_token) sync().catch(e => console.error('eBay sync:', e.message)); }, 10 * 60 * 1000);
  return { stockChanged };
};
