export type ViewMode = 'storefront' | 'login' | 'dashboard' | 'stock-entry' | 'stock-control' | 'sell' | 'invoice-view' | 'customers' | 'sales-ledger' | 'expenses' | 'accountant-report' | 'float-tracker' | 'consignment' | 'reservations' | 'wish-list' | 'supplier-log' | 'price-labels' | 'profit-dashboard' | 'bullion' | 'admin' | 'outstanding' | 'refunds' | 'credit-notes' | 'bank-reconciliation' | 'pnl-report' | 'cashup' | 'purchase-stock' | 'takings-report' | 'customer-loyalty' | 'event-tracker' | 'quick-quotes' | 'insurance-register' | 'gift-vouchers' | 'quick-stock-entry' | 'scan-review' | 'supplier-invoices' | 'ebay-export' | 'stock-check' | 'bulk-stock-entry';

export interface Expense {
  id: number;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  receipt_photo: string;
  payment_method: string;
  paid_by: string;
  entered_by: string;
  created_at: string;
}

export interface StockItem {
  id: number;
  part_number: string;
  description: string;
  photo: string;
  qty: number;
  location: string;
  cost: number;
  rrp: number;
  entered_by: string;
  category: string;
  created_at: string;
  // New fields for offers and sourcing
  on_offer: number; // 0 or 1
  offer_price: number;
  supplier_id: number | null;
  source_type: string;
  entry_type: string; // 'legacy' | 'purchase' | 'trade_in'
  purchase_date: string;
  purchase_payment_method: string;
  purchased_by: string;
}

export interface StaffUser {
  id: number;
  name: string;
  initials: string;
  created_at: string;
}

export interface CartItem {
  stock: StockItem;
  sellQty: number;
  unitPrice: number;
  lineTotal: number;
  isConsignment?: boolean;
  consignmentItemId?: number;
}

export interface Customer {
  id: number;
  salutation: string;
  first_name: string;
  surname: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  postcode: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface Sale {
  id: number;
  sale_date: string;
  customer_name: string;
  customer_id: number | null;
  payment_method: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: string; // paid, partial, unpaid, refunded, credited
  sale_type: string; // receipt, invoice (account sale)
  due_date: string;
  sold_by: string;
  invoice_number: string;
  notes: string;
  created_at: string;
}

// ── Payments (against invoices) ──
export interface Payment {
  id: number;
  sale_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string;
  entered_by: string;
  created_at: string;
}

// ── Refunds ──
export interface Refund {
  id: number;
  sale_id: number;
  invoice_number: string;
  refund_date: string;
  amount: number;
  refund_method: string; // cash, bank_transfer, sumup, credit_note
  reason: string;
  items_restocked: number; // 0 or 1
  entered_by: string;
  credit_note_number: string;
  created_at: string;
}

// ── Credit Notes ──
export interface CreditNote {
  id: number;
  customer_id: number | null;
  customer_name: string;
  credit_note_number: string;
  date_issued: string;
  original_invoice: string;
  amount: number;
  amount_used: number;
  balance: number;
  reason: string;
  status: string; // active, used, expired, cancelled
  entered_by: string;
  created_at: string;
}

// ── Bank Transactions ──
export interface BankTransaction {
  id: number;
  bank_account_id: number;
  transaction_date: string;
  description: string;
  amount: number; // positive = credit (money in), negative = debit (money out)
  reference: string;
  category: string; // sale, expense, refund, transfer, other
  linked_sale_id: number | null;
  linked_expense_id: number | null;
  reconciled: number; // 0 or 1
  entered_by: string;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  stock_id: number;
  part_number: string;
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
  is_consignment: number;
  consignment_item_id: number | null;
}

// ── Float Tracker ──
export interface FloatRecord {
  id: number;
  float_date: string;
  opening_amount: number;
  closing_amount: number;
  cash_in: number;
  cash_out: number;
  difference: number;
  notes: string;
  entered_by: string;
  created_at: string;
}

// ── Consignment ──
export interface Consigner {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  commission_pct: number;
  notes: string;
  created_at: string;
}

export interface ConsignmentItem {
  id: number;
  consigner_id: number;
  consigner_name: string;
  description: string;
  qty: number;
  selling_price: number;
  commission_pct: number;
  status: string; // available, sold, returned, partial
  date_received: string;
  notes: string;
  entered_by: string;
  created_at: string;
  qty_sold: number;
  qty_remaining: number;
}

// ── Reservations ──
export interface Reservation {
  id: number;
  stock_id: number;
  stock_description: string;
  stock_part_number: string;
  customer_id: number | null;
  customer_name: string;
  deposit: number;
  total_price: number;
  reserve_date: string;
  expiry_date: string;
  status: string; // active, collected, expired, cancelled
  notes: string;
  reserved_by: string;
  created_at: string;
}

// ── Wish List ──
export interface WishListItem {
  id: number;
  customer_id: number | null;
  customer_name: string;
  description: string;
  notes: string;
  status: string; // open, found, notified, closed
  created_by: string;
  created_at: string;
}

// ── Suppliers ──
export interface Supplier {
  id: number;
  name: string;
  source_type: string; // Auction House, House Clearance, Car Boot, Private Sale, Dealer, Online, Other
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  notes: string;
  created_at: string;
}

// ── Bullion ──
export interface BullionItem {
  id: number;
  metal_type: string; // Gold, Silver, Platinum, Palladium
  form: string; // Coin, Bar, Round, Jewellery, Scrap, Other
  description: string;
  weight: number;
  weight_unit: string; // oz, g
  purity: string; // e.g. 999, 916 (22ct), 750 (18ct), 925, 585
  purchase_date: string;
  purchase_price: number;
  premium_paid: number;
  dealer_name: string;
  sell_date: string;
  sale_price: number;
  status: string; // held, sold, valuation
  payment_method: string; // cash, bank_transfer, sumup, paypal, crypto, other
  buyer_name: string;
  customer_id: number | null;
  notes: string;
  entered_by: string;
  purchase_payment_method?: string;
  created_at: string;
}

// ── Events ──
export interface EventRecord {
  id: number;
  event_name: string;
  location: string;
  event_date: string;
  end_date: string;
  pitch_cost: number;
  travel_cost: number;
  other_costs: number;
  notes: string;
  status: string; // planned, active, completed, cancelled
  entered_by: string;
  created_at: string;
}

export interface EventItem {
  id: number;
  event_id: number;
  stock_id: number;
  description: string;
  part_number: string;
  qty_taken: number;
  qty_sold: number;
  sale_price: number;
  cost_price: number;
  created_at: string;
}

// ── Quotes ──
export interface Quote {
  id: number;
  quote_number: string;
  customer_id: number | null;
  customer_name: string;
  quote_date: string;
  expiry_date: string;
  status: string; // draft, sent, accepted, declined, expired, converted
  notes: string;
  entered_by: string;
  created_at: string;
}

export interface QuoteItem {
  id: number;
  quote_id: number;
  stock_id: number;
  description: string;
  part_number: string;
  qty: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

// ── Gift Vouchers ──
export interface GiftVoucher {
  id: number;
  voucher_number: string;
  amount: number;
  amount_used: number;
  balance: number;
  purchaser_name: string;
  purchaser_customer_id: number | null;
  recipient_name: string;
  recipient_customer_id: number | null;
  payment_method: string;
  date_issued: string;
  date_expires: string;
  status: string; // active, used, expired, cancelled
  notes: string;
  entered_by: string;
  created_at: string;
}

// ── Scan Staging ──
export interface ScanStagingItem {
  id: number;
  description: string;
  part_number: string;
  qty: number;
  condition: string;
  category: string;
  location: string;
  cost: number;
  rrp: number;
  offer_price: number;
  acquisition_type: string; // 'existing' | 'purchased'
  supplier_name: string;
  source_type: string;
  purchase_date: string;
  payment_method: string;
  purchased_by: string;
  notes: string;
  scan_type: string; // 'single' | 'multiple'
  scanned_by: string;
  status: string; // 'pending' | 'approved' | 'rejected'
  scanned_at: string;
}

// ── Supplier Invoices (Accounts Payable) ──
export interface SupplierInvoice {
  id: number;
  invoice_ref: string;
  supplier_id: number | null;
  supplier_name: string;
  description: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string; // unpaid, partial, paid, overdue
  invoice_date: string;
  due_date: string;
  notes: string;
  entered_by: string;
  created_at: string;
}

export interface SupplierPayment {
  id: number;
  supplier_invoice_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string;
  entered_by: string;
  created_at: string;
}

// Legacy type kept for compatibility
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  stock_qty: number;
  low_stock_threshold: number;
  image_emoji: string;
  featured: number;
  created_at: string;
}
