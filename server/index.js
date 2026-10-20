const express = require('express');
const session = require('express-session');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'sylvias-dev-secret-change-me';
// In production, default to the persistent volume at /data
const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/data/sylvias.db' : path.join(__dirname, '..', 'data', 'sylvias.db'));
const UPLOADS_DIR = process.env.NODE_ENV === 'production' ? '/data/uploads' : path.join(__dirname, '..', 'data', 'uploads');
const BACKUP_DIR = process.env.NODE_ENV === 'production' ? '/data/backups' : path.join(__dirname, '..', 'data', 'backups');
const TEST_MODE = process.env.TEST_MODE === 'true' || process.env.NODE_ENV !== 'production';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync('/tmp/sylvias-pdfs', { recursive: true });

// ── One-time migration: move DB from old /app/data/ path to volume ──
const OLD_DB_PATH = path.join(__dirname, '..', 'data', 'sylvias.db');
if (DB_PATH !== OLD_DB_PATH && fs.existsSync(OLD_DB_PATH) && !fs.existsSync(DB_PATH)) {
  try {
    fs.copyFileSync(OLD_DB_PATH, DB_PATH);
    console.log(`Migrated database from ${OLD_DB_PATH} to ${DB_PATH}`);
    // Also copy WAL/SHM if they exist
    if (fs.existsSync(OLD_DB_PATH + '-wal')) fs.copyFileSync(OLD_DB_PATH + '-wal', DB_PATH + '-wal');
    if (fs.existsSync(OLD_DB_PATH + '-shm')) fs.copyFileSync(OLD_DB_PATH + '-shm', DB_PATH + '-shm');
  } catch (e) {
    console.error('DB migration failed:', e.message);
  }
}

// ── Auto-backup before startup ──
// If a database already exists, back it up before we touch anything
if (fs.existsSync(DB_PATH)) {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = path.join(BACKUP_DIR, `sylvias-pre-deploy-${ts}.db`);
  try {
    fs.copyFileSync(DB_PATH, backupFile);
    console.log(`Pre-deploy backup saved: ${backupFile}`);
    // Keep only last 10 pre-deploy backups to avoid filling the volume
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('sylvias-pre-deploy-') && f.endsWith('.db'))
      .sort();
    while (backups.length > 10) {
      const oldest = backups.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, oldest));
      console.log(`Cleaned old backup: ${oldest}`);
    }
  } catch (e) {
    console.error('Pre-deploy backup failed:', e.message);
  }
} else {
  console.log('No existing database found — fresh start');
}

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
  "CREATE TABLE IF NOT EXISTS sylvias_email_recipients (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_sent_emails (id INTEGER PRIMARY KEY AUTOINCREMENT, sent_at TEXT NOT NULL DEFAULT (datetime('now')), subject TEXT NOT NULL DEFAULT '', recipients TEXT NOT NULL DEFAULT '', body_preview TEXT NOT NULL DEFAULT '', sections_used TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'sent')",
  "CREATE TABLE IF NOT EXISTS sylvias_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, table_name TEXT NOT NULL, record_id INTEGER NOT NULL, details TEXT NOT NULL DEFAULT '', performed_by TEXT NOT NULL DEFAULT '', performed_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_snags (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', reported_by TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'open', resolution TEXT NOT NULL DEFAULT '', user_response TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sylvias_stock_removals (id INTEGER PRIMARY KEY AUTOINCREMENT, stock_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'wastage', reason TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL DEFAULT 1, initials TEXT NOT NULL DEFAULT '', cost_at_removal REAL NOT NULL DEFAULT 0, retail_at_removal REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
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
  "ALTER TABLE sylvias_stock_check_items ADD COLUMN actual_qty INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE sylvias_stock_check_items ADD COLUMN status TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock_check_items ADD COLUMN checked_by TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock_check_items ADD COLUMN checked_at TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock_check_items ADD COLUMN signoff_by TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock_check_items ADD COLUMN signoff_at TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_stock_check_items ADD COLUMN resolution TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE sylvias_sales ADD COLUMN discount REAL NOT NULL DEFAULT 0",
];

// Create all tables
for (const sql of INIT_TABLES) {
  db.exec(sql);
}

try { db.exec('ALTER TABLE sylvias_staff ADD COLUMN pin_hash TEXT'); } catch (e) { /* exists */ }

// Run ALTER TABLE migrations (ignore "duplicate column" errors)
for (const sql of ALTER_SQLS) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}

console.log('Database initialized with all tables');

// ── SQLite Session Store (sessions persist across container restarts) ──
class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired INTEGER NOT NULL
    )`);
    this.getStmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?');
    this.setStmt = db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)');
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.cleanupStmt = db.prepare('DELETE FROM sessions WHERE expired < ?');
    setInterval(() => { try { this.cleanupStmt.run(Date.now()); } catch(e) {} }, 15 * 60 * 1000);
  }
  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) || 86400000;
      this.setStmt.run(sid, JSON.stringify(sess), Date.now() + maxAge);
      cb(null);
    } catch (e) { cb(e); }
  }
  destroy(sid, cb) {
    try { this.destroyStmt.run(sid); cb(null); } catch (e) { cb(e); }
  }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}


app.set('trust proxy', 1);
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(session({
  store: new SQLiteSessionStore(db),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24*60*60*1000,
    secure: true,
    sameSite: 'lax'
  }
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

// ── PIN helpers ──
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return salt + ':' + hash;
}
function verifyPin(pin, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pin), salt, 32);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}
const isValidPin = (p) => typeof p === 'string' && /^\d{4}$/.test(p);
const loginFailures = new Map(); // staffId -> { count, until }
const MAX_TRIES = 5, LOCK_MS = 5 * 60 * 1000;

// Auth — staff id + 4-digit PIN
app.post('/api/auth/login', (req, res) => {
  try {
    const { id, pin, newPin } = req.body || {};
    const staff = db.prepare('SELECT id, name, initials, pin_hash FROM sylvias_staff WHERE id = ?').get(id);
    if (!staff) return res.status(400).json({ error: 'Staff member not found' });

    const f = loginFailures.get(staff.id);
    if (f && f.until && f.until > Date.now()) {
      const mins = Math.ceil((f.until - Date.now()) / 60000);
      return res.status(429).json({ error: `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` });
    }

    if (!staff.pin_hash) {
      // First-time login: staff member creates their own PIN
      if (!isValidPin(newPin)) return res.status(400).json({ error: 'Please choose a 4-digit PIN', needsPin: true });
      db.prepare('UPDATE sylvias_staff SET pin_hash = ? WHERE id = ?').run(hashPin(newPin), staff.id);
    } else {
      if (!isValidPin(pin) || !verifyPin(pin, staff.pin_hash)) {
        const cur = loginFailures.get(staff.id) || { count: 0, until: 0 };
        cur.count = (cur.until && cur.until <= Date.now()) ? 1 : cur.count + 1;
        cur.until = 0;
        if (cur.count >= MAX_TRIES) { cur.until = Date.now() + LOCK_MS; cur.count = 0; }
        loginFailures.set(staff.id, cur);
        if (cur.until) return res.status(429).json({ error: 'Too many wrong PINs. Locked for 5 minutes.' });
        const left = MAX_TRIES - cur.count;
        return res.status(401).json({ error: `Wrong PIN. ${left} tr${left === 1 ? 'y' : 'ies'} left.` });
      }
    }
    loginFailures.delete(staff.id);
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      req.session.user = { name: staff.name, initials: staff.initials };
      res.json({ ok: true, user: { id: staff.id, name: staff.name, initials: staff.initials } });
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});
// Automation login (backups / daily summary) — long secret key, not a staff PIN
const SERVICE_KEY = process.env.SERVICE_KEY || crypto.createHash('sha256').update(SESSION_SECRET + ':service').digest('hex');
app.post('/api/auth/service', (req, res) => {
  const key = String((req.body && req.body.key) || '');
  const a = Buffer.from(key), b = Buffer.from(SERVICE_KEY);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid key' });
  req.session.user = { name: 'Automation', initials: 'SYS' };
  res.json({ ok: true });
});
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get('/api/auth/check', (req, res) => {
  res.json(req.session?.user ? { authenticated: true, user: req.session.user } : { authenticated: false });
});

// Public: staff list for login screen (names only, plus whether a PIN is set)
app.get('/api/auth/staff-list', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, initials, created_at, CASE WHEN pin_hash IS NULL THEN 0 ELSE 1 END AS has_pin FROM sylvias_staff ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    console.error('Staff list error:', err.message);
    res.json([]);
  }
});

// Logged-in only: add new staff member with PIN
app.post('/api/auth/register', requireAuth, (req, res) => {
  try {
    const { name, initials, pin } = req.body || {};
    if (!name || !initials) return res.status(400).json({ error: 'Name and initials required' });
    if (!isValidPin(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    const existing = db.prepare("SELECT id FROM sylvias_staff WHERE UPPER(initials) = UPPER(?)").get(initials);
    if (existing) return res.status(409).json({ error: 'Those initials are already taken. Try different ones.' });
    db.prepare("INSERT INTO sylvias_staff (name, initials, pin_hash) VALUES (?, ?, ?)").run(name, initials.toUpperCase(), hashPin(pin));
    res.json({ ok: true });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Logged-in only: set / reset a staff member's PIN
app.post('/api/auth/set-pin', requireAuth, (req, res) => {
  try {
    const { id, pin } = req.body || {};
    if (!isValidPin(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    const r = db.prepare('UPDATE sylvias_staff SET pin_hash = ? WHERE id = ?').run(hashPin(pin), id);
    if (!r.changes) return res.status(404).json({ error: 'Staff member not found' });
    loginFailures.delete(Number(id));
    res.json({ ok: true });
  } catch (err) {
    console.error('Set PIN error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Logged-in only: delete staff member
app.post('/api/auth/delete-staff', requireAuth, (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing staff id' });
    const count = db.prepare('SELECT COUNT(*) AS c FROM sylvias_staff').get().c;
    if (count <= 1) return res.status(400).json({ error: "Can't delete the last staff member" });
    db.prepare('DELETE FROM sylvias_staff WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete staff error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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

// Data reset (admin, behind login + confirmation)
app.post('/api/admin/reset', requireAuth, (req, res) => {
  const tables = ['sylvias_stock','sylvias_sales','sylvias_sale_items','sylvias_customers','sylvias_expenses','sylvias_payments','sylvias_refunds','sylvias_credit_notes','sylvias_gift_vouchers','sylvias_consignment_items','sylvias_consignees','sylvias_reservations','sylvias_wishlist','sylvias_bullion','sylvias_bank_transactions','sylvias_eod_cashup','sylvias_scan_staging','sylvias_supplier_invoices','sylvias_supplier_invoice_payments','sylvias_suppliers','sylvias_float','sylvias_learned_items'];
  for (const t of tables) { try { db.exec('DELETE FROM ' + t); } catch(e) {} }
  res.json({ ok: true, tablesCleared: tables.length });
});

// ── eBay integration (stage 1: connection check) ──
const EBAY_ENV = (process.env.EBAY_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
const EBAY_API = EBAY_ENV === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
let ebayAppToken = { token: null, expires: 0 };
async function getEbayAppToken() {
  const id = process.env.EBAY_APP_ID, secret = process.env.EBAY_CERT_ID;
  if (!id || !secret) throw new Error('eBay keys not set on this site');
  if (ebayAppToken.token && Date.now() < ebayAppToken.expires - 60000) return ebayAppToken.token;
  const r = await fetch(EBAY_API + '/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64') },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error('eBay rejected the keys: ' + (data.error_description || data.error || r.status));
  ebayAppToken = { token: data.access_token, expires: Date.now() + (data.expires_in || 7200) * 1000 };
  return ebayAppToken.token;
}
app.get('/api/ebay/status', requireAuth, async (req, res) => {
  const configured = !!(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID);
  const out = { configured, env: EBAY_ENV, appIdHint: configured ? String(process.env.EBAY_APP_ID).slice(0, 18) + '…' : null, hasRuName: !!process.env.EBAY_RUNAME, keysOk: false, apiOk: false, categoryTreeId: null, error: null };
  if (!configured) return res.json(out);
  try {
    const token = await getEbayAppToken();
    out.keysOk = true;
    const r = await fetch(EBAY_API + '/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_GB', { headers: { Authorization: 'Bearer ' + token } });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { out.apiOk = true; out.categoryTreeId = d.categoryTreeId || null; }
    else out.error = 'Keys OK but eBay test call failed (' + r.status + ')';
  } catch (e) { out.error = e.message; }
  res.json(out);
});

// ── DB Backup/Restore (admin only) ──
app.get('/api/admin/db-backup', requireAuth, (req, res) => {
  try {
    const backupPath = '/tmp/sylvias-backup.db';
    db.backup(backupPath).then(() => {
      res.download(backupPath, 'sylvias.db', (err) => {
        try { require('fs').unlinkSync(backupPath); } catch(e) {}
      });
    }).catch(err => {
      console.error('Backup failed:', err);
      res.status(500).json({ error: 'Backup failed' });
    });
  } catch(err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/db-restore', requireAuth, (req, res) => {
  // Only allow on test site
  if (!TEST_MODE) {
    return res.status(403).json({ error: 'DB restore only allowed in test mode' });
  }
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const restorePath = '/tmp/sylvias-restore.db';
      require('fs').writeFileSync(restorePath, buffer);
      // Verify it's a valid SQLite DB
      const testDb = new Database(restorePath);
      testDb.pragma('integrity_check');
      testDb.close();
      // Close current DB, replace, reopen
      db.close();
      require('fs').copyFileSync(restorePath, DB_PATH);
      require('fs').unlinkSync(restorePath);
      // Reopen - but since db is const, restart is cleaner
      res.json({ ok: true, message: 'Database restored. Server will restart.' });
      // Force restart so the new DB is loaded
      setTimeout(() => process.exit(1), 500);
    } catch(err) {
      console.error('Restore error:', err);
      res.status(500).json({ error: err.message });
    }
  });
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
