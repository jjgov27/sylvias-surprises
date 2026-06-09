import React, { useState, useEffect, useCallback } from 'react';
import { Sale, SaleItem, Refund, CreditNote, StaffUser } from '../types';
import { getAllRefunds, addRefund, getSaleById, getSaleItems, getAllSales, updateStockQty, getStockById, formatPaymentMethod, generateCreditNoteNumber, addCreditNote, titleCase, getCreditNoteByNumber } from '../utils/db';
import { RotateCcw, Search, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { CreditNotePrint } from './CreditNotePrint';

interface Props {
  currentUser: StaffUser;
  onViewInvoice: (saleId: number) => void;
}

export function RefundsView({ currentUser, onViewInvoice }: Props) {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [restockItems, setRestockItems] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCreditNote, setShowCreditNote] = useState<CreditNote | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRefunds(await getAllRefunds());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function searchInvoice() {
    const q = invoiceSearch.trim().toUpperCase();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setFoundSale(null);
    setSaleItems([]);
    try {
      // Search all sales for matching invoice number
      const allSales = await getAllSales();
      const match = allSales.find(s => s.invoice_number.toUpperCase() === q);
      if (!match) {
        setSearchError('Invoice not found. Check the number and try again.');
        return;
      }
      setFoundSale(match);
      setSaleItems(await getSaleItems(match.id));
      setRefundAmount(String(match.total.toFixed(2)));
    } finally {
      setSearching(false);
    }
  }

  async function processRefund() {
    if (!foundSale || !refundAmount || !reason.trim()) return;
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) return;
    setProcessing(true);
    try {
      let cnNumber = '';
      if (refundMethod === 'credit_note') {
        cnNumber = await generateCreditNoteNumber();
        await addCreditNote({
          customer_id: foundSale.customer_id,
          customer_name: foundSale.customer_name,
          credit_note_number: cnNumber,
          date_issued: new Date().toISOString().split('T')[0],
          original_invoice: foundSale.invoice_number,
          amount: amt,
          reason: titleCase(reason),
          entered_by: currentUser.initials,
        });
      }

      await addRefund({
        sale_id: foundSale.id,
        invoice_number: foundSale.invoice_number,
        refund_date: new Date().toISOString().split('T')[0],
        amount: amt,
        refund_method: refundMethod,
        reason: titleCase(reason),
        items_restocked: restockItems ? 1 : 0,
        entered_by: currentUser.initials,
        credit_note_number: cnNumber,
      });

      // Restock items if selected
      if (restockItems) {
        for (const item of saleItems) {
          if (item.is_consignment) continue; // Don't restock consignment
          const stock = await getStockById(item.stock_id);
          if (stock) {
            await updateStockQty(stock.id, stock.qty + item.qty);
          }
        }
      }

      // If credit note was created, show it for printing
      if (refundMethod === 'credit_note' && cnNumber) {
        const cn = await getCreditNoteByNumber(cnNumber);
        if (cn) setShowCreditNote(cn);
      }

      setShowNew(false);
      setFoundSale(null);
      setSaleItems([]);
      setInvoiceSearch('');
      setRefundAmount('');
      setReason('');
      await load();
    } finally {
      setProcessing(false);
    }
  }

  const totalRefunded = refunds.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <RotateCcw size={24} /> Refunds & Returns
      </h2>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="text-sm text-base-content/60">Total Refunds</div>
            <div className="text-2xl font-bold text-error">{refunds.length}</div>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="text-sm text-base-content/60">Total Refunded</div>
            <div className="text-2xl font-bold text-error">£{totalRefunded.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <button className="btn btn-primary gap-2 mb-4" onClick={() => setShowNew(true)}>
        <RotateCcw size={16} /> Process Refund
      </button>

      {/* Refund history */}
      {loading ? (
        <div className="text-center py-8"><span className="loading loading-spinner loading-lg" /></div>
      ) : refunds.length === 0 ? (
        <div className="text-center py-8 text-base-content/50">
          <CheckCircle size={48} className="mx-auto mb-2 text-success" />
          <p>No refunds processed yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm table-zebra w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reason</th>
                <th>Restocked</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map(r => (
                <tr key={r.id}>
                  <td className="text-sm">{new Date(r.refund_date + 'T00:00:00').toLocaleDateString('en-GB')}</td>
                  <td>
                    <button className="link link-primary font-mono text-sm" onClick={() => onViewInvoice(r.sale_id)}>
                      {r.invoice_number}
                    </button>
                  </td>
                  <td className="font-bold text-error">£{r.amount.toFixed(2)}</td>
                  <td>{formatPaymentMethod(r.refund_method)}{r.credit_note_number && ` (${r.credit_note_number})`}</td>
                  <td className="text-sm">{r.reason}</td>
                  <td>{r.items_restocked ? <span className="badge badge-success badge-sm">Yes</span> : <span className="badge badge-ghost badge-sm">No</span>}</td>
                  <td className="font-mono text-sm">{r.entered_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Credit Note Print Modal */}
      {showCreditNote && (
        <CreditNotePrint creditNote={showCreditNote} onClose={() => setShowCreditNote(null)} />
      )}

      {/* New refund modal */}
      {showNew && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl">
            <h3 className="font-bold text-lg flex items-center gap-2"><RotateCcw size={20} /> Process Refund</h3>

            {/* Step 1: Find the invoice */}
            <div className="mt-4">
              <label className="label"><span className="label-text font-semibold">Find Invoice</span></label>
              <div className="flex gap-2">
                <input type="text" className="input input-bordered flex-1 font-mono" placeholder="SS-2506-0001"
                  value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && searchInvoice()} />
                <button className="btn btn-primary gap-1" onClick={searchInvoice} disabled={searching}>
                  <Search size={16} /> Find
                </button>
              </div>
              {searchError && <p className="text-error text-sm mt-1">{searchError}</p>}
            </div>

            {/* Step 2: Show sale details */}
            {foundSale && (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-base-200 rounded-lg">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-bold">{foundSale.invoice_number}</div>
                      <div className="text-sm text-base-content/60">{foundSale.customer_name} · {new Date(foundSale.sale_date + 'Z').toLocaleDateString('en-GB')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">£{foundSale.total.toFixed(2)}</div>
                      <div className="text-sm">{formatPaymentMethod(foundSale.payment_method)}</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-base-content/50 mb-1">Items</div>
                    {saleItems.map(item => (
                      <div key={item.id} className="flex justify-between text-sm py-1 border-b border-base-300 last:border-0">
                        <span>{item.description} {item.is_consignment ? <span className="badge badge-warning badge-xs">Consignment</span> : ''}</span>
                        <span>×{item.qty} = £{item.line_total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Refund details */}
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-sm font-semibold">Refund Amount</span></label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">£</span>
                    <input type="text" className="input input-bordered w-40" value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)} />
                    <span className="text-sm text-base-content/50">of £{foundSale.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-sm font-semibold">Refund Method</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'cash', label: '💵 Cash', cls: 'btn-success' },
                      { key: 'bank_transfer', label: '🏦 Bank Transfer', cls: 'btn-secondary' },
                      { key: 'sumup', label: '💳 SumUp', cls: 'btn-info' },
                      { key: 'credit_note', label: '📝 Credit Note', cls: 'btn-accent' },
                    ].map(m => (
                      <button key={m.key} className={`btn btn-sm ${refundMethod === m.key ? m.cls : 'btn-outline'}`}
                        onClick={() => setRefundMethod(m.key)}>{m.label}</button>
                    ))}
                  </div>
                </div>

                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-sm font-semibold">Reason for Refund</span></label>
                  <input type="text" className="input input-bordered w-full" value={reason}
                    onChange={e => setReason(e.target.value)} placeholder="e.g. Customer changed mind, item damaged..."
                    style={{ textTransform: 'capitalize' }} />
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input type="checkbox" className="checkbox checkbox-primary" checked={restockItems}
                      onChange={e => setRestockItems(e.target.checked)} />
                    <div>
                      <span className="label-text font-semibold flex items-center gap-1"><Package size={14} /> Restock items</span>
                      <span className="label-text-alt text-base-content/50">Return items to inventory (not applicable to consignment)</span>
                    </div>
                  </label>
                </div>

                {refundMethod === 'credit_note' && (
                  <div className="p-2 bg-accent/10 border border-accent/30 rounded text-sm">
                    📝 A credit note will be created for £{parseFloat(refundAmount || '0').toFixed(2)} against {foundSale.customer_name}'s account.
                  </div>
                )}
              </div>
            )}

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowNew(false); setFoundSale(null); setInvoiceSearch(''); setSearchError(''); }} disabled={processing}>Cancel</button>
              {foundSale && (
                <button className="btn btn-error gap-2" onClick={processRefund}
                  disabled={processing || !refundAmount || !reason.trim()}>
                  {processing ? <span className="loading loading-spinner loading-sm" /> : <RotateCcw size={16} />}
                  Process Refund — £{parseFloat(refundAmount || '0').toFixed(2)}
                </button>
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !processing && setShowNew(false)} />
        </dialog>
      )}
    </div>
  );
}
