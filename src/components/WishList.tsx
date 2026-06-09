import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Search, Plus, CheckCircle, Bell, XCircle, Star, MessageSquare } from 'lucide-react';
import { StaffUser, WishListItem, Customer } from '../types';
import { getAllWishListItems, addWishListItem, updateWishListStatus, deleteWishListItem, searchCustomers, titleCase } from '../utils/db';

type StatusFilter = 'all' | 'open' | 'found' | 'notified' | 'closed';

export function WishList({ currentUser }: { currentUser: StaffUser }) {
  const [items, setItems] = useState<WishListItem[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const all = await getAllWishListItems();
      setItems(all);
    } catch (e: any) {
      setError(e.message || 'Failed to load wish list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // Customer search with debounce
  useEffect(() => {
    if (customerQuery.length < 2) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const results = await searchCustomers(customerQuery);
        setCustomerResults(results);
        setShowCustomerDropdown(results.length > 0);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery]);

  const filteredItems = filter === 'all' ? items : items.filter(i => i.status === filter);

  const stats = {
    open: items.filter(i => i.status === 'open').length,
    found: items.filter(i => i.status === 'found').length,
    total: items.length,
  };

  const handleSelectCustomer = (c: Customer) => {
    const fullName = `${c.first_name} ${c.surname}`.trim();
    setCustomerName(fullName);
    setCustomerId(c.id);
    setCustomerQuery(fullName);
    setShowCustomerDropdown(false);
    setCustomerResults([]);
  };

  const handleCustomerQueryChange = (val: string) => {
    setCustomerQuery(val);
    setCustomerName(titleCase(val));
    setCustomerId(null);
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerId(null);
    setDescription('');
    setNotes('');
    setCustomerQuery('');
    setCustomerResults([]);
    setShowCustomerDropdown(false);
  };

  const handleAdd = async () => {
    setError('');
    if (!customerName.trim()) { setError('Customer name is required'); return; }
    if (!description.trim()) { setError('Description of what they want is required'); return; }
    try {
      await addWishListItem({
        customer_id: customerId,
        customer_name: customerName.trim(),
        description: description.trim(),
        notes: notes.trim(),
        status: 'open',
        created_by: currentUser.initials,
      });
      setSuccess('Wish added successfully!');
      resetForm();
      setShowForm(false);
      await loadItems();
    } catch (e: any) {
      setError(e.message || 'Failed to add wish');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    setError('');
    try {
      await updateWishListStatus(id, newStatus);
      setSuccess(`Status updated to ${newStatus}`);
      await loadItems();
    } catch (e: any) {
      setError(e.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    try {
      await deleteWishListItem(id);
      setSuccess('Wish removed');
      setDeleteId(null);
      await loadItems();
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: 'badge badge-success badge-sm',
      found: 'badge badge-warning badge-sm',
      notified: 'badge badge-info badge-sm',
      closed: 'badge badge-ghost badge-sm',
    };
    return <span className={map[status] || 'badge badge-sm'}>{status}</span>;
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return d; }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500" /> Wish List
        </h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(!showForm); setError(''); }}>
          <Plus className="w-4 h-4" /> Add Wish
        </button>
      </div>

      {/* Success alert */}
      {success && (
        <div className="alert alert-success mb-3 text-sm">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="alert alert-error mb-3 text-sm">
          <XCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Open Wishes</div>
          <div className="stat-value text-lg text-success">{stats.open}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Found (Awaiting Notify)</div>
          <div className="stat-value text-lg text-warning">{stats.found}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Wishes</div>
          <div className="stat-value text-lg">{stats.total}</div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Star className="w-4 h-4" /> New Wish
            </h3>

            <div className="relative">
              <label className="label py-1"><span className="label-text text-xs">Customer Name</span></label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full"
                    placeholder="Type name or search existing customer..."
                    value={customerQuery}
                    onChange={e => handleCustomerQueryChange(e.target.value)}
                    onFocus={() => { if (customerResults.length > 0) setShowCustomerDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  />
                  {showCustomerDropdown && (
                    <ul className="absolute z-50 w-full bg-base-100 border border-base-300 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg">
                      {customerResults.map(c => (
                        <li
                          key={c.id}
                          className="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
                          onMouseDown={() => handleSelectCustomer(c)}
                        >
                          <span className="font-medium">{c.first_name} {c.surname}</span>
                          {c.phone && <span className="text-xs opacity-60 ml-2">{c.phone}</span>}
                          {c.postcode && <span className="text-xs opacity-60 ml-2">{c.postcode}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {customerId && (
                  <span className="badge badge-primary badge-sm self-center whitespace-nowrap">
                    <Search className="w-3 h-3 mr-1" /> Linked
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="label py-1"><span className="label-text text-xs">What are they looking for?</span></label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="e.g. Victorian oil lamp, Art Deco clock..."
                value={description}
                onChange={e => setDescription(titleCase(e.target.value))}
              />
            </div>

            <div>
              <label className="label py-1"><span className="label-text text-xs">Notes (optional)</span></label>
              <textarea
                className="textarea textarea-bordered textarea-sm w-full"
                placeholder="Budget, preferences, colour, size..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2 mt-2">
              <button className="btn btn-primary btn-sm" onClick={handleAdd}>
                <Plus className="w-4 h-4" /> Add Wish
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); resetForm(); setError(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(['all', 'open', 'found', 'notified', 'closed'] as StatusFilter[]).map(f => (
          <button
            key={f}
            className={`btn btn-xs ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 opacity-70">({items.filter(i => i.status === f).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Items list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 opacity-60 text-sm">
          <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {filter === 'all' ? 'No wishes yet. Add one above!' : `No ${filter} wishes.`}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => (
            <div key={item.id} className="card bg-base-200 shadow">
              <div className="card-body p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{item.customer_name}</span>
                      {statusBadge(item.status)}
                    </div>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <Search className="w-3 h-3 opacity-50 shrink-0" />
                      <span>{item.description}</span>
                    </p>
                    {item.notes && (
                      <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 shrink-0" />
                        {item.notes}
                      </p>
                    )}
                    <p className="text-xs opacity-50 mt-1">
                      Added {formatDate(item.created_at)} by {item.created_by}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {item.status === 'open' && (
                    <button
                      className="btn btn-warning btn-xs"
                      onClick={() => handleStatusChange(item.id, 'found')}
                    >
                      <CheckCircle className="w-3 h-3" /> Mark as Found
                    </button>
                  )}
                  {item.status === 'found' && (
                    <button
                      className="btn btn-info btn-xs"
                      onClick={() => handleStatusChange(item.id, 'notified')}
                    >
                      <Bell className="w-3 h-3" /> Mark as Notified
                    </button>
                  )}
                  {(item.status === 'notified' || item.status === 'found') && (
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleStatusChange(item.id, 'closed')}
                    >
                      <XCircle className="w-3 h-3" /> Close
                    </button>
                  )}
                  {item.status === 'open' && (
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleStatusChange(item.id, 'closed')}
                    >
                      <XCircle className="w-3 h-3" /> Close
                    </button>
                  )}

                  {deleteId === item.id ? (
                    <span className="flex items-center gap-1 ml-auto">
                      <span className="text-xs text-error">Delete?</span>
                      <button className="btn btn-error btn-xs" onClick={() => handleDelete(item.id)}>Yes</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setDeleteId(null)}>No</button>
                    </span>
                  ) : (
                    <button
                      className="btn btn-ghost btn-xs ml-auto text-error"
                      onClick={() => setDeleteId(item.id)}
                    >
                      <XCircle className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
