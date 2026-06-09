import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser, Quote, QuoteItem, StockItem, Customer } from '../types';
import {
  getAllQuotes, getQuoteById, addQuote, updateQuote, updateQuoteStatus, deleteQuote,
  getQuoteItems, addQuoteItem, deleteQuoteItemsByQuote, generateQuoteNumber,
  searchStock, searchCustomers,
} from '../utils/db';
import { FileCheck, Plus, Trash2, Edit2, Eye, Search, Printer, X, ChevronLeft, ShoppingCart, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

type Tab = 'list' | 'form' | 'detail';

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-ghost',
  sent: 'badge-info',
  accepted: 'badge-success',
  declined: 'badge-error',
  expired: 'badge-warning',
  converted: 'badge-primary',
};

interface CartLine {
  stock: StockItem;
  qty: number;
  unitPrice: string;
}

export function QuickQuotes({ currentUser }: Props) {
  const [tab, setTab] = useState<Tab>('list');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Form state
  const [editId, setEditId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [stockResults, setStockResults] = useState<StockItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Detail view
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try { setQuotes(await getAllQuotes()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Customer search
  const custTimerRef = React.useRef<any>(null);
  useEffect(() => {
    if (custTimerRef.current) clearTimeout(custTimerRef.current);
    const q = customerSearch.trim();
    if (q.length < 2) { setCustomerResults([]); return; }
    custTimerRef.current = setTimeout(async () => {
      const results = await searchCustomers(q);
      setCustomerResults(results);
      setShowCustDropdown(true);
    }, 300);
  }, [customerSearch]);

  // Stock search
  const stockTimerRef = React.useRef<any>(null);
  useEffect(() => {
    if (stockTimerRef.current) clearTimeout(stockTimerRef.current);
    const q = stockSearch.trim();
    if (q.length < 2) { setStockResults([]); return; }
    stockTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try { setStockResults(await searchStock(q)); }
      finally { setSearching(false); }
    }, 300);
  }, [stockSearch]);

  function selectCustomer(c: Customer) {
    const name = `${c.first_name} ${c.surname}`.trim();
    setCustomerName(name);
    setCustomerId(c.id);
    setCustomerSearch(name);
    setShowCustDropdown(false);
    setCustomerResults([]);
  }

  function addToCart(s: StockItem) {
    if (cart.find(c => c.stock.id === s.id)) return;
    setCart([...cart, { stock: s, qty: 1, unitPrice: String(s.rrp) }]);
    setStockSearch('');
    setStockResults([]);
  }

  function removeFromCart(idx: number) {
    setCart(cart.filter((_, i) => i !== idx));
  }

  function updateCartLine(idx: number, field: 'qty' | 'unitPrice', val: string) {
    const updated = [...cart];
    if (field === 'qty') updated[idx] = { ...updated[idx], qty: parseInt(val) || 1 };
    else updated[idx] = { ...updated[idx], unitPrice: val };
    setCart(updated);
  }

  function cartTotal(): number {
    return cart.reduce((s, c) => s + (c.qty * (parseFloat(c.unitPrice) || 0)), 0);
  }

  function getDefaultExpiry(): string {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }

  function openAdd() {
    setEditId(null);
    setCustomerName('');
    setCustomerId(null);
    setCustomerSearch('');
    setExpiryDate(getDefaultExpiry());
    setNotes('');
    setCart([]);
    setTab('form');
  }

  async function openEdit(quote: Quote) {
    setEditId(quote.id);
    setCustomerName(quote.customer_name);
    setCustomerId(quote.customer_id);
    setCustomerSearch(quote.customer_name);
    setExpiryDate(quote.expiry_date);
    setNotes(quote.notes);
    // Load items into cart
    const items = await getQuoteItems(quote.id);
    const cartLines: CartLine[] = [];
    for (const item of items) {
      // Create a minimal StockItem for the cart
      cartLines.push({
        stock: { id: item.stock_id, part_number: item.part_number, description: item.description, rrp: item.unit_price, cost: 0, qty: 0, location: '', entered_by: '', category: '', photo: '', created_at: '', on_offer: 0, offer_price: 0, supplier_id: null, source_type: '', entry_type: 'legacy', purchase_date: '', purchase_payment_method: '', purchased_by: '' },
        qty: item.qty,
        unitPrice: String(item.unit_price),
      });
    }
    setCart(cartLines);
    setTab('form');
  }

  async function handleSave() {
    if (!customerName.trim() || cart.length === 0) return;
    setSaving(true);
    try {
      if (editId) {
        await updateQuote(editId, {
          customer_id: customerId,
          customer_name: customerName.trim(),
          expiry_date: expiryDate,
          status: 'draft',
          notes: notes.trim(),
        });
        await deleteQuoteItemsByQuote(editId);
        for (const line of cart) {
          const up = parseFloat(line.unitPrice) || 0;
          await addQuoteItem({
            quote_id: editId,
            stock_id: line.stock.id,
            description: line.stock.description,
            part_number: line.stock.part_number,
            qty: line.qty,
            unit_price: up,
            line_total: line.qty * up,
          });
        }
      } else {
        const qn = await generateQuoteNumber();
        const today = new Date().toISOString().slice(0, 10);
        const quoteId = await addQuote({
          quote_number: qn,
          customer_id: customerId,
          customer_name: customerName.trim(),
          quote_date: today,
          expiry_date: expiryDate,
          status: 'draft',
          notes: notes.trim(),
          entered_by: currentUser.initials,
        });
        for (const line of cart) {
          const up = parseFloat(line.unitPrice) || 0;
          await addQuoteItem({
            quote_id: quoteId,
            stock_id: line.stock.id,
            description: line.stock.description,
            part_number: line.stock.part_number,
            qty: line.qty,
            unit_price: up,
            line_total: line.qty * up,
          });
        }
      }
      await load();
      setTab('list');
    } finally { setSaving(false); }
  }

  async function viewDetail(quote: Quote) {
    setSelectedQuote(quote);
    setLoadingDetail(true);
    setTab('detail');
    try {
      setQuoteItems(await getQuoteItems(quote.id));
    } finally { setLoadingDetail(false); }
  }

  async function handleDelete(id: number) {
    await deleteQuote(id);
    setConfirmDelete(null);
    if (selectedQuote?.id === id) { setTab('list'); setSelectedQuote(null); }
    await load();
  }

  async function changeStatus(id: number, status: string) {
    await updateQuoteStatus(id, status);
    await load();
    if (selectedQuote?.id === id) {
      const updated = await getQuoteById(id);
      if (updated) setSelectedQuote(updated);
    }
  }

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  function isExpiringSoon(q: Quote): boolean {
    if (!q.expiry_date || q.status !== 'draft' && q.status !== 'sent') return false;
    const exp = new Date(q.expiry_date + 'T23:59:59');
    const now = new Date();
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  }

  function isExpired(q: Quote): boolean {
    if (!q.expiry_date || q.status === 'converted' || q.status === 'declined') return false;
    return new Date(q.expiry_date + 'T23:59:59') < new Date();
  }

  const filtered = statusFilter === 'all' ? quotes : quotes.filter(q => q.status === statusFilter);

  function handlePrint() { window.print(); }

  // List view
  if (tab === 'list') {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><FileCheck size={24} className="text-primary" /></div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Quick Quotes</h1>
              <p className="text-sm text-base-content/50">Create and manage customer quotations</p>
            </div>
          </div>
          <button className="btn btn-primary btn-sm gap-1" onClick={openAdd}>
            <Plus size={16} /> New Quote
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['all', 'draft', 'sent', 'accepted', 'declined', 'expired', 'converted'].map(s => (
            <button key={s} className={`btn btn-xs ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-base-content/40">
            <FileCheck size={48} className="mx-auto mb-3 opacity-30" />
            <p>No quotes found</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-base-300">
            <table className="table table-sm table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Quote #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className="hover">
                    <td className="font-mono text-xs">{q.quote_number}</td>
                    <td className="font-semibold">{q.customer_name}</td>
                    <td className="text-xs">{fmtDate(q.quote_date)}</td>
                    <td className="text-xs">
                      <span className={`flex items-center gap-1 ${isExpired(q) ? 'text-error' : isExpiringSoon(q) ? 'text-warning' : ''}`}>
                        {fmtDate(q.expiry_date)}
                        {isExpiringSoon(q) && <AlertTriangle size={12} />}
                        {isExpired(q) && <XCircle size={12} />}
                      </span>
                    </td>
                    <td><span className={`badge badge-sm ${STATUS_COLORS[q.status] || ''}`}>{q.status}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-xs" onClick={() => viewDetail(q)} title="View"><Eye size={14} /></button>
                        <button className="btn btn-ghost btn-xs" onClick={() => openEdit(q)} title="Edit"><Edit2 size={14} /></button>
                        {confirmDelete === q.id ? (
                          <>
                            <button className="btn btn-error btn-xs" onClick={() => handleDelete(q.id)}>Yes</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(null)}>No</button>
                          </>
                        ) : (
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => setConfirmDelete(q.id)} title="Delete"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Form view
  if (tab === 'form') {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <button className="btn btn-ghost btn-sm gap-1 mb-4" onClick={() => setTab('list')}>
          <ChevronLeft size={16} /> Back
        </button>
        <h2 className="text-xl font-bold text-primary mb-4">{editId ? 'Edit Quote' : 'New Quote'}</h2>

        <div className="card bg-base-200 p-4 space-y-3 mb-4">
          {/* Customer picker */}
          <div className="form-control relative">
            <label className="label"><span className="label-text font-semibold">Customer *</span></label>
            <input
              className="input input-bordered input-sm"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value);
                setCustomerName(e.target.value);
                setCustomerId(null);
              }}
              onFocus={() => customerResults.length > 0 && setShowCustDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)}
            />
            {showCustDropdown && customerResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-40 overflow-y-auto mt-1">
                {customerResults.map(c => (
                  <div key={c.id} className="px-3 py-1.5 hover:bg-base-200 cursor-pointer text-sm" onClick={() => selectCustomer(c)}>
                    {c.salutation} {c.first_name} {c.surname} {c.postcode && `(${c.postcode})`}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Expiry Date</span></label>
            <input type="date" className="input input-bordered input-sm" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Notes</span></label>
            <textarea className="textarea textarea-bordered textarea-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Add items */}
        <div className="card bg-base-200 p-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">Add Items</h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
            <input
              className="input input-bordered input-sm w-full pl-9"
              placeholder="Search stock..."
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
            />
          </div>
          {searching && <div className="mt-2"><span className="loading loading-spinner loading-xs" /></div>}
          {stockResults.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto border border-base-300 rounded-lg">
              {stockResults.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-base-300 cursor-pointer text-sm" onClick={() => addToCart(s)}>
                  <span>{s.part_number} — {s.description}</span>
                  <span className="text-xs text-base-content/50">£{s.rrp.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <div className="card bg-base-200 p-4 mb-4">
            <h3 className="font-semibold text-sm mb-2">Quote Items</h3>
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Part #</th>
                    <th>Description</th>
                    <th className="w-20">Qty</th>
                    <th className="w-28">Unit Price</th>
                    <th>Line Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((line, i) => {
                    const lt = line.qty * (parseFloat(line.unitPrice) || 0);
                    return (
                      <tr key={i}>
                        <td className="font-mono text-xs">{line.stock.part_number}</td>
                        <td className="text-sm">{line.stock.description}</td>
                        <td>
                          <input className="input input-bordered input-xs w-16" type="number" min="1" value={line.qty}
                            onChange={e => updateCartLine(i, 'qty', e.target.value)} />
                        </td>
                        <td>
                          <input className="input input-bordered input-xs w-24" value={line.unitPrice}
                            onChange={e => updateCartLine(i, 'unitPrice', e.target.value)} />
                        </td>
                        <td className="font-mono">£{lt.toFixed(2)}</td>
                        <td>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => removeFromCart(i)}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={4} className="text-right">Total:</td>
                    <td className="font-mono">£{cartTotal().toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !customerName.trim() || cart.length === 0}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : editId ? 'Update Quote' : 'Create Quote'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setTab('list')}>Cancel</button>
        </div>
      </div>
    );
  }

  // Detail view
  if (tab === 'detail' && selectedQuote) {
    const total = quoteItems.reduce((s, i) => s + i.line_total, 0);
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <button className="btn btn-ghost btn-sm gap-1 mb-4" onClick={() => { setTab('list'); setSelectedQuote(null); }}>
          <ChevronLeft size={16} /> Back
        </button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-primary">Quote {selectedQuote.quote_number}</h2>
            <p className="text-sm text-base-content/50">
              {fmtDate(selectedQuote.quote_date)} · Expires {fmtDate(selectedQuote.expiry_date)}
              {isExpired(selectedQuote) && <span className="text-error ml-2 font-semibold">EXPIRED</span>}
              {isExpiringSoon(selectedQuote) && <span className="text-warning ml-2 font-semibold">Expiring Soon</span>}
            </p>
          </div>
          <span className={`badge ${STATUS_COLORS[selectedQuote.status] || ''}`}>{selectedQuote.status}</span>
        </div>

        {/* Customer info */}
        <div className="card bg-base-200 p-4 mb-4">
          <p className="text-xs text-base-content/50">Customer</p>
          <p className="font-semibold">{selectedQuote.customer_name}</p>
        </div>

        {/* Items */}
        {loadingDetail ? (
          <div className="flex justify-center py-6"><span className="loading loading-spinner loading-md" /></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-base-300 mb-4">
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Part #</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {quoteItems.map(item => (
                  <tr key={item.id}>
                    <td className="font-mono text-xs">{item.part_number}</td>
                    <td>{item.description}</td>
                    <td>{item.qty}</td>
                    <td className="font-mono">£{item.unit_price.toFixed(2)}</td>
                    <td className="font-mono font-semibold">£{item.line_total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-lg">
                  <td colSpan={4} className="text-right">Total:</td>
                  <td className="font-mono">£{total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {selectedQuote.notes && (
          <div className="card bg-base-200 p-3 mb-4">
            <p className="text-xs text-base-content/50 mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{selectedQuote.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm gap-1" onClick={handlePrint}><Printer size={14} /> Print</button>
          <button className="btn btn-ghost btn-sm gap-1" onClick={() => openEdit(selectedQuote)}><Edit2 size={14} /> Edit</button>
          {selectedQuote.status === 'draft' && (
            <button className="btn btn-info btn-sm" onClick={() => changeStatus(selectedQuote.id, 'sent')}>Mark as Sent</button>
          )}
          {(selectedQuote.status === 'draft' || selectedQuote.status === 'sent') && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => changeStatus(selectedQuote.id, 'accepted')}>Accept</button>
              <button className="btn btn-error btn-sm" onClick={() => changeStatus(selectedQuote.id, 'declined')}>Decline</button>
            </>
          )}
          {selectedQuote.status === 'accepted' && (
            <button className="btn btn-primary btn-sm gap-1" onClick={() => changeStatus(selectedQuote.id, 'converted')}>
              <ShoppingCart size={14} /> Convert to Sale
            </button>
          )}
        </div>

        <p className="text-xs text-base-content/30 mt-4">Created by: {selectedQuote.entered_by} · {fmtDate(selectedQuote.created_at)}</p>
      </div>
    );
  }

  return null;
}
