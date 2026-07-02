import { StockItem, StaffUser, Sale, SaleItem, Customer, Expense, FloatRecord, Consigner, ConsignmentItem, Reservation, WishListItem, Supplier, BullionItem, Payment, Refund, CreditNote, BankTransaction, EventRecord, EventItem, Quote, QuoteItem, GiftVoucher, ScanStagingItem, SupplierInvoice, SupplierPayment } from '../types';

export function esc(s: string): string {
  return s.split("'").join("''");
}

const INIT_TABLES = [
  `CREATE TABLE IF NOT EXISTS sylvias_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    initials TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number TEXT NOT NULL,
    description TEXT NOT NULL,
    photo TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 0,
    location TEXT NOT NULL DEFAULT '',
    cost REAL NOT NULL DEFAULT 0,
    rrp REAL NOT NULL DEFAULT 0,
    entered_by TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Other',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_item_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_date TEXT NOT NULL DEFAULT (datetime('now')),
    customer_name TEXT NOT NULL DEFAULT 'Walk-in',
    payment_method TEXT NOT NULL DEFAULT 'cash',
    total REAL NOT NULL DEFAULT 0,
    sold_by TEXT NOT NULL DEFAULT '',
    invoice_number TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,
    part_number TEXT NOT NULL,
    description TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salutation TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    surname TEXT NOT NULL DEFAULT '',
    address_line1 TEXT NOT NULL DEFAULT '',
    address_line2 TEXT NOT NULL DEFAULT '',
    address_line3 TEXT NOT NULL DEFAULT '',
    postcode TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date TEXT NOT NULL DEFAULT (date('now')),
    category TEXT NOT NULL DEFAULT 'General',
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    receipt_photo TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // ── New tables ──
  `CREATE TABLE IF NOT EXISTS sylvias_float (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    float_date TEXT NOT NULL DEFAULT (date('now')),
    opening_amount REAL NOT NULL DEFAULT 0,
    closing_amount REAL NOT NULL DEFAULT 0,
    cash_in REAL NOT NULL DEFAULT 0,
    cash_out REAL NOT NULL DEFAULT 0,
    difference REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_consigners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    commission_pct REAL NOT NULL DEFAULT 20,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_consignment_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consigner_id INTEGER NOT NULL,
    consigner_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    selling_price REAL NOT NULL DEFAULT 0,
    commission_pct REAL NOT NULL DEFAULT 20,
    status TEXT NOT NULL DEFAULT 'available',
    date_received TEXT NOT NULL DEFAULT (date('now')),
    notes TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    qty_sold INTEGER NOT NULL DEFAULT 0,
    qty_remaining INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    stock_description TEXT NOT NULL DEFAULT '',
    stock_part_number TEXT NOT NULL DEFAULT '',
    customer_id INTEGER,
    customer_name TEXT NOT NULL DEFAULT '',
    deposit REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    reserve_date TEXT NOT NULL DEFAULT (date('now')),
    expiry_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT NOT NULL DEFAULT '',
    reserved_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    customer_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'Other',
    contact_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_bullion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metal_type TEXT NOT NULL DEFAULT 'Gold',
    form TEXT NOT NULL DEFAULT 'Coin',
    description TEXT NOT NULL DEFAULT '',
    weight REAL NOT NULL DEFAULT 0,
    weight_unit TEXT NOT NULL DEFAULT 'oz',
    purity TEXT NOT NULL DEFAULT '999',
    purchase_date TEXT NOT NULL DEFAULT (date('now')),
    purchase_price REAL NOT NULL DEFAULT 0,
    premium_paid REAL NOT NULL DEFAULT 0,
    dealer_name TEXT NOT NULL DEFAULT '',
    sell_date TEXT NOT NULL DEFAULT '',
    sale_price REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'held',
    notes TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT NOT NULL DEFAULT '',
    bank_name TEXT NOT NULL DEFAULT '',
    sort_code TEXT NOT NULL DEFAULT '',
    account_number TEXT NOT NULL DEFAULT '',
    opening_balance REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // ── Phase 10: Bookkeeping tables ──
  `CREATE TABLE IF NOT EXISTS sylvias_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    payment_date TEXT NOT NULL DEFAULT (date('now')),
    amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL DEFAULT '',
    refund_date TEXT NOT NULL DEFAULT (date('now')),
    amount REAL NOT NULL DEFAULT 0,
    refund_method TEXT NOT NULL DEFAULT 'cash',
    reason TEXT NOT NULL DEFAULT '',
    items_restocked INTEGER NOT NULL DEFAULT 0,
    entered_by TEXT NOT NULL DEFAULT '',
    credit_note_number TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_credit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    customer_name TEXT NOT NULL DEFAULT '',
    credit_note_number TEXT NOT NULL DEFAULT '',
    date_issued TEXT NOT NULL DEFAULT (date('now')),
    original_invoice TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    amount_used REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_id INTEGER NOT NULL,
    transaction_date TEXT NOT NULL DEFAULT (date('now')),
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    reference TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'other',
    linked_sale_id INTEGER,
    linked_expense_id INTEGER,
    reconciled INTEGER NOT NULL DEFAULT 0,
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // ── Phase 16: Events ──
  `CREATE TABLE IF NOT EXISTS sylvias_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL DEFAULT (date('now')),
    end_date TEXT NOT NULL DEFAULT '',
    pitch_cost REAL NOT NULL DEFAULT 0,
    travel_cost REAL NOT NULL DEFAULT 0,
    other_costs REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planned',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_event_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    part_number TEXT NOT NULL DEFAULT '',
    qty_taken INTEGER NOT NULL DEFAULT 1,
    qty_sold INTEGER NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // ── Phase 16: Quotes ──
  `CREATE TABLE IF NOT EXISTS sylvias_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT NOT NULL DEFAULT '',
    customer_id INTEGER,
    customer_name TEXT NOT NULL DEFAULT '',
    quote_date TEXT NOT NULL DEFAULT (date('now')),
    expiry_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    part_number TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_gift_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_number TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL DEFAULT 0,
    amount_used REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    purchaser_name TEXT NOT NULL DEFAULT '',
    purchaser_customer_id INTEGER DEFAULT NULL,
    recipient_name TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    date_issued TEXT NOT NULL DEFAULT '',
    date_expires TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_supplier_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_ref TEXT NOT NULL DEFAULT '',
    supplier_id INTEGER DEFAULT NULL,
    supplier_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    total_amount REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    balance_due REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid',
    invoice_date TEXT NOT NULL DEFAULT (date('now')),
    due_date TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_supplier_invoice_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_invoice_id INTEGER NOT NULL,
    payment_date TEXT NOT NULL DEFAULT (date('now')),
    amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    entered_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_scan_staging (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL DEFAULT '',
    part_number TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 1,
    condition TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    cost REAL NOT NULL DEFAULT 0,
    rrp REAL NOT NULL DEFAULT 0,
    offer_price REAL NOT NULL DEFAULT 0,
    acquisition_type TEXT NOT NULL DEFAULT 'existing',
    supplier_name TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT '',
    purchase_date TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    purchased_by TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    scan_type TEXT NOT NULL DEFAULT 'single',
    scanned_by TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_email_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_sent_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    subject TEXT NOT NULL DEFAULT '',
    recipients TEXT NOT NULL DEFAULT '',
    body_preview TEXT NOT NULL DEFAULT '',
    sections_used TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'sent'
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    performed_by TEXT NOT NULL DEFAULT '',
    performed_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sylvias_snags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    reported_by TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    resolution TEXT NOT NULL DEFAULT '',
    user_response TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

const ALTER_SQLS = [
  `ALTER TABLE sylvias_sales ADD COLUMN customer_id INTEGER DEFAULT NULL`,
  `ALTER TABLE sylvias_stock ADD COLUMN on_offer INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sylvias_stock ADD COLUMN offer_price REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE sylvias_stock ADD COLUMN supplier_id INTEGER DEFAULT NULL`,
  `ALTER TABLE sylvias_stock ADD COLUMN source_type TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE sylvias_sale_items ADD COLUMN is_consignment INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sylvias_sale_items ADD COLUMN consignment_item_id INTEGER DEFAULT NULL`,
  `ALTER TABLE sylvias_bullion ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE sylvias_bullion ADD COLUMN buyer_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE sylvias_bullion ADD COLUMN customer_id INTEGER DEFAULT NULL`,
  // Phase 10: Payment tracking on sales
  `ALTER TABLE sylvias_sales ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE sylvias_sales ADD COLUMN balance_due REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE sylvias_sales ADD COLUMN status TEXT NOT NULL DEFAULT 'paid'`,
  `ALTER TABLE sylvias_sales ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'receipt'`,
  `ALTER TABLE sylvias_sales ADD COLUMN due_date TEXT NOT NULL DEFAULT ''`,
  // Expenses: payment_method and paid_by
  `ALTER TABLE sylvias_expenses ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE sylvias_expenses ADD COLUMN paid_by TEXT NOT NULL DEFAULT ''`,
  // Stock: purchase tracking
  `ALTER TABLE sylvias_stock ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'legacy'`,
  `ALTER TABLE sylvias_stock ADD COLUMN purchase_date TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE sylvias_stock ADD COLUMN purchase_payment_method TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE sylvias_stock ADD COLUMN purchased_by TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE sylvias_stock ADD COLUMN no_partnumber_initials TEXT NOT NULL DEFAULT ''`,
  // Supplier postcode
  `ALTER TABLE sylvias_suppliers ADD COLUMN postcode TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE sylvias_gift_vouchers ADD COLUMN recipient_customer_id INTEGER DEFAULT NULL`,
  `ALTER TABLE sylvias_bullion ADD COLUMN purchase_payment_method TEXT NOT NULL DEFAULT ''`,
];

let initialized = false;

export async function initDB(): Promise<void> {
  if (initialized) return;

  // Always run CREATE TABLE IF NOT EXISTS — they are idempotent and ensure
  // any newly-added tables get created even if older tables already exist.
  // Sequential to avoid version conflicts
  for (const sql of INIT_TABLES) {
    await window.tasklet.sqlExec(sql).catch((e: unknown) => console.warn('Table init:', e));
  }

  // Run ALTER TABLE migrations — skip if latest migration column already exists
  let needsAlters = false;
  try {
    await window.tasklet.sqlQuery("SELECT purchase_payment_method FROM sylvias_bullion LIMIT 1");
  } catch { needsAlters = true; }
  if (needsAlters) {
    for (const sql of ALTER_SQLS) {
      await window.tasklet.sqlExec(sql).catch(() => { /* column already exists */ });
    }
  }
  initialized = true;
}

// ── Staff / Login ──

export async function getStaffUsers(): Promise<StaffUser[]> {
  const rows = await window.tasklet.sqlQuery('SELECT * FROM sylvias_staff ORDER BY name ASC');
  return rows as unknown as StaffUser[];
}

export async function addStaffUser(name: string, initials: string): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_staff (name, initials) VALUES ('${esc(name)}', '${esc(initials.toUpperCase())}')`
  );
}

export async function getStaffByInitials(initials: string): Promise<StaffUser | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_staff WHERE initials = '${esc(initials.toUpperCase())}'`
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as StaffUser;
}

// ── Stock Items ──

export async function getAllStock(): Promise<StockItem[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_stock ORDER BY description ASC'
  );
  return rows as unknown as StockItem[];
}

export async function addStockItem(item: Omit<StockItem, 'id' | 'created_at' | 'on_offer' | 'offer_price' | 'supplier_id' | 'source_type' | 'entry_type' | 'purchase_date' | 'purchase_payment_method' | 'purchased_by'> & { no_partnumber_initials?: string }): Promise<void> {
  const safeQty = Math.max(1, parseInt(String(item.qty)) || 1);
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_stock (part_number, description, photo, qty, location, cost, rrp, entered_by, category, no_partnumber_initials)
     VALUES ('${esc(item.part_number)}', '${esc(item.description)}', '${esc(item.photo)}', ${safeQty}, '${esc(item.location)}', ${item.cost}, ${item.rrp}, '${esc(item.entered_by)}', '${esc(item.category)}', '${esc(item.no_partnumber_initials || '')}')`
  );
  await learnItemName(item.description);
}

export async function updateStockItem(item: StockItem): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_stock SET
      part_number='${esc(item.part_number)}',
      description='${esc(item.description)}',
      photo='${esc(item.photo)}',
      qty=${item.qty},
      location='${esc(item.location)}',
      cost=${item.cost},
      rrp=${item.rrp},
      entered_by='${esc(item.entered_by)}',
      category='${esc(item.category)}',
      on_offer=${item.on_offer || 0},
      offer_price=${item.offer_price || 0},
      supplier_id=${item.supplier_id || 'NULL'},
      source_type='${esc(item.source_type || '')}',
      entry_type='${esc((item as any).entry_type || 'legacy')}',
      purchase_date='${esc((item as any).purchase_date || '')}',
      purchase_payment_method='${esc((item as any).purchase_payment_method || '')}',
      purchased_by='${esc((item as any).purchased_by || '')}',
      no_partnumber_initials='${esc((item as any).no_partnumber_initials || '')}'
     WHERE id=${item.id}`
  );
  await learnItemName(item.description);
}

export async function deleteStockItem(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_stock WHERE id=${id}`);
}

export async function updateStockQty(id: number, newQty: number): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_stock SET qty=${Math.max(0, newQty)} WHERE id=${id}`
  );
}

export async function getStockByPartNumber(partNumber: string): Promise<StockItem | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_stock WHERE part_number = '${esc(partNumber)}'`
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as StockItem;
}

export async function getStockMissingPartNumbers(): Promise<StockItem[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_stock WHERE part_number = '' OR part_number IS NULL ORDER BY created_at DESC`
  );
  return rows as unknown as StockItem[];
}

export async function searchStock(query: string): Promise<StockItem[]> {
  const q = esc(query);
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_stock WHERE description LIKE '%${q}%' OR part_number LIKE '%${q}%' OR location LIKE '%${q}%' ORDER BY description ASC`
  );
  return rows as unknown as StockItem[];
}

export async function searchStockInStock(query: string): Promise<StockItem[]> {
  const q = esc(query);
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_stock WHERE (description LIKE '%${q}%' OR part_number LIKE '%${q}%' OR location LIKE '%${q}%') AND qty > 0 ORDER BY description ASC`
  );
  return rows as unknown as StockItem[];
}

export async function getStockById(id: number): Promise<StockItem | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_stock WHERE id = ${id}`
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as StockItem;
}

// ── Stock Aging & Offers ──

export async function setStockOnOffer(id: number, offerPrice: number): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_stock SET on_offer = 1, offer_price = ${offerPrice} WHERE id = ${id}`
  );
}

export async function removeStockOffer(id: number): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_stock SET on_offer = 0, offer_price = 0 WHERE id = ${id}`
  );
}

export async function getStockOnOffer(): Promise<StockItem[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_stock WHERE on_offer = 1 ORDER BY description ASC'
  );
  return rows as unknown as StockItem[];
}

export function getStockAgeDays(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Auto-learn Item Names ──

export async function learnItemName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await window.tasklet.sqlExec(
    `INSERT OR IGNORE INTO sylvias_item_names (name) VALUES ('${esc(trimmed)}')`
  );
}

export async function getLearnedItemNames(): Promise<string[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT name FROM sylvias_item_names ORDER BY name ASC'
  );
  return (rows as unknown as { name: string }[]).map(r => r.name);
}

// ── Sales ──

export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `SS-${yy}${mm}-`;
  // Find the highest existing invoice number for this month
  const rows = await window.tasklet.sqlQuery(
    `SELECT invoice_number FROM sylvias_sales WHERE invoice_number LIKE '${prefix}%' ORDER BY invoice_number DESC LIMIT 1`
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const last = (rows[0] as unknown as { invoice_number: string }).invoice_number;
    const lastNum = parseInt(last.replace(prefix, ''), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

export async function createSale(sale: {
  customer_name: string;
  customer_id: number | null;
  payment_method: string;
  total: number;
  sold_by: string;
  invoice_number: string;
  notes: string;
  amount_paid?: number;
  balance_due?: number;
  status?: string;
  sale_type?: string;
  due_date?: string;
  sale_date?: string;
  discount?: number;
}): Promise<number> {
  const custId = sale.customer_id !== null ? String(sale.customer_id) : 'NULL';
  const discount = sale.discount ?? 0;
  const amountPaid = sale.amount_paid ?? (sale.total - discount);
  const balanceDue = sale.balance_due ?? 0;
  const status = sale.status ?? 'paid';
  const saleType = sale.sale_type ?? 'receipt';
  const dueDate = sale.due_date ?? '';
  const saleDate = sale.sale_date || new Date().toISOString().replace('T', ' ').slice(0, 19);
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_sales (customer_name, customer_id, payment_method, total, sold_by, invoice_number, notes, amount_paid, balance_due, status, sale_type, due_date, sale_date, discount)
     VALUES ('${esc(sale.customer_name)}', ${custId}, '${esc(sale.payment_method)}', ${sale.total}, '${esc(sale.sold_by)}', '${esc(sale.invoice_number)}', '${esc(sale.notes)}', ${amountPaid}, ${balanceDue}, '${esc(status)}', '${esc(saleType)}', '${esc(dueDate)}', '${esc(saleDate)}', ${discount})`
  );
  const rows = await window.tasklet.sqlQuery(
    `SELECT id FROM sylvias_sales WHERE invoice_number = '${esc(sale.invoice_number)}' ORDER BY id DESC LIMIT 1`
  );
  return (rows[0] as unknown as { id: number }).id;
}

export async function addSaleItem(item: {
  sale_id: number;
  stock_id: number;
  part_number: string;
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
  is_consignment?: number;
  consignment_item_id?: number | null;
}): Promise<void> {
  const isCon = item.is_consignment || 0;
  const conId = item.consignment_item_id || 'NULL';
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_sale_items (sale_id, stock_id, part_number, description, qty, unit_price, line_total, is_consignment, consignment_item_id)
     VALUES (${item.sale_id}, ${item.stock_id}, '${esc(item.part_number)}', '${esc(item.description)}', ${item.qty}, ${item.unit_price}, ${item.line_total}, ${isCon}, ${conId})`
  );
}

export async function getSaleById(id: number): Promise<Sale | null> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_sales WHERE id = ${id}`);
  if (rows.length === 0) return null;
  return rows[0] as unknown as Sale;
}

export async function getSaleItems(saleId: number): Promise<SaleItem[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_sale_items WHERE sale_id = ${saleId}`
  );
  return rows as unknown as SaleItem[];
}

export async function getTodaysSales(): Promise<Sale[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_sales WHERE date(sale_date) = date('now') ORDER BY sale_date DESC`
  );
  return rows as unknown as Sale[];
}

export async function getAllSales(): Promise<Sale[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_sales ORDER BY sale_date DESC`
  );
  return rows as unknown as Sale[];
}

// ── Categories ──

export const DEFAULT_CATEGORIES = [
  'Clocks & Watches',
  'Vintage China',
  'Jewellery',
  'Books & Maps',
  'Furniture',
  'Art & Prints',
  'Curios & Oddities',
  'Silverware',
  'Glassware',
  'Textiles & Linen',
  'Toys & Games',
  'Kitchenware',
  'Militaria',
  'Tools & Hardware',
  'Other',
];

export const DEFAULT_LOCATIONS = [
  'Front Window',
  'Display Cabinet 1',
  'Display Cabinet 2',
  'Display Cabinet 3',
  'Wall Display',
  'Back Room',
  'Shelf A',
  'Shelf B',
  'Shelf C',
  'Counter',
  'Storage',
  'Other',
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Insurance', 'Transport',
  'Shop Supplies', 'Packaging & Supplies', 'Marketing', 'Repairs & Maintenance', 'Professional Fees',
  'Bank Charges', 'Refreshments', 'Cleaning', 'Postage', 'Petrol & Travel',
  'Electricity', 'Gas', 'Water', 'WiFi & Internet', 'Mobile Phone',
  'Telephone & Landline', 'General', 'Other',
];

// Backward-compat aliases (static fallbacks)
export const CATEGORIES = DEFAULT_CATEGORIES;
export const LOCATIONS = DEFAULT_LOCATIONS;

// Dynamic loaders — read from settings, fall back to defaults
export async function getCategories(): Promise<string[]> {
  const raw = await getSetting('custom_categories');
  if (raw) try { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length > 0) return arr; } catch {}
  return [...DEFAULT_CATEGORIES];
}
export async function saveCategories(cats: string[]): Promise<void> {
  await setSetting('custom_categories', JSON.stringify(cats));
}

export async function getLocations(): Promise<string[]> {
  const raw = await getSetting('custom_locations');
  if (raw) try { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length > 0) return arr; } catch {}
  return [...DEFAULT_LOCATIONS];
}
export async function saveLocations(locs: string[]): Promise<void> {
  await setSetting('custom_locations', JSON.stringify(locs));
}

export async function getExpenseCategories(): Promise<string[]> {
  const raw = await getSetting('custom_expense_categories');
  if (raw) try { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length > 0) return arr; } catch {}
  return [...DEFAULT_EXPENSE_CATEGORIES];
}
export async function saveExpenseCategories(cats: string[]): Promise<void> {
  await setSetting('custom_expense_categories', JSON.stringify(cats));
}

// ── Customers ──

export async function getAllCustomers(): Promise<Customer[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_customers ORDER BY surname ASC, first_name ASC'
  );
  return rows as unknown as Customer[];
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_customers WHERE id = ${id}`
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as Customer;
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const q = esc(query);
  const qpc = esc(query.replace(/\s/g, '').toUpperCase());
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_customers WHERE first_name LIKE '%${q}%' OR surname LIKE '%${q}%' OR email LIKE '%${q}%' OR phone LIKE '%${q}%' OR postcode LIKE '%${q}%' OR REPLACE(UPPER(postcode), ' ', '') LIKE '%${qpc}%' ORDER BY surname ASC`
  );
  return rows as unknown as Customer[];
}

export async function addCustomer(c: Omit<Customer, 'id' | 'created_at'>): Promise<number> {
  const fn = titleCase(c.first_name.trim());
  const sn = titleCase(c.surname.trim());
  const a1 = titleCase(c.address_line1.trim());
  const a2 = titleCase(c.address_line2.trim());
  const a3 = titleCase(c.address_line3.trim());
  const pc = c.postcode.trim().toUpperCase();

  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_customers (salutation, first_name, surname, address_line1, address_line2, address_line3, postcode, phone, email)
     VALUES ('${esc(c.salutation)}', '${esc(fn)}', '${esc(sn)}', '${esc(a1)}', '${esc(a2)}', '${esc(a3)}', '${esc(pc)}', '${esc(c.phone.trim())}', '${esc(c.email.trim().toLowerCase())}')`
  );
  const rows = await window.tasklet.sqlQuery(
    `SELECT id FROM sylvias_customers WHERE first_name = '${esc(fn)}' AND surname = '${esc(sn)}' AND email = '${esc(c.email.trim().toLowerCase())}' ORDER BY id DESC LIMIT 1`
  );
  return (rows[0] as unknown as { id: number }).id;
}

export async function updateCustomer(c: Customer): Promise<void> {
  const fn = titleCase(c.first_name.trim());
  const sn = titleCase(c.surname.trim());
  const a1 = titleCase(c.address_line1.trim());
  const a2 = titleCase(c.address_line2.trim());
  const a3 = titleCase(c.address_line3.trim());
  const pc = c.postcode.trim().toUpperCase();

  await window.tasklet.sqlExec(
    `UPDATE sylvias_customers SET
      salutation='${esc(c.salutation)}',
      first_name='${esc(fn)}',
      surname='${esc(sn)}',
      address_line1='${esc(a1)}',
      address_line2='${esc(a2)}',
      address_line3='${esc(a3)}',
      postcode='${esc(pc)}',
      phone='${esc(c.phone.trim())}',
      email='${esc(c.email.trim().toLowerCase())}'
     WHERE id=${c.id}`
  );
}

export async function deleteCustomer(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_customers WHERE id=${id}`);
}

export async function getCustomerSaleCount(customerId: number): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COUNT(*) as cnt FROM sylvias_sales WHERE customer_id = ${customerId}`
  );
  return (rows[0] as unknown as { cnt: number }).cnt;
}

// Title-case helper
export function titleCase(str: string): string {
  if (!str) return str;
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

export const SALUTATIONS = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Rev', 'Sir', 'Lady', 'Prof', ''];

// ── Part Number Generator ──

export async function generatePartNumber(category: string): Promise<string> {
  const prefix = category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const rows = await window.tasklet.sqlQuery(
    `SELECT COUNT(*) as cnt FROM sylvias_stock WHERE part_number LIKE '${prefix}-%'`
  );
  const count = (rows[0] as unknown as { cnt: number }).cnt;
  const num = String(count + 1).padStart(4, '0');
  return `${prefix}-${num}`;
}

// ── Expenses ──

export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;

export const EXPENSE_PAYMENT_METHODS = ['Cash', 'SumUp', 'Bank Transfer', 'PayPal', 'Direct Debit', 'Standing Order', 'Card', 'Other'];

export async function getAllExpenses(): Promise<Expense[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_expenses ORDER BY expense_date DESC, id DESC'
  );
  return rows as unknown as Expense[];
}

export async function getExpensesByDateRange(from: string, to: string): Promise<Expense[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_expenses WHERE expense_date >= '${esc(from)}' AND expense_date <= '${esc(to)}' ORDER BY expense_date DESC, id DESC`
  );
  return rows as unknown as Expense[];
}

export async function addExpense(e: Omit<Expense, 'id' | 'created_at'>): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_expenses (expense_date, category, description, amount, receipt_photo, entered_by, payment_method, paid_by)
     VALUES ('${esc(e.expense_date)}', '${esc(e.category)}', '${esc(e.description)}', ${e.amount}, '${esc(e.receipt_photo)}', '${esc(e.entered_by)}', '${esc(e.payment_method || '')}', '${esc(e.paid_by || '')}')`
  );
}

export async function updateExpense(e: Expense): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_expenses SET
      expense_date='${esc(e.expense_date)}',
      category='${esc(e.category)}',
      description='${esc(e.description)}',
      amount=${e.amount},
      receipt_photo='${esc(e.receipt_photo)}',
      entered_by='${esc(e.entered_by)}',
      payment_method='${esc(e.payment_method || '')}',
      paid_by='${esc(e.paid_by || '')}'
     WHERE id=${e.id}`
  );
}

export async function deleteExpense(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_expenses WHERE id=${id}`);
}

// ── Sales Ledger queries ──

export async function getSalesByDateRange(from: string, to: string): Promise<Sale[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_sales WHERE date(sale_date) >= '${esc(from)}' AND date(sale_date) <= '${esc(to)}' ORDER BY sale_date DESC`
  );
  return rows as unknown as Sale[];
}

export async function getSalesWithItems(saleId: number): Promise<{sale: Sale; items: SaleItem[]}> {
  const sale = await getSaleById(saleId);
  const items = await getSaleItems(saleId);
  return { sale: sale!, items };
}

// ── Accountant Report queries ──

export async function getSalesTotals(): Promise<{total_sales: number; sale_count: number}> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(total - discount), 0) as total_sales, COUNT(*) as sale_count FROM sylvias_sales`
  );
  return rows[0] as unknown as {total_sales: number; sale_count: number};
}

export async function getExpensesTotals(): Promise<{total_expenses: number; expense_count: number}> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as expense_count FROM sylvias_expenses`
  );
  return rows[0] as unknown as {total_expenses: number; expense_count: number};
}

export async function getStockCostTotal(): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(cost * qty), 0) as total_cost FROM sylvias_stock`
  );
  return (rows[0] as unknown as {total_cost: number}).total_cost;
}

export async function getExpensesByCategory(): Promise<{category: string; total: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT category, SUM(amount) as total FROM sylvias_expenses GROUP BY category ORDER BY total DESC`
  );
  return rows as unknown as {category: string; total: number}[];
}

export async function getSalesByMonth(): Promise<{month: string; total: number; count: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT strftime('%Y-%m', sale_date) as month, SUM(total - discount) as total, COUNT(*) as count FROM sylvias_sales GROUP BY month ORDER BY month DESC`
  );
  return rows as unknown as {month: string; total: number; count: number}[];
}

export async function getSalesByPaymentMethod(): Promise<{method: string; total: number; count: number}[]> {
  // Use sylvias_payments for actual money received by method
  const rows = await window.tasklet.sqlQuery(
    `SELECT payment_method as method, SUM(amount) as total, COUNT(*) as count FROM sylvias_payments GROUP BY payment_method ORDER BY total DESC`
  );
  return rows as unknown as {method: string; total: number; count: number}[];
}

export async function getCostOfGoodsSold(): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(si.qty * s.cost), 0) as cogs
     FROM sylvias_sale_items si
     JOIN sylvias_stock s ON si.stock_id = s.id`
  );
  return (rows[0] as unknown as {cogs: number}).cogs;
}

// ── Date-range filtered report queries ──

export async function getSalesTotalsByRange(from: string, to: string): Promise<{total_sales: number; sale_count: number}> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(total - discount), 0) as total_sales, COUNT(*) as sale_count FROM sylvias_sales WHERE date(sale_date) >= '${esc(from)}' AND date(sale_date) <= '${esc(to)}'`
  );
  return rows[0] as unknown as {total_sales: number; sale_count: number};
}

export async function getExpensesTotalsByRange(from: string, to: string): Promise<{total_expenses: number; expense_count: number}> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as expense_count FROM sylvias_expenses WHERE expense_date >= '${esc(from)}' AND expense_date <= '${esc(to)}'`
  );
  return rows[0] as unknown as {total_expenses: number; expense_count: number};
}

export async function getCogsByRange(from: string, to: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(si.qty * s.cost), 0) as cogs
     FROM sylvias_sale_items si
     JOIN sylvias_stock s ON si.stock_id = s.id
     JOIN sylvias_sales sa ON si.sale_id = sa.id
     WHERE date(sa.sale_date) >= '${esc(from)}' AND date(sa.sale_date) <= '${esc(to)}'`
  );
  return (rows[0] as unknown as {cogs: number}).cogs;
}

// Bullion COGS — cost of bullion items sold in a date range
// Only becomes an expense (COGS) when the bullion is sold, not when purchased
export async function getBullionCOGSByRange(from: string, to: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(purchase_price + premium_paid), 0) as cogs
     FROM sylvias_bullion
     WHERE status = 'sold' AND date(sell_date) >= '${esc(from)}' AND date(sell_date) <= '${esc(to)}'`
  );
  return (rows[0] as unknown as {cogs: number}).cogs;
}

export async function getSalesByMonthInRange(from: string, to: string): Promise<{month: string; total: number; count: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT strftime('%Y-%m', sale_date) as month, SUM(total - discount) as total, COUNT(*) as count
     FROM sylvias_sales WHERE date(sale_date) >= '${esc(from)}' AND date(sale_date) <= '${esc(to)}'
     GROUP BY month ORDER BY month ASC`
  );
  return rows as unknown as {month: string; total: number; count: number}[];
}

export async function getSalesByPaymentMethodInRange(from: string, to: string): Promise<{method: string; total: number; count: number}[]> {
  // Use sylvias_payments for actual money received by method
  const rows = await window.tasklet.sqlQuery(
    `SELECT payment_method as method, SUM(amount) as total, COUNT(*) as count
     FROM sylvias_payments WHERE date(payment_date) >= '${esc(from)}' AND date(payment_date) <= '${esc(to)}'
     GROUP BY payment_method ORDER BY total DESC`
  );
  return rows as unknown as {method: string; total: number; count: number}[];
}

export async function getExpensesByCategoryInRange(from: string, to: string): Promise<{category: string; total: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT category, SUM(amount) as total FROM sylvias_expenses
     WHERE expense_date >= '${esc(from)}' AND expense_date <= '${esc(to)}'
     GROUP BY category ORDER BY total DESC`
  );
  return rows as unknown as {category: string; total: number}[];
}

export async function getExpensesMonthlyInRange(from: string, to: string): Promise<{month: string; total: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as total
     FROM sylvias_expenses WHERE expense_date >= '${esc(from)}' AND expense_date <= '${esc(to)}'
     GROUP BY month ORDER BY month ASC`
  );
  return rows as unknown as {month: string; total: number}[];
}

export async function getAllSalesInRange(from: string, to: string): Promise<Sale[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_sales WHERE date(sale_date) >= '${esc(from)}' AND date(sale_date) <= '${esc(to)}' ORDER BY sale_date ASC`
  );
  return rows as unknown as Sale[];
}

export async function getAllExpensesInRange(from: string, to: string): Promise<Expense[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_expenses WHERE expense_date >= '${esc(from)}' AND expense_date <= '${esc(to)}' ORDER BY expense_date ASC`
  );
  return rows as unknown as Expense[];
}

export async function getSalesIncomeByMethod(from: string, to: string): Promise<{method: string; total: number}[]> {
  // Use sylvias_payments for actual money received by method
  const rows = await window.tasklet.sqlQuery(
    `SELECT payment_method as method, COALESCE(SUM(amount), 0) as total
     FROM sylvias_payments WHERE date(payment_date) >= '${esc(from)}' AND date(payment_date) <= '${esc(to)}'
     GROUP BY payment_method ORDER BY total DESC`
  );
  return rows as unknown as {method: string; total: number}[];
}

export async function getExpensesByCategoryForPeriod(from: string, to: string): Promise<Record<string, number>> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT category, COALESCE(SUM(amount), 0) as total FROM sylvias_expenses
     WHERE expense_date >= '${esc(from)}' AND expense_date <= '${esc(to)}'
     GROUP BY category ORDER BY category ASC`
  );
  const result: Record<string, number> = {};
  for (const r of rows as unknown as {category: string; total: number}[]) {
    result[r.category] = r.total;
  }
  return result;
}

export async function getDetailedExpensesGrouped(from: string, to: string): Promise<{category: string; items: {date: string; description: string; amount: number}[]; total: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT category, expense_date, description, amount FROM sylvias_expenses
     WHERE expense_date >= '${esc(from)}' AND expense_date <= '${esc(to)}'
     ORDER BY category ASC, expense_date ASC`
  );
  const typed = rows as unknown as {category: string; expense_date: string; description: string; amount: number}[];
  const grouped: Record<string, {date: string; description: string; amount: number}[]> = {};
  for (const r of typed) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push({ date: r.expense_date, description: r.description, amount: r.amount });
  }
  return Object.entries(grouped).map(([category, items]) => ({
    category,
    items,
    total: items.reduce((s, i) => s + i.amount, 0),
  }));
}

// ── Float Tracker ──

export async function getFloatByDate(date: string): Promise<FloatRecord | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_float WHERE float_date = '${esc(date)}' ORDER BY id DESC LIMIT 1`
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as FloatRecord;
}

export async function getAllFloats(): Promise<FloatRecord[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_float ORDER BY float_date DESC, id DESC'
  );
  return rows as unknown as FloatRecord[];
}

export async function saveFloat(f: Omit<FloatRecord, 'id' | 'created_at'>): Promise<void> {
  // Check if a record exists for this date
  const existing = await getFloatByDate(f.float_date);
  if (existing) {
    await window.tasklet.sqlExec(
      `UPDATE sylvias_float SET
        opening_amount=${f.opening_amount},
        closing_amount=${f.closing_amount},
        cash_in=${f.cash_in},
        cash_out=${f.cash_out},
        difference=${f.difference},
        notes='${esc(f.notes)}',
        entered_by='${esc(f.entered_by)}'
       WHERE id=${existing.id}`
    );
  } else {
    await window.tasklet.sqlExec(
      `INSERT INTO sylvias_float (float_date, opening_amount, closing_amount, cash_in, cash_out, difference, notes, entered_by)
       VALUES ('${esc(f.float_date)}', ${f.opening_amount}, ${f.closing_amount}, ${f.cash_in}, ${f.cash_out}, ${f.difference}, '${esc(f.notes)}', '${esc(f.entered_by)}')`
    );
  }
}

// ── Consigners ──

export async function getAllConsigners(): Promise<Consigner[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_consigners ORDER BY name ASC'
  );
  return rows as unknown as Consigner[];
}

export async function addConsigner(c: Omit<Consigner, 'id' | 'created_at'>): Promise<number> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_consigners (name, phone, email, address, commission_pct, notes)
     VALUES ('${esc(titleCase(c.name))}', '${esc(c.phone)}', '${esc(c.email.toLowerCase())}', '${esc(c.address)}', ${c.commission_pct}, '${esc(c.notes)}')`
  );
  const rows = await window.tasklet.sqlQuery(
    `SELECT id FROM sylvias_consigners WHERE name = '${esc(titleCase(c.name))}' ORDER BY id DESC LIMIT 1`
  );
  return (rows[0] as unknown as { id: number }).id;
}

export async function updateConsigner(c: Consigner): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_consigners SET
      name='${esc(titleCase(c.name))}',
      phone='${esc(c.phone)}',
      email='${esc(c.email.toLowerCase())}',
      address='${esc(c.address)}',
      commission_pct=${c.commission_pct},
      notes='${esc(c.notes)}'
     WHERE id=${c.id}`
  );
}

export async function deleteConsigner(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_consigners WHERE id=${id}`);
}

// ── Consignment Stock ──

export async function getAllConsignmentStock(): Promise<ConsignmentItem[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_consignment_stock ORDER BY date_received DESC'
  );
  return rows as unknown as ConsignmentItem[];
}

export async function getConsignmentByConsigner(consignerId: number): Promise<ConsignmentItem[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_consignment_stock WHERE consigner_id = ${consignerId} ORDER BY date_received DESC`
  );
  return rows as unknown as ConsignmentItem[];
}

export async function getAvailableConsignmentStock(): Promise<ConsignmentItem[]> {
  const rows = await window.tasklet.sqlQuery(
    "SELECT * FROM sylvias_consignment_stock WHERE status IN ('available','partial') AND qty_remaining > 0 ORDER BY description ASC"
  );
  return rows as unknown as ConsignmentItem[];
}

export async function addConsignmentItem(item: Omit<ConsignmentItem, 'id' | 'created_at' | 'qty_sold' | 'qty_remaining'>): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_consignment_stock (consigner_id, consigner_name, description, qty, selling_price, commission_pct, status, date_received, notes, entered_by, qty_sold, qty_remaining)
     VALUES (${item.consigner_id}, '${esc(item.consigner_name)}', '${esc(titleCase(item.description))}', ${item.qty}, ${item.selling_price}, ${item.commission_pct}, '${esc(item.status)}', '${esc(item.date_received)}', '${esc(item.notes)}', '${esc(item.entered_by)}', 0, ${item.qty})`
  );
}

export async function updateConsignmentItem(item: ConsignmentItem): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_consignment_stock SET
      description='${esc(item.description)}',
      qty=${item.qty},
      selling_price=${item.selling_price},
      commission_pct=${item.commission_pct},
      status='${esc(item.status)}',
      notes='${esc(item.notes)}',
      qty_sold=${item.qty_sold},
      qty_remaining=${item.qty_remaining}
     WHERE id=${item.id}`
  );
}

export async function recordConsignmentSale(itemId: number, qtySold: number): Promise<void> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_consignment_stock WHERE id = ${itemId}`
  );
  if (rows.length === 0) return;
  const item = rows[0] as unknown as ConsignmentItem;
  const newSold = item.qty_sold + qtySold;
  const newRemaining = item.qty - newSold;
  const newStatus = newRemaining <= 0 ? 'sold' : 'partial';
  await window.tasklet.sqlExec(
    `UPDATE sylvias_consignment_stock SET qty_sold = ${newSold}, qty_remaining = ${Math.max(0, newRemaining)}, status = '${newStatus}' WHERE id = ${itemId}`
  );
}

export async function deleteConsignmentItem(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_consignment_stock WHERE id=${id}`);
}

export async function searchConsignmentStock(query: string): Promise<ConsignmentItem[]> {
  const q = esc(query);
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_consignment_stock WHERE (description LIKE '%${q}%' OR consigner_name LIKE '%${q}%') AND status IN ('available','partial') AND qty_remaining > 0 ORDER BY description ASC`
  );
  return rows as unknown as ConsignmentItem[];
}

// ── Reservations ──

export async function getAllReservations(): Promise<Reservation[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_reservations ORDER BY reserve_date DESC'
  );
  return rows as unknown as Reservation[];
}

export async function getActiveReservations(): Promise<Reservation[]> {
  const rows = await window.tasklet.sqlQuery(
    "SELECT * FROM sylvias_reservations WHERE status = 'active' ORDER BY expiry_date ASC"
  );
  return rows as unknown as Reservation[];
}

export async function addReservation(r: Omit<Reservation, 'id' | 'created_at'>): Promise<void> {
  const custId = r.customer_id !== null ? String(r.customer_id) : 'NULL';
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_reservations (stock_id, stock_description, stock_part_number, customer_id, customer_name, deposit, total_price, reserve_date, expiry_date, status, notes, reserved_by)
     VALUES (${r.stock_id}, '${esc(r.stock_description)}', '${esc(r.stock_part_number)}', ${custId}, '${esc(r.customer_name)}', ${r.deposit}, ${r.total_price}, '${esc(r.reserve_date)}', '${esc(r.expiry_date)}', '${esc(r.status)}', '${esc(r.notes)}', '${esc(r.reserved_by)}')`
  );
}

export async function updateReservationStatus(id: number, status: string): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_reservations SET status = '${esc(status)}' WHERE id = ${id}`
  );
}

export async function deleteReservation(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_reservations WHERE id=${id}`);
}

// ── Wish List ──

export async function getAllWishListItems(): Promise<WishListItem[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_wishlist ORDER BY created_at DESC'
  );
  return rows as unknown as WishListItem[];
}

export async function getOpenWishListItems(): Promise<WishListItem[]> {
  const rows = await window.tasklet.sqlQuery(
    "SELECT * FROM sylvias_wishlist WHERE status IN ('open','found') ORDER BY created_at DESC"
  );
  return rows as unknown as WishListItem[];
}

export async function addWishListItem(w: Omit<WishListItem, 'id' | 'created_at'>): Promise<void> {
  const custId = w.customer_id !== null ? String(w.customer_id) : 'NULL';
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_wishlist (customer_id, customer_name, description, notes, status, created_by)
     VALUES (${custId}, '${esc(titleCase(w.customer_name))}', '${esc(titleCase(w.description))}', '${esc(w.notes)}', '${esc(w.status)}', '${esc(w.created_by)}')`
  );
}

export async function updateWishListStatus(id: number, status: string): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_wishlist SET status = '${esc(status)}' WHERE id = ${id}`
  );
}

export async function deleteWishListItem(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_wishlist WHERE id=${id}`);
}

// ── Suppliers ──

export const SOURCE_TYPES = [
  'Auction House',
  'House Clearance',
  'Car Boot Sale',
  'Private Sale',
  'Dealer',
  'Online',
  'Donation',
  'Estate Sale',
  'Other',
];

export const STOCK_PAYMENT_METHODS = ['Cash', 'SumUp', 'Bank Transfer', 'PayPal', 'Card', 'Cheque', 'Other'];

export async function addTradeInStockItem(item: {
  description: string;
  category: string;
  qty: number;
  cost: number;
  rrp: number;
  entered_by: string;
  location: string;
  notes: string;
}): Promise<void> {
  const partNumber = await generatePartNumber(item.category);
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_stock (part_number, description, photo, qty, location, cost, rrp, entered_by, category, entry_type)
     VALUES ('${esc(partNumber)}', '${esc(item.description)}', '', ${item.qty}, '${esc(item.location)}', ${item.cost}, ${item.rrp}, '${esc(item.entered_by)}', '${esc(item.category)}', 'trade_in')`
  );
  await learnItemName(item.description);
}

export async function addPurchasedStockItem(item: {
  part_number: string;
  description: string;
  photo: string;
  qty: number;
  location: string;
  cost: number;
  rrp: number;
  entered_by: string;
  category: string;
  supplier_id: number | null;
  source_type: string;
  purchase_date: string;
  purchase_payment_method: string;
  purchased_by: string;
  no_partnumber_initials?: string;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_stock (part_number, description, photo, qty, location, cost, rrp, entered_by, category, supplier_id, source_type, entry_type, purchase_date, purchase_payment_method, purchased_by, no_partnumber_initials)
     VALUES ('${esc(item.part_number)}', '${esc(item.description)}', '${esc(item.photo)}', ${item.qty}, '${esc(item.location)}', ${item.cost}, ${item.rrp}, '${esc(item.entered_by)}', '${esc(item.category)}', ${item.supplier_id || 'NULL'}, '${esc(item.source_type)}', 'purchase', '${esc(item.purchase_date)}', '${esc(item.purchase_payment_method)}', '${esc(item.purchased_by)}', '${esc(item.no_partnumber_initials || '')}')`
  );
  await learnItemName(item.description);
}

export async function getAllSuppliers(): Promise<Supplier[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_suppliers ORDER BY name ASC'
  );
  return rows as unknown as Supplier[];
}

export async function searchSuppliersByPostcode(query: string): Promise<Supplier[]> {
  const q = esc(query);
  const qpc = esc(query.replace(/\s/g, '').toUpperCase());
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_suppliers WHERE name LIKE '%${q}%' OR postcode LIKE '%${q}%' OR REPLACE(UPPER(postcode), ' ', '') LIKE '%${qpc}%' OR contact_name LIKE '%${q}%' ORDER BY name ASC`
  );
  return rows as unknown as Supplier[];
}

export async function addSupplier(s: Omit<Supplier, 'id' | 'created_at'>): Promise<number> {
  const pc = (s.postcode || '').trim().toUpperCase();
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_suppliers (name, source_type, contact_name, phone, email, address, postcode, notes)
     VALUES ('${esc(titleCase(s.name))}', '${esc(s.source_type)}', '${esc(titleCase(s.contact_name))}', '${esc(s.phone)}', '${esc(s.email.toLowerCase())}', '${esc(titleCase(s.address))}', '${esc(pc)}', '${esc(s.notes)}')`
  );
  const rows = await window.tasklet.sqlQuery(
    `SELECT id FROM sylvias_suppliers WHERE name = '${esc(titleCase(s.name))}' ORDER BY id DESC LIMIT 1`
  );
  return (rows[0] as unknown as { id: number }).id;
}

export async function updateSupplier(s: Supplier): Promise<void> {
  const pc = (s.postcode || '').trim().toUpperCase();
  await window.tasklet.sqlExec(
    `UPDATE sylvias_suppliers SET
      name='${esc(titleCase(s.name))}',
      source_type='${esc(s.source_type)}',
      contact_name='${esc(titleCase(s.contact_name))}',
      phone='${esc(s.phone)}',
      email='${esc(s.email.toLowerCase())}',
      address='${esc(titleCase(s.address))}',
      postcode='${esc(pc)}',
      notes='${esc(s.notes)}'
     WHERE id=${s.id}`
  );
}

export async function deleteSupplier(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_suppliers WHERE id=${id}`);
}

export async function getStockBySupplier(supplierId: number): Promise<StockItem[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_stock WHERE supplier_id = ${supplierId} ORDER BY description ASC`
  );
  return rows as unknown as StockItem[];
}

// ── Profit Margin queries ──

export async function getProfitByCategory(): Promise<{category: string; revenue: number; cost: number; profit: number; margin: number; count: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT s.category,
            COALESCE(SUM(si.line_total), 0) as revenue,
            COALESCE(SUM(si.qty * s.cost), 0) as cost,
            COALESCE(SUM(si.line_total - (si.qty * s.cost)), 0) as profit,
            COUNT(DISTINCT sa.id) as count
     FROM sylvias_sale_items si
     JOIN sylvias_stock s ON si.stock_id = s.id
     JOIN sylvias_sales sa ON si.sale_id = sa.id
     GROUP BY s.category ORDER BY profit DESC`
  );
  return (rows as unknown as any[]).map(r => ({
    category: r.category,
    revenue: r.revenue,
    cost: r.cost,
    profit: r.profit,
    margin: r.revenue > 0 ? ((r.profit / r.revenue) * 100) : 0,
    count: r.count,
  }));
}

export async function getTopSellingItems(limit: number = 10): Promise<{description: string; part_number: string; total_sold: number; revenue: number; cost: number; profit: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT si.description, si.part_number,
            SUM(si.qty) as total_sold,
            SUM(si.line_total) as revenue,
            COALESCE(SUM(si.qty * s.cost), 0) as cost,
            COALESCE(SUM(si.line_total - (si.qty * s.cost)), 0) as profit
     FROM sylvias_sale_items si
     LEFT JOIN sylvias_stock s ON si.stock_id = s.id
     GROUP BY si.stock_id ORDER BY revenue DESC LIMIT ${limit}`
  );
  return rows as unknown as any[];
}

export async function getSlowestStock(limit: number = 10): Promise<StockItem[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_stock WHERE qty > 0 ORDER BY created_at ASC LIMIT ${limit}`
  );
  return rows as unknown as StockItem[];
}

// ── Consignment Sales Reporting ──

export interface SalesSplit {
  stockSalesTotal: number;
  stockSalesCount: number;
  consignmentSalesTotal: number;
  consignmentSalesCount: number;
  consignmentCommission: number; // Your profit from consignment (the commission %)
  consignmentOwed: number; // Amount owed to consigners
}

export async function getSalesSplitByDateRange(from: string, to: string): Promise<SalesSplit> {
  // Stock sales: sale items where is_consignment = 0
  const stockRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(si.line_total), 0) as total, COUNT(DISTINCT sa.id) as cnt
     FROM sylvias_sale_items si
     JOIN sylvias_sales sa ON si.sale_id = sa.id
     WHERE si.is_consignment = 0 AND date(sa.sale_date) >= '${esc(from)}' AND date(sa.sale_date) <= '${esc(to)}'`
  );
  const st = stockRows[0] as unknown as { total: number; cnt: number };

  // Consignment sales: sale items where is_consignment = 1
  const conRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(si.line_total), 0) as total, COUNT(DISTINCT sa.id) as cnt
     FROM sylvias_sale_items si
     JOIN sylvias_sales sa ON si.sale_id = sa.id
     WHERE si.is_consignment = 1 AND date(sa.sale_date) >= '${esc(from)}' AND date(sa.sale_date) <= '${esc(to)}'`
  );
  const ct = conRows[0] as unknown as { total: number; cnt: number };

  // Commission earned from consignment sales
  const commRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(si.line_total * cs.commission_pct / 100.0), 0) as commission
     FROM sylvias_sale_items si
     JOIN sylvias_sales sa ON si.sale_id = sa.id
     LEFT JOIN sylvias_consignment_stock cs ON si.consignment_item_id = cs.id
     WHERE si.is_consignment = 1 AND date(sa.sale_date) >= '${esc(from)}' AND date(sa.sale_date) <= '${esc(to)}'`
  );
  const commission = (commRows[0] as unknown as { commission: number }).commission;

  // Sale-level discounts reduce stock sales (shop eats the discount, not consigners)
  const discRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(discount), 0) as total_discount
     FROM sylvias_sales
     WHERE date(sale_date) >= '${esc(from)}' AND date(sale_date) <= '${esc(to)}' AND discount > 0`
  );
  const totalDiscount = (discRows[0] as unknown as { total_discount: number }).total_discount;

  return {
    stockSalesTotal: st.total - totalDiscount,
    stockSalesCount: st.cnt,
    consignmentSalesTotal: ct.total,
    consignmentSalesCount: ct.cnt,
    consignmentCommission: commission,
    consignmentOwed: ct.total - commission,
  };
}

export async function getSalesSplitForDate(date: string): Promise<SalesSplit> {
  return getSalesSplitByDateRange(date, date);
}

// Get profit by category excluding consignment items (owned stock only)
export async function getOwnedStockProfitByCategory(): Promise<{category: string; revenue: number; cost: number; profit: number; margin: number; count: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT s.category,
            COALESCE(SUM(si.line_total), 0) as revenue,
            COALESCE(SUM(si.qty * s.cost), 0) as cost,
            COALESCE(SUM(si.line_total - (si.qty * s.cost)), 0) as profit,
            COUNT(DISTINCT sa.id) as count
     FROM sylvias_sale_items si
     JOIN sylvias_stock s ON si.stock_id = s.id
     JOIN sylvias_sales sa ON si.sale_id = sa.id
     WHERE si.is_consignment = 0
     GROUP BY s.category ORDER BY profit DESC`
  );
  return (rows as unknown as any[]).map(r => ({
    category: r.category,
    revenue: r.revenue,
    cost: r.cost,
    profit: r.profit,
    margin: r.revenue > 0 ? ((r.profit / r.revenue) * 100) : 0,
    count: r.count,
  }));
}

// Consignment profit summary (commission earned by consigner)
export async function getConsignmentProfitSummary(): Promise<{consigner_name: string; total_sold: number; commission_earned: number; owed_to_consigner: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT cs.consigner_name,
            COALESCE(SUM(si.line_total), 0) as total_sold,
            COALESCE(SUM(si.line_total * cs.commission_pct / 100.0), 0) as commission_earned,
            COALESCE(SUM(si.line_total * (100 - cs.commission_pct) / 100.0), 0) as owed_to_consigner
     FROM sylvias_sale_items si
     JOIN sylvias_consignment_stock cs ON si.consignment_item_id = cs.id
     WHERE si.is_consignment = 1
     GROUP BY cs.consigner_name ORDER BY total_sold DESC`
  );
  return rows as unknown as any[];
}

// COGS for owned stock only (excludes consignment)
export async function getOwnedStockCOGS(): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(si.qty * s.cost), 0) as cogs
     FROM sylvias_sale_items si
     JOIN sylvias_stock s ON si.stock_id = s.id
     WHERE si.is_consignment = 0`
  );
  return (rows[0] as unknown as { cogs: number }).cogs;
}

export async function getOwnedStockCOGSByRange(from: string, to: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(si.qty * s.cost), 0) as cogs
     FROM sylvias_sale_items si
     JOIN sylvias_stock s ON si.stock_id = s.id
     JOIN sylvias_sales sa ON si.sale_id = sa.id
     WHERE si.is_consignment = 0 AND date(sa.sale_date) >= '${esc(from)}' AND date(sa.sale_date) <= '${esc(to)}'`
  );
  return (rows[0] as unknown as { cogs: number }).cogs;
}

// Check if a specific sale has consignment items
export async function getSaleConsignmentSplit(saleId: number): Promise<{stockTotal: number; consignmentTotal: number; commission: number}> {
  const stockRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(line_total), 0) as total FROM sylvias_sale_items WHERE sale_id = ${saleId} AND is_consignment = 0`
  );
  const conRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(si.line_total), 0) as total,
            COALESCE(SUM(si.line_total * cs.commission_pct / 100.0), 0) as commission
     FROM sylvias_sale_items si
     LEFT JOIN sylvias_consignment_stock cs ON si.consignment_item_id = cs.id
     WHERE si.sale_id = ${saleId} AND si.is_consignment = 1`
  );
  return {
    stockTotal: (stockRows[0] as unknown as { total: number }).total,
    consignmentTotal: (conRows[0] as unknown as { total: number }).total,
    commission: (conRows[0] as unknown as { commission: number }).commission,
  };
}

// ── Daily Summary ──

export async function getDailySummary(date: string): Promise<{
  salesCount: number; salesTotal: number; cashTotal: number; cardTotal: number; ebayTotal: number;
  expensesTotal: number; expensesCount: number; floatOpening: number; floatClosing: number;
  stockSalesTotal: number; consignmentSalesTotal: number; consignmentCommission: number; consignmentOwed: number;
}> {
  const salesRows = await window.tasklet.sqlQuery(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(total - discount), 0) as total FROM sylvias_sales WHERE date(sale_date) = '${esc(date)}'`
  );
  const s = salesRows[0] as unknown as {cnt: number; total: number};

  // Use sylvias_payments for actual money received (not invoice totals)
  const cashRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' AND payment_method = 'cash'`
  );
  const cardRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' AND payment_method = 'sumup'`
  );
  const ebayRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' AND payment_method = 'ebay'`
  );
  const expRows = await window.tasklet.sqlQuery(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total FROM sylvias_expenses WHERE expense_date = '${esc(date)}'`
  );
  const e = expRows[0] as unknown as {cnt: number; total: number};

  const floatRec = await getFloatByDate(date);
  const split = await getSalesSplitForDate(date);

  return {
    salesCount: s.cnt,
    salesTotal: s.total,
    cashTotal: (cashRows[0] as unknown as {total: number}).total,
    cardTotal: (cardRows[0] as unknown as {total: number}).total,
    ebayTotal: (ebayRows[0] as unknown as {total: number}).total,
    expensesTotal: e.total,
    expensesCount: e.cnt,
    floatOpening: floatRec?.opening_amount || 0,
    floatClosing: floatRec?.closing_amount || 0,
    stockSalesTotal: split.stockSalesTotal,
    consignmentSalesTotal: split.consignmentSalesTotal,
    consignmentCommission: split.consignmentCommission,
    consignmentOwed: split.consignmentOwed,
  };
}

// ── Bullion ──

export async function getBullion(statusFilter: string = 'all'): Promise<BullionItem[]> {
  const where = statusFilter === 'all' ? '' : `WHERE status = '${esc(statusFilter)}'`;
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_bullion ${where} ORDER BY purchase_date DESC`);
  return rows as unknown as BullionItem[];
}

export async function addBullion(b: Omit<BullionItem, 'id' | 'created_at'> & { purchase_payment_method?: string }): Promise<number> {
  const ppm = b.purchase_payment_method || '';
  const status = b.status || 'held';
  const buyerName = b.buyer_name || '';
  const custId = b.customer_id ?? null;
  const payMethod = b.payment_method || '';
  await window.tasklet.sqlExec(`INSERT INTO sylvias_bullion (metal_type, form, description, weight, weight_unit, purity, purchase_date, purchase_price, premium_paid, dealer_name, sell_date, sale_price, status, notes, entered_by, purchase_payment_method, buyer_name, customer_id, payment_method)
    VALUES ('${esc(b.metal_type)}', '${esc(b.form)}', '${esc(b.description)}', ${b.weight}, '${esc(b.weight_unit)}', '${esc(b.purity)}', '${esc(b.purchase_date)}', ${b.purchase_price}, ${b.premium_paid}, '${esc(b.dealer_name)}', '', 0, '${esc(status)}', '${esc(b.notes)}', '${esc(b.entered_by)}', '${esc(ppm)}', '${esc(buyerName)}', ${custId === null ? 'NULL' : custId}, '${esc(payMethod)}')`);
  const rows = await window.tasklet.sqlQuery(`SELECT id FROM sylvias_bullion ORDER BY id DESC LIMIT 1`);
  return (rows[0] as any).id;
}

export async function updateBullion(id: number, b: Partial<BullionItem>): Promise<void> {
  const sets: string[] = [];
  if (b.metal_type !== undefined) sets.push(`metal_type = '${esc(b.metal_type)}'`);
  if (b.form !== undefined) sets.push(`form = '${esc(b.form)}'`);
  if (b.description !== undefined) sets.push(`description = '${esc(b.description)}'`);
  if (b.weight !== undefined) sets.push(`weight = ${b.weight}`);
  if (b.weight_unit !== undefined) sets.push(`weight_unit = '${esc(b.weight_unit)}'`);
  if (b.purity !== undefined) sets.push(`purity = '${esc(b.purity)}'`);
  if (b.purchase_date !== undefined) sets.push(`purchase_date = '${esc(b.purchase_date)}'`);
  if (b.purchase_price !== undefined) sets.push(`purchase_price = ${b.purchase_price}`);
  if (b.premium_paid !== undefined) sets.push(`premium_paid = ${b.premium_paid}`);
  if (b.dealer_name !== undefined) sets.push(`dealer_name = '${esc(b.dealer_name)}'`);
  if (b.sell_date !== undefined) sets.push(`sell_date = '${esc(b.sell_date)}'`);
  if (b.sale_price !== undefined) sets.push(`sale_price = ${b.sale_price}`);
  if (b.status !== undefined) sets.push(`status = '${esc(b.status)}'`);
  if (b.notes !== undefined) sets.push(`notes = '${esc(b.notes)}'`);
  if (sets.length > 0) await window.tasklet.sqlExec(`UPDATE sylvias_bullion SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function sellBullion(id: number, sellDate: string, salePrice: number, paymentMethod: string = '', buyerName: string = '', customerId: number | null = null, soldBy: string = ''): Promise<number> {
  // Update the bullion record
  await window.tasklet.sqlExec(`UPDATE sylvias_bullion SET status = 'sold', sell_date = '${esc(sellDate)}', sale_price = ${salePrice}, payment_method = '${esc(paymentMethod)}', buyer_name = '${esc(buyerName)}', customer_id = ${customerId ?? 'NULL'} WHERE id = ${id}`);
  
  // Get bullion description for the sale
  const bRows = await window.tasklet.sqlQuery(`SELECT description, metal_type, form FROM sylvias_bullion WHERE id = ${id}`);
  const bInfo = bRows[0] as any;
  const desc = `Bullion: ${bInfo.description} (${bInfo.metal_type} ${bInfo.form})`;
  
  // Create a proper sale record
  const invoiceNumber = await generateInvoiceNumber();
  const pmLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'bank_transfer' ? 'Bank Transfer' : paymentMethod === 'sumup' ? 'SumUp' : paymentMethod === 'paypal' ? 'PayPal' : paymentMethod === 'crypto' ? 'Crypto' : 'Other';
  const saleId = await createSale({
    customer_name: buyerName || 'Walk-in Customer',
    customer_id: customerId,
    payment_method: paymentMethod,
    total: salePrice,
    sold_by: soldBy,
    invoice_number: invoiceNumber,
    notes: `Bullion sale - ${desc}`,
    amount_paid: salePrice,
    balance_due: 0,
    status: 'paid',
  });
  
  // Create sale item
  await addSaleItem({
    sale_id: saleId,
    stock_id: 0,
    part_number: `BUL-${String(id).padStart(4, '0')}`,
    description: desc,
    qty: 1,
    unit_price: salePrice,
    line_total: salePrice,
  });
  
  // Record payment in sylvias_payments (single source of truth for CashUp)
  await addPayment({
    sale_id: saleId,
    payment_date: sellDate,
    amount: salePrice,
    payment_method: paymentMethod,
    notes: `Bullion sale: ${bInfo.description}`,
    entered_by: soldBy,
  });
  
  return saleId;
}

export async function deleteBullion(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_bullion WHERE id = ${id}`);
}

export async function getBullionSummary(): Promise<{
  heldCount: number; heldCost: number;
  soldCount: number; soldRevenue: number; soldCost: number; soldProfit: number;
  byMetal: Array<{metal_type: string; count: number; total_weight: number; total_cost: number}>;
}> {
  const held = await window.tasklet.sqlQuery(`SELECT COUNT(*) as cnt, COALESCE(SUM(purchase_price + premium_paid), 0) as cost FROM sylvias_bullion WHERE status = 'held'`);
  const sold = await window.tasklet.sqlQuery(`SELECT COUNT(*) as cnt, COALESCE(SUM(sale_price), 0) as revenue, COALESCE(SUM(purchase_price + premium_paid), 0) as cost FROM sylvias_bullion WHERE status = 'sold'`);
  const byMetal = await window.tasklet.sqlQuery(`SELECT metal_type, COUNT(*) as count, COALESCE(SUM(weight), 0) as total_weight, COALESCE(SUM(purchase_price + premium_paid), 0) as total_cost FROM sylvias_bullion WHERE status = 'held' GROUP BY metal_type ORDER BY total_cost DESC`);
  const h = held[0] as any;
  const s = sold[0] as any;
  return {
    heldCount: h.cnt, heldCost: h.cost,
    soldCount: s.cnt, soldRevenue: s.revenue, soldCost: s.cost, soldProfit: s.revenue - s.cost,
    byMetal: byMetal as any[],
  };
}

// ── Admin / Settings ──

export async function getSetting(key: string): Promise<string> {
  const rows = await window.tasklet.sqlQuery(`SELECT value FROM sylvias_settings WHERE key = '${esc(key)}'`);
  if (rows.length === 0) return '';
  return (rows[0] as any).value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await window.tasklet.sqlExec(`INSERT OR REPLACE INTO sylvias_settings (key, value) VALUES ('${esc(key)}', '${esc(value)}')`);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await window.tasklet.sqlQuery(`SELECT key, value FROM sylvias_settings ORDER BY key`);
  const result: Record<string, string> = {};
  for (const r of rows as any[]) { result[r.key] = r.value; }
  return result;
}

export interface BankAccount {
  id: number;
  account_name: string;
  bank_name: string;
  sort_code: string;
  account_number: string;
  opening_balance: number;
  notes: string;
  created_at: string;
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_bank_accounts ORDER BY account_name ASC`);
  return rows as unknown as BankAccount[];
}

export async function addBankAccount(acct: Omit<BankAccount, 'id' | 'created_at'>): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_bank_accounts (account_name, bank_name, sort_code, account_number, opening_balance, notes)
     VALUES ('${esc(acct.account_name)}', '${esc(acct.bank_name)}', '${esc(acct.sort_code)}', '${esc(acct.account_number)}', ${acct.opening_balance}, '${esc(acct.notes)}')`
  );
}

export async function updateBankAccount(id: number, acct: Omit<BankAccount, 'id' | 'created_at'>): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_bank_accounts SET account_name='${esc(acct.account_name)}', bank_name='${esc(acct.bank_name)}', sort_code='${esc(acct.sort_code)}', account_number='${esc(acct.account_number)}', opening_balance=${acct.opening_balance}, notes='${esc(acct.notes)}' WHERE id=${id}`
  );
}

export async function deleteBankAccount(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_bank_accounts WHERE id=${id}`);
}

// ── Test Data Reset ──

export async function clearTableData(tableName: string): Promise<{ deleted: number }> {
  const validTables = [
    'sylvias_stock', 'sylvias_sales', 'sylvias_sale_items', 'sylvias_customers',
    'sylvias_expenses', 'sylvias_float', 'sylvias_consignees', 'sylvias_consignment_items',
    'sylvias_reservations', 'sylvias_wishlist', 'sylvias_suppliers', 'sylvias_bullion',
    'sylvias_learned_items', 'sylvias_bank_transactions', 'sylvias_settings',
    'sylvias_payments', 'sylvias_refunds', 'sylvias_credit_notes', 'sylvias_eod_cashup',
    'sylvias_gift_vouchers', 'sylvias_scan_staging',
    'sylvias_supplier_invoices', 'sylvias_supplier_invoice_payments',
  ];
  if (!validTables.includes(tableName)) throw new Error('Invalid table name');
  // Single call — just delete (rowsAffected tells us how many)
  const result = await window.tasklet.sqlExec(`DELETE FROM ${tableName}`);
  return { deleted: (result as any)?.rowsAffected ?? 0 };
}

export async function clearAllTestData(): Promise<Record<string, number>> {
  // Delete in dependency order — child tables first
  const tables = [
    'sylvias_sale_items', 'sylvias_supplier_invoice_payments', 'sylvias_payments',
    'sylvias_sales', 'sylvias_stock', 'sylvias_customers',
    'sylvias_expenses', 'sylvias_float', 'sylvias_consignees', 'sylvias_consignment_items',
    'sylvias_reservations', 'sylvias_wishlist', 'sylvias_suppliers', 'sylvias_bullion',
    'sylvias_learned_items', 'sylvias_supplier_invoices',
    'sylvias_refunds', 'sylvias_credit_notes', 'sylvias_gift_vouchers',
    'sylvias_scan_staging', 'sylvias_eod_cashup',
    'sylvias_bank_transactions',
  ];
  const results: Record<string, number> = {};
  // Sequential deletes to avoid version conflicts
  for (const t of tables) {
    const r = await clearTableData(t);
    results[t] = r.deleted;
  }
  return results;
}

export async function getTableCounts(): Promise<Record<string, number>> {
  const tables = [
    'sylvias_stock', 'sylvias_sales', 'sylvias_sale_items', 'sylvias_customers',
    'sylvias_expenses', 'sylvias_float', 'sylvias_consignees', 'sylvias_consignment_items',
    'sylvias_reservations', 'sylvias_wishlist', 'sylvias_suppliers', 'sylvias_bullion',
    'sylvias_learned_items', 'sylvias_staff',
    'sylvias_payments', 'sylvias_refunds', 'sylvias_credit_notes', 'sylvias_bank_transactions',
    'sylvias_eod_cashup', 'sylvias_scan_staging',
    'sylvias_supplier_invoices', 'sylvias_supplier_invoice_payments',
    'sylvias_gift_vouchers', 'sylvias_settings',
    'sylvias_email_recipients', 'sylvias_sent_emails',
  ];
  // Query only tables that actually exist to avoid crashes
  const existing = await window.tasklet.sqlQuery(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sylvias_%'"
  );
  const existingSet = new Set((existing as any[]).map(r => r.name));
  const validTables = tables.filter(t => existingSet.has(t));
  if (validTables.length === 0) return {};
  const unionSql = validTables.map(t => `SELECT '${t}' as tbl, COUNT(*) as cnt FROM ${t}`).join(' UNION ALL ');
  const rows = await window.tasklet.sqlQuery(unionSql);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[(row as any).tbl] = (row as any).cnt;
  }
  return counts;
}

// ══════════════════════════════════════════════
// Phase 10: Bookkeeping Functions
// ══════════════════════════════════════════════

// ── Payments against invoices ──

export async function getPaymentsForSale(saleId: number): Promise<Payment[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_payments WHERE sale_id = ${saleId} ORDER BY payment_date ASC`
  );
  return rows as unknown as Payment[];
}

export async function addPayment(p: { sale_id: number; payment_date: string; amount: number; payment_method: string; notes: string; entered_by: string }): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_payments (sale_id, payment_date, amount, payment_method, notes, entered_by)
     VALUES (${p.sale_id}, '${esc(p.payment_date)}', ${p.amount}, '${esc(p.payment_method)}', '${esc(p.notes)}', '${esc(p.entered_by)}')`
  );
  // Update the sale's amount_paid and balance_due
  const paymentRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total_paid FROM sylvias_payments WHERE sale_id = ${p.sale_id}`
  );
  const totalPaid = (paymentRows[0] as any).total_paid;
  const saleRows = await window.tasklet.sqlQuery(`SELECT total, discount FROM sylvias_sales WHERE id = ${p.sale_id}`);
  const saleTotal = (saleRows[0] as any).total;
  const saleDiscount = (saleRows[0] as any).discount || 0;
  const balanceDue = Math.max(0, saleTotal - saleDiscount - totalPaid);
  const status = balanceDue <= 0 ? 'paid' : 'partial';
  await window.tasklet.sqlExec(
    `UPDATE sylvias_sales SET amount_paid = ${totalPaid}, balance_due = ${balanceDue}, status = '${status}' WHERE id = ${p.sale_id}`
  );
}

export async function getOutstandingInvoices(): Promise<Sale[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_sales WHERE status IN ('unpaid', 'partial') ORDER BY due_date ASC, sale_date ASC`
  );
  return rows as unknown as Sale[];
}

export async function getOverdueInvoices(): Promise<Sale[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_sales WHERE status IN ('unpaid', 'partial') AND due_date != '' AND due_date < date('now') ORDER BY due_date ASC`
  );
  return rows as unknown as Sale[];
}

export async function updateSaleStatus(saleId: number, status: string): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_sales SET status = '${esc(status)}' WHERE id = ${saleId}`
  );
}

export async function updateSalePayment(saleId: number, amountPaid: number, balanceDue: number, status: string): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_sales SET amount_paid = ${amountPaid}, balance_due = ${balanceDue}, status = '${esc(status)}' WHERE id = ${saleId}`
  );
}

// ── Refunds ──

export async function getAllRefunds(): Promise<Refund[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_refunds ORDER BY refund_date DESC, id DESC'
  );
  return rows as unknown as Refund[];
}

export async function getRefundsBySale(saleId: number): Promise<Refund[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_refunds WHERE sale_id = ${saleId} ORDER BY refund_date DESC`
  );
  return rows as unknown as Refund[];
}

export async function addRefund(r: {
  sale_id: number; invoice_number: string; refund_date: string; amount: number;
  refund_method: string; reason: string; items_restocked: number; entered_by: string;
  credit_note_number?: string;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_refunds (sale_id, invoice_number, refund_date, amount, refund_method, reason, items_restocked, entered_by, credit_note_number)
     VALUES (${r.sale_id}, '${esc(r.invoice_number)}', '${esc(r.refund_date)}', ${r.amount}, '${esc(r.refund_method)}', '${esc(r.reason)}', ${r.items_restocked}, '${esc(r.entered_by)}', '${esc(r.credit_note_number || '')}')`
  );
  // Update sale status
  const totalRefunded = await getTotalRefundedForSale(r.sale_id);
  const saleRows = await window.tasklet.sqlQuery(`SELECT total FROM sylvias_sales WHERE id = ${r.sale_id}`);
  const saleTotal = (saleRows[0] as any).total;
  if (totalRefunded >= saleTotal) {
    await updateSaleStatus(r.sale_id, 'refunded');
  }
}

export async function getTotalRefundedForSale(saleId: number): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_refunds WHERE sale_id = ${saleId}`
  );
  return (rows[0] as any).total;
}

export async function getRefundsByDateRange(from: string, to: string): Promise<Refund[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_refunds WHERE refund_date >= '${esc(from)}' AND refund_date <= '${esc(to)}' ORDER BY refund_date DESC`
  );
  return rows as unknown as Refund[];
}

export async function getRefundsTotalByRange(from: string, to: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_refunds WHERE refund_date >= '${esc(from)}' AND refund_date <= '${esc(to)}'`
  );
  return (rows[0] as any).total;
}

// ── Credit Notes ──

export async function generateCreditNoteNumber(): Promise<string> {
  const rows = await window.tasklet.sqlQuery(`SELECT COUNT(*) as cnt FROM sylvias_credit_notes`);
  const count = (rows[0] as any).cnt;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `CN-${yy}${mm}-${String(count + 1).padStart(4, '0')}`;
}

export async function getAllCreditNotes(): Promise<CreditNote[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_credit_notes ORDER BY date_issued DESC, id DESC'
  );
  return rows as unknown as CreditNote[];
}

export async function getActiveCreditNotes(): Promise<CreditNote[]> {
  const rows = await window.tasklet.sqlQuery(
    "SELECT * FROM sylvias_credit_notes WHERE status = 'active' AND balance > 0 ORDER BY date_issued DESC"
  );
  return rows as unknown as CreditNote[];
}

export async function getCreditNotesByCustomer(customerId: number): Promise<CreditNote[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_credit_notes WHERE customer_id = ${customerId} ORDER BY date_issued DESC`
  );
  return rows as unknown as CreditNote[];
}

export async function addCreditNote(cn: {
  customer_id: number | null; customer_name: string; credit_note_number: string;
  date_issued: string; original_invoice: string; amount: number; reason: string; entered_by: string;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_credit_notes (customer_id, customer_name, credit_note_number, date_issued, original_invoice, amount, amount_used, balance, reason, status, entered_by)
     VALUES (${cn.customer_id ?? 'NULL'}, '${esc(cn.customer_name)}', '${esc(cn.credit_note_number)}', '${esc(cn.date_issued)}', '${esc(cn.original_invoice)}', ${cn.amount}, 0, ${cn.amount}, '${esc(cn.reason)}', 'active', '${esc(cn.entered_by)}')`
  );
}

export async function useCreditNote(id: number, amountToUse: number): Promise<void> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_credit_notes WHERE id = ${id}`);
  if (rows.length === 0) return;
  const cn = rows[0] as any;
  const newUsed = cn.amount_used + amountToUse;
  const newBalance = Math.max(0, cn.amount - newUsed);
  const newStatus = newBalance <= 0 ? 'used' : 'active';
  await window.tasklet.sqlExec(
    `UPDATE sylvias_credit_notes SET amount_used = ${newUsed}, balance = ${newBalance}, status = '${newStatus}' WHERE id = ${id}`
  );
}

export async function cancelCreditNote(id: number): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_credit_notes SET status = 'cancelled' WHERE id = ${id}`
  );
}

export async function getCreditNoteByNumber(cnNumber: string): Promise<CreditNote | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_credit_notes WHERE credit_note_number = '${esc(cnNumber)}' LIMIT 1`
  );
  return rows.length > 0 ? (rows[0] as unknown as CreditNote) : null;
}

// ── Bank Transactions ──

export async function getBankTransactions(bankAccountId?: number, from?: string, to?: string): Promise<BankTransaction[]> {
  let where = 'WHERE 1=1';
  if (bankAccountId) where += ` AND bank_account_id = ${bankAccountId}`;
  if (from) where += ` AND transaction_date >= '${esc(from)}'`;
  if (to) where += ` AND transaction_date <= '${esc(to)}'`;
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_bank_transactions ${where} ORDER BY transaction_date DESC, id DESC`
  );
  return rows as unknown as BankTransaction[];
}

export async function addBankTransaction(t: {
  bank_account_id: number; transaction_date: string; description: string; amount: number;
  reference: string; category: string; linked_sale_id?: number | null; linked_expense_id?: number | null;
  entered_by: string;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_bank_transactions (bank_account_id, transaction_date, description, amount, reference, category, linked_sale_id, linked_expense_id, entered_by)
     VALUES (${t.bank_account_id}, '${esc(t.transaction_date)}', '${esc(t.description)}', ${t.amount}, '${esc(t.reference)}', '${esc(t.category)}', ${t.linked_sale_id ?? 'NULL'}, ${t.linked_expense_id ?? 'NULL'}, '${esc(t.entered_by)}')`
  );
}

export async function updateBankTransaction(id: number, t: Partial<BankTransaction>): Promise<void> {
  const sets: string[] = [];
  if (t.transaction_date !== undefined) sets.push(`transaction_date = '${esc(t.transaction_date)}'`);
  if (t.description !== undefined) sets.push(`description = '${esc(t.description)}'`);
  if (t.amount !== undefined) sets.push(`amount = ${t.amount}`);
  if (t.reference !== undefined) sets.push(`reference = '${esc(t.reference)}'`);
  if (t.category !== undefined) sets.push(`category = '${esc(t.category)}'`);
  if (t.reconciled !== undefined) sets.push(`reconciled = ${t.reconciled}`);
  if (t.linked_sale_id !== undefined) sets.push(`linked_sale_id = ${t.linked_sale_id ?? 'NULL'}`);
  if (t.linked_expense_id !== undefined) sets.push(`linked_expense_id = ${t.linked_expense_id ?? 'NULL'}`);
  if (sets.length > 0) await window.tasklet.sqlExec(`UPDATE sylvias_bank_transactions SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function deleteBankTransaction(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_bank_transactions WHERE id=${id}`);
}

export async function toggleReconciled(id: number): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_bank_transactions SET reconciled = CASE WHEN reconciled = 0 THEN 1 ELSE 0 END WHERE id = ${id}`
  );
}

export async function getBankAccountBalance(bankAccountId: number): Promise<number> {
  const acctRows = await window.tasklet.sqlQuery(`SELECT opening_balance FROM sylvias_bank_accounts WHERE id = ${bankAccountId}`);
  const opening = acctRows.length > 0 ? (acctRows[0] as any).opening_balance : 0;
  const txRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_bank_transactions WHERE bank_account_id = ${bankAccountId}`
  );
  return opening + (txRows[0] as any).total;
}

export async function getUnreconciledTransactions(bankAccountId?: number): Promise<BankTransaction[]> {
  let where = 'WHERE reconciled = 0';
  if (bankAccountId) where += ` AND bank_account_id = ${bankAccountId}`;
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_bank_transactions ${where} ORDER BY transaction_date DESC`
  );
  return rows as unknown as BankTransaction[];
}

// ── Cash-Up / End of Day ──

export async function getCashSalesForDate(date: string): Promise<number> {
  // Use sylvias_payments as single source of truth for actual money received
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' AND payment_method = 'cash'`
  );
  return (rows[0] as any).total;
}

export async function getCardSalesForDate(date: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' AND payment_method = 'sumup'`
  );
  return (rows[0] as any).total;
}

export async function getBankTransferSalesForDate(date: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' AND payment_method = 'bank_transfer'`
  );
  return (rows[0] as any).total;
}

export async function getCashRefundsForDate(date: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_refunds WHERE refund_date = '${esc(date)}' AND refund_method = 'cash'`
  );
  return (rows[0] as any).total;
}

export async function getEbaySalesForDate(date: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' AND payment_method = 'ebay'`
  );
  return (rows[0] as unknown as { total: number }).total;
}

export async function getCashExpensesForDate(date: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_expenses WHERE expense_date = '${esc(date)}'`
  );
  return (rows[0] as any).total;
}

export async function getTradeInSalesForDate(date: string): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' AND payment_method = 'trade_in'`
  );
  return (rows[0] as any).total;
}

export async function getAllSalesByMethodForDate(date: string): Promise<Record<string, number>> {
  // Use sylvias_payments as single source of truth for actual money received
  // This includes point-of-sale payments AND later balance payments — all by payment_date
  const rows = await window.tasklet.sqlQuery(
    `SELECT payment_method, COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' GROUP BY payment_method`
  );
  const result: Record<string, number> = {};
  (rows || []).forEach((r: any) => { result[r.payment_method || 'cash'] = Number(r.total) || 0; });
  return result;
}

export async function getAllExpensesByMethodForDate(date: string): Promise<Record<string, number>> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT payment_method, COALESCE(SUM(amount), 0) as total FROM sylvias_expenses WHERE expense_date = '${esc(date)}' GROUP BY payment_method`
  );
  const result: Record<string, number> = {};
  (rows || []).forEach((r: any) => { result[r.payment_method || 'cash'] = Number(r.total) || 0; });
  return result;
}

export async function getAllRefundsByMethodForDate(date: string): Promise<Record<string, number>> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(refund_method, 'cash') as method, COALESCE(SUM(amount), 0) as total FROM sylvias_refunds WHERE refund_date = '${esc(date)}' GROUP BY refund_method`
  );
  const result: Record<string, number> = {};
  (rows || []).forEach((r: any) => { result[r.method || 'cash'] = Number(r.total) || 0; });
  return result;
}

// ── Discount totals ──

export async function getDiscountTotalForDate(date: string): Promise<{ totalDiscount: number; discountCount: number }> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(discount), 0) as total_discount, COUNT(*) as discount_count FROM sylvias_sales WHERE date(sale_date) = '${esc(date)}' AND discount > 0`
  );
  const r = (rows || [])[0] as any;
  return { totalDiscount: Number(r?.total_discount) || 0, discountCount: Number(r?.discount_count) || 0 };
}

export async function getDiscountTotalForRange(from: string, to: string): Promise<{ totalDiscount: number; discountCount: number }> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(discount), 0) as total_discount, COUNT(*) as discount_count FROM sylvias_sales WHERE date(sale_date) >= date('${esc(from)}') AND date(sale_date) <= date('${esc(to)}') AND discount > 0`
  );
  const r = (rows || [])[0] as any;
  return { totalDiscount: Number(r?.total_discount) || 0, discountCount: Number(r?.discount_count) || 0 };
}

// ── Invoice balance payments (from sylvias_payments) ──

export async function getInvoicePaymentsByMethodForDate(date: string): Promise<Record<string, number>> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT payment_method, COALESCE(SUM(amount), 0) as total FROM sylvias_payments WHERE date(payment_date) = '${esc(date)}' GROUP BY payment_method`
  );
  const result: Record<string, number> = {};
  (rows || []).forEach((r: any) => { result[r.payment_method || 'cash'] = Number(r.total) || 0; });
  return result;
}

export async function getInvoicePaymentsByMethodForRange(from: string, to: string): Promise<{byMethod: Record<string, {total: number; count: number}>; grand: number}> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT payment_method as method, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM sylvias_payments WHERE date(payment_date) >= date('${esc(from)}') AND date(payment_date) <= date('${esc(to)}') GROUP BY payment_method`
  );
  const byMethod: Record<string, {total: number; count: number}> = {};
  let grand = 0;
  (rows || []).forEach((r: any) => {
    const m = r.method || 'cash';
    const t = Number(r.total) || 0;
    byMethod[m] = { total: t, count: Number(r.count) || 0 };
    grand += t;
  });
  return { byMethod, grand };
}

// ── Supplier Invoices (Accounts Payable) ──

export async function getAllSupplierInvoices(statusFilter?: string): Promise<SupplierInvoice[]> {
  const where = statusFilter && statusFilter !== 'all' ? `WHERE status = '${esc(statusFilter)}'` : '';
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_supplier_invoices ${where} ORDER BY invoice_date DESC`
  );
  return rows as unknown as SupplierInvoice[];
}

export async function addSupplierInvoice(inv: {
  invoice_ref: string; supplier_id: number | null; supplier_name: string;
  description: string; total_amount: number; invoice_date: string; due_date: string;
  notes: string; entered_by: string;
}): Promise<number> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_supplier_invoices (invoice_ref, supplier_id, supplier_name, description, total_amount, balance_due, invoice_date, due_date, notes, entered_by)
     VALUES ('${esc(inv.invoice_ref)}', ${inv.supplier_id || 'NULL'}, '${esc(inv.supplier_name)}', '${esc(inv.description)}', ${inv.total_amount}, ${inv.total_amount}, '${esc(inv.invoice_date)}', '${esc(inv.due_date)}', '${esc(inv.notes)}', '${esc(inv.entered_by)}')`
  );
  const rows = await window.tasklet.sqlQuery(
    `SELECT id FROM sylvias_supplier_invoices ORDER BY id DESC LIMIT 1`
  );
  return (rows[0] as unknown as { id: number }).id;
}

export async function getSupplierInvoice(id: number): Promise<SupplierInvoice | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_supplier_invoices WHERE id = ${id}`
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as SupplierInvoice;
}

export async function getSupplierPayments(invoiceId: number): Promise<SupplierPayment[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_supplier_invoice_payments WHERE supplier_invoice_id = ${invoiceId} ORDER BY payment_date ASC`
  );
  return rows as unknown as SupplierPayment[];
}

export async function addSupplierPayment(p: {
  supplier_invoice_id: number; amount: number; payment_method: string;
  payment_date: string; notes: string; entered_by: string;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_supplier_invoice_payments (supplier_invoice_id, payment_date, amount, payment_method, notes, entered_by)
     VALUES (${p.supplier_invoice_id}, '${esc(p.payment_date)}', ${p.amount}, '${esc(p.payment_method)}', '${esc(p.notes)}', '${esc(p.entered_by)}')`
  );
  // Update invoice totals
  const inv = await getSupplierInvoice(p.supplier_invoice_id);
  if (inv) {
    const newPaid = inv.amount_paid + p.amount;
    const newBalance = Math.max(0, inv.total_amount - newPaid);
    const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    await window.tasklet.sqlExec(
      `UPDATE sylvias_supplier_invoices SET amount_paid = ${newPaid}, balance_due = ${newBalance}, status = '${newStatus}' WHERE id = ${p.supplier_invoice_id}`
    );
  }
}

export async function getSupplierInvoicesTotals(): Promise<{ total_owed: number; total_paid: number; count: number }> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(balance_due), 0) as total_owed, COALESCE(SUM(amount_paid), 0) as total_paid, COUNT(*) as count FROM sylvias_supplier_invoices WHERE status != 'paid'`
  );
  return rows[0] as unknown as { total_owed: number; total_paid: number; count: number };
}

export async function getSupplierInvoicesTotalsByRange(from: string, to: string): Promise<{ total_owed: number; total_invoiced: number }> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(balance_due), 0) as total_owed, COALESCE(SUM(total_amount), 0) as total_invoiced FROM sylvias_supplier_invoices WHERE invoice_date >= '${esc(from)}' AND invoice_date <= '${esc(to)}'`
  );
  return rows[0] as unknown as { total_owed: number; total_invoiced: number };
}

// ── P&L helpers ──

export async function getNetSalesByRange(from: string, to: string): Promise<number> {
  const salesRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(total), 0) as total FROM sylvias_sales WHERE date(sale_date) >= '${esc(from)}' AND date(sale_date) <= '${esc(to)}' AND status != 'refunded'`
  );
  const refundRows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM sylvias_refunds WHERE refund_date >= '${esc(from)}' AND refund_date <= '${esc(to)}'`
  );
  return (salesRows[0] as any).total - (refundRows[0] as any).total;
}

// ── Payment method formatter ──

// ══════════════════════════════════════════════
// Phase 16: Events CRUD
// ══════════════════════════════════════════════

export async function getAllEvents(): Promise<EventRecord[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_events ORDER BY event_date DESC'
  );
  return rows as unknown as EventRecord[];
}

export async function getEventById(id: number): Promise<EventRecord | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_events WHERE id = ${id}`
  );
  return rows.length > 0 ? (rows[0] as unknown as EventRecord) : null;
}

export async function addEvent(e: {
  event_name: string; location: string; event_date: string; end_date: string;
  pitch_cost: number; travel_cost: number; other_costs: number;
  notes: string; status: string; entered_by: string;
}): Promise<number> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_events (event_name, location, event_date, end_date, pitch_cost, travel_cost, other_costs, notes, status, entered_by)
     VALUES ('${esc(titleCase(e.event_name))}', '${esc(titleCase(e.location))}', '${esc(e.event_date)}', '${esc(e.end_date)}', ${e.pitch_cost}, ${e.travel_cost}, ${e.other_costs}, '${esc(e.notes)}', '${esc(e.status)}', '${esc(e.entered_by)}')`
  );
  const rows = await window.tasklet.sqlQuery(
    `SELECT id FROM sylvias_events ORDER BY id DESC LIMIT 1`
  );
  return (rows[0] as unknown as { id: number }).id;
}

export async function updateEvent(id: number, e: {
  event_name: string; location: string; event_date: string; end_date: string;
  pitch_cost: number; travel_cost: number; other_costs: number;
  notes: string; status: string;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_events SET
      event_name='${esc(titleCase(e.event_name))}',
      location='${esc(titleCase(e.location))}',
      event_date='${esc(e.event_date)}',
      end_date='${esc(e.end_date)}',
      pitch_cost=${e.pitch_cost},
      travel_cost=${e.travel_cost},
      other_costs=${e.other_costs},
      notes='${esc(e.notes)}',
      status='${esc(e.status)}'
     WHERE id=${id}`
  );
}

export async function deleteEvent(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_event_items WHERE event_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM sylvias_events WHERE id=${id}`);
}

export async function getEventItems(eventId: number): Promise<EventItem[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_event_items WHERE event_id = ${eventId} ORDER BY id ASC`
  );
  return rows as unknown as EventItem[];
}

export async function addEventItem(item: {
  event_id: number; stock_id: number; description: string; part_number: string;
  qty_taken: number; qty_sold: number; sale_price: number; cost_price: number;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_event_items (event_id, stock_id, description, part_number, qty_taken, qty_sold, sale_price, cost_price)
     VALUES (${item.event_id}, ${item.stock_id}, '${esc(item.description)}', '${esc(item.part_number)}', ${item.qty_taken}, ${item.qty_sold}, ${item.sale_price}, ${item.cost_price})`
  );
}

export async function updateEventItem(id: number, updates: { qty_sold?: number; sale_price?: number }): Promise<void> {
  const sets: string[] = [];
  if (updates.qty_sold !== undefined) sets.push(`qty_sold = ${updates.qty_sold}`);
  if (updates.sale_price !== undefined) sets.push(`sale_price = ${updates.sale_price}`);
  if (sets.length > 0) await window.tasklet.sqlExec(`UPDATE sylvias_event_items SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function deleteEventItem(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_event_items WHERE id=${id}`);
}

// ══════════════════════════════════════════════
// Phase 16: Quotes CRUD
// ══════════════════════════════════════════════

export async function generateQuoteNumber(): Promise<string> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COUNT(*) as cnt FROM sylvias_quotes`
  );
  const count = (rows[0] as unknown as { cnt: number }).cnt;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const num = String(count + 1).padStart(4, '0');
  return `QT-${dd}${mm}-${num}`;
}

export async function getAllQuotes(): Promise<Quote[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT * FROM sylvias_quotes ORDER BY quote_date DESC, id DESC'
  );
  return rows as unknown as Quote[];
}

export async function getQuoteById(id: number): Promise<Quote | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_quotes WHERE id = ${id}`
  );
  return rows.length > 0 ? (rows[0] as unknown as Quote) : null;
}

export async function addQuote(q: {
  quote_number: string; customer_id: number | null; customer_name: string;
  quote_date: string; expiry_date: string; status: string; notes: string; entered_by: string;
}): Promise<number> {
  const custId = q.customer_id !== null ? String(q.customer_id) : 'NULL';
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_quotes (quote_number, customer_id, customer_name, quote_date, expiry_date, status, notes, entered_by)
     VALUES ('${esc(q.quote_number)}', ${custId}, '${esc(q.customer_name)}', '${esc(q.quote_date)}', '${esc(q.expiry_date)}', '${esc(q.status)}', '${esc(q.notes)}', '${esc(q.entered_by)}')`
  );
  const rows = await window.tasklet.sqlQuery(
    `SELECT id FROM sylvias_quotes WHERE quote_number = '${esc(q.quote_number)}' ORDER BY id DESC LIMIT 1`
  );
  return (rows[0] as unknown as { id: number }).id;
}

export async function updateQuote(id: number, q: {
  customer_id: number | null; customer_name: string;
  expiry_date: string; status: string; notes: string;
}): Promise<void> {
  const custId = q.customer_id !== null ? String(q.customer_id) : 'NULL';
  await window.tasklet.sqlExec(
    `UPDATE sylvias_quotes SET
      customer_id=${custId},
      customer_name='${esc(q.customer_name)}',
      expiry_date='${esc(q.expiry_date)}',
      status='${esc(q.status)}',
      notes='${esc(q.notes)}'
     WHERE id=${id}`
  );
}

export async function updateQuoteStatus(id: number, status: string): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_quotes SET status = '${esc(status)}' WHERE id = ${id}`
  );
}

export async function deleteQuote(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_quote_items WHERE quote_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM sylvias_quotes WHERE id=${id}`);
}

export async function getQuoteItems(quoteId: number): Promise<QuoteItem[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_quote_items WHERE quote_id = ${quoteId} ORDER BY id ASC`
  );
  return rows as unknown as QuoteItem[];
}

export async function addQuoteItem(item: {
  quote_id: number; stock_id: number; description: string; part_number: string;
  qty: number; unit_price: number; line_total: number;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_quote_items (quote_id, stock_id, description, part_number, qty, unit_price, line_total)
     VALUES (${item.quote_id}, ${item.stock_id}, '${esc(item.description)}', '${esc(item.part_number)}', ${item.qty}, ${item.unit_price}, ${item.line_total})`
  );
}

export async function deleteQuoteItem(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_quote_items WHERE id=${id}`);
}

export async function deleteQuoteItemsByQuote(quoteId: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_quote_items WHERE quote_id=${quoteId}`);
}

// ── Gift Vouchers ──

export async function generateVoucherNumber(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rows = await window.tasklet.sqlQuery(`SELECT COUNT(*) as c FROM sylvias_gift_vouchers`);
  const count = (rows[0] as any).c || 0;
  return `GV-${dd}${mm}-${String(count + 1).padStart(4, '0')}`;
}

export async function getAllGiftVouchers(status?: string): Promise<GiftVoucher[]> {
  let where = 'WHERE 1=1';
  if (status) where += ` AND status = '${esc(status)}'`;
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_gift_vouchers ${where} ORDER BY created_at DESC`);
  return rows as unknown as GiftVoucher[];
}

export async function getGiftVoucherByNumber(num: string): Promise<GiftVoucher | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_gift_vouchers WHERE voucher_number = '${esc(num)}' LIMIT 1`
  );
  return rows.length > 0 ? (rows[0] as unknown as GiftVoucher) : null;
}

export async function getGiftVouchersByCustomer(customerId: number): Promise<GiftVoucher[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_gift_vouchers WHERE purchaser_customer_id = ${customerId} AND status = 'active' AND balance > 0 ORDER BY created_at DESC`
  );
  return rows as unknown as GiftVoucher[];
}

export async function addGiftVoucher(gv: {
  voucher_number: string; amount: number; purchaser_name: string; purchaser_customer_id: number | null;
  recipient_name: string; recipient_customer_id: number | null; payment_method: string; date_issued: string; date_expires: string;
  notes: string; entered_by: string;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_gift_vouchers (voucher_number, amount, amount_used, balance, purchaser_name, purchaser_customer_id, recipient_name, recipient_customer_id, payment_method, date_issued, date_expires, status, notes, entered_by)
     VALUES ('${esc(gv.voucher_number)}', ${gv.amount}, 0, ${gv.amount}, '${esc(gv.purchaser_name)}', ${gv.purchaser_customer_id ?? 'NULL'}, '${esc(gv.recipient_name)}', ${gv.recipient_customer_id ?? 'NULL'}, '${esc(gv.payment_method)}', '${esc(gv.date_issued)}', '${esc(gv.date_expires)}', 'active', '${esc(gv.notes)}', '${esc(gv.entered_by)}')`
  );
}

export async function useGiftVoucher(id: number, amountToUse: number): Promise<void> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_gift_vouchers WHERE id = ${id}`);
  if (rows.length === 0) return;
  const gv = rows[0] as any;
  const newUsed = gv.amount_used + amountToUse;
  const newBalance = Math.max(0, gv.amount - newUsed);
  const newStatus = newBalance <= 0 ? 'used' : 'active';
  await window.tasklet.sqlExec(
    `UPDATE sylvias_gift_vouchers SET amount_used = ${newUsed}, balance = ${newBalance}, status = '${newStatus}' WHERE id = ${id}`
  );
}

export async function cancelGiftVoucher(id: number): Promise<void> {
  await window.tasklet.sqlExec(
    `UPDATE sylvias_gift_vouchers SET status = 'cancelled' WHERE id = ${id}`
  );
}

export function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    sumup: 'SumUp (Card)',
    ebay: 'eBay',
    bank_transfer: 'Bank Transfer',
    paypal: 'PayPal',
    crypto: 'Crypto',
    credit_note: 'Credit Note',
    gift_voucher: 'Gift Voucher',
    trade_in: 'Trade-In',
    account: 'Account',
    on_account: 'On Account',
    other: 'Other',
  };
  return map[method] || method;
}

// ── Scan Staging ──

export async function getScanStagingItems(status = 'pending'): Promise<ScanStagingItem[]> {
  return await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_scan_staging WHERE status='${esc(status)}' ORDER BY scanned_at DESC`
  ) as unknown as ScanStagingItem[];
}

export async function addScanStagingItem(item: {
  description: string; part_number: string; qty: number; condition: string;
  category: string; location: string; cost: number; rrp: number; offer_price: number;
  acquisition_type: string; supplier_name: string; source_type: string;
  purchase_date: string; payment_method: string; purchased_by: string;
  notes: string; scan_type: string; scanned_by: string;
}): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_scan_staging (description, part_number, qty, condition, category, location, cost, rrp, offer_price, acquisition_type, supplier_name, source_type, purchase_date, payment_method, purchased_by, notes, scan_type, scanned_by)
     VALUES ('${esc(item.description)}', '${esc(item.part_number)}', ${item.qty}, '${esc(item.condition)}', '${esc(item.category)}', '${esc(item.location)}', ${item.cost}, ${item.rrp}, ${item.offer_price}, '${esc(item.acquisition_type)}', '${esc(item.supplier_name)}', '${esc(item.source_type)}', '${esc(item.purchase_date)}', '${esc(item.payment_method)}', '${esc(item.purchased_by)}', '${esc(item.notes)}', '${esc(item.scan_type)}', '${esc(item.scanned_by)}')`
  );
}

export async function clearPendingScanStaging(): Promise<void> {
  await window.tasklet.sqlExec("DELETE FROM sylvias_scan_staging WHERE status='pending'");
}

export async function rejectAllPendingScanStaging(): Promise<number> {
  const res = await window.tasklet.sqlExec("UPDATE sylvias_scan_staging SET status='rejected' WHERE status='pending'");
  return res?.rowsAffected || 0;
}

export async function addScanStagingBatch(items: Array<{
  description: string; part_number: string; qty: number;
  location: string; cost: number; rrp: number;
  scan_type: string; scanned_by: string; notes: string;
}>): Promise<void> {
  for (const item of items) {
    await window.tasklet.sqlExec(
      `INSERT INTO sylvias_scan_staging (description, part_number, qty, location, cost, rrp, scan_type, scanned_by, notes)
       VALUES ('${esc(item.description)}', '${esc(item.part_number)}', ${item.qty}, '${esc(item.location)}', ${item.cost}, ${item.rrp}, '${esc(item.scan_type)}', '${esc(item.scanned_by)}', '${esc(item.notes)}')`
    );
  }
}

export async function updateScanStagingItem(id: number, fields: Partial<ScanStagingItem>): Promise<void> {
  const sets: string[] = [];
  if (fields.description !== undefined) sets.push(`description='${esc(fields.description)}'`);
  if (fields.part_number !== undefined) sets.push(`part_number='${esc(fields.part_number)}'`);
  if (fields.qty !== undefined) sets.push(`qty=${fields.qty}`);
  if (fields.condition !== undefined) sets.push(`condition='${esc(fields.condition)}'`);
  if (fields.category !== undefined) sets.push(`category='${esc(fields.category)}'`);
  if (fields.location !== undefined) sets.push(`location='${esc(fields.location)}'`);
  if (fields.cost !== undefined) sets.push(`cost=${fields.cost}`);
  if (fields.rrp !== undefined) sets.push(`rrp=${fields.rrp}`);
  if (fields.offer_price !== undefined) sets.push(`offer_price=${fields.offer_price}`);
  if (fields.acquisition_type !== undefined) sets.push(`acquisition_type='${esc(fields.acquisition_type)}'`);
  if (fields.supplier_name !== undefined) sets.push(`supplier_name='${esc(fields.supplier_name)}'`);
  if (fields.notes !== undefined) sets.push(`notes='${esc(fields.notes)}'`);
  if (fields.status !== undefined) sets.push(`status='${esc(fields.status)}'`);
  if (sets.length > 0) {
    await window.tasklet.sqlExec(`UPDATE sylvias_scan_staging SET ${sets.join(', ')} WHERE id=${id}`);
  }
}

export async function approveScanStagingItem(id: number): Promise<{ merged: number; inserted: number }> {
  // Delegate to batch function — gets duplicate detection for free
  return approveScanStagingBatch([id]);
}

export async function approveScanStagingBatch(ids: number[]): Promise<{ merged: number; inserted: number }> {
  if (ids.length === 0) return { merged: 0, inserted: 0 };
  const idList = ids.join(',');
  // 1. Get all staging items in one query
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_scan_staging WHERE id IN (${idList}) AND status='pending'`
  ) as unknown as ScanStagingItem[];
  if (rows.length === 0) return { merged: 0, inserted: 0 };

  // 2. Check for existing stock that might match — by part_number or by description+location+cost+rrp
  const partNums = rows.map(r => r.part_number?.trim()).filter(Boolean);
  const descriptions = rows.map(r => r.description?.trim()).filter(Boolean);
  const conditions: string[] = [];
  if (partNums.length > 0) {
    conditions.push(`(part_number IN (${partNums.map(p => `'${esc(p)}'`).join(',')}) AND part_number != '')`);
  }
  if (descriptions.length > 0) {
    conditions.push(`(LOWER(description) IN (${descriptions.map(d => `'${esc(d.toLowerCase())}'`).join(',')}))`);
  }
  let existingStock: Array<{ id: number; part_number: string; description: string; location: string; cost: number; rrp: number; qty: number }> = [];
  if (conditions.length > 0) {
    existingStock = await window.tasklet.sqlQuery(
      `SELECT id, part_number, description, location, cost, rrp, qty FROM sylvias_stock WHERE ${conditions.join(' OR ')}`
    ) as any;
  }

  // 3. Split into merge vs insert
  const toMerge: Array<{ stockId: number; addQty: number }> = [];
  const toInsert: ScanStagingItem[] = [];

  for (const item of rows) {
    let matchId: number | null = null;
    const pn = item.part_number?.trim() || '';
    // First try matching by part number (if non-empty)
    if (pn) {
      const match = existingStock.find(s => s.part_number?.trim().toLowerCase() === pn.toLowerCase());
      if (match) matchId = match.id;
    }
    // If no part number match, try matching by description + location + cost + rrp
    if (matchId === null) {
      const match = existingStock.find(s =>
        s.description?.trim().toLowerCase() === item.description?.trim().toLowerCase() &&
        s.location?.trim().toLowerCase() === (item.location?.trim() || '').toLowerCase() &&
        Number(s.cost) === Number(item.cost || 0) &&
        Number(s.rrp) === Number(item.rrp || 0)
      );
      if (match) matchId = match.id;
    }

    if (matchId !== null) {
      // Check if we already have a merge entry for this stock id
      const existing = toMerge.find(m => m.stockId === matchId);
      if (existing) {
        existing.addQty += Number(item.qty) || 1;
      } else {
        toMerge.push({ stockId: matchId, addQty: Number(item.qty) || 1 });
      }
    } else {
      toInsert.push(item);
    }
  }

  // 4. Batch UPDATE existing stock quantities (one query with CASE/WHEN)
  if (toMerge.length > 0) {
    const mergeIds = toMerge.map(m => m.stockId).join(',');
    const caseClauses = toMerge.map(m => `WHEN ${m.stockId} THEN qty + ${m.addQty}`).join(' ');
    await window.tasklet.sqlExec(
      `UPDATE sylvias_stock SET qty = CASE id ${caseClauses} END WHERE id IN (${mergeIds})`
    );
  }

  // 5. Batch INSERT new items
  if (toInsert.length > 0) {
    const valueRows = toInsert.map(item =>
      `('${esc(item.description)}', '${esc(item.part_number)}', ${item.qty}, '${esc(item.location)}', ${item.cost}, ${item.rrp}, '${esc(item.scanned_by)}', '${esc(item.category)}')`
    ).join(', ');
    await window.tasklet.sqlExec(
      `INSERT INTO sylvias_stock (description, part_number, qty, location, cost, rrp, entered_by, category) VALUES ${valueRows}`
    );
  }

  // 6. Batch learn item names
  const uniqueNames = [...new Set(rows.map(r => r.description.trim()).filter(Boolean))];
  if (uniqueNames.length > 0) {
    const nameValues = uniqueNames.map(n => `('${esc(n)}')`).join(', ');
    await window.tasklet.sqlExec(
      `INSERT OR IGNORE INTO sylvias_item_names (name) VALUES ${nameValues}`
    );
  }

  // 7. Batch mark as approved
  await window.tasklet.sqlExec(`UPDATE sylvias_scan_staging SET status='approved' WHERE id IN (${idList})`);
  return { merged: toMerge.length, inserted: toInsert.length };
}

export async function rejectScanStagingBatch(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await window.tasklet.sqlExec(`UPDATE sylvias_scan_staging SET status='rejected' WHERE id IN (${ids.join(',')})`);
}

export async function rejectScanStagingItem(id: number): Promise<void> {
  await window.tasklet.sqlExec(`UPDATE sylvias_scan_staging SET status='rejected' WHERE id=${id}`);
}

export async function deleteScanStagingItem(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_scan_staging WHERE id=${id}`);
}

export async function getScanStagingCount(): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    "SELECT COUNT(*) as cnt FROM sylvias_scan_staging WHERE status='pending'"
  ) as Array<{ cnt: number }>;
  return rows[0]?.cnt || 0;
}

// ── Duplicate Checker ──
export interface DuplicateGroup {
  area: string;
  matchField: string;
  matchValue: string;
  items: Array<{ id: number; label: string; detail: string }>;
}

export async function findAllDuplicates(): Promise<DuplicateGroup[]> {
  const groups: DuplicateGroup[] = [];

  // 1. Stock — duplicate part numbers (non-empty)
  const stockPN = await window.tasklet.sqlQuery(
    `SELECT id, description, part_number, qty, location, cost, rrp
     FROM sylvias_stock
     WHERE part_number IS NOT NULL AND part_number != ''
     ORDER BY part_number, id`
  ) as Array<{ id: number; description: string; part_number: string; qty: number; location: string; cost: number; rrp: number }>;

  const pnMap = new Map<string, typeof stockPN>();
  for (const r of stockPN) {
    const key = r.part_number.trim().toUpperCase();
    if (!pnMap.has(key)) pnMap.set(key, []);
    pnMap.get(key)!.push(r);
  }
  for (const [pn, items] of pnMap) {
    if (items.length > 1) {
      groups.push({
        area: 'Stock', matchField: 'Part Number', matchValue: pn,
        items: items.map(i => ({
          id: i.id,
          label: `${i.description} (PN: ${i.part_number})`,
          detail: `Qty: ${i.qty} | Loc: ${i.location || '—'} | Cost: £${(i.cost || 0).toFixed(2)} | RRP: £${(i.rrp || 0).toFixed(2)}`
        }))
      });
    }
  }

  // 2. Stock — duplicate descriptions (exact match, case-insensitive)
  const stockDesc = await window.tasklet.sqlQuery(
    `SELECT id, description, part_number, qty, location, cost, rrp
     FROM sylvias_stock ORDER BY description COLLATE NOCASE, id`
  ) as Array<{ id: number; description: string; part_number: string; qty: number; location: string; cost: number; rrp: number }>;

  const descMap = new Map<string, typeof stockDesc>();
  for (const r of stockDesc) {
    const key = r.description.trim().toLowerCase();
    if (!descMap.has(key)) descMap.set(key, []);
    descMap.get(key)!.push(r);
  }
  for (const [, items] of descMap) {
    if (items.length > 1) {
      groups.push({
        area: 'Stock', matchField: 'Description', matchValue: items[0].description,
        items: items.map(i => ({
          id: i.id,
          label: `${i.description}${i.part_number ? ' (PN: ' + i.part_number + ')' : ''}`,
          detail: `Qty: ${i.qty} | Loc: ${i.location || '—'} | Cost: £${(i.cost || 0).toFixed(2)} | RRP: £${(i.rrp || 0).toFixed(2)}`
        }))
      });
    }
  }

  // 3. Customers — duplicate by name (first+last, case-insensitive)
  const custs = await window.tasklet.sqlQuery(
    `SELECT id, salutation, first_name, surname, email, phone, postcode
     FROM sylvias_customers ORDER BY surname COLLATE NOCASE, first_name COLLATE NOCASE, id`
  ) as Array<{ id: number; salutation: string; first_name: string; surname: string; email: string; phone: string; postcode: string }>;

  const custNameMap = new Map<string, typeof custs>();
  for (const r of custs) {
    const key = `${(r.first_name || '').trim().toLowerCase()}|${(r.surname || '').trim().toLowerCase()}`;
    if (key === '|') continue;
    if (!custNameMap.has(key)) custNameMap.set(key, []);
    custNameMap.get(key)!.push(r);
  }
  for (const [, items] of custNameMap) {
    if (items.length > 1) {
      groups.push({
        area: 'Customers', matchField: 'Name', matchValue: `${items[0].first_name} ${items[0].surname}`,
        items: items.map(i => ({
          id: i.id,
          label: `${i.salutation ? i.salutation + ' ' : ''}${i.first_name} ${i.surname}`,
          detail: `${i.email || '—'} | ${i.phone || '—'} | ${i.postcode || '—'}`
        }))
      });
    }
  }

  // 4. Customers — duplicate email (non-empty)
  const custEmailMap = new Map<string, typeof custs>();
  for (const r of custs) {
    if (!r.email) continue;
    const key = r.email.trim().toLowerCase();
    if (!custEmailMap.has(key)) custEmailMap.set(key, []);
    custEmailMap.get(key)!.push(r);
  }
  for (const [email, items] of custEmailMap) {
    if (items.length > 1) {
      groups.push({
        area: 'Customers', matchField: 'Email', matchValue: email,
        items: items.map(i => ({
          id: i.id,
          label: `${i.first_name} ${i.surname}`,
          detail: `${i.email} | ${i.phone || '—'} | ${i.postcode || '—'}`
        }))
      });
    }
  }

  // 5. Expenses — same amount + date + description
  const exps = await window.tasklet.sqlQuery(
    `SELECT id, description, amount, expense_date, category, payment_method
     FROM sylvias_expenses ORDER BY expense_date DESC, id`
  ) as Array<{ id: number; description: string; amount: number; expense_date: string; category: string; payment_method: string }>;

  const expMap = new Map<string, typeof exps>();
  for (const r of exps) {
    const key = `${(r.description || '').trim().toLowerCase()}|${r.amount}|${(r.expense_date || '').substring(0, 10)}`;
    if (!expMap.has(key)) expMap.set(key, []);
    expMap.get(key)!.push(r);
  }
  for (const [, items] of expMap) {
    if (items.length > 1) {
      groups.push({
        area: 'Expenses', matchField: 'Amount + Date + Description', matchValue: `${items[0].description} — £${items[0].amount} on ${(items[0].expense_date || '').substring(0, 10)}`,
        items: items.map(i => ({
          id: i.id,
          label: `${i.description} — £${Number(i.amount).toFixed(2)}`,
          detail: `${(i.expense_date || '').substring(0, 10)} | ${i.category || '—'} | ${i.payment_method || '—'}`
        }))
      });
    }
  }

  // 6. Suppliers — duplicate name
  const supps = await window.tasklet.sqlQuery(
    `SELECT id, name, contact_name, phone, email, postcode
     FROM sylvias_suppliers ORDER BY name COLLATE NOCASE, id`
  ) as Array<{ id: number; name: string; contact_name: string; phone: string; email: string; postcode: string }>;

  const suppMap = new Map<string, typeof supps>();
  for (const r of supps) {
    const key = (r.name || '').trim().toLowerCase();
    if (!key) continue;
    if (!suppMap.has(key)) suppMap.set(key, []);
    suppMap.get(key)!.push(r);
  }
  for (const [, items] of suppMap) {
    if (items.length > 1) {
      groups.push({
        area: 'Suppliers', matchField: 'Name', matchValue: items[0].name,
        items: items.map(i => ({
          id: i.id,
          label: i.name,
          detail: `${i.contact_name || '—'} | ${i.email || '—'} | ${i.phone || '—'}`
        }))
      });
    }
  }

  return groups;
}

export async function mergeStockItems(keepId: number, removeIds: number[]): Promise<void> {
  if (removeIds.length === 0) return;
  // Sum quantities from items being removed and add to keeper
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(qty), 0) as totalQty FROM sylvias_stock WHERE id IN (${removeIds.join(',')})`
  ) as Array<{ totalQty: number }>;
  const addQty = rows[0]?.totalQty || 0;
  await window.tasklet.sqlExec(
    `UPDATE sylvias_stock SET qty = qty + ${addQty} WHERE id = ${keepId}`
  );
  await window.tasklet.sqlExec(
    `DELETE FROM sylvias_stock WHERE id IN (${removeIds.join(',')})`
  );
}

export async function deleteCustomerById(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_customers WHERE id = ${id}`);
}

export async function deleteExpenseById(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_expenses WHERE id = ${id}`);
}

export async function deleteSupplierById(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM sylvias_suppliers WHERE id = ${id}`);
}

// ── Audit Log ──

export interface AuditEntry {
  id: number;
  action: string;
  table_name: string;
  record_id: number;
  details: string;
  performed_by: string;
  performed_at: string;
}

export async function logAudit(action: string, tableName: string, recordId: number, details: string, performedBy: string): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO sylvias_audit_log (action, table_name, record_id, details, performed_by)
     VALUES ('${esc(action)}', '${esc(tableName)}', ${recordId}, '${esc(details)}', '${esc(performedBy)}')`
  );
}

export async function getAuditLog(tableName?: string, recordId?: number, limit: number = 50): Promise<AuditEntry[]> {
  let where = '1=1';
  if (tableName) where += ` AND table_name = '${esc(tableName)}'`;
  if (recordId !== undefined) where += ` AND record_id = ${recordId}`;
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM sylvias_audit_log WHERE ${where} ORDER BY performed_at DESC, id DESC LIMIT ${limit}`
  );
  return rows as unknown as AuditEntry[];
}

export async function deleteSaleWithAudit(saleId: number, performedBy: string, reason: string): Promise<void> {
  // Grab sale info for audit trail
  const saleRows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_sales WHERE id = ${saleId}`);
  if (!saleRows || saleRows.length === 0) return;
  const sale = saleRows[0] as any;
  const itemRows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_sale_items WHERE sale_id = ${saleId}`);
  const items = (itemRows || []) as any[];
  const payRows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_payments WHERE sale_id = ${saleId}`);
  const payments = (payRows || []) as any[];

  const details = JSON.stringify({
    reason,
    sale: { invoice: sale.invoice_number, total: sale.total, customer: sale.customer_name, method: sale.payment_method, date: sale.sale_date },
    items: items.map((i: any) => ({ desc: i.description, qty: i.qty, price: i.unit_price })),
    payments: payments.map((p: any) => ({ amount: p.amount, method: p.payment_method, date: p.payment_date })),
  });

  // Log audit before deleting
  await logAudit('DELETE', 'sylvias_sales', saleId, details, performedBy);

  // Delete related records
  await window.tasklet.sqlExec(`DELETE FROM sylvias_payments WHERE sale_id = ${saleId}`);
  await window.tasklet.sqlExec(`DELETE FROM sylvias_sale_items WHERE sale_id = ${saleId}`);
  await window.tasklet.sqlExec(`DELETE FROM sylvias_sales WHERE id = ${saleId}`);

  // Restore stock quantities for any stock items that were sold
  for (const item of items) {
    if (item.stock_id && item.stock_id > 0) {
      await window.tasklet.sqlExec(`UPDATE sylvias_stock SET qty = qty + ${item.qty} WHERE id = ${item.stock_id}`);
    }
  }
}

export async function deleteExpenseWithAudit(expenseId: number, performedBy: string, reason: string): Promise<void> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_expenses WHERE id = ${expenseId}`);
  if (!rows || rows.length === 0) return;
  const exp = rows[0] as any;

  const details = JSON.stringify({
    reason,
    expense: { description: exp.description, amount: exp.amount, category: exp.category, date: exp.expense_date },
  });

  await logAudit('DELETE', 'sylvias_expenses', expenseId, details, performedBy);
  await window.tasklet.sqlExec(`DELETE FROM sylvias_expenses WHERE id = ${expenseId}`);
}

export async function editSaleTotalWithAudit(saleId: number, newTotal: number, performedBy: string, reason: string): Promise<void> {
  const saleRows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_sales WHERE id = ${saleId}`);
  if (!saleRows || saleRows.length === 0) return;
  const sale = saleRows[0] as any;

  const details = JSON.stringify({
    reason,
    old_total: sale.total,
    new_total: newTotal,
    invoice: sale.invoice_number,
  });

  await logAudit('EDIT', 'sylvias_sales', saleId, details, performedBy);

  // Update sale total and recalc payment status
  const payRows = await window.tasklet.sqlQuery(`SELECT COALESCE(SUM(amount), 0) as total_paid FROM sylvias_payments WHERE sale_id = ${saleId}`);
  const totalPaid = (payRows[0] as any).total_paid;
  const discRows = await window.tasklet.sqlQuery(`SELECT discount FROM sylvias_sales WHERE id = ${saleId}`);
  const saleDiscount = (discRows[0] as any).discount || 0;
  const balanceDue = Math.max(0, newTotal - saleDiscount - totalPaid);
  const status = balanceDue <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

  await window.tasklet.sqlExec(
    `UPDATE sylvias_sales SET total = ${newTotal}, amount_paid = ${totalPaid}, balance_due = ${balanceDue}, status = '${status}' WHERE id = ${saleId}`
  );
}

export async function getStockRetailTotal(): Promise<number> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT COALESCE(SUM(rrp * qty), 0) as total_retail FROM sylvias_stock WHERE qty > 0`
  );
  return (rows[0] as unknown as {total_retail: number}).total_retail;
}

export async function getStockCategorySummary(): Promise<{category: string; item_count: number; total_units: number; cost_value: number; retail_value: number}[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT category, COUNT(*) as item_count, COALESCE(SUM(qty), 0) as total_units, COALESCE(SUM(cost * qty), 0) as cost_value, COALESCE(SUM(rrp * qty), 0) as retail_value FROM sylvias_stock WHERE qty > 0 GROUP BY category ORDER BY cost_value DESC`
  );
  return rows as unknown as {category: string; item_count: number; total_units: number; cost_value: number; retail_value: number}[];
}

// Stock holding summary
export async function getStockHolding(): Promise<{items: number; units: number; costValue: number; retailValue: number}> {
  const rows: any[] = await window.tasklet.sqlQuery("SELECT COUNT(*) as items, SUM(qty) as units, SUM(cost * qty) as cost_value, SUM(rrp * qty) as retail_value FROM sylvias_stock WHERE qty > 0");
  if (rows.length > 0) {
    return {
      items: rows[0].items || 0,
      units: rows[0].units || 0,
      costValue: rows[0].cost_value || 0,
      retailValue: rows[0].retail_value || 0,
    };
  }
  return {items: 0, units: 0, costValue: 0, retailValue: 0};
}

// Bullion held summary
export async function getBullionHeld(): Promise<{items: number; totalCost: number}> {
  const rows: any[] = await window.tasklet.sqlQuery("SELECT COUNT(*) as items, COALESCE(SUM(purchase_price + premium_paid), 0) as totalCost FROM sylvias_bullion WHERE status = 'held'");
  return { items: rows[0]?.items || 0, totalCost: rows[0]?.totalCost || 0 };
}
