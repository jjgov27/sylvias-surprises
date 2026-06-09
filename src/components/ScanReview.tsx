import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Pencil, Trash2, CheckCheck, AlertTriangle, Eye, Package, ScanLine } from 'lucide-react';
import { ScanStagingItem, StaffUser } from '../types';
import {
  getScanStagingItems, updateScanStagingItem, approveScanStagingItem,
  approveScanStagingBatch, rejectScanStagingBatch,
  rejectScanStagingItem, rejectAllPendingScanStaging, deleteScanStagingItem, getCategories, getLocations, titleCase
} from '../utils/db';

interface Props {
  currentUser: StaffUser;
}

export const ScanReview: React.FC<Props> = ({ currentUser }) => {
  const [items, setItems] = useState<ScanStagingItem[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<ScanStagingItem>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [mergeMsg, setMergeMsg] = useState('');

  const load = useCallback(async () => {
    const rows = await getScanStagingItems(filter);
    setItems(rows);
    setSelected(new Set());
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getCategories().then(setCategories);
    getLocations().then(setLocations);
  }, []);

  function startEdit(item: ScanStagingItem) {
    setEditId(item.id);
    setEditData({
      description: item.description,
      part_number: item.part_number,
      qty: item.qty,
      category: item.category,
      location: item.location,
      cost: item.cost,
      rrp: item.rrp,
      notes: item.notes,
    });
  }

  async function saveEdit() {
    if (editId === null) return;
    await updateScanStagingItem(editId, editData);
    setEditId(null);
    setEditData({});
    await load();
  }

  async function handleApprove(id: number) {
    setBusy(true);
    setMergeMsg('');
    const result = await approveScanStagingItem(id);
    if (result.merged > 0) {
      setMergeMsg('✅ Merged with existing stock (qty updated)');
      setTimeout(() => setMergeMsg(''), 4000);
    }
    await load();
    setBusy(false);
  }

  async function handleReject(id: number) {
    setBusy(true);
    await rejectScanStagingItem(id);
    await load();
    setBusy(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this scanned item permanently?')) return;
    setBusy(true);
    await deleteScanStagingItem(id);
    await load();
    setBusy(false);
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return;
    setBusy(true);
    setMergeMsg('');
    const result = await approveScanStagingBatch([...selected]);
    const parts: string[] = [];
    if (result.inserted > 0) parts.push(`${result.inserted} new item${result.inserted > 1 ? 's' : ''} added`);
    if (result.merged > 0) parts.push(`${result.merged} merged with existing stock`);
    setMergeMsg(`✅ ${parts.join(', ')}`);
    setTimeout(() => setMergeMsg(''), 5000);
    setSelected(new Set());
    await load();
    setBusy(false);
  }

  async function handleBulkReject() {
    if (selected.size === 0) return;
    setBusy(true);
    await rejectScanStagingBatch([...selected]);
    setSelected(new Set());
    await load();
    setBusy(false);
  }

  async function handleRejectAll() {
    if (!confirm('Reject ALL pending items? This cannot be undone.')) return;
    setBusy(true);
    await rejectAllPendingScanStaging();
    await load();
    setBusy(false);
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  }

  const pendingCount = items.length;

  function fmtDate(d: string) {
    if (!d) return '';
    try { return new Date(d.replace(' ', 'T')).toLocaleDateString('en-GB'); } catch { return d; }
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ScanLine size={28} className="text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-base-content">Scan Review</h1>
          <p className="text-sm text-base-content/60">
            Scanned items land here first. Check them, then approve into stock.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs tabs-boxed mb-4 inline-flex">
        {(['pending', 'approved', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            className={`tab ${filter === tab ? 'tab-active' : ''}`}
            onClick={() => setFilter(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Bulk actions for pending */}
      {filter === 'pending' && items.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={selected.size === items.length && items.length > 0}
              onChange={toggleAll}
            />
            <span className="text-sm font-medium">Select All ({items.length})</span>
          </label>
          {selected.size > 0 && (
            <>
              <button className="btn btn-success btn-sm gap-1" onClick={handleBulkApprove} disabled={busy}>
                <CheckCheck size={16} /> Approve {selected.size} Item{selected.size !== 1 ? 's' : ''}
              </button>
              <button className="btn btn-error btn-sm gap-1" onClick={handleBulkReject} disabled={busy}>
                <XCircle size={16} /> Reject {selected.size}
              </button>
            </>
          )}
          <button className="btn btn-outline btn-error btn-sm gap-1 ml-auto" onClick={handleRejectAll} disabled={busy}>
            <Trash2 size={16} /> Reject All
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card bg-base-200">
          <div className="card-body items-center text-center py-12">
            <Package size={48} className="opacity-30 mb-3" />
            <p className="text-base-content/60 font-medium">
              {filter === 'pending'
                ? 'No scanned items waiting for review. Scan a stock form or list to get started!'
                : `No ${filter} items to show.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr className="bg-base-200">
                {filter === 'pending' && <th className="w-8"></th>}
                <th>Description</th>
                <th>Part No</th>
                <th className="text-center">Qty</th>
                <th>Category</th>
                <th>Location</th>
                <th className="text-right">Cost</th>
                <th className="text-right">RRP</th>
                <th>Notes</th>
                <th>Scanned</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                editId === item.id ? (
                  /* ── Edit row ── */
                  <tr key={item.id} className="bg-warning/10">
                    {filter === 'pending' && <td></td>}
                    <td>
                      <input
                        className="input input-xs input-bordered w-full"
                        value={editData.description || ''}
                        onChange={e => setEditData(p => ({ ...p, description: titleCase(e.target.value) }))}
                      />
                    </td>
                    <td>
                      <input
                        className="input input-xs input-bordered w-20"
                        value={editData.part_number || ''}
                        onChange={e => setEditData(p => ({ ...p, part_number: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        className="input input-xs input-bordered w-16 text-center"
                        value={editData.qty ?? ''}
                        onChange={e => setEditData(p => ({ ...p, qty: parseInt(e.target.value) || 0 }))}
                      />
                    </td>
                    <td>
                      <select
                        className="select select-xs select-bordered w-full"
                        value={editData.category || ''}
                        onChange={e => setEditData(p => ({ ...p, category: e.target.value }))}
                      >
                        <option value="">—</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        className="select select-xs select-bordered w-full"
                        value={editData.location || ''}
                        onChange={e => setEditData(p => ({ ...p, location: e.target.value }))}
                      >
                        <option value="">—</option>
                        {locations.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className="input input-xs input-bordered w-20 text-right"
                        value={editData.cost ?? ''}
                        onChange={e => setEditData(p => ({ ...p, cost: parseFloat(e.target.value) || 0 }))}
                      />
                    </td>
                    <td>
                      <input
                        className="input input-xs input-bordered w-20 text-right"
                        value={editData.rrp ?? ''}
                        onChange={e => setEditData(p => ({ ...p, rrp: parseFloat(e.target.value) || 0 }))}
                      />
                    </td>
                    <td>
                      <input
                        className="input input-xs input-bordered w-full"
                        value={editData.notes || ''}
                        onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                      />
                    </td>
                    <td className="text-xs">{fmtDate(item.scanned_at)}</td>
                    <td className="text-center">
                      <div className="flex gap-1 justify-center">
                        <button className="btn btn-success btn-xs" onClick={saveEdit}>Save</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* ── Display row ── */
                  <tr key={item.id} className={`hover ${selected.has(item.id) ? 'bg-primary/5' : ''}`}>
                    {filter === 'pending' && (
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                    )}
                    <td className="font-medium">{item.description || <span className="opacity-40">—</span>}</td>
                    <td className="text-xs">{item.part_number || '—'}</td>
                    <td className="text-center">{item.qty}</td>
                    <td className="text-xs">{item.category || '—'}</td>
                    <td className="text-xs">{item.location || '—'}</td>
                    <td className="text-right">
                      {item.cost ? `£${item.cost.toFixed(2)}` : '—'}
                    </td>
                    <td className="text-right">
                      {item.rrp ? `£${item.rrp.toFixed(2)}` : '—'}
                    </td>
                    <td className="text-xs max-w-[120px] truncate" title={item.notes}>{item.notes || '—'}</td>
                    <td className="text-xs whitespace-nowrap">
                      {fmtDate(item.scanned_at)}
                      <br />
                      <span className="opacity-60">{item.scanned_by}</span>
                    </td>
                    <td className="text-center">
                      {filter === 'pending' ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            className="btn btn-success btn-xs gap-0.5"
                            onClick={() => handleApprove(item.id)}
                            disabled={busy}
                            title="Approve into stock"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs gap-0.5"
                            onClick={() => startEdit(item)}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-error btn-xs gap-0.5"
                            onClick={() => handleReject(item.id)}
                            disabled={busy}
                            title="Reject"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ) : filter === 'rejected' ? (
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => handleDelete(item.id)}
                          title="Delete permanently"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="badge badge-success badge-sm gap-1">
                          <CheckCircle size={12} /> In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Warning banner for pending */}
      {filter === 'pending' && items.length > 0 && (
        <div className="alert alert-warning mt-4 text-sm">
          <AlertTriangle size={18} />
          <span>
            <strong>Review carefully!</strong> Scanned data may contain errors from handwriting recognition.
            Edit any wrong fields before approving into stock.
          </span>
        </div>
      )}
    </div>
  );
};
