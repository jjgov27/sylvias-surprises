const express = require('express');
const session = require('express-session');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'sylvias-dev-secret-change-me';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sylvias.db');
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');
const TEST_MODE = process.env.TEST_MODE === 'true' || process.env.NODE_ENV !== 'production';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync('/tmp/sylvias-pdfs', { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24*60*60*1000 }
}));

app.use('/uploads', express.static(UPLOADS_DIR));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// Auth
app.post('/api/auth/login', (req, res) => {
  const { name, initials } = req.body;
  if (!name || !initials) return res.status(400).json({ error: 'Name and initials required' });
  req.session.user = { name, initials };
  res.json({ ok: true, user: req.session.user });
});
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get('/api/auth/check', (req, res) => {
  res.json(req.session?.user ? { authenticated: true, user: req.session.user } : { authenticated: false });
});

// SQL Query (SELECT)
app.post('/api/sql/query', requireAuth, (req, res) => {
  try {
    const { sql } = req.body;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    console.error('SQL query error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// SQL Exec (INSERT/UPDATE/DELETE/CREATE/ALTER)
app.post('/api/sql/exec', requireAuth, (req, res) => {
  try {
    const { sql } = req.body;
    // Try as prepared statement first
    try {
      const info = db.prepare(sql).run();
      return res.json({ rowsAffected: info.changes, lastInsertRowid: Number(info.lastInsertRowid) });
    } catch (prepErr) {
      // If prepare fails (e.g. CREATE TABLE), use exec
      db.exec(sql);
      return res.json({ rowsAffected: 0 });
    }
  } catch (err) {
    if (err.message.includes('duplicate column')) return res.json({ rowsAffected: 0 });
    console.error('SQL exec error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Batch SQL (for init - multiple statements)
app.post('/api/sql/batch', requireAuth, (req, res) => {
  try {
    const { statements } = req.body;
    const results = [];
    for (const sql of statements) {
      try {
        db.exec(sql);
        results.push({ ok: true });
      } catch (err) {
        results.push({ ok: !err.message.includes('duplicate column') ? false : true, error: err.message });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shell commands (PDF generation)
app.post('/api/command', requireAuth, (req, res) => {
  try {
    const { command, timeout } = req.body;
    const result = execSync(command, {
      timeout: (timeout || 120) * 1000,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      cwd: '/tmp'
    });
    res.json({ log: result || '' });
  } catch (err) {
    if (err.stdout) return res.json({ log: err.stdout });
    res.status(500).json({ error: err.message, log: err.stderr || '' });
  }
});

// File write (only /tmp/)
app.post('/api/files/write', requireAuth, (req, res) => {
  try {
    const { path: fp, content } = req.body;
    if (!fp.startsWith('/tmp/')) return res.status(403).json({ error: 'Can only write to /tmp/' });
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, content, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File read
app.post('/api/files/read', requireAuth, (req, res) => {
  try {
    const content = fs.readFileSync(req.body.path, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File read binary (base64)
app.post('/api/files/read-binary', requireAuth, (req, res) => {
  try {
    const data = fs.readFileSync(req.body.path);
    res.json({ data: data.toString('base64') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Photo upload
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(file.originalname))
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// Test mode reset
app.post('/api/admin/reset', requireAuth, (req, res) => {
  if (!TEST_MODE) return res.status(403).json({ error: 'Not available' });
  const tables = ['sylvias_stock','sylvias_sales','sylvias_sale_items','sylvias_customers','sylvias_expenses','sylvias_payments','sylvias_refunds','sylvias_credit_notes','sylvias_gift_vouchers','sylvias_consignment_items','sylvias_consignees','sylvias_reservations','sylvias_wishlist','sylvias_bullion','sylvias_bank_transactions','sylvias_eod_cashup','sylvias_scan_staging','sylvias_supplier_invoices','sylvias_supplier_invoice_payments','sylvias_suppliers','sylvias_float','sylvias_learned_items'];
  for (const t of tables) { try { db.exec('DELETE FROM ' + t); } catch(e) {} }
  res.json({ ok: true, tablesCleared: tables.length });
});

// Serve React app
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log('Sylvias Surprises running on port ' + PORT);
  console.log('Test mode: ' + TEST_MODE);
});

// ── Graceful shutdown ──
function shutdown(signal) {
  console.log(`${signal} received — closing DB and shutting down`);
  try { db.close(); } catch(e) {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); });
process.on('unhandledRejection', (err) => { console.error('Unhandled rejection:', err); });
