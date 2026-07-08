import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser, StockItem } from '../types';
import { esc } from '../utils/db';
import { Trash2, Gift, Search, AlertTriangle, CheckCircle, Package } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

interface StockRemoval {
  id: number;
  stock_id: number;
  type: string; // 'wastage' | 'gift'
  reason: string;
  quantity: number;
  initials: string;
  cost_at_removal: number;
  retail_at_removal: number;
  part_number: string;
  description: string;
  created_at: string;
}

export function StockRemovals({ currentUser }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StockItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [removalType, setRemovalType] = useState<'wastage' | 'gift'>('wastage');
  const [reason, setReason] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [initials, setInitials] = useState(currentUser.initials);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [recentRemovals, setRecentRemovals] = useState<StockRemoval[]>([]);
  const [tab, setTab] = useState<'remove' | 'history'>('remove');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'wastage' | 'gift'>('all');

  const loadRecent = useCallback(async () => {
    try {
      const filterClause = historyFilter === 'all' ? '' : ` WHERE r.type = '${historyFilter}'`;
      const rows = await window.tasklet.sqlQuery(
        `SELECT r.*, s.part_number, s.description FROM sylvias_stock_removals r
         LEFT JOIN sylvias_stock s ON s.id = r.stock_id
         ${filterClause}
         ORDER BY r.created_at DESC LIMIT 100`
      );
      setRecentRemovals(rows as unknown as StockRemoval[]);
    } catch { setRecentRemovals([]); }
  }, [historyFilter]);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.trim().length < 2) { setResults([]); return; }
    try {
      const sq = esc(q);
      const rows = await window.tasklet.sqlQuery(
        `SELECT * FROM sylvias_stock WHERE (description LIKE '%${sq}%' OR part_number LIKE '%${sq}%') AND qty > 0 ORDER BY description ASC LIMIT 20`
      );
      setResults(rows as unknown as StockItem[]);
    } catch { setResults([]); }
  }

  function selectItem(item: StockItem) {
    setSelectedItem(item);
    setSearch('');
    setResults([]);
    setReason('');
    setQuantity('1');
    setInitials(currentUser.initials);
    setErrors({});
    setConfirming(false);
    setSuccessMsg('');
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!reason.trim()) errs.reason = 'Please enter a reason';
    const qty = parseInt(quantity);
    if (!qty || qty < 1) errs.quantity = 'Quantity must be at least 1';
    else if (selectedItem && qty > selectedItem.qty) errs.quantity = `Only ${selectedItem.qty} in stock`;
    if (!initials.trim()) errs.initials = 'Initials required for audit trail';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    setConfirming(true);
  }

  async function confirmRemoval() {
    if (!selectedItem || busy) return;
    setBusy(true);
    try {
      const qty = parseInt(quantity);
      // Insert removal record
      await window.tasklet.sqlExec(
        `INSERT INTO sylvias_stock_removals (stock_id, type, reason, quantity, initials, cost_at_removal, retail_at_removal, created_at)
         VALUES (${selectedItem.id}, '${esc(removalType)}', '${esc(reason.trim())}', ${qty}, '${esc(initials.trim().toUpperCase())}', ${selectedItem.cost}, ${selectedItem.rrp}, datetime('now'))`
      );
      // Reduce stock quantity
      await window.tasklet.sqlExec(
        `UPDATE sylvias_stock SET qty = MAX(0, qty - ${qty}) WHERE id = ${selectedItem.id}`
      );
      // Audit log
      await window.tasklet.sqlExec(
        `INSERT INTO sylvias_audit_log (action, table_name, record_id, details, performed_by)
         VALUES ('${removalType}', 'sylvias_stock', ${selectedItem.id}, '${esc(`${removalType === 'wastage' ? 'Wastage' : 'Gift'}: ${qty}x ${selectedItem.description} — ${reason.trim()}`)}', '${esc(initials.trim().toUpperCase())}')`
      );
      const label = removalType === 'wastage' ? '⚠️ Wastage' : '🎁 Gift';
      setSuccessMsg(`${label} recorded: ${qty}× ${selectedItem.description}. Stock updated.`);
      setSelectedItem(null);
      setConfirming(false);
      setReason('');
      setQuantity('1');
      loadRecent();
    } catch (e) {
      setErrors({ submit: 'Failed to save. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const formatDate = (d: string) => {
    try {
      const dt = new Date(d.replace(' ', 'T'));
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Package size={24} /> Stock Removals
      </h2>
      <p className="text-sm text-base-content/60 mb-4">Record wastage (damaged/broken items) or gifts (raffle prizes, donations). Stock is reduced and an audit trail is kept.</p>

      {/* Tabs */}
      <div className="tabs tabs-boxed mb-4">
        <button className={`tab ${tab === 'remove' ? 'tab-active' : ''}`} onClick={() => setTab('remove')}>
          Remove Stock
        </button>
        <button className={`tab ${tab === 'history' ? 'tab-active' : ''}`} onClick={() => { setTab('history'); loadRecent(); }}>
          History
        </button>
      </div>

      {tab === 'remove' ? (
        <>
          {/* Success message */}
          {successMsg && (
            <div className="mb-4 p-3 bg-success/15 border border-success/30 rounded-lg text-success font-semibold flex items-center gap-2">
              <CheckCircle size={18} /> {successMsg}
            </div>
          )}

          {/* Type selector */}
          <div className="flex gap-3 mb-4">
            <button
              className={`btn flex-1 gap-2 ${removalType === 'wastage' ? 'btn-warning' : 'btn-outline btn-warning'}`}
              onClick={() => setRemovalType('wastage')}
            >
              <Trash2 size={18} /> ⚠️ Wastage
            </button>
            <button
              className={`btn flex-1 gap-2 ${removalType === 'gift' ? 'btn-info' : 'btn-outline btn-info'}`}
              onClick={() => setRemovalType('gift')}
            >
              <Gift size={18} /> 🎁 Gift
            </button>
          </div>

          <p className="text-sm text-base-content/50 mb-3">
            {removalType === 'wastage'
              ? 'For damaged, broken, or unusable items that need to be written off.'
              : 'For items given away — raffle prizes, donations, promotional gifts.'}
          </p>

          {/* Search for item */}
          {!selectedItem && (
            <div className="relative mb-4">
              <label className="label py-1"><span className="label-text font-semibold">Search for item</span></label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-base-content/40" />
                <input
                  type="text"
                  className="input input-bordered w-full pl-9"
                  placeholder="Type item description or part number..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {results.length > 0 && (
                <div className="absolute z-20 w-full bg-base-100 border border-base-300 rounded-lg shadow-xl mt-1 max-h-64 overflow-y-auto">
                  {results.map(item => (
                    <button
                      key={item.id}
                      className="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-200 last:border-0 flex justify-between items-center"
                      onClick={() => selectItem(item)}
                    >
                      <div>
                        <div className="font-semibold">{item.description}</div>
                        <div className="text-xs text-base-content/50">
                          {item.part_number && <span className="mr-3">Part: {item.part_number}</span>}
                          Qty: {item.qty} · £{item.rrp.toFixed(2)}
                        </div>
                      </div>
                      <span className="badge badge-sm">{item.qty} in stock</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected item form */}
          {selectedItem && !confirming && (
            <div className="card bg-base-200 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{selectedItem.description}</h3>
                    <p className="text-sm text-base-content/50">
                      {selectedItem.part_number && <span className="mr-3">Part: {selectedItem.part_number}</span>}
                      In stock: {selectedItem.qty} · Cost: £{selectedItem.cost.toFixed(2)} · RRP: £{selectedItem.rrp.toFixed(2)}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedItem(null)}>✕</button>
                </div>

                <div className="space-y-3">
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text font-semibold">
                      {removalType === 'wastage' ? 'Reason for wastage *' : 'Gift purpose *'}
                    </span></label>
                    <input
                      type="text"
                      className={`input input-bordered w-full ${errors.reason ? 'input-error' : ''}`}
                      placeholder={removalType === 'wastage' ? 'e.g. Damaged in display, cracked during handling...' : 'e.g. Raffle prize — Lions Club fundraiser...'}
                      value={reason}
                      onChange={e => { setReason(e.target.value); setErrors(prev => ({ ...prev, reason: '' })); }}
                    />
                    {errors.reason && <span className="text-error text-xs mt-1">{errors.reason}</span>}
                  </div>

                  <div className="flex gap-4">
                    <div className="form-control w-32">
                      <label className="label py-1"><span className="label-text font-semibold">Quantity *</span></label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`input input-bordered ${errors.quantity ? 'input-error' : ''}`}
                        value={quantity}
                        onChange={e => { setQuantity(e.target.value); setErrors(prev => ({ ...prev, quantity: '' })); }}
                      />
                      {errors.quantity && <span className="text-error text-xs mt-1">{errors.quantity}</span>}
                    </div>

                    <div className="form-control w-32">
                      <label className="label py-1"><span className="label-text font-semibold">Your Initials *</span></label>
                      <input
                        type="text"
                        className={`input input-bordered ${errors.initials ? 'input-error' : ''}`}
                        value={initials}
                        onChange={e => { setInitials(e.target.value); setErrors(prev => ({ ...prev, initials: '' })); }}
                        maxLength={5}
                      />
                      {errors.initials && <span className="text-error text-xs mt-1">{errors.initials}</span>}
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="text-error text-sm">{errors.submit}</div>
                  )}

                  <button
                    className={`btn gap-2 mt-2 ${removalType === 'wastage' ? 'btn-warning' : 'btn-info'}`}
                    onClick={handleSubmit}
                  >
                    {removalType === 'wastage' ? <><Trash2 size={18} /> Record Wastage</> : <><Gift size={18} /> Record Gift</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inline confirmation banner */}
          {confirming && selectedItem && (
            <div className="mb-4 p-4 bg-warning/20 border-2 border-warning rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle size={24} className="text-warning flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h4 className="font-bold text-lg mb-1">Confirm {removalType === 'wastage' ? 'Wastage' : 'Gift'}</h4>
                  <p className="text-sm mb-2">
                    <strong>{parseInt(quantity)}×</strong> {selectedItem.description}
                    {selectedItem.part_number && <span className="text-base-content/50"> ({selectedItem.part_number})</span>}
                  </p>
                  <p className="text-sm mb-1">
                    <strong>Reason:</strong> {reason}
                  </p>
                  <p className="text-sm mb-1">
                    <strong>Retail value:</strong> £{(selectedItem.rrp * parseInt(quantity)).toFixed(2)}
                  </p>
                  <p className="text-sm mb-3">
                    <strong>Authorised by:</strong> {initials.toUpperCase()}
                  </p>
                  <p className="text-sm font-semibold text-warning mb-3">
                    This will reduce stock by {parseInt(quantity)} and cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className={`btn btn-sm ${removalType === 'wastage' ? 'btn-warning' : 'btn-info'} gap-1`}
                      onClick={confirmRemoval}
                      disabled={busy}
                    >
                      {busy ? <span className="loading loading-spinner loading-sm" /> : null}
                      Yes — Confirm
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setConfirming(false)}
                      disabled={busy}
                    >
                      No — Go Back
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* History tab */
        <>
          <div className="flex gap-2 mb-4">
            {(['all', 'wastage', 'gift'] as const).map(f => (
              <button
                key={f}
                className={`btn btn-sm ${historyFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setHistoryFilter(f)}
              >
                {f === 'all' ? '📋 All' : f === 'wastage' ? '⚠️ Wastage' : '🎁 Gifts'}
              </button>
            ))}
          </div>

          {recentRemovals.length === 0 ? (
            <div className="text-center py-8 text-base-content/50">No records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200">
                    <th>Date</th>
                    <th>Type</th>
                    <th>Item</th>
                    <th>Part No.</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Retail</th>
                    <th>Reason</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRemovals.map(r => (
                    <tr key={r.id} className="hover">
                      <td className="text-xs whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td>
                        <span className={`badge badge-sm ${r.type === 'wastage' ? 'badge-warning' : 'badge-info'}`}>
                          {r.type === 'wastage' ? '⚠️ Wastage' : '🎁 Gift'}
                        </span>
                      </td>
                      <td className="font-semibold">{r.description}</td>
                      <td className="text-xs text-base-content/50">{r.part_number || '—'}</td>
                      <td className="text-center">{r.quantity}</td>
                      <td className="text-right">£{(r.retail_at_removal * r.quantity).toFixed(2)}</td>
                      <td className="text-sm max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                      <td className="font-mono text-sm">{r.initials}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={5}>Totals</td>
                    <td className="text-right">
                      £{recentRemovals.reduce((sum, r) => sum + r.retail_at_removal * r.quantity, 0).toFixed(2)}
                    </td>
                    <td colSpan={2}>{recentRemovals.length} record{recentRemovals.length !== 1 ? 's' : ''}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
