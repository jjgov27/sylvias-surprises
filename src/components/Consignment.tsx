import React, { useState, useEffect, useCallback } from 'react';
import { Users, Package, Plus, Edit, Trash2, DollarSign, Tag, Search } from 'lucide-react';
import { StaffUser, Consigner, ConsignmentItem } from '../types';
import {
  getAllConsigners, addConsigner, updateConsigner, deleteConsigner,
  getAllConsignmentStock, addConsignmentItem, updateConsignmentItem, deleteConsignmentItem,
  getConsignmentByConsigner, titleCase,
} from '../utils/db';

type TabView = 'consigners' | 'stock';

const emptyConsigner = (): Omit<Consigner, 'id' | 'created_at'> => ({
  name: '', phone: '', email: '', address: '', commission_pct: 20, notes: '',
});

const todayStr = () => new Date().toISOString().slice(0, 10);

export function Consignment({ currentUser }: { currentUser: StaffUser }) {
  const [tab, setTab] = useState<TabView>('consigners');

  // ── Consigner state ──
  const [consigners, setConsigners] = useState<Consigner[]>([]);
  const [consignerForm, setConsignerForm] = useState(emptyConsigner());
  const [commissionStr, setCommissionStr] = useState('20');
  const [editingConsigner, setEditingConsigner] = useState<Consigner | null>(null);
  const [showConsignerForm, setShowConsignerForm] = useState(false);
  const [selectedConsigner, setSelectedConsigner] = useState<Consigner | null>(null);
  const [consignerItems, setConsignerItems] = useState<ConsignmentItem[]>([]);
  const [consignerSearch, setConsignerSearch] = useState('');

  // ── Stock state ──
  const [stock, setStock] = useState<ConsignmentItem[]>([]);
  const [showStockForm, setShowStockForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ConsignmentItem | null>(null);
  const [stockSearch, setStockSearch] = useState('');

  // Stock form fields
  const [sfConsignerId, setSfConsignerId] = useState<number>(0);
  const [sfDescription, setSfDescription] = useState('');
  const [sfQty, setSfQty] = useState('1');
  const [sfPrice, setSfPrice] = useState('0');
  const [sfCommission, setSfCommission] = useState('20');
  const [sfDate, setSfDate] = useState(todayStr());
  const [sfNotes, setSfNotes] = useState('');

  // Feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Load data ──
  const loadConsigners = useCallback(async () => {
    try { setConsigners(await getAllConsigners()); } catch (e: any) { setError(e.message); }
  }, []);

  const loadStock = useCallback(async () => {
    try { setStock(await getAllConsignmentStock()); } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { loadConsigners(); loadStock(); }, [loadConsigners, loadStock]);

  // Auto-dismiss success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // ── Consigner CRUD ──
  const handleSaveConsigner = async () => {
    setError('');
    if (!consignerForm.name.trim()) { setError('Consigner name is required'); return; }
    const pct = parseFloat(commissionStr) || 0;
    try {
      if (editingConsigner) {
        await updateConsigner({ ...editingConsigner, ...consignerForm, commission_pct: pct });
        setSuccess('Consigner updated');
      } else {
        await addConsigner({ ...consignerForm, commission_pct: pct });
        setSuccess('Consigner added');
      }
      setConsignerForm(emptyConsigner());
      setCommissionStr('20');
      setEditingConsigner(null);
      setShowConsignerForm(false);
      await loadConsigners();
    } catch (e: any) { setError(e.message); }
  };

  const handleEditConsigner = (c: Consigner) => {
    setEditingConsigner(c);
    setConsignerForm({ name: c.name, phone: c.phone, email: c.email, address: c.address, commission_pct: c.commission_pct, notes: c.notes });
    setCommissionStr(String(c.commission_pct));
    setShowConsignerForm(true);
  };

  const handleDeleteConsigner = async (id: number) => {
    setError('');
    try {
      await deleteConsigner(id);
      setSuccess('Consigner deleted');
      if (selectedConsigner?.id === id) { setSelectedConsigner(null); setConsignerItems([]); }
      await loadConsigners();
    } catch (e: any) { setError(e.message); }
  };

  const handleSelectConsigner = async (c: Consigner) => {
    setSelectedConsigner(c);
    try { setConsignerItems(await getConsignmentByConsigner(c.id)); } catch (e: any) { setError(e.message); }
  };

  // ── Stock CRUD ──
  const resetStockForm = () => {
    setSfConsignerId(0);
    setSfDescription('');
    setSfQty('1');
    setSfPrice('0');
    setSfCommission('20');
    setSfDate(todayStr());
    setSfNotes('');
    setEditingItem(null);
  };

  const handleConsignerSelect = (id: number) => {
    setSfConsignerId(id);
    const c = consigners.find(x => x.id === id);
    if (c) setSfCommission(String(c.commission_pct));
  };

  const handleSaveItem = async () => {
    setError('');
    if (!sfConsignerId) { setError('Please select a consigner'); return; }
    if (!sfDescription.trim()) { setError('Description is required'); return; }
    const qty = parseInt(sfQty) || 0;
    const price = parseFloat(sfPrice) || 0;
    const comm = parseFloat(sfCommission) || 0;
    if (qty <= 0) { setError('Quantity must be at least 1'); return; }
    if (price <= 0) { setError('Selling price must be greater than 0'); return; }
    const consigner = consigners.find(c => c.id === sfConsignerId);
    try {
      if (editingItem) {
        await updateConsignmentItem({
          ...editingItem,
          description: titleCase(sfDescription.trim()),
          qty,
          selling_price: price,
          commission_pct: comm,
          notes: sfNotes,
          qty_remaining: qty - editingItem.qty_sold,
        });
        setSuccess('Consignment item updated');
      } else {
        await addConsignmentItem({
          consigner_id: sfConsignerId,
          consigner_name: consigner?.name || '',
          description: titleCase(sfDescription.trim()),
          qty,
          selling_price: price,
          commission_pct: comm,
          status: 'available',
          date_received: sfDate,
          notes: sfNotes,
          entered_by: currentUser.initials,
        });
        setSuccess('Consignment item added');
      }
      resetStockForm();
      setShowStockForm(false);
      await loadStock();
    } catch (e: any) { setError(e.message); }
  };

  const handleEditItem = (item: ConsignmentItem) => {
    setEditingItem(item);
    setSfConsignerId(item.consigner_id);
    setSfDescription(item.description);
    setSfQty(String(item.qty));
    setSfPrice(String(item.selling_price));
    setSfCommission(String(item.commission_pct));
    setSfDate(item.date_received);
    setSfNotes(item.notes);
    setShowStockForm(true);
  };

  const handleDeleteItem = async (id: number) => {
    setError('');
    try {
      await deleteConsignmentItem(id);
      setSuccess('Consignment item deleted');
      await loadStock();
    } catch (e: any) { setError(e.message); }
  };

  const handleReturnItem = async (item: ConsignmentItem) => {
    setError('');
    try {
      await updateConsignmentItem({ ...item, status: 'returned', qty_remaining: 0 });
      setSuccess(`"${item.description}" marked as returned`);
      await loadStock();
    } catch (e: any) { setError(e.message); }
  };

  // ── Computed stats ──
  const totalItems = stock.length;
  const availableItems = stock.filter(s => s.status === 'available').length;
  const soldItems = stock.filter(s => s.status === 'sold').length;
  const totalValue = stock.reduce((sum, s) => sum + s.selling_price * s.qty, 0);
  const owedToConsigners = stock
    .filter(s => s.status === 'sold' || s.status === 'partial')
    .reduce((sum, s) => sum + (s.selling_price * (s.commission_pct / 100) * s.qty_sold), 0);

  // ── Filter helpers ──
  const filteredConsigners = consigners.filter(c =>
    !consignerSearch || c.name.toLowerCase().includes(consignerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(consignerSearch.toLowerCase()) ||
    c.phone.includes(consignerSearch)
  );

  const filteredStock = stock.filter(s =>
    !stockSearch || s.description.toLowerCase().includes(stockSearch.toLowerCase()) ||
    s.consigner_name.toLowerCase().includes(stockSearch.toLowerCase())
  );

  // ── Status badge helper ──
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      available: 'badge badge-success badge-sm',
      partial: 'badge badge-warning badge-sm',
      sold: 'badge badge-info badge-sm',
      returned: 'badge badge-ghost badge-sm',
    };
    return <span className={map[status] || 'badge badge-sm'}>{status}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Package size={22} /> Consignment</h2>
      </div>

      {/* Success / Error */}
      {success && <div className="alert alert-success mb-3 text-sm">{success}</div>}
      {error && <div className="alert alert-error mb-3 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="tabs tabs-boxed">
        <button className={`tab ${tab === 'consigners' ? 'tab-active' : ''}`} onClick={() => setTab('consigners')}>
          <Users size={14} className="mr-1" /> Consigners
        </button>
        <button className={`tab ${tab === 'stock' ? 'tab-active' : ''}`} onClick={() => setTab('stock')}>
          <Package size={14} className="mr-1" /> Consignment Stock
        </button>
      </div>

      {/* ═══════════════ CONSIGNERS TAB ═══════════════ */}
      {tab === 'consigners' && (
        <div className="space-y-4">
          {/* Search + Add */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input className="input input-bordered input-sm w-full pl-8" placeholder="Search consigners…"
                value={consignerSearch} onChange={e => setConsignerSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowConsignerForm(true); setEditingConsigner(null); setConsignerForm(emptyConsigner()); setCommissionStr('20'); }}>
              <Plus size={14} /> Add Consigner
            </button>
          </div>

          {/* Add / Edit Consigner Form */}
          {showConsignerForm && (
            <div className="card bg-base-200 shadow">
              <div className="card-body p-4">
                <h3 className="font-semibold text-sm mb-2">{editingConsigner ? 'Edit Consigner' : 'New Consigner'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Name *</span></label>
                    <input className="input input-bordered input-sm w-full" value={consignerForm.name}
                      onChange={e => setConsignerForm({ ...consignerForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Phone</span></label>
                    <input className="input input-bordered input-sm w-full" value={consignerForm.phone}
                      onChange={e => setConsignerForm({ ...consignerForm, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Email</span></label>
                    <input className="input input-bordered input-sm w-full" type="email" value={consignerForm.email}
                      onChange={e => setConsignerForm({ ...consignerForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Commission %</span></label>
                    <input className="input input-bordered input-sm w-full" value={commissionStr}
                      onChange={e => setCommissionStr(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label py-1"><span className="label-text text-xs">Address</span></label>
                    <input className="input input-bordered input-sm w-full" value={consignerForm.address}
                      onChange={e => setConsignerForm({ ...consignerForm, address: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label py-1"><span className="label-text text-xs">Notes</span></label>
                    <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} value={consignerForm.notes}
                      onChange={e => setConsignerForm({ ...consignerForm, notes: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-primary btn-sm" onClick={handleSaveConsigner}>
                    {editingConsigner ? 'Update' : 'Save'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowConsignerForm(false); setEditingConsigner(null); setConsignerForm(emptyConsigner()); setCommissionStr('20'); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Consigner detail panel */}
          {selectedConsigner && (
            <div className="card bg-base-200 shadow">
              <div className="card-body p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Items for: {selectedConsigner.name}</h3>
                  <button className="btn btn-ghost btn-xs" onClick={() => { setSelectedConsigner(null); setConsignerItems([]); }}>✕</button>
                </div>
                {consignerItems.length === 0 ? (
                  <p className="text-xs opacity-60">No consignment items for this consigner.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-base-300">
                    <table className="table table-sm">
                      <thead>
                        <tr><th>Description</th><th>Qty</th><th>Price</th><th>Comm %</th><th>Status</th><th>Remaining</th></tr>
                      </thead>
                      <tbody>
                        {consignerItems.map(item => (
                          <tr key={item.id}>
                            <td className="text-xs">{item.description}</td>
                            <td>{item.qty}</td>
                            <td>£{item.selling_price.toFixed(2)}</td>
                            <td>{item.commission_pct}%</td>
                            <td>{statusBadge(item.status)}</td>
                            <td>{item.qty_remaining}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Consigners List */}
          <div className="overflow-x-auto rounded-lg border border-base-300">
            <table className="table table-sm">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Email</th><th>Commission %</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredConsigners.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-xs opacity-60">No consigners found</td></tr>
                ) : filteredConsigners.map(c => (
                  <tr key={c.id} className="hover cursor-pointer" onClick={() => handleSelectConsigner(c)}>
                    <td className="font-medium text-xs">{c.name}</td>
                    <td className="text-xs">{c.phone}</td>
                    <td className="text-xs">{c.email}</td>
                    <td className="text-xs">{c.commission_pct}%</td>
                    <td className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-xs" onClick={() => handleEditConsigner(c)}><Edit size={13} /></button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDeleteConsigner(c.id)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ STOCK TAB ═══════════════ */}
      {tab === 'stock' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="stat bg-base-200 rounded-lg p-3">
              <div className="stat-title text-xs">Total Items</div>
              <div className="stat-value text-lg">{totalItems}</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-3">
              <div className="stat-title text-xs">Available</div>
              <div className="stat-value text-lg text-success">{availableItems}</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-3">
              <div className="stat-title text-xs">Sold</div>
              <div className="stat-value text-lg text-info">{soldItems}</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-3">
              <div className="stat-title text-xs">Total Value</div>
              <div className="stat-value text-lg">£{totalValue.toFixed(2)}</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-3">
              <div className="stat-title text-xs">Owed to Consigners</div>
              <div className="stat-value text-lg text-warning">£{owedToConsigners.toFixed(2)}</div>
            </div>
          </div>

          {/* Search + Add */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input className="input input-bordered input-sm w-full pl-8" placeholder="Search stock…"
                value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { resetStockForm(); setShowStockForm(true); }}>
              <Plus size={14} /> Add Item
            </button>
          </div>

          {/* Add / Edit Stock Form */}
          {showStockForm && (
            <div className="card bg-base-200 shadow">
              <div className="card-body p-4">
                <h3 className="font-semibold text-sm mb-2">{editingItem ? 'Edit Consignment Item' : 'New Consignment Item'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Consigner *</span></label>
                    <select className="select select-bordered select-sm w-full" value={sfConsignerId}
                      onChange={e => handleConsignerSelect(Number(e.target.value))}>
                      <option value={0}>-- Select consigner --</option>
                      {consigners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Description *</span></label>
                    <input className="input input-bordered input-sm w-full" value={sfDescription}
                      onChange={e => setSfDescription(e.target.value)}
                      onBlur={e => setSfDescription(titleCase(e.target.value))} />
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Quantity</span></label>
                    <input className="input input-bordered input-sm w-full" value={sfQty}
                      onChange={e => setSfQty(e.target.value)} />
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Selling Price (£)</span></label>
                    <input className="input input-bordered input-sm w-full" value={sfPrice}
                      onChange={e => setSfPrice(e.target.value)} />
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Commission %</span></label>
                    <input className="input input-bordered input-sm w-full" value={sfCommission}
                      onChange={e => setSfCommission(e.target.value)} />
                  </div>
                  <div>
                    <label className="label py-1"><span className="label-text text-xs">Date Received</span></label>
                    <input className="input input-bordered input-sm w-full" type="date" value={sfDate}
                      onChange={e => setSfDate(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label py-1"><span className="label-text text-xs">Notes</span></label>
                    <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} value={sfNotes}
                      onChange={e => setSfNotes(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-primary btn-sm" onClick={handleSaveItem}>
                    {editingItem ? 'Update' : 'Save'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowStockForm(false); resetStockForm(); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stock Table */}
          <div className="overflow-x-auto rounded-lg border border-base-300">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Consigner</th><th>Description</th><th>Qty</th><th>Price</th><th>Comm %</th><th>Status</th><th>Remaining</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-xs opacity-60">No consignment stock found</td></tr>
                ) : filteredStock.map(item => (
                  <tr key={item.id}>
                    <td className="text-xs">{item.consigner_name}</td>
                    <td className="text-xs font-medium">{item.description}</td>
                    <td>{item.qty}</td>
                    <td>£{item.selling_price.toFixed(2)}</td>
                    <td>{item.commission_pct}%</td>
                    <td>{statusBadge(item.status)}</td>
                    <td>{item.qty_remaining}</td>
                    <td className="flex gap-1">
                      <button className="btn btn-ghost btn-xs" onClick={() => handleEditItem(item)}><Edit size={13} /></button>
                      {(item.status === 'available' || item.status === 'partial') && (
                        <button className="btn btn-ghost btn-xs text-warning" title="Mark as returned" onClick={() => handleReturnItem(item)}>↩</button>
                      )}
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDeleteItem(item.id)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
