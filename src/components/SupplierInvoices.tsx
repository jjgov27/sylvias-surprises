import React, { useState, useEffect } from 'react';
import { FileText, Plus, ChevronRight, ChevronDown, DollarSign, AlertTriangle } from 'lucide-react';
import { StaffUser, Supplier, SupplierInvoice, SupplierPayment } from '../types';
import {
  getAllSupplierInvoices, addSupplierInvoice, getSupplierPayments, addSupplierPayment,
  getAllSuppliers, addSupplier, formatPaymentMethod, STOCK_PAYMENT_METHODS, SOURCE_TYPES, titleCase, esc,
} from '../utils/db';

interface SupplierInvoicesProps {
  currentUser: StaffUser;
}

export const SupplierInvoices: React.FC<SupplierInvoicesProps> = ({ currentUser }) => {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filter, setFilter] = useState('outstanding');
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  // New invoice form
  const [invRef, setInvRef] = useState('');
  const [invSupplierId, setInvSupplierId] = useState<number | null>(null);
  const [invSupplierName, setInvSupplierName] = useState('');
  const [invDescription, setInvDescription] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [invDueDate, setInvDueDate] = useState('');
  const [invNotes, setInvNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payingId, setPayingId] = useState<number | null>(null);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    const [invs, sups] = await Promise.all([
      filter === 'outstanding'
        ? getAllSupplierInvoices().then(all => all.filter(i => i.status !== 'paid'))
        : filter === 'all'
          ? getAllSupplierInvoices()
          : getAllSupplierInvoices(filter),
      getAllSuppliers(),
    ]);
    setInvoices(invs);
    setSuppliers(sups);
    setLoading(false);
  }

  async function handleNewInvoice() {
    setError('');
    if (!invDescription.trim()) { setError('Description is required'); return; }
    const amt = parseFloat(invAmount);
    if (!amt || amt <= 0) { setError('Amount must be greater than 0'); return; }

    setSaving(true);
    try {
      const supplierName = invSupplierId
        ? suppliers.find(s => s.id === invSupplierId)?.name || invSupplierName
        : invSupplierName;

      await addSupplierInvoice({
        invoice_ref: invRef.trim(),
        supplier_id: invSupplierId,
        supplier_name: titleCase(supplierName.trim()),
        description: titleCase(invDescription.trim()),
        total_amount: amt,
        invoice_date: invDate,
        due_date: invDueDate || '',
        notes: invNotes.trim(),
        entered_by: currentUser.initials,
      });
      setSuccess('Supplier invoice recorded! ✅');
      setShowNew(false);
      resetNewForm();
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function resetNewForm() {
    setInvRef(''); setInvSupplierId(null); setInvSupplierName('');
    setInvDescription(''); setInvAmount(''); setInvNotes('');
    setInvDate(new Date().toISOString().slice(0, 10)); setInvDueDate('');
  }

  async function toggleRow(inv: SupplierInvoice) {
    if (expandedId === inv.id) { setExpandedId(null); return; }
    setExpandedId(inv.id);
    setPayAmount(inv.balance_due.toFixed(2));
    setPayMethod('Bank Transfer');
    setPayNotes('');
    setPayDate(new Date().toISOString().slice(0, 10));
    const p = await getSupplierPayments(inv.id);
    setPayments(p);
  }

  async function handlePay(inv: SupplierInvoice) {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    if (amt > inv.balance_due + 0.01) return;

    setPayingId(inv.id);
    try {
      await addSupplierPayment({
        supplier_invoice_id: inv.id,
        amount: amt,
        payment_method: payMethod.toLowerCase().replace(/ /g, '_'),
        payment_date: payDate,
        notes: payNotes.trim(),
        entered_by: currentUser.initials,
      });
      await load();
      const p = await getSupplierPayments(inv.id);
      setPayments(p);
      // Refresh the pay amount
      const updated = await getAllSupplierInvoices().then(all => all.find(i => i.id === inv.id));
      if (updated) setPayAmount(updated.balance_due.toFixed(2));
    } catch (err) {
      console.warn('Payment failed:', err);
    } finally {
      setPayingId(null);
    }
  }

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return new Date(d.replace(' ', 'T')).toLocaleDateString('en-GB'); } catch { return d; }
  };

  const totalOwed = invoices.reduce((s, i) => s + i.balance_due, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      unpaid: 'badge-error', partial: 'badge-warning', paid: 'badge-success', overdue: 'badge-error',
    };
    return `badge badge-sm ${map[s] || 'badge-ghost'}`;
  };

  return (
    <div className="p-4 w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2"><FileText size={22} /> Supplier Invoices</h2>
        <button className="btn btn-primary btn-sm gap-1" onClick={() => setShowNew(!showNew)}>
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {success && <div className="alert alert-success mb-3 py-2 text-sm">{success}</div>}

      {/* Stats */}
      <div className="stats stats-horizontal shadow mb-4 w-full">
        <div className="stat py-2 px-4">
          <div className="stat-title text-xs">Total Outstanding</div>
          <div className="stat-value text-lg text-error">£{totalOwed.toFixed(2)}</div>
        </div>
        <div className="stat py-2 px-4">
          <div className="stat-title text-xs">Invoices Shown</div>
          <div className="stat-value text-lg">{invoices.length}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs tabs-boxed mb-4 gap-1">
        {['outstanding', 'unpaid', 'partial', 'paid', 'all'].map(f => (
          <button key={f} className={`tab tab-sm ${filter === f ? 'tab-active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'outstanding' ? 'Outstanding' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* New Invoice Form */}
      {showNew && (
        <div className="card bg-base-200 p-4 mb-4">
          <h3 className="font-bold text-sm mb-3">Record Supplier Invoice</h3>
          {error && <div className="alert alert-error mb-2 py-1 text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text text-xs">Supplier</label>
              <select className="select select-bordered select-sm w-full" value={invSupplierId || ''} onChange={e => {
                const id = e.target.value ? Number(e.target.value) : null;
                setInvSupplierId(id);
                if (id) setInvSupplierName(suppliers.find(s => s.id === id)?.name || '');
              }}>
                <option value="">— Select or type below —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className="input input-bordered input-sm w-full mt-1" placeholder="Or type supplier name"
                value={invSupplierName} onChange={e => { setInvSupplierName(e.target.value); setInvSupplierId(null); }} style={{ textTransform: 'capitalize' }} />
            </div>
            <div>
              <label className="label label-text text-xs">Invoice Ref (optional)</label>
              <input className="input input-bordered input-sm w-full" value={invRef} onChange={e => setInvRef(e.target.value)} placeholder="Supplier's invoice number" />
            </div>
            <div className="md:col-span-2">
              <label className="label label-text text-xs">Description</label>
              <input className="input input-bordered input-sm w-full" value={invDescription}
                onChange={e => setInvDescription(titleCase(e.target.value))} placeholder="What was purchased?" style={{ textTransform: 'capitalize' }} />
            </div>
            <div>
              <label className="label label-text text-xs">Amount (£)</label>
              <input className="input input-bordered input-sm w-full" value={invAmount} onChange={e => setInvAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label label-text text-xs">Invoice Date</label>
              <input type="date" className="input input-bordered input-sm w-full" value={invDate} onChange={e => setInvDate(e.target.value)} />
            </div>
            <div>
              <label className="label label-text text-xs">Due Date (optional)</label>
              <input type="date" className="input input-bordered input-sm w-full" value={invDueDate} onChange={e => setInvDueDate(e.target.value)} />
            </div>
            <div>
              <label className="label label-text text-xs">Notes (optional)</label>
              <input className="input input-bordered input-sm w-full" value={invNotes} onChange={e => setInvNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className={`btn btn-primary btn-sm ${saving ? 'loading' : ''}`} onClick={handleNewInvoice} disabled={saving}>Save Invoice</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowNew(false); resetNewForm(); setError(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Invoice Table */}
      {loading ? (
        <div className="flex justify-center py-8"><span className="loading loading-spinner loading-lg" /></div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-8 text-base-content/50">No supplier invoices found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th className="w-6"></th>
                <th>Ref</th>
                <th>Supplier</th>
                <th>Description</th>
                <th>Date</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <React.Fragment key={inv.id}>
                  <tr className="cursor-pointer hover:bg-base-200" onClick={() => toggleRow(inv)}>
                    <td>{expandedId === inv.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td className="text-xs">{inv.invoice_ref || '—'}</td>
                    <td className="font-medium max-w-[150px] truncate">{inv.supplier_name || '—'}</td>
                    <td className="max-w-[200px] truncate" title={inv.description}>{inv.description}</td>
                    <td className="text-xs">{fmtDate(inv.invoice_date)}</td>
                    <td className="text-right font-mono">£{inv.total_amount.toFixed(2)}</td>
                    <td className="text-right font-mono text-success">£{inv.amount_paid.toFixed(2)}</td>
                    <td className="text-right font-mono text-error font-bold">£{inv.balance_due.toFixed(2)}</td>
                    <td><span className={statusBadge(inv.status)}>{inv.status}</span></td>
                  </tr>
                  {expandedId === inv.id && (
                    <tr>
                      <td colSpan={9} className="bg-base-200 p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Left: Payment Trail */}
                          <div>
                            <h4 className="font-bold text-sm mb-2">Payment History</h4>
                            {payments.length === 0 ? (
                              <p className="text-sm text-base-content/50 italic">No payments recorded yet.</p>
                            ) : (
                              <div className="space-y-1">
                                {payments.map((p, i) => (
                                  <div key={p.id} className="grid grid-cols-4 gap-2 text-sm items-center" style={{ gridTemplateColumns: '2rem 5rem 5rem auto' }}>
                                    <span className="text-base-content/50">#{i + 1}</span>
                                    <span>{fmtDate(p.payment_date)}</span>
                                    <span className="font-mono font-bold text-success">£{p.amount.toFixed(2)}</span>
                                    <span className="badge badge-outline badge-sm">{formatPaymentMethod(p.payment_method)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="divider my-2" />
                            <div className="flex justify-between text-sm">
                              <span>Total Invoiced:</span><span className="font-mono">£{inv.total_amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-success">
                              <span>Total Paid:</span><span className="font-mono">£{inv.amount_paid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-error">
                              <span>Balance Due:</span><span className="font-mono">£{inv.balance_due.toFixed(2)}</span>
                            </div>
                            {inv.due_date && (
                              <div className="flex justify-between text-sm mt-1">
                                <span>Due Date:</span><span>{fmtDate(inv.due_date)}</span>
                              </div>
                            )}
                            {inv.notes && <p className="text-xs mt-2 text-base-content/60 italic">{inv.notes}</p>}
                          </div>

                          {/* Right: Pay Form */}
                          {inv.balance_due > 0 && (
                            <div className="card bg-base-100 p-3">
                              <h4 className="font-bold text-sm mb-2 flex items-center gap-1"><DollarSign size={14} /> Record Payment</h4>
                              <div className="space-y-2">
                                <div>
                                  <label className="label label-text text-xs">Date</label>
                                  <input type="date" className="input input-bordered input-sm w-full" value={payDate} onChange={e => setPayDate(e.target.value)} />
                                </div>
                                <div>
                                  <label className="label label-text text-xs">Amount (£)</label>
                                  <input className="input input-bordered input-sm w-full" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                                </div>
                                <div>
                                  <label className="label label-text text-xs">Payment Method</label>
                                  <div className="flex flex-wrap gap-1">
                                    {STOCK_PAYMENT_METHODS.map(m => (
                                      <button key={m} className={`btn btn-xs ${payMethod === m ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPayMethod(m)}>{m}</button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label className="label label-text text-xs">Notes (optional)</label>
                                  <input className="input input-bordered input-sm w-full" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                                </div>
                                <button
                                  className={`btn btn-success btn-sm w-full ${payingId === inv.id ? 'loading' : ''}`}
                                  onClick={() => handlePay(inv)} disabled={payingId === inv.id}
                                >💰 Pay Now</button>
                              </div>
                            </div>
                          )}
                          {inv.balance_due <= 0 && (
                            <div className="flex items-center justify-center">
                              <div className="badge badge-success badge-lg gap-1">✅ Fully Paid</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
