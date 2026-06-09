import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Edit, Trash2, Search, MapPin, Phone, Mail, Package } from 'lucide-react';
import { PostcodeLookup } from './PostcodeLookup';
import { StaffUser, Supplier, StockItem } from '../types';
import {
  getAllSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  getStockBySupplier,
  SOURCE_TYPES,
  titleCase,
} from '../utils/db';

const SOURCE_BADGE_COLOURS: Record<string, string> = {
  'Auction House': 'badge-secondary',       // purple
  'House Clearance': 'badge-info',           // blue
  'Car Boot Sale': 'badge-warning',          // orange
  'Private Sale': 'badge-success',           // green
  'Dealer': 'badge-primary',                 // primary
  'Online': 'badge-accent',                  // accent
  'Donation': 'badge-ghost',                 // ghost
  'Estate Sale': 'badge-neutral',            // neutral
  'Other': 'badge-outline',                  // outline
};

function badgeClass(sourceType: string): string {
  return SOURCE_BADGE_COLOURS[sourceType] || 'badge-outline';
}

const emptyForm = {
  name: '',
  source_type: 'Other',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  postcode: '',
  notes: '',
};

export function SupplierLog({ currentUser }: { currentUser: StaffUser }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Detail view
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierStock, setSupplierStock] = useState<StockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllSuppliers();
      setSuppliers(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // Filtered list
  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.contact_name.toLowerCase().includes(q) ||
      s.source_type.toLowerCase().includes(q);
    const matchType = !filterType || s.source_type === filterType;
    return matchSearch && matchType;
  });

  // Stats
  const totalSuppliers = suppliers.length;
  const typeBreakdown: Record<string, number> = {};
  suppliers.forEach((s) => {
    typeBreakdown[s.source_type] = (typeBreakdown[s.source_type] || 0) + 1;
  });

  // ── Handlers ──

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (s: Supplier) => {
    setForm({
      name: s.name,
      source_type: s.source_type,
      contact_name: s.contact_name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      postcode: s.postcode || '',
      notes: s.notes,
    });
    setEditingId(s.id);
    setShowForm(true);
    setSelectedSupplier(null);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSupplier(id);
      setSuccess('Supplier deleted');
      if (selectedSupplier?.id === id) setSelectedSupplier(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to delete supplier');
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim()) {
      setError('Supplier name is required');
      return;
    }
    try {
      if (editingId !== null) {
        await updateSupplier({
          id: editingId,
          name: form.name,
          source_type: form.source_type,
          contact_name: form.contact_name,
          phone: form.phone,
          email: form.email.trim(),
          address: form.address,
          postcode: form.postcode,
          notes: form.notes,
          created_at: '',
        });
        setSuccess('Supplier updated');
      } else {
        await addSupplier({
          name: form.name,
          source_type: form.source_type,
          contact_name: form.contact_name,
          phone: form.phone,
          email: form.email.trim(),
          address: form.address,
          postcode: form.postcode,
          notes: form.notes,
        });
        setSuccess('Supplier added');
      }
      resetForm();
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to save supplier');
    }
  };

  const handleSelectSupplier = async (s: Supplier) => {
    setSelectedSupplier(s);
    setLoadingStock(true);
    try {
      const items = await getStockBySupplier(s.id);
      setSupplierStock(items);
    } catch (e: any) {
      setError(e.message || 'Failed to load stock for supplier');
    } finally {
      setLoadingStock(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Truck className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">Supplier / Sourcing Log</h2>
      </div>

      {/* Success */}
      {success && (
        <div className="alert alert-success mb-3 text-sm">
          <span>{success}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error mb-3 text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Suppliers</div>
          <div className="stat-value text-lg">{totalSuppliers}</div>
        </div>
        {Object.entries(typeBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <div key={type} className="stat bg-base-200 rounded-lg p-3">
              <div className="stat-title text-xs">{type}</div>
              <div className="stat-value text-lg">{count}</div>
            </div>
          ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label py-1"><span className="label-text text-xs">Search</span></label>
          <div className="input input-bordered input-sm flex items-center gap-2">
            <Search className="w-4 h-4 opacity-60" />
            <input
              type="text"
              className="grow bg-transparent outline-none"
              placeholder="Search name, contact, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label py-1"><span className="label-text text-xs">Source Type</span></label>
          <select
            className="select select-bordered select-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-sm gap-1" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4">
            <h3 className="font-bold text-sm mb-2">{editingId !== null ? 'Edit Supplier' : 'New Supplier'}</h3>
            {/* Postcode Lookup — only when adding new */}
            {editingId === null && (
              <div className="mb-3">
                <PostcodeLookup
                  type="supplier"
                  label="Check postcode first — avoid duplicates"
                  selected={null}
                  onSelect={(s) => {
                    const sup = s as Supplier;
                    setForm({
                      name: sup.name, source_type: sup.source_type, contact_name: sup.contact_name,
                      phone: sup.phone, email: sup.email, address: sup.address,
                      postcode: sup.postcode || '', notes: sup.notes,
                    });
                    setEditingId(sup.id);
                  }}
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="label py-1"><span className="label-text text-xs">Supplier Name *</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: titleCase(e.target.value) })}
                  placeholder="e.g. Bonhams"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Source Type</span></label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={form.source_type}
                  onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Contact Name</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: titleCase(e.target.value) })}
                  placeholder="Contact person"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Phone</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Email</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Address</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  style={{textTransform: 'capitalize'}}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Address"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs">Postcode</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  style={{textTransform: 'uppercase'}}
                  value={form.postcode}
                  onChange={(e) => setForm({ ...form, postcode: e.target.value.toUpperCase() })}
                  placeholder="e.g. IM4 4AD"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="label py-1"><span className="label-text text-xs">Notes</span></label>
                <textarea
                  className="textarea textarea-bordered textarea-sm w-full"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes about this supplier…"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-primary btn-sm" onClick={handleSubmit}>
                {editingId !== null ? 'Update' : 'Add'} Supplier
              </button>
              <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Detail Panel */}
      {selectedSupplier && (
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                <h3 className="font-bold">{selectedSupplier.name}</h3>
                <span className={`badge ${badgeClass(selectedSupplier.source_type)} badge-sm`}>
                  {selectedSupplier.source_type}
                </span>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setSelectedSupplier(null)}>✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
              {selectedSupplier.contact_name && (
                <div className="flex items-center gap-1">
                  <span className="opacity-60">Contact:</span> {selectedSupplier.contact_name}
                </div>
              )}
              {selectedSupplier.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 opacity-60" /> {selectedSupplier.phone}
                </div>
              )}
              {selectedSupplier.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-3 h-3 opacity-60" /> {selectedSupplier.email}
                </div>
              )}
              {(selectedSupplier.address || selectedSupplier.postcode) && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 opacity-60" /> {[selectedSupplier.address, selectedSupplier.postcode].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
            {selectedSupplier.notes && (
              <p className="text-xs opacity-70 mb-3">{selectedSupplier.notes}</p>
            )}

            {/* Stock from this supplier */}
            <h4 className="font-semibold text-sm flex items-center gap-1 mb-1">
              <Package className="w-4 h-4" /> Stock Items ({supplierStock.length})
            </h4>
            {loadingStock ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : supplierStock.length === 0 ? (
              <p className="text-xs opacity-60">No stock items linked to this supplier.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-base-300">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Part #</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Cost</th>
                      <th>RRP</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierStock.map((item) => (
                      <tr key={item.id}>
                        <td className="font-mono text-xs">{item.part_number}</td>
                        <td>{item.description}</td>
                        <td>{item.qty}</td>
                        <td>£{item.cost.toFixed(2)}</td>
                        <td>£{item.rrp.toFixed(2)}</td>
                        <td className="text-xs">{item.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suppliers Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm opacity-60 text-center py-4">
          {suppliers.length === 0 ? 'No suppliers yet. Add your first supplier above.' : 'No suppliers match your search.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Source Type</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className={`hover cursor-pointer ${selectedSupplier?.id === s.id ? 'bg-base-300' : ''}`}
                  onClick={() => handleSelectSupplier(s)}
                >
                  <td className="font-medium">{s.name}</td>
                  <td>
                    <span className={`badge ${badgeClass(s.source_type)} badge-sm`}>
                      {s.source_type}
                    </span>
                  </td>
                  <td className="text-xs">{s.contact_name}</td>
                  <td className="text-xs">{s.phone}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-xs"
                        title="Edit"
                        onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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
