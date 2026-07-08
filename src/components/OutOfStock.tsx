import React, { useState, useEffect } from 'react';
import { PackageX, Search, Plus, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { StockItem, StaffUser } from '../types';
import { getAllStock, updateStockQty, deleteStockItem } from '../utils/db';

interface Props {
  currentUser: StaffUser;
  onEdit: (item: StockItem) => void;
  onRestock?: (item: StockItem) => void;
}

export const OutOfStock: React.FC<Props> = ({ currentUser, onEdit }) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [restockId, setRestockId] = useState<number | null>(null);
  const [restockQty, setRestockQty] = useState('1');
  const [msg, setMsg] = useState('');

  async function loadItems() {
    setLoading(true);
    const all = await getAllStock();
    setItems(all.filter(i => i.qty === 0));
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, []);

  const filtered = search
    ? items.filter(i =>
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        i.part_number.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  async function handleRestock(id: number) {
    const qty = parseInt(restockQty);
    if (!qty || qty < 1) { setMsg('Please enter a valid quantity'); return; }
    await updateStockQty(id, qty);
    setRestockId(null);
    setRestockQty('1');
    setMsg('✅ Item restocked!');
    setTimeout(() => setMsg(''), 3000);
    await loadItems();
  }

  async function handleDelete(id: number) {
    await deleteStockItem(id);
    setDeleteConfirm(null);
    setMsg('✅ Item removed from system');
    setTimeout(() => setMsg(''), 3000);
    await loadItems();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <PackageX size={28} className="text-error" />
        <h1 className="text-2xl font-bold text-error">Out of Stock</h1>
        <span className="badge badge-error badge-lg">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {msg && (
        <div className={`alert ${msg.includes('✅') ? 'alert-success' : 'alert-warning'} mb-4 text-sm`}>
          <span>{msg}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setMsg('')}>✕</button>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-[1em] opacity-50" />
          <input
            type="text"
            className="grow"
            placeholder="Search out of stock items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        <button className="btn btn-outline btn-sm gap-1" onClick={loadItems}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-base-content/50">
          <PackageX size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-semibold">All stocked up! 🎉</p>
          <p className="text-sm">No out-of-stock items found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead className="bg-base-200">
              <tr>
                <th>Part No.</th>
                <th>Description</th>
                <th>Category</th>
                <th>Location</th>
                <th className="text-right">Cost</th>
                <th className="text-right">RRP</th>
                <th>By</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-base-content/50">
                    No matching items
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="bg-error/5 hover:bg-error/10 cursor-pointer transition-colors" onClick={() => onEdit(item)}>
                    <td className="font-mono text-xs">{item.part_number || '—'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {item.photo && (
                          <img src={item.photo} alt="" className="w-8 h-8 rounded object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                        )}
                        <div className="font-medium text-sm">{item.description}</div>
                      </div>
                    </td>
                    <td className="text-xs">{item.category}</td>
                    <td className="text-xs">{item.location || '—'}</td>
                    <td className="text-right text-sm">£{item.cost.toFixed(2)}</td>
                    <td className="text-right text-sm font-semibold">£{item.rrp.toFixed(2)}</td>
                    <td>
                      <span className="badge badge-ghost badge-sm font-mono">{item.entered_by}</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {restockId === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              className="input input-bordered input-xs w-14 text-center"
                              value={restockQty}
                              onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setRestockQty(v); }}
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleRestock(item.id); if (e.key === 'Escape') setRestockId(null); }}
                            />
                            <button className="btn btn-success btn-xs" onClick={() => handleRestock(item.id)}>
                              <Plus size={12} /> Add
                            </button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setRestockId(null)}>✕</button>
                          </div>
                        ) : (
                          <button className="btn btn-success btn-xs gap-1" onClick={() => { setRestockId(item.id); setRestockQty('1'); }}>
                            <Plus size={12} /> Restock
                          </button>
                        )}
                        {deleteConfirm === item.id ? (
                          <div className="flex gap-1">
                            <button className="btn btn-error btn-xs" onClick={() => handleDelete(item.id)}>Yes</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setDeleteConfirm(null)}>No</button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteConfirm(item.id)} title="Remove from system">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-base-content/40 mt-2 text-right">
        Showing {filtered.length} of {items.length} out-of-stock items
      </div>
    </div>
  );
};
