// ── HP ePrint: email each new eBay sale's invoice + packing slip to the shop printer ──
// Sender account comes from Railway env vars only: SMTP_USER, SMTP_PASS (Gmail app password).
// Printer address is a per-site setting (sylvias_settings key 'eprint_email'), so test and live can differ.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
let nodemailer = null; try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }

module.exports = function setupEprint(app, db, requireAuth) {
  db.exec(`CREATE TABLE IF NOT EXISTS sylvias_eprint_log (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL DEFAULT '', invoice TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  const getSet = (k) => { const r = db.prepare('SELECT value FROM sylvias_settings WHERE key = ?').get(k); return r ? String(r.value || '') : ''; };
  const setSet = (k, v) => db.prepare('INSERT OR REPLACE INTO sylvias_settings (key, value) VALUES (?, ?)').run(k, String(v));
  const senderReady = () => !!(nodemailer && process.env.SMTP_USER && process.env.SMTP_PASS);
  const printer = () => getSet('eprint_email').trim().toLowerCase();
  const autoOn = () => getSet('eprint_auto') !== '0';

  function transport() {
    return nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: String(process.env.SMTP_PASS).replace(/\s+/g, '') } });
  }
  function buildPdf(data) {
    return new Promise((resolve, reject) => {
      const out = path.join(os.tmpdir(), 'order-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.pdf');
      const p = execFile('python3', [path.join(__dirname, 'order_pdf.py'), out], { timeout: 30000 }, (err, _so, se) => {
        if (err) return reject(new Error('PDF failed: ' + (se || err.message).slice(0, 300)));
        try { const buf = fs.readFileSync(out); fs.unlinkSync(out); resolve(buf); } catch (e) { reject(e); }
      });
      p.stdin.end(JSON.stringify(data));
    });
  }
  function orderData(orderId) {
    const o = db.prepare(`SELECT o.*, sa.invoice_number, sa.sale_date FROM sylvias_ebay_orders o LEFT JOIN sylvias_sales sa ON sa.id = o.sale_id WHERE o.order_id = ?`).get(String(orderId));
    if (!o) throw new Error('Order not found');
    let items = []; try { items = JSON.parse(o.line_items || '[]'); } catch {}
    if (!items.length && o.sale_id) items = db.prepare('SELECT part_number, description AS title, qty AS quantity, unit_price AS unit, line_total AS total FROM sylvias_sale_items WHERE sale_id = ?').all(o.sale_id);
    const date = String(o.sale_date || o.created_at || '').slice(0, 10).split('-').reverse().join('/');
    return { order_id: o.order_id, invoice_number: o.invoice_number || o.note || '', date, ship_name: o.ship_name || o.buyer, ship_address: o.ship_address || '', ship_phone: o.ship_phone || '', buyer_username: o.buyer_username || '', total: o.total, postage: o.postage, items };
  }
  async function send(to, subject, pdf, filename) {
    await transport().sendMail({ from: '"Sylvia\'s Surprises" <' + process.env.SMTP_USER + '>', to, subject, text: subject, attachments: [{ filename, content: pdf, contentType: 'application/pdf' }] });
  }
  function log(orderId, invoice, status, note) { db.prepare('INSERT INTO sylvias_eprint_log (order_id, invoice, status, note) VALUES (?,?,?,?)').run(orderId || '', invoice || '', status, String(note || '').slice(0, 500)); }

  async function printOrder(orderId) {
    const to = printer();
    if (!to) throw new Error('No printer email address saved');
    if (!senderReady()) throw new Error('The sending email account is not set up on this site yet');
    const d = orderData(orderId);
    try {
      const pdf = await buildPdf(d);
      await send(to, 'Invoice ' + d.invoice_number, pdf, 'Invoice-' + String(d.invoice_number).replace(/[^\w-]/g, '') + '.pdf');
      log(orderId, d.invoice_number, 'sent', 'Sent to ' + to);
      return { ok: true, invoice: d.invoice_number, to };
    } catch (e) { log(orderId, d.invoice_number, 'failed', e.message); throw e; }
  }
  // called by eBay sync for each new sale
  async function autoPrint(orderIds) {
    if (!autoOn() || !printer() || !senderReady()) return;
    for (const id of orderIds) { try { await printOrder(id); } catch (e) { console.error('ePrint:', e.message); } }
  }

  app.get('/api/eprint/settings', requireAuth, (req, res) => {
    const recent = db.prepare('SELECT order_id, invoice, status, note, created_at FROM sylvias_eprint_log ORDER BY id DESC LIMIT 8').all();
    res.json({ printer: printer(), auto: autoOn(), senderReady: senderReady(), sender: process.env.SMTP_USER || '', recent });
  });
  app.post('/api/eprint/settings', requireAuth, (req, res) => {
    const email = String(req.body?.printer || '').trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'That doesn’t look like an email address' });
    setSet('eprint_email', email);
    if (req.body && 'auto' in req.body) setSet('eprint_auto', req.body.auto ? '1' : '0');
    res.json({ ok: true, printer: printer(), auto: autoOn() });
  });
  app.post('/api/eprint/test', requireAuth, async (req, res) => {
    try {
      const to = printer(); if (!to) throw new Error('Save the printer email address first');
      if (!senderReady()) throw new Error('The sending email account is not set up on this site yet');
      const sample = { order_id: 'TEST-PRINT', invoice_number: 'TEST', date: new Date().toISOString().slice(0, 10).split('-').reverse().join('/'), ship_name: 'Test Print – Not A Real Order', ship_address: 'Memorial Hall\nMain Road\nUnion Mills\nIM4 4AD', ship_phone: '', buyer_username: 'test', total: 0, postage: 0, items: [{ part_number: 'TEST', title: 'This is a test print – no sale has happened', quantity: 1, unit: 0, total: 0 }] };
      const pdf = await buildPdf(sample);
      await send(to, 'Test print', pdf, 'Test-print.pdf');
      log('', 'TEST', 'sent', 'Test page sent to ' + to);
      res.json({ ok: true, to });
    } catch (e) { log('', 'TEST', 'failed', e.message); res.status(400).json({ error: friendly(e) }); }
  });
  app.post('/api/eprint/order', requireAuth, async (req, res) => {
    try { res.json(await printOrder(String(req.body?.order_id || ''))); }
    catch (e) { res.status(400).json({ error: friendly(e) }); }
  });
  function friendly(e) {
    const m = String(e.message || e);
    if (/Invalid login|535|Username and Password not accepted/i.test(m)) return 'Gmail refused the sign-in — the app password may be wrong or deleted. Make a new one and paste it into Railway (SMTP_PASS).';
    return m;
  }
  return { autoPrint };
};
