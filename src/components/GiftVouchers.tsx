import React, { useState, useEffect, useCallback } from 'react';
import { GiftVoucher, StaffUser, Customer } from '../types';
import { getAllGiftVouchers, addGiftVoucher, generateVoucherNumber, useGiftVoucher, cancelGiftVoucher, searchCustomers, addCustomer, formatPaymentMethod, esc, titleCase, SALUTATIONS, EXPENSE_PAYMENT_METHODS, createSale, generateInvoiceNumber, addSaleItem, addPayment } from '../utils/db';
import { Gift, Plus, Search, Trash2, Printer, CheckCircle, XCircle, AlertTriangle, Users, UserPlus, Loader2 } from 'lucide-react';
import { PostcodeLookup } from './PostcodeLookup';

interface Props { currentUser: StaffUser; }

export function GiftVouchers({ currentUser }: Props) {
  const [vouchers, setVouchers] = useState<GiftVoucher[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [amount, setAmount] = useState('');
  const [purchaserName, setPurchaserName] = useState('');
  const [purchaserCustomerId, setPurchaserCustomerId] = useState<number | null>(null);
  const [purchaserSelected, setPurchaserSelected] = useState<{ name: string; address: string; postcode: string } | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientCustomerId, setRecipientCustomerId] = useState<number | null>(null);
  const [recipientSelected, setRecipientSelected] = useState<{ name: string; address: string; postcode: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [expiryMonths, setExpiryMonths] = useState('12');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Customer search (purchaser — name-based)
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [showAddCust, setShowAddCust] = useState(false);
  const [newCust, setNewCust] = useState({ salutation: '', first_name: '', surname: '', phone: '', email: '' });

  // Print state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const load = useCallback(async () => {
    const all = await getAllGiftVouchers(filter === 'all' ? undefined : filter);
    setVouchers(all);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Customer search
  useEffect(() => {
    if (custSearch.length >= 2) {
      searchCustomers(custSearch).then(r => { setCustResults(r); setShowCustDrop(true); });
    } else {
      setCustResults([]); setShowCustDrop(false);
    }
  }, [custSearch]);

  const filtered = vouchers.filter(v => {
    if (!search) return true;
    const s = search.toLowerCase();
    return v.voucher_number.toLowerCase().includes(s) || v.purchaser_name.toLowerCase().includes(s) || v.recipient_name.toLowerCase().includes(s);
  });

  function clearForm() {
    setAmount(''); setPurchaserName(''); setPurchaserCustomerId(null); setPurchaserSelected(null);
    setRecipientName(''); setRecipientCustomerId(null); setRecipientSelected(null);
    setPaymentMethod('cash'); setNotes(''); setCustSearch(''); setExpiryMonths('12');
  }

  async function handleIssue() {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setFormError('Please enter a valid amount'); return; }
    if (!purchaserName.trim()) { setFormError('Please enter purchaser name'); return; }
    setFormError('');
    setSaving(true);
    try {
      const num = await generateVoucherNumber();
      const today = new Date();
      const expiry = new Date(today);
      expiry.setMonth(expiry.getMonth() + parseInt(expiryMonths));
      const pName = titleCase(purchaserName.trim());
      await addGiftVoucher({
        voucher_number: num,
        amount: val,
        purchaser_name: pName,
        purchaser_customer_id: purchaserCustomerId,
        recipient_name: titleCase(recipientName.trim()),
        recipient_customer_id: recipientCustomerId,
        payment_method: paymentMethod,
        date_issued: today.toISOString().split('T')[0],
        date_expires: expiry.toISOString().split('T')[0],
        notes: notes.trim(),
        entered_by: currentUser.initials,
      });

      // Record in the Sales Ledger
      const invoiceNum = await generateInvoiceNumber();
      const saleId = await createSale({
        customer_name: pName,
        customer_id: purchaserCustomerId,
        payment_method: paymentMethod,
        total: val,
        sold_by: currentUser.initials,
        invoice_number: invoiceNum,
        notes: `Gift Voucher ${num} — £${val.toFixed(2)}`,
        amount_paid: val,
        balance_due: 0,
        status: 'paid',
        sale_type: 'receipt',
      });
      await addSaleItem({
        sale_id: saleId,
        stock_id: 0,
        part_number: num,
        description: `Gift Voucher ${num}`,
        qty: 1,
        unit_price: val,
        line_total: val,
      });

      // Record payment so it appears in CashUp / Takings
      await addPayment({
        sale_id: saleId,
        payment_date: today.toISOString().split('T')[0],
        amount: val,
        payment_method: paymentMethod,
        notes: `Gift Voucher ${num} purchased`,
        entered_by: currentUser.initials,
      });

      setSuccess(`Gift Voucher ${num} issued for £${val.toFixed(2)} — Invoice ${invoiceNum}`);
      setShowForm(false);
      clearForm();
      await load();
      setTimeout(() => setSuccess(''), 5000);

      // Auto-generate PDF for the newly issued voucher
      await generateVoucherPdf({
        id: 0,
        voucher_number: num,
        amount: val,
        balance: val,
        purchaser_name: pName,
        purchaser_customer_id: purchaserCustomerId,
        recipient_name: titleCase(recipientName.trim()),
        recipient_customer_id: recipientCustomerId,
        payment_method: paymentMethod,
        date_issued: today.toISOString().split('T')[0],
        date_expires: expiry.toISOString().split('T')[0],
        notes: notes.trim(),
        entered_by: currentUser.initials,
        status: 'active',
      } as GiftVoucher);
    } catch (err) {
      setFormError('Error issuing voucher: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(gv: GiftVoucher) {
    if (!confirm(`Cancel voucher ${gv.voucher_number}? This cannot be undone.`)) return;
    await cancelGiftVoucher(gv.id);
    await load();
  }

  async function handleAddCustomer() {
    if (!newCust.first_name.trim() || !newCust.surname.trim()) { setFormError('First name and surname required'); return; }
    try {
      await addCustomer({
        salutation: newCust.salutation, first_name: titleCase(newCust.first_name.trim()), surname: titleCase(newCust.surname.trim()),
        address_line1: '', address_line2: '', address_line3: '', postcode: '',
        phone: newCust.phone, email: newCust.email.toLowerCase(),
      });
      const results = await searchCustomers(newCust.surname);
      if (results.length > 0) {
        const c = results[0];
        setPurchaserCustomerId(c.id);
        setPurchaserName([c.first_name, c.surname].filter(Boolean).join(' '));
        setCustSearch([c.first_name, c.surname].filter(Boolean).join(' '));
        setPurchaserSelected({
          name: [c.first_name, c.surname].filter(Boolean).join(' '),
          address: [c.address_line1, c.address_line2, c.address_line3].filter(Boolean).join(', '),
          postcode: c.postcode,
        });
      }
      setShowAddCust(false);
      setNewCust({ salutation: '', first_name: '', surname: '', phone: '', email: '' });
    } catch (err) {
      setFormError('Error adding customer: ' + (err as Error).message);
    }
  }

  function selectPurchaserFromPostcode(c: Customer) {
    const name = [c.first_name, c.surname].filter(Boolean).join(' ');
    setPurchaserName(name);
    setPurchaserCustomerId(c.id);
    setCustSearch(name);
    setPurchaserSelected({
      name,
      address: [c.address_line1, c.address_line2, c.address_line3].filter(Boolean).join(', '),
      postcode: c.postcode,
    });
  }

  function selectRecipientFromPostcode(c: Customer) {
    const name = [c.first_name, c.surname].filter(Boolean).join(' ');
    setRecipientName(name);
    setRecipientCustomerId(c.id);
    setRecipientSelected({
      name,
      address: [c.address_line1, c.address_line2, c.address_line3].filter(Boolean).join(', '),
      postcode: c.postcode,
    });
  }

  function statusBadge(s: string) {
    const m: Record<string, string> = { active: 'badge-success', used: 'badge-ghost', expired: 'badge-warning', cancelled: 'badge-error' };
    return <span className={`badge badge-sm ${m[s] || 'badge-ghost'}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>;
  }

  function fmtDate(d: string) {
    if (!d) return '—';
    try { return new Date(d.replace(' ', 'T')).toLocaleDateString('en-GB'); } catch { return d; }
  }

  function fmtDateLong(d: string) {
    if (!d) return '—';
    try { return new Date(d.replace(' ', 'T')).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return d; }
  }

  async function generateVoucherPdf(v: GiftVoucher) {
    setPdfGenerating(true);
    setPdfUrl(null);
    try {
      const safeNum = v.voucher_number.replace(/'/g, "\\'");
      const safeRecipient = (v.recipient_name || '').replace(/'/g, "\\'");
      const issuedStr = fmtDateLong(v.date_issued);
      const expiresStr = fmtDateLong(v.date_expires);
      const filename = `gift-voucher-${v.voucher_number}.pdf`;
      const outputPath = `/tmp/${filename}`;

      const script = `
from reportlab.lib.pagesizes import A5, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas

c = canvas.Canvas('${outputPath}', pagesize=landscape(A5))
w, h = landscape(A5)
cx = w / 2

# Background
c.setFillColor(colors.HexColor("#FFFBF0"))
c.rect(0, 0, w, h, fill=1, stroke=0)

# Dashed border
c.setStrokeColor(colors.HexColor("#8B6914"))
c.setLineWidth(2)
c.setDash(6, 4)
c.roundRect(15, 15, w - 30, h - 30, 12, stroke=1, fill=0)
c.setDash()

# Header
y = h - 55
c.setFont("Helvetica-Bold", 22)
c.setFillColor(colors.HexColor("#8B6914"))
c.drawCentredString(cx, y, "Sylvia's Surprises")
y -= 16
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawCentredString(cx, y, "Antiques, Collectibles & More")

# Divider
y -= 18
c.setStrokeColor(colors.HexColor("#DDD"))
c.setLineWidth(0.5)
c.setDash(3, 3)
c.line(60, y, w - 60, y)
c.setDash()

# Gift Voucher title
y -= 28
c.setFont("Helvetica-Bold", 16)
c.setFillColor(colors.HexColor("#333333"))
c.drawCentredString(cx, y, "GIFT VOUCHER")

# Voucher number
y -= 28
c.setFont("Courier-Bold", 22)
c.setFillColor(colors.HexColor("#8B6914"))
c.drawCentredString(cx, y, '${safeNum}')

# Amount
y -= 38
c.setFont("Helvetica-Bold", 36)
c.setFillColor(colors.HexColor("#333333"))
c.drawCentredString(cx, y, '\\u00a3${v.amount.toFixed(2)}')

# Recipient
${safeRecipient ? `
y -= 28
c.setFont("Helvetica", 12)
c.setFillColor(colors.HexColor("#555555"))
c.drawCentredString(cx, y, 'For: ${safeRecipient}')
` : ''}

# Dates
y -= 24
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawCentredString(cx, y, 'Issued: ${issuedStr}')
y -= 14
c.drawCentredString(cx, y, 'Valid Until: ${expiresStr}')

# Divider
y -= 16
c.setStrokeColor(colors.HexColor("#DDD"))
c.setDash(3, 3)
c.line(60, y, w - 60, y)
c.setDash()

# Footer
y -= 18
c.setFont("Helvetica", 8)
c.setFillColor(colors.HexColor("#999999"))
c.drawCentredString(cx, y, 'Present this voucher at the time of purchase.')
y -= 12
c.drawCentredString(cx, y, 'Memorial Hall, Main Road, Union Mills, IM4 4AD  |  07624 433076')

c.save()
print('OK')
`;

      await window.tasklet.writeFileToDisk('/tmp/gen_gift_voucher.py', script);
      const result = await window.tasklet.runCommand('cd /tmp && python3 gen_gift_voucher.py', 120);
      if (!result.log.includes('OK')) throw new Error(result.log);

      const b64Result = await window.tasklet.runCommand(`base64 -w0 ${outputPath}`);
      const b64 = b64Result.log.trim();
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfFilename(filename);

      // Auto-download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } catch (err) {
      setFormError('Error generating PDF: ' + (err as Error).message);
    } finally {
      setPdfGenerating(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Gift size={24} /> Gift Vouchers</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Issue New Voucher
        </button>
      </div>

      {success && (
        <div className="alert alert-success mb-4"><CheckCircle size={16} /> {success}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Issued</div>
          <div className="stat-value text-lg">{vouchers.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Active</div>
          <div className="stat-value text-lg text-success">{vouchers.filter(v => v.status === 'active').length}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Outstanding Value</div>
          <div className="stat-value text-lg">£{vouchers.filter(v => v.status === 'active').reduce((s, v) => s + v.balance, 0).toFixed(2)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Redeemed</div>
          <div className="stat-value text-lg">{vouchers.filter(v => v.status === 'used').length}</div>
        </div>
      </div>

      {/* Issue Form */}
      {showForm && (
        <div className="card bg-base-200 shadow-md mb-4">
          <div className="card-body p-4">
            <h3 className="font-bold text-lg mb-2">Issue New Gift Voucher</h3>
            {formError && <div className="alert alert-error text-sm py-2 mb-2"><AlertTriangle size={14} /> {formError}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Amount */}
              <div className="form-control">
                <label className="label py-1"><span className="label-text font-semibold">Value (£) *</span></label>
                <input className="input input-bordered input-sm" placeholder="e.g. 25.00" value={amount}
                  onChange={e => setAmount(e.target.value)} onBlur={() => { const v = parseFloat(amount); if (v > 0) setAmount(v.toFixed(2)); }} />
              </div>

              {/* Payment Method */}
              <div className="form-control">
                <label className="label py-1"><span className="label-text font-semibold">Payment Method</span></label>
                <select className="select select-bordered select-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="sumup">SumUp (Card)</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="ebay">eBay</option>
                </select>
              </div>
            </div>

            {/* Purchaser Section */}
            <div className="mt-3 p-3 bg-base-300/50 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">👤 Purchased By *</h4>
              <PostcodeLookup
                type="customer"
                label="Find purchaser by postcode"
                selected={purchaserSelected}
                onSelect={(c) => selectPurchaserFromPostcode(c as Customer)}
                onClear={() => { setPurchaserSelected(null); setPurchaserName(''); setPurchaserCustomerId(null); setCustSearch(''); }}
              />
              {!purchaserSelected && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    <div className="form-control flex-1 relative">
                      <input className="input input-bordered input-sm capitalize w-full" placeholder="Or search/type name..."
                        value={custSearch || purchaserName}
                        onChange={e => { setCustSearch(e.target.value); setPurchaserName(e.target.value); setPurchaserCustomerId(null); }}
                        onFocus={() => { if (custResults.length > 0) setShowCustDrop(true); }}
                        onBlur={() => setTimeout(() => setShowCustDrop(false), 200)} />
                      {showCustDrop && custResults.length > 0 && (
                        <ul className="absolute top-full left-0 right-0 z-50 bg-base-100 border border-base-300 rounded shadow max-h-40 overflow-auto mt-1">
                          {custResults.map(c => (
                            <li key={c.id} className="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => selectPurchaserFromPostcode(c)}>
                              {[c.salutation, c.first_name, c.surname].filter(Boolean).join(' ')}
                              {c.postcode && <span className="text-xs text-base-content/50 ml-2 font-mono">{c.postcode}</span>}
                              {c.phone && <span className="text-xs text-base-content/50 ml-2">{c.phone}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <button className="btn btn-ghost btn-sm btn-square" onClick={() => setShowAddCust(!showAddCust)} title="Add new customer">
                      <UserPlus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Recipient Section */}
            <div className="mt-3 p-3 bg-base-300/50 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">🎁 Purchased For (Recipient)</h4>
              <PostcodeLookup
                type="customer"
                label="Find recipient by postcode"
                selected={recipientSelected}
                onSelect={(c) => selectRecipientFromPostcode(c as Customer)}
                onClear={() => { setRecipientSelected(null); setRecipientName(''); setRecipientCustomerId(null); }}
              />
              {/* Always show editable name — pre-filled from postcode lookup but changeable */}
              <div className="form-control mt-2">
                <label className="label py-0.5"><span className="label-text text-xs">Recipient Name {recipientSelected ? '(editable — change if different from address holder)' : ''}</span></label>
                <input className="input input-bordered input-sm capitalize" placeholder={recipientSelected ? 'Change name if needed' : 'Type recipient name (blank = same as purchaser)'}
                  value={recipientName} onChange={e => setRecipientName(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {/* Expiry */}
              <div className="form-control">
                <label className="label py-1"><span className="label-text font-semibold">Valid For</span></label>
                <select className="select select-bordered select-sm" value={expiryMonths} onChange={e => setExpiryMonths(e.target.value)}>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                  <option value="24">24 Months</option>
                  <option value="36">36 Months</option>
                </select>
              </div>

              {/* Notes */}
              <div className="form-control">
                <label className="label py-1"><span className="label-text font-semibold">Notes</span></label>
                <input className="input input-bordered input-sm" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            {/* Quick-add customer */}
            {showAddCust && (
              <div className="mt-3 p-3 bg-base-300 rounded">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><UserPlus size={14} /> Quick-Add Customer</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <select className="select select-bordered select-xs" value={newCust.salutation} onChange={e => setNewCust({ ...newCust, salutation: e.target.value })}>
                    <option value="">Salutation</option>
                    {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input className="input input-bordered input-xs capitalize" placeholder="First Name *" value={newCust.first_name} onChange={e => setNewCust({ ...newCust, first_name: e.target.value })} />
                  <input className="input input-bordered input-xs capitalize" placeholder="Surname *" value={newCust.surname} onChange={e => setNewCust({ ...newCust, surname: e.target.value })} />
                  <input className="input input-bordered input-xs" placeholder="Phone" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} />
                  <input className="input input-bordered input-xs" placeholder="Email" value={newCust.email} onChange={e => setNewCust({ ...newCust, email: e.target.value.toLowerCase() })} />
                  <button className="btn btn-success btn-xs" onClick={handleAddCustomer}>Add</button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); clearForm(); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleIssue} disabled={saving}>
                {saving ? 'Issuing...' : '🎁 Issue Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'active', 'used', 'expired', 'cancelled'].map(f => (
          <button key={f} className={`btn btn-xs ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <input className="input input-bordered input-xs w-48" placeholder="Search vouchers..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Voucher Table */}
      <div className="overflow-x-auto">
        <table className="table table-xs table-zebra w-full">
          <thead>
            <tr>
              <th>Voucher #</th>
              <th>Value</th>
              <th>Balance</th>
              <th>Purchaser</th>
              <th>Recipient</th>
              <th>Issued</th>
              <th>Expires</th>
              <th>Paid By</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-base-content/50">No vouchers found</td></tr>
            )}
            {filtered.map(v => {
              const isExpired = v.status === 'active' && v.date_expires && v.date_expires < today;
              return (
                <tr key={v.id} className={isExpired ? 'bg-warning/10' : ''}>
                  <td className="font-mono font-bold text-primary">{v.voucher_number}</td>
                  <td>£{v.amount.toFixed(2)}</td>
                  <td className={v.balance > 0 ? 'text-success font-bold' : 'text-base-content/50'}>£{v.balance.toFixed(2)}</td>
                  <td>{v.purchaser_name}</td>
                  <td>{v.recipient_name || '—'}</td>
                  <td>{fmtDate(v.date_issued)}</td>
                  <td className={isExpired ? 'text-warning font-bold' : ''}>{fmtDate(v.date_expires)} {isExpired && '⚠️'}</td>
                  <td><span className="whitespace-nowrap">{formatPaymentMethod(v.payment_method)}</span></td>
                  <td>{isExpired ? <span className="badge badge-warning badge-sm">Expired</span> : statusBadge(v.status)}</td>
                  <td className="flex gap-1">
                    <button className="btn btn-ghost btn-xs" title="Download PDF" onClick={() => generateVoucherPdf(v)} disabled={pdfGenerating}><Printer size={12} /></button>
                    {v.status === 'active' && (
                      <button className="btn btn-ghost btn-xs text-error" title="Cancel" onClick={() => handleCancel(v)}><XCircle size={12} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PDF Generating Indicator */}
      {pdfGenerating && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg p-6 shadow-xl text-center">
            <Loader2 size={32} className="animate-spin mx-auto mb-3 text-primary" />
            <p className="font-semibold">Generating Gift Voucher PDF...</p>
          </div>
        </div>
      )}
    </div>
  );
}
