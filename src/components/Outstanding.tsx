import React, { useState, useEffect, useCallback } from 'react';
import { Sale, Payment, StaffUser } from '../types';
import { getOutstandingInvoices, getOverdueInvoices, getPaymentsForSale, addPayment, getSaleItems, formatPaymentMethod } from '../utils/db';
import { Clock, AlertTriangle, CheckCircle, Plus, Banknote, CreditCard, Landmark, Globe, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
  onViewInvoice: (saleId: number) => void;
}

export function Outstanding({ currentUser, onViewInvoice }: Props) {
  const [invoices, setInvoices] = useState<Sale[]>([]);
  const [overdue, setOverdue] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Record<number, Payment[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');
  const [payModal, setPayModal] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<string>('cash');
  const [payNotes, setPayNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<{ text: string; saleId: number; invoiceNum: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, ov] = await Promise.all([getOutstandingInvoices(), getOverdueInvoices()]);
      setInvoices(inv);
      setOverdue(ov);
      // Payments loaded on-demand when row expanded (saves DB calls)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = filter === 'overdue' ? overdue : invoices;
  const totalOutstanding = displayed.reduce((s, i) => s + (i.balance_due || 0), 0);

  async function handleRecordPayment() {
    if (!payModal || !payAmount) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) { setErrorMsg('Please enter a valid payment amount'); return; }
    
    const balanceBefore = payModal.balance_due || 0;
    if (amt > balanceBefore + 0.01) { setErrorMsg(`Payment £${amt.toFixed(2)} exceeds balance due £${balanceBefore.toFixed(2)}`); return; }
    
    setProcessing(true);
    setErrorMsg('');
    
    const invoiceNum = payModal.invoice_number;
    const saleId = payModal.id;
    
    try {
      await addPayment({
        sale_id: saleId,
        payment_date: new Date().toISOString().split('T')[0],
        amount: amt,
        payment_method: payMethod,
        notes: payNotes,
        entered_by: currentUser.initials,
      });
      
      const newBalance = Math.max(0, balanceBefore - amt);
      
      setPayModal(null);
      setPayAmount('');
      setPayNotes('');
      setErrorMsg('');
      
      const msg = newBalance <= 0
        ? `✅ Payment of £${amt.toFixed(2)} recorded — Invoice ${invoiceNum} is now PAID IN FULL!`
        : `✅ Payment of £${amt.toFixed(2)} recorded against ${invoiceNum}. Remaining balance: £${newBalance.toFixed(2)}`;
      setSuccessMsg({ text: msg, saleId, invoiceNum });
      
      await load();
    } catch (err: any) {
      console.error('Payment recording failed:', err);
      setErrorMsg(`Failed to record payment: ${err?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-4 w-full">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Clock size={24} /> Outstanding Invoices
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="text-sm text-base-content/60">Total Outstanding</div>
            <div className="text-2xl font-bold text-error">£{totalOutstanding.toFixed(2)}</div>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="text-sm text-base-content/60">Unpaid Invoices</div>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="text-sm text-base-content/60">Overdue</div>
            <div className="text-2xl font-bold text-warning">{overdue.length}</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>
          All ({invoices.length})
        </button>
        <button className={`btn btn-sm ${filter === 'overdue' ? 'btn-warning' : 'btn-outline'}`} onClick={() => setFilter('overdue')}>
          <AlertTriangle size={14} /> Overdue ({overdue.length})
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="alert alert-success mb-4 shadow-md">
          <CheckCircle size={20} />
          <span className="font-semibold">{successMsg.text}</span>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-ghost" onClick={() => { onViewInvoice(successMsg.saleId); setSuccessMsg(null); }}>
              View Invoice
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSuccessMsg(null)}>✕</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><span className="loading loading-spinner loading-lg" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-8 text-base-content/50">
          <CheckCircle size={48} className="mx-auto mb-2 text-success" />
          <p className="text-lg font-semibold">All clear! No outstanding invoices.</p>
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <table className="table table-xs w-full">
            <thead>
              <tr>
                <th className="w-28">Invoice</th>
                <th className="w-20">Date</th>
                <th>Customer</th>
                <th className="text-right w-16">Total</th>
                <th className="text-right w-16">Paid</th>
                <th className="text-right w-16">Due</th>
                <th className="w-20">Due Date</th>
                <th className="w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(inv => {
                const isOverdue = inv.due_date && inv.due_date < new Date().toISOString().split('T')[0];
                const invPayments = payments[inv.id] || [];
                const isExpanded = expandedId === inv.id;
                return (
                  <React.Fragment key={inv.id}>
                    <tr className={`${isOverdue ? 'bg-error/10' : ''} cursor-pointer hover`} onClick={async () => {
                      if (isExpanded) { setExpandedId(null); return; }
                      setExpandedId(inv.id);
                      if (!payments[inv.id]) {
                        const p = await getPaymentsForSale(inv.id);
                        setPayments(prev => ({ ...prev, [inv.id]: p }));
                      }
                    }}>
                      <td className="font-mono text-xs">
                        <div className="flex items-center gap-1">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <button className="link link-primary" onClick={(e) => { e.stopPropagation(); onViewInvoice(inv.id); }}>{inv.invoice_number}</button>
                        </div>
                      </td>
                      <td className="text-xs">{new Date(inv.sale_date + 'Z').toLocaleDateString('en-GB')}</td>
                      <td className="text-xs truncate">{inv.customer_name}</td>
                      <td className="text-right font-semibold text-xs">£{inv.total.toFixed(2)}</td>
                      <td className="text-right text-success text-xs">£{(inv.amount_paid || 0).toFixed(2)}</td>
                      <td className="text-right font-bold text-error text-xs">£{(inv.balance_due || 0).toFixed(2)}</td>
                      <td className="text-xs">
                        {inv.due_date ? (
                          <span className={isOverdue ? 'text-error font-bold' : ''}>{new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-GB')}</span>
                        ) : '—'}
                      </td>
                      <td>
                        {inv.status === 'partial' ? (
                          <span className="badge badge-warning badge-xs">Part</span>
                        ) : (
                          <span className="badge badge-error badge-xs">Unpaid</span>
                        )}
                        {isOverdue && <span className="badge badge-error badge-xs ml-0.5">!</span>}
                      </td>
                    </tr>
                    {/* Expanded: payment trail + inline payment form */}
                    {isExpanded && (
                      <tr className="bg-base-200/50">
                        <td colSpan={8} className="py-3 px-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Left: payment trail */}
                            <div>
                              {invPayments.length > 0 && (
                                <>
                                  <div className="text-xs font-semibold text-base-content/50 mb-1">💰 Payment Trail</div>
                                  <div className="mb-2" style={{display:'grid',gridTemplateColumns:'1.5rem 5.5rem 4.5rem auto',gap:'0.25rem 0.5rem',alignItems:'center'}}>
                                    {invPayments.map((p, i) => (
                                      <React.Fragment key={p.id}>
                                        <span className="badge badge-ghost badge-xs">#{i + 1}</span>
                                        <span className="text-sm">{new Date(p.payment_date + 'T00:00:00').toLocaleDateString('en-GB')}</span>
                                        <span className="text-sm font-bold text-success text-right">£{p.amount.toFixed(2)}</span>
                                        <span className="badge badge-sm badge-outline w-fit">{formatPaymentMethod(p.payment_method)}</span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </>
                              )}
                              <div className="text-sm mt-2">
                                <span className="text-base-content/60">Total: </span><span className="font-bold">£{inv.total.toFixed(2)}</span>
                                <span className="mx-2">·</span>
                                <span className="text-base-content/60">Paid: </span><span className="font-bold text-success">£{(inv.amount_paid || 0).toFixed(2)}</span>
                                <span className="mx-2">·</span>
                                <span className="text-base-content/60">Due: </span><span className="font-bold text-error">£{(inv.balance_due || 0).toFixed(2)}</span>
                              </div>
                              <button className="btn btn-ghost btn-xs mt-2" onClick={(e) => { e.stopPropagation(); onViewInvoice(inv.id); }}>
                                📄 View Full Invoice
                              </button>
                            </div>

                            {/* Right: inline payment form */}
                            <div className="card bg-base-100 shadow-sm border border-base-300">
                              <div className="card-body p-3">
                                <h4 className="font-bold text-sm flex items-center gap-1"><Banknote size={16} /> Record Payment</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-lg font-bold">£</span>
                                  <input type="text" className="input input-bordered input-sm w-32"
                                    value={payModal?.id === inv.id ? payAmount : (inv.balance_due || 0).toFixed(2)}
                                    onClick={(e) => { e.stopPropagation(); if (payModal?.id !== inv.id) { setPayModal(inv); setPayAmount((inv.balance_due || 0).toFixed(2)); setPayNotes(''); setErrorMsg(''); } }}
                                    onChange={e => { setPayAmount(e.target.value); if (payModal?.id !== inv.id) { setPayModal(inv); } }}
                                  />
                                  <span className="text-xs text-base-content/50">of £{(inv.balance_due || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex gap-1.5 flex-wrap mt-1">
                                  {(['cash', 'sumup', 'bank_transfer', 'ebay'] as const).map(m => (
                                    <button key={m}
                                      className={`btn btn-xs ${(payModal?.id === inv.id ? payMethod : 'cash') === m ? (m === 'cash' ? 'btn-success' : m === 'sumup' ? 'btn-info' : m === 'bank_transfer' ? 'btn-secondary' : 'btn-warning') : 'btn-outline'}`}
                                      onClick={(e) => { e.stopPropagation(); setPayMethod(m); if (payModal?.id !== inv.id) { setPayModal(inv); setPayAmount((inv.balance_due || 0).toFixed(2)); setPayNotes(''); setErrorMsg(''); } }}>
                                      {m === 'cash' ? '💵 Cash' : m === 'sumup' ? '💳 SumUp' : m === 'bank_transfer' ? '🏦 Bank' : '🌐 eBay'}
                                    </button>
                                  ))}
                                </div>
                                <input type="text" className="input input-bordered input-xs w-full mt-1"
                                  placeholder="Notes (optional)"
                                  value={payModal?.id === inv.id ? payNotes : ''}
                                  onClick={(e) => { e.stopPropagation(); if (payModal?.id !== inv.id) { setPayModal(inv); setPayAmount((inv.balance_due || 0).toFixed(2)); setPayNotes(''); setErrorMsg(''); } }}
                                  onChange={e => { setPayNotes(e.target.value); if (payModal?.id !== inv.id) { setPayModal(inv); } }}
                                />
                                {errorMsg && payModal?.id === inv.id && (
                                  <div className="text-error text-xs mt-1 flex items-center gap-1"><AlertTriangle size={12} /> {errorMsg}</div>
                                )}
                                <button className="btn btn-primary btn-sm mt-2 gap-1"
                                  disabled={processing}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (payModal?.id !== inv.id) {
                                      setPayModal(inv);
                                      setPayAmount((inv.balance_due || 0).toFixed(2));
                                      setPayNotes('');
                                      setErrorMsg('');
                                      return;
                                    }
                                    handleRecordPayment();
                                  }}>
                                  {processing && payModal?.id === inv.id ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={14} />}
                                  Pay Now
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}


    </div>
  );
}
