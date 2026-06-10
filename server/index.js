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

// ── Initialize database tables on server startup ──
const INIT_TABLES = [
  "CREATE TABLE IF NOT EXISTS sylvias_staff (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, initials TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, part_number TEXT NOT NULL, description TEXT NOT NULL, photo TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL DEFAULT 0, location TEXT NOT NULL DEFAULT '', cost REAL NOT NULL DEFAULT 0, rrp REAL NOT NULL DEFAULT 0, entered_by TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Other', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_item_names (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)",
  "CREATE TABLE IF NOT EXISTS sylvias_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_date TEXT NOT NULL DEFAULT (datetime('now')), customer_name TEXT NOT NULL DEFAULT 'Walk-in', payment_method TEXT NOT NULL DEFAULT 'cash', total REAL NOT NULL DEFAULT 0, sold_by TEXT NOT NULL DEFAULT '', invoice_number TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, stock_id INTEGER NOT NULL, part_number TEXT NOT NULL, description TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS sylvias_customers (id INTEGER PRIMARY KEY AUTOINCREMENT, salutation TEXT NOT NULL DEFAULT '', first_name TEXT NOT NULL DEFAULT '', surname TEXT NOT NULL DEFAULT '', address_line1 TEXT NOT NULL DEFAULT '', address_line2 TEXT NOT NULL DEFAULT '', address_line3 TEXT NOT NULL DEFAULT '', postcode TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, expense_date TEXT NOT NULL DEFAULT (date('now')), category TEXT NOT NULL DEFAULT 'General', description TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0, receipt_photo TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_float (id INTEGER PRIMARY KEY AUTOINCREMENT, float_date TEXT NOT NULL DEFAULT (date('now')), opening_amount REAL NOT NULL DEFAULT 0, closing_amount REAL NOT NULL DEFAULT 0, cash_in REAL NOT NULL DEFAULT 0, cash_out REAL NOT NULL DEFAULT 0, difference REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_consigners (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', commission_pct REAL NOT NULL DEFAULT 20, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_consignment_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, consigner_id INTEGER NOT NULL, consigner_name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, selling_price REAL NOT NULL DEFAULT 0, commission_pct REAL NOT NULL DEFAULT 20, status TEXT NOT NULL DEFAULT 'available', date_received TEXT NOT NULL DEFAULT (date('now')), notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), qty_sold INTEGER NOT NULL DEFAULT 0, qty_remaining INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE IF NOT EXISTS sylvias_reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, stock_id INTEGER NOT NULL, stock_description TEXT NOT NULL DEFAULT '', stock_part_number TEXT NOT NULL DEFAULT '', customer_id INTEGER, customer_name TEXT NOT NULL DEFAULT '', deposit REAL NOT NULL DEFAULT 0, total_price REAL NOT NULL DEFAULT 0, reserve_date TEXT NOT NULL DEFAULT (date('now')), expiry_date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '', reserved_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_wishlist (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, customer_name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'Other', contact_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_bullion (id INTEGER PRIMARY KEY AUTOINCREMENT, metal_type TEXT NOT NULL DEFAULT 'Gold', form TEXT NOT NULL DEFAULT 'Coin', description TEXT NOT NULL DEFAULT '', weight REAL NOT NULL DEFAULT 0, weight_unit TEXT NOT NULL DEFAULT 'oz', purity TEXT NOT NULL DEFAULT '999', purchase_date TEXT NOT NULL DEFAULT (date('now')), purchase_price REAL NOT NULL DEFAULT 0, premium_paid REAL NOT NULL DEFAULT 0, dealer_name TEXT NOT NULL DEFAULT '', sell_date TEXT NOT NULL DEFAULT '', sale_price REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'held', notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')",
  "CREATE TABLE IF NOT EXISTS sylvias_bank_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, account_name TEXT NOT NULL DEFAULT '', bank_name TEXT NOT NULL DEFAULT '', sort_code TEXT NOT NULL DEFAULT '', account_number TEXT NOT NULL DEFAULT '', opening_balance REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, payment_date TEXT NOT NULL DEFAULT (date('now')), amount REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT 'cash', notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_refunds (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, invoice_number TEXT NOT NULL DEFAULT '', refund_date TEXT NOT NULL DEFAULT (date('now')), amount REAL NOT NULL DEFAULT 0, refund_method TEXT NOT NULL DEFAULT 'cash', reason TEXT NOT NULL DEFAULT '', items_restocked INTEGER NOT NULL DEFAULT 0, entered_by TEXT NOT NULL DEFAULT '', credit_note_number TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_credit_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, customer_name TEXT NOT NULL DEFAULT '', credit_note_number TEXT NOT NULL DEFAULT '', date_issued TEXT NOT NULL DEFAULT (date('now')), original_invoice TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0, amount_used REAL NOT NULL DEFAULT 0, balance REAL NOT NULL DEFAULT 0, reason TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_bank_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, bank_account_id INTEGER NOT NULL, transaction_date TEXT NOT NULL DEFAULT (date('now')), description TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0, reference TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'other', linked_sale_id INTEGER, linked_expense_id INTEGER, reconciled INTEGER NOT NULL DEFAULT 0, entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', event_date TEXT NOT NULL DEFAULT (date('now')), end_date TEXT NOT NULL DEFAULT '', pitch_cost REAL NOT NULL DEFAULT 0, travel_cost REAL NOT NULL DEFAULT 0, other_costs REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_event_items (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, stock_id INTEGER NOT NULL, description TEXT NOT NULL DEFAULT '', part_number TEXT NOT NULL DEFAULT '', qty_taken INTEGER NOT NULL DEFAULT 1, qty_sold INTEGER NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0, cost_price REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_number TEXT NOT NULL DEFAULT '', customer_id INTEGER, customer_name TEXT NOT NULL DEFAULT '', quote_date TEXT NOT NULL DEFAULT (date('now')), expiry_date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_quote_items (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id INTEGER NOT NULL, stock_id INTEGER NOT NULL, description TEXT NOT NULL DEFAULT '', part_number TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_gift_vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT, voucher_number TEXT NOT NULL UNIQUE, amount REAL NOT NULL DEFAULT 0, amount_used REAL NOT NULL DEFAULT 0, balance REAL NOT NULL DEFAULT 0, purchaser_name TEXT NOT NULL DEFAULT '', purchaser_customer_id INTEGER DEFAULT NULL, recipient_name TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT '', date_issued TEXT NOT NULL DEFAULT '', date_expires TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_supplier_invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_ref TEXT NOT NULL DEFAULT '', supplier_id INTEGER DEFAULT NULL, supplier_name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', total_amount REAL NOT NULL DEFAULT 0, amount_paid REAL NOT NULL DEFAULT 0, balance_due REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'unpaid', invoice_date TEXT NOT NULL DEFAULT (date('now')), due_date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_supplier_invoice_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_invoice_id INTEGER NOT NULL, payment_date TEXT NOT NULL DEFAULT (date('now')), amount REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_scan_staging (id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL DEFAULT '', part_number TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL DEFAULT 1, condition TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', cost REAL NOT NULL DEFAULT 0, rrp REAL NOT NULL DEFAULT 0, offer_price REAL NOT NULL DEFAULT 0, acquisition_type TEXT NOT NULL DEFAULT 'existing', supplier_name TEXT NOT NULL DEFAULT '', source_type TEXT NOT NULL DEFAULT '', purchase_date TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT '', purchased_by TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', scan_type TEXT NOT NULL DEFAULT 'single', scanned_by TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', scanned_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_stock_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, check_number TEXT NOT NULL DEFAULT '', check_type TEXT NOT NULL DEFAULT 'spot', location_filter TEXT NOT NULL DEFAULT '', started_by TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending_check', total_items INTEGER NOT NULL DEFAULT 0, found_count INTEGER NOT NULL DEFAULT 0, missing_count INTEGER NOT NULL DEFAULT 0, signed_by TEXT NOT NULL DEFAULT '', signed_at TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '')",
  "CREATE TABLE IF NOT EXISTS sylvias_stock_check_items (id INTEGER PRIMARY KEY AUTOINCREMENT, check_id INTEGER NOT NULL, stock_id INTEGER NOT NULL, part_number TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', expected_qty INTEGER NOT NULL DEFAULT 0, checked INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '')",
];

const ALTER_SQLS = [
  "ALTER TABLE sylvias_sales ADD COLUMN customer_id INTEGER DEFAULT NULL",
  "ALTER TABLE sylvias_stock ADD COLUMN on_offer INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE sylvias_stock ADD COLUMN offer_price REAL NOT NULL DEFAULT 0",
  "ALTER TABLE sylvias_stock ADD COLUMN supplier_id INTEGER DEFAULT NULL",
  "ALTER TABLE sylvias_stock ADD COLUMN source_type TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_sale_items ADD COLUMN is_consignment INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE sylvias_sale_items ADD COLUMN consignment_item_id INTEGER DEFAULT NULL",
  "ALTER TABLE sylvias_bullion ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_bullion ADD COLUMN buyer_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_bullion ADD COLUMN customer_id INTEGER DEFAULT NULL",
  "ALTER TABLE sylvias_sales ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0",
  "ALTER TABLE sylvias_sales ADD COLUMN balance_due REAL NOT NULL DEFAULT 0",
  "ALTER TABLE sylvias_sales ADD COLUMN status TEXT NOT NULL DEFAULT 'paid'",
  "ALTER TABLE sylvias_sales ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'receipt'",
  "ALTER TABLE sylvias_sales ADD COLUMN due_date TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_expenses ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_expenses ADD COLUMN paid_by TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'legacy'",
  "ALTER TABLE sylvias_stock ADD COLUMN purchase_date TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock ADD COLUMN purchase_payment_method TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock ADD COLUMN purchased_by TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock ADD COLUMN no_partnumber_initials TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_suppliers ADD COLUMN postcode TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_gift_vouchers ADD COLUMN recipient_customer_id INTEGER DEFAULT NULL",
  "ALTER TABLE sylvias_bullion ADD COLUMN purchase_payment_method TEXT NOT NULL DEFAULT ''",
];

// Create all tables
for (const sql of INIT_TABLES) {
  db.exec(sql);
}

// Run ALTER TABLE migrations (ignore "duplicate column" errors)
for (const sql of ALTER_SQLS) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}

console.log('Database initialized with all tables');


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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Public: staff list for login screen (no auth required)
app.get('/api/auth/staff-list', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, initials FROM sylvias_staff ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    console.error('Staff list error:', err.message);
    res.json([]);
  }
});

// Public: register new staff member (also sets session)
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, initials } = req.body;
    if (!name || !initials) return res.status(400).json({ error: 'Name and initials required' });
    // Check if initials already taken
    const existing = db.prepare("SELECT id FROM sylvias_staff WHERE UPPER(initials) = UPPER(?)").get(initials);
    if (existing) return res.status(409).json({ error: 'Those initials are already taken. Try different ones.' });
    db.prepare("INSERT INTO sylvias_staff (name, initials) VALUES (?, ?)").run(name, initials.toUpperCase());
    const user = db.prepare("SELECT id, name, initials FROM sylvias_staff WHERE UPPER(initials) = UPPER(?)").get(initials.toUpperCase());
    req.session.user = { name: user.name, initials: user.initials };
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Public: delete staff member (from admin panel)
app.post('/api/auth/delete-staff', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing staff id' });
    db.prepare('DELETE FROM sylvias_staff WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete staff error:', err.message);
    res.status(500).json({ error: err.message });
  }
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
    res.json({ log: result || '', exitCode: 0 });
  } catch (err) {
    if (err.stdout) return res.json({ log: err.stdout, exitCode: err.status || 1 });
    res.status(500).json({ error: err.message, log: err.stderr || '', exitCode: err.status || 1 });
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
