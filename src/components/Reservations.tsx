import { useState, useEffect, useCallback } from 'react';
import { StaffUser, Reservation, StockItem } from '../types';
import { getAllReservations, addReservation, updateReservationStatus, deleteReservation, searchStock, titleCase } from '../utils/db';
import { Bookmark, Search, Calendar, CheckCircle, XCircle, Clock, AlertTriangle, Plus } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'collected' | 'expired' | 'cancelled';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function futureStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isExpiredButActive(r: Reservation): boolean {
  return r.status === 'active' && r.expiry_date < todayStr();
}

export function Reservations({ currentUser }: { currentUser: StaffUser }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [stockQuery, setStockQuery] = useState('');
  const [stockResults, setStockResults] = useState<StockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [deposit, setDeposit] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [reserveDate, setReserveDate] = useState(todayStr());
  const [expiryDate, setExpiryDate] = useState(futureStr(14));
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const all = await getAllReservations();
      setReservations(all);
    } catch (e: any) {
      setError(e.message || 'Failed to load reservations');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Stock search
  const handleStockSearch = useCallback(async (q: string) => {
    setStockQuery(q);
    setSelectedStock(null);
    if (q.trim().length < 2) {
      setStockResults([]);
      return;
    }
    try {
      const results = await searchStock(q.trim());
      setStockResults(results.filter(s => s.qty > 0));
    } catch { setStockResults([]); }
  }, []);

  const selectStockItem = (item: StockItem) => {
    setSelectedStock(item);
    setStockQuery(item.description);
    setStockResults([]);
    setTotalPrice(String(item.rrp));
  };

  const resetForm = () => {
    setStockQuery('');
    setStockResults([]);
    setSelectedStock(null);
    setCustomerName('');
    setDeposit('');
    setTotalPrice('');
    setReserveDate(todayStr());
    setExpiryDate(futureStr(14));
    setNotes('');
    setShowForm(false);
  };

  const handleAdd = async () => {
    setError('');
    if (!selectedStock) { setError('Please search and select a stock item'); return; }
    if (!customerName.trim()) { setError('Customer name is required'); return; }
    const dep = parseFloat(deposit) || 0;
    const total = parseFloat(totalPrice) || 0;
    if (total <= 0) { setError('Total price must be greater than zero'); return; }
    if (dep > total) { setError('Deposit cannot exceed total price'); return; }

    try {
      await addReservation({
        stock_id: selectedStock.id,
        stock_description: selectedStock.description,
        stock_part_number: selectedStock.part_number,
        customer_id: null,
        customer_name: titleCase(customerName.trim()),
        deposit: dep,
        total_price: total,
        reserve_date: reserveDate,
        expiry_date: expiryDate,
        status: 'active',
        notes: notes.trim(),
        reserved_by: currentUser.initials,
      });
      setSuccess('Reservation added successfully');
      resetForm();
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to add reservation');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    setError('');
    try {
      await updateReservationStatus(id, status);
      setSuccess(`Reservation marked as ${status}`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to update reservation');
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    try {
      await deleteReservation(id);
      setSuccess('Reservation deleted');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to delete reservation');
    }
  };

  const filtered = filter === 'all' ? reservations : reservations.filter(r => r.status === filter);

  const activeReservations = reservations.filter(r => r.status === 'active');
  const totalDeposits = activeReservations.reduce((s, r) => s + r.deposit, 0);
  const awaitingCollection = reservations.filter(r => r.status === 'active' && !isExpiredButActive(r)).length;

  const statusBadge = (r: Reservation) => {
    const expired = isExpiredButActive(r);
    if (expired) {
      return <span className="badge badge-error badge-sm gap-1"><AlertTriangle size={10} /> Expired</span>;
    }
    switch (r.status) {
      case 'active': return <span className="badge badge-success badge-sm">Active</span>;
      case 'collected': return <span className="badge badge-info badge-sm">Collected</span>;
      case 'expired': return <span className="badge badge-error badge-sm">Expired</span>;
      case 'cancelled': return <span className="badge badge-ghost badge-sm">Cancelled</span>;
      default: return <span className="badge badge-sm">{r.status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bookmark size={20} /> Reservations &amp; Layaway
        </h2>
        <button className="btn btn-primary btn-sm gap-1" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> New Reservation
        </button>
      </div>

      {/* Success / Error */}
      {success && (
        <div className="alert alert-success mb-3 text-sm">
          <CheckCircle size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="alert alert-error mb-3 text-sm">
          <XCircle size={16} /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Active Reservations</div>
          <div className="stat-value text-lg">{activeReservations.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Deposits Held</div>
          <div className="stat-value text-lg">£{totalDeposits.toFixed(2)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Awaiting Collection</div>
          <div className="stat-value text-lg">{awaitingCollection}</div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4">
            <h3 className="font-semibold text-sm mb-2">New Reservation</h3>

            {/* Stock search */}
            <label className="label py-1"><span className="label-text text-xs">Search Stock Item</span></label>
            <div className="relative">
              <div className="flex items-center gap-1">
                <Search size={14} className="opacity-50" />
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1"
                  placeholder="Type to search stock..."
                  value={stockQuery}
                  onChange={e => handleStockSearch(e.target.value)}
                />
              </div>
              {stockResults.length > 0 && (
                <ul className="menu menu-sm bg-base-100 border border-base-300 rounded-lg shadow absolute z-10 w-full max-h-40 overflow-y-auto mt-1">
                  {stockResults.slice(0, 10).map(item => (
                    <li key={item.id}>
                      <button className="text-xs" onClick={() => selectStockItem(item)}>
                        <span className="font-mono">{item.part_number}</span> — {item.description} (Qty: {item.qty}, RRP: £{item.rrp.toFixed(2)})
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedStock && (
              <div className="text-xs text-success mt-1">
                ✓ Selected: {selectedStock.part_number} — {selectedStock.description}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="label py-1"><span className="label-text text-xs">Customer Name</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  onBlur={e => setCustomerName(titleCase(e.target.value))}
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Deposit (£)</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={deposit}
                  onChange={e => setDeposit(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Total Price (£)</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={totalPrice}
                  onChange={e => setTotalPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Reserve Date</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={reserveDate}
                  onChange={e => setReserveDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Expiry Date</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Notes</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button className="btn btn-primary btn-sm" onClick={handleAdd}>
                <Plus size={14} /> Add Reservation
              </button>
              <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="tabs tabs-boxed bg-base-200 w-fit">
        {(['all', 'active', 'collected', 'expired', 'cancelled'] as StatusFilter[]).map(f => (
          <button
            key={f}
            className={`tab tab-sm ${filter === f ? 'tab-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'all' && <span className="badge badge-sm ml-1">{reservations.length}</span>}
            {f === 'active' && <span className="badge badge-sm ml-1">{activeReservations.length}</span>}
          </button>
        ))}
      </div>

      {/* Reservations table */}
      {filtered.length === 0 ? (
        <div className="text-center text-sm opacity-60 py-8">
          No reservations found
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th>Customer</th>
                <th>Deposit</th>
                <th>Total</th>
                <th>Reserved</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={isExpiredButActive(r) ? 'bg-error/10' : ''}>
                  <td>
                    <div className="text-xs font-semibold">{r.stock_description}</div>
                    <div className="text-xs opacity-60 font-mono">{r.stock_part_number}</div>
                  </td>
                  <td className="text-xs">{r.customer_name}</td>
                  <td className="text-xs">£{r.deposit.toFixed(2)}</td>
                  <td className="text-xs">£{r.total_price.toFixed(2)}</td>
                  <td className="text-xs">
                    <span className="flex items-center gap-1"><Calendar size={10} /> {r.reserve_date}</span>
                  </td>
                  <td className="text-xs">
                    <span className="flex items-center gap-1"><Clock size={10} /> {r.expiry_date}</span>
                  </td>
                  <td>{statusBadge(r)}</td>
                  <td>
                    {r.status === 'active' && (
                      <div className="flex gap-1">
                        <button
                          className="btn btn-info btn-xs gap-1"
                          onClick={() => handleStatusChange(r.id, 'collected')}
                          title="Mark as Collected"
                        >
                          <CheckCircle size={12} /> Collected
                        </button>
                        <button
                          className="btn btn-error btn-xs gap-1"
                          onClick={() => handleStatusChange(r.id, 'expired')}
                          title="Mark as Expired"
                        >
                          <Clock size={12} /> Expired
                        </button>
                        <button
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={() => handleStatusChange(r.id, 'cancelled')}
                          title="Cancel Reservation"
                        >
                          <XCircle size={12} /> Cancel
                        </button>
                      </div>
                    )}
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
