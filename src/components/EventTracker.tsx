import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser, EventRecord, EventItem, StockItem } from '../types';
import { getAllEvents, addEvent, updateEvent, deleteEvent, getEventItems, addEventItem, updateEventItem, deleteEventItem, searchStock } from '../utils/db';
import { CalendarDays, Plus, Trash2, Edit2, Eye, Search, Printer, X, ChevronLeft, Package } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

type Tab = 'list' | 'form' | 'detail';

const STATUS_OPTIONS = ['planned', 'active', 'completed', 'cancelled'];
const STATUS_COLORS: Record<string, string> = {
  planned: 'badge-info',
  active: 'badge-success',
  completed: 'badge-primary',
  cancelled: 'badge-error',
};

const emptyForm = {
  event_name: '', location: '', event_date: '', end_date: '',
  pitch_cost: '', travel_cost: '', other_costs: '', notes: '', status: 'planned',
};

export function EventTracker({ currentUser }: Props) {
  const [tab, setTab] = useState<Tab>('list');
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail view
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [eventItems, setEventItems] = useState<EventItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Add stock to event
  const [stockSearch, setStockSearch] = useState('');
  const [stockResults, setStockResults] = useState<StockItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingStock, setAddingStock] = useState(false);

  // Edit item modal
  const [editItemModal, setEditItemModal] = useState<EventItem | null>(null);
  const [editQtySold, setEditQtySold] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await getAllEvents());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadEventDetail(ev: EventRecord) {
    setSelectedEvent(ev);
    setLoadingItems(true);
    setTab('detail');
    try {
      setEventItems(await getEventItems(ev.id));
    } finally { setLoadingItems(false); }
  }

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm, event_date: new Date().toISOString().slice(0, 10) });
    setTab('form');
  }

  function openEdit(ev: EventRecord) {
    setEditId(ev.id);
    setForm({
      event_name: ev.event_name, location: ev.location,
      event_date: ev.event_date, end_date: ev.end_date,
      pitch_cost: String(ev.pitch_cost), travel_cost: String(ev.travel_cost),
      other_costs: String(ev.other_costs), notes: ev.notes, status: ev.status,
    });
    setTab('form');
  }

  async function handleSave() {
    if (!form.event_name.trim() || !form.event_date) return;
    setSaving(true);
    try {
      const data = {
        event_name: form.event_name.trim(),
        location: form.location.trim(),
        event_date: form.event_date,
        end_date: form.end_date,
        pitch_cost: parseFloat(form.pitch_cost) || 0,
        travel_cost: parseFloat(form.travel_cost) || 0,
        other_costs: parseFloat(form.other_costs) || 0,
        notes: form.notes.trim(),
        status: form.status,
      };
      if (editId) {
        await updateEvent(editId, data);
      } else {
        await addEvent({ ...data, entered_by: currentUser.initials });
      }
      await load();
      setTab('list');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    await deleteEvent(id);
    setConfirmDelete(null);
    if (selectedEvent?.id === id) { setTab('list'); setSelectedEvent(null); }
    await load();
  }

  // Stock search for adding to event
  const searchTimerRef = React.useRef<any>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = stockSearch.trim();
    if (q.length < 2) { setStockResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try { setStockResults(await searchStock(q)); }
      finally { setSearching(false); }
    }, 300);
  }, [stockSearch]);

  async function addStockToEvent(stock: StockItem) {
    if (!selectedEvent) return;
    setAddingStock(true);
    try {
      await addEventItem({
        event_id: selectedEvent.id,
        stock_id: stock.id,
        description: stock.description,
        part_number: stock.part_number,
        qty_taken: stock.qty > 0 ? 1 : 1,
        qty_sold: 0,
        sale_price: stock.rrp,
        cost_price: stock.cost,
      });
      setEventItems(await getEventItems(selectedEvent.id));
      setStockSearch('');
      setStockResults([]);
    } finally { setAddingStock(false); }
  }

  function openEditItem(item: EventItem) {
    setEditItemModal(item);
    setEditQtySold(String(item.qty_sold));
    setEditSalePrice(String(item.sale_price));
  }

  async function saveEditItem() {
    if (!editItemModal || !selectedEvent) return;
    await updateEventItem(editItemModal.id, {
      qty_sold: parseInt(editQtySold) || 0,
      sale_price: parseFloat(editSalePrice) || 0,
    });
    setEditItemModal(null);
    setEventItems(await getEventItems(selectedEvent.id));
  }

  async function removeEventItem(id: number) {
    if (!selectedEvent) return;
    await deleteEventItem(id);
    setEventItems(await getEventItems(selectedEvent.id));
  }

  function getEventSummary(ev: EventRecord, items: EventItem[]) {
    const totalCosts = ev.pitch_cost + ev.travel_cost + ev.other_costs;
    const totalSales = items.reduce((s, i) => s + (i.qty_sold * i.sale_price), 0);
    const totalCostOfGoods = items.reduce((s, i) => s + (i.qty_sold * i.cost_price), 0);
    const profit = totalSales - totalCosts - totalCostOfGoods;
    return { totalCosts, totalSales, totalCostOfGoods, profit };
  }

  function handlePrint() {
    window.print();
  }

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  // List view
  if (tab === 'list') {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><CalendarDays size={24} className="text-primary" /></div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Antique Fair / Event Tracker</h1>
              <p className="text-sm text-base-content/50">Track events, stock taken, and profit/loss</p>
            </div>
          </div>
          <button className="btn btn-primary btn-sm gap-1" onClick={openAdd}>
            <Plus size={16} /> New Event
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-base-content/40">
            <CalendarDays size={48} className="mx-auto mb-3 opacity-30" />
            <p>No events yet — add your first antique fair!</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-base-300">
            <table className="table table-sm table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Event</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Costs</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} className="hover">
                    <td className="font-semibold">{ev.event_name}</td>
                    <td>{ev.location}</td>
                    <td className="text-xs">{fmtDate(ev.event_date)}{ev.end_date ? ` – ${fmtDate(ev.end_date)}` : ''}</td>
                    <td><span className={`badge badge-sm ${STATUS_COLORS[ev.status] || ''}`}>{ev.status}</span></td>
                    <td className="font-mono">£{(ev.pitch_cost + ev.travel_cost + ev.other_costs).toFixed(2)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-xs" onClick={() => loadEventDetail(ev)} title="View"><Eye size={14} /></button>
                        <button className="btn btn-ghost btn-xs" onClick={() => openEdit(ev)} title="Edit"><Edit2 size={14} /></button>
                        {confirmDelete === ev.id ? (
                          <>
                            <button className="btn btn-error btn-xs" onClick={() => handleDelete(ev.id)}>Yes</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(null)}>No</button>
                          </>
                        ) : (
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => setConfirmDelete(ev.id)} title="Delete"><Trash2 size={14} /></button>
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

  // Form view (add/edit event)
  if (tab === 'form') {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <button className="btn btn-ghost btn-sm gap-1 mb-4" onClick={() => setTab('list')}>
          <ChevronLeft size={16} /> Back
        </button>
        <h2 className="text-xl font-bold text-primary mb-4">{editId ? 'Edit Event' : 'New Event'}</h2>
        <div className="card bg-base-200 p-4 space-y-3">
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Event Name *</span></label>
            <input className="input input-bordered input-sm" value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })} />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Location</span></label>
            <input className="input input-bordered input-sm" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Start Date *</span></label>
              <input type="date" className="input input-bordered input-sm" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">End Date</span></label>
              <input type="date" className="input input-bordered input-sm" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Pitch Cost (£)</span></label>
              <input className="input input-bordered input-sm" value={form.pitch_cost} onChange={e => setForm({ ...form, pitch_cost: e.target.value })} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Travel Cost (£)</span></label>
              <input className="input input-bordered input-sm" value={form.travel_cost} onChange={e => setForm({ ...form, travel_cost: e.target.value })} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Other Costs (£)</span></label>
              <input className="input input-bordered input-sm" value={form.other_costs} onChange={e => setForm({ ...form, other_costs: e.target.value })} />
            </div>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Status</span></label>
            <select className="select select-bordered select-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Notes</span></label>
            <textarea className="textarea textarea-bordered textarea-sm" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.event_name.trim() || !form.event_date}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : editId ? 'Update Event' : 'Create Event'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setTab('list')}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // Detail view
  if (tab === 'detail' && selectedEvent) {
    const summary = getEventSummary(selectedEvent, eventItems);
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <button className="btn btn-ghost btn-sm gap-1 mb-4" onClick={() => { setTab('list'); setSelectedEvent(null); }}>
          <ChevronLeft size={16} /> Back to Events
        </button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              {selectedEvent.event_name}
              <span className={`badge badge-sm ${STATUS_COLORS[selectedEvent.status] || ''}`}>{selectedEvent.status}</span>
            </h2>
            <p className="text-sm text-base-content/50">
              {selectedEvent.location && `${selectedEvent.location} · `}
              {fmtDate(selectedEvent.event_date)}{selectedEvent.end_date ? ` – ${fmtDate(selectedEvent.end_date)}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm gap-1" onClick={() => openEdit(selectedEvent)}><Edit2 size={14} /> Edit</button>
            <button className="btn btn-ghost btn-sm gap-1" onClick={handlePrint}><Printer size={14} /> Print</button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="card bg-base-200 p-3">
            <p className="text-xs text-base-content/50">Total Costs</p>
            <p className="text-lg font-bold text-error">£{summary.totalCosts.toFixed(2)}</p>
            <p className="text-xs text-base-content/40">Pitch: £{selectedEvent.pitch_cost.toFixed(2)} · Travel: £{selectedEvent.travel_cost.toFixed(2)} · Other: £{selectedEvent.other_costs.toFixed(2)}</p>
          </div>
          <div className="card bg-base-200 p-3">
            <p className="text-xs text-base-content/50">Total Sales</p>
            <p className="text-lg font-bold text-success">£{summary.totalSales.toFixed(2)}</p>
          </div>
          <div className="card bg-base-200 p-3">
            <p className="text-xs text-base-content/50">Cost of Goods</p>
            <p className="text-lg font-bold text-warning">£{summary.totalCostOfGoods.toFixed(2)}</p>
          </div>
          <div className="card bg-base-200 p-3">
            <p className="text-xs text-base-content/50">Profit / Loss</p>
            <p className={`text-lg font-bold ${summary.profit >= 0 ? 'text-success' : 'text-error'}`}>
              {summary.profit >= 0 ? '+' : ''}£{summary.profit.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Add stock search */}
        <div className="card bg-base-200 p-3 mb-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-1"><Package size={14} /> Add Stock Item to Event</h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-9"
              placeholder="Search stock by name or part number..."
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
            />
          </div>
          {searching && <div className="mt-2"><span className="loading loading-spinner loading-xs" /></div>}
          {stockResults.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto border border-base-300 rounded-lg">
              {stockResults.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-base-300 cursor-pointer text-sm" onClick={() => addStockToEvent(s)}>
                  <span>{s.part_number} — {s.description} (Qty: {s.qty})</span>
                  <span className="text-xs text-base-content/50">RRP £{s.rrp.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Items table */}
        <h3 className="font-semibold mb-2">Items ({eventItems.length})</h3>
        {loadingItems ? (
          <div className="flex justify-center py-6"><span className="loading loading-spinner loading-md" /></div>
        ) : eventItems.length === 0 ? (
          <p className="text-sm text-base-content/40 py-4 text-center">No items added yet</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-base-300">
            <table className="table table-sm table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Part #</th>
                  <th>Description</th>
                  <th>Qty Taken</th>
                  <th>Qty Sold</th>
                  <th>Sale Price</th>
                  <th>Cost Price</th>
                  <th>Revenue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eventItems.map(item => (
                  <tr key={item.id}>
                    <td className="font-mono text-xs">{item.part_number}</td>
                    <td>{item.description}</td>
                    <td>{item.qty_taken}</td>
                    <td className={item.qty_sold > 0 ? 'text-success font-semibold' : ''}>{item.qty_sold}</td>
                    <td className="font-mono">£{item.sale_price.toFixed(2)}</td>
                    <td className="font-mono text-base-content/50">£{item.cost_price.toFixed(2)}</td>
                    <td className="font-mono font-semibold">£{(item.qty_sold * item.sale_price).toFixed(2)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-xs" onClick={() => openEditItem(item)} title="Mark sold"><Edit2 size={14} /></button>
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => removeEventItem(item.id)} title="Remove"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedEvent.notes && (
          <div className="mt-4 p-3 bg-base-200 rounded-lg">
            <p className="text-xs text-base-content/50 mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{selectedEvent.notes}</p>
          </div>
        )}

        {/* Edit Item Modal */}
        {editItemModal && (
          <div className="modal modal-open">
            <div className="modal-box max-w-sm">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setEditItemModal(null)}>✕</button>
              <h3 className="font-bold text-primary mb-3">Update Sale Info</h3>
              <p className="text-sm mb-3">{editItemModal.description}</p>
              <div className="space-y-3">
                <div className="form-control">
                  <label className="label"><span className="label-text font-semibold">Qty Sold</span></label>
                  <input className="input input-bordered input-sm" value={editQtySold} onChange={e => setEditQtySold(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-semibold">Sale Price (£ each)</span></label>
                  <input className="input input-bordered input-sm" value={editSalePrice} onChange={e => setEditSalePrice(e.target.value)} />
                </div>
                <button className="btn btn-primary btn-sm w-full" onClick={saveEditItem}>Save</button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setEditItemModal(null)} />
          </div>
        )}
      </div>
    );
  }

  return null;
}
