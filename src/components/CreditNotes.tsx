import React, { useState, useEffect, useCallback } from 'react';
import { CreditNote, StaffUser } from '../types';
import { getAllCreditNotes, cancelCreditNote } from '../utils/db';
import { FileText, XCircle, Receipt } from 'lucide-react';
import { CreditNotePrint } from './CreditNotePrint';

interface Props {
  currentUser: StaffUser;
}

export function CreditNotesView({ currentUser }: Props) {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'used' | 'cancelled'>('all');
  const [viewingCn, setViewingCn] = useState<CreditNote | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotes(await getAllCreditNotes());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? notes : notes.filter(n => n.status === filter);
  const activeTotal = notes.filter(n => n.status === 'active').reduce((s, n) => s + n.balance, 0);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <FileText size={24} /> Credit Notes
      </h2>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="text-sm text-base-content/60">Active Balance</div>
            <div className="text-2xl font-bold text-accent">£{activeTotal.toFixed(2)}</div>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="text-sm text-base-content/60">Total Issued</div>
            <div className="text-2xl font-bold">{notes.length}</div>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="text-sm text-base-content/60">Active</div>
            <div className="text-2xl font-bold text-accent">{notes.filter(n => n.status === 'active').length}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'active', 'used', 'cancelled'] as const).map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? notes.length : notes.filter(n => n.status === f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8"><span className="loading loading-spinner loading-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-base-content/50">
          <p>No credit notes {filter !== 'all' ? `with status "${filter}"` : 'issued yet'}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm table-zebra w-full">
            <thead>
              <tr>
                <th>Credit Note #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Original Invoice</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Used</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cn => (
                <tr key={cn.id}>
                  <td className="font-mono text-sm font-bold">{cn.credit_note_number}</td>
                  <td className="text-sm">{new Date(cn.date_issued + 'T00:00:00').toLocaleDateString('en-GB')}</td>
                  <td>{cn.customer_name}</td>
                  <td className="font-mono text-sm">{cn.original_invoice || '—'}</td>
                  <td className="text-right font-semibold">£{cn.amount.toFixed(2)}</td>
                  <td className="text-right">£{cn.amount_used.toFixed(2)}</td>
                  <td className="text-right font-bold text-accent">£{cn.balance.toFixed(2)}</td>
                  <td>
                    <span className={`badge badge-sm ${cn.status === 'active' ? 'badge-accent' : cn.status === 'used' ? 'badge-success' : 'badge-error'}`}>
                      {cn.status}
                    </span>
                  </td>
                  <td className="text-sm max-w-[200px] truncate">{cn.reason}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs gap-1" title="View / Print"
                        onClick={() => setViewingCn(cn)}>
                        <Receipt size={12} /> 🧾
                      </button>
                      {cn.status === 'active' && (
                        <button className="btn btn-error btn-xs gap-1"
                          onClick={async () => {
                            if (confirm(`Cancel credit note ${cn.credit_note_number}?`)) {
                              await cancelCreditNote(cn.id);
                              await load();
                            }
                          }}>
                          <XCircle size={12} /> Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 p-3 bg-base-200 rounded-lg text-sm text-base-content/60">
        💡 Credit notes are created automatically when processing a refund as "Credit Note". They can be applied to future sales.
      </div>

      {/* Credit Note Print Modal */}
      {viewingCn && (
        <CreditNotePrint creditNote={viewingCn} onClose={() => setViewingCn(null)} />
      )}
    </div>
  );
}
