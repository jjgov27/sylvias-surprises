import React, { useState, useEffect, useCallback } from 'react';
import { Customer, StaffUser } from '../types';
import {
  getAllCustomers, searchCustomers, addCustomer, updateCustomer,
  deleteCustomer, getCustomerSaleCount, SALUTATIONS,
} from '../utils/db';
import { Users, Search, Plus, Edit3, Trash2, Save, X, Mail, Phone, MapPin, ShoppingBag } from 'lucide-react';
import { PostcodeLookup } from './PostcodeLookup';

interface Props {
  currentUser: StaffUser;
}

const emptyCustomer: Omit<Customer, 'id' | 'created_at'> = {
  salutation: '', first_name: '', surname: '',
  address_line1: '', address_line2: '', address_line3: '',
  postcode: '', phone: '', email: '',
};

export function CustomerDatabase({ currentUser }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saleCounts, setSaleCounts] = useState<Record<number, number>>({});

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = searchQuery.trim()
        ? await searchCustomers(searchQuery.trim())
        : await getAllCustomers();
      setCustomers(data);
      // Load sale counts
      const counts: Record<number, number> = {};
      for (const c of data) {
        counts[c.id] = await getCustomerSaleCount(c.id);
      }
      setSaleCounts(counts);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { loadCustomers(); }, []);

  function handleSearch() {
    loadCustomers();
  }

  function startAdd() {
    setEditingCustomer(null);
    setForm(emptyCustomer);
    setShowForm(true);
  }

  function startEdit(c: Customer) {
    setEditingCustomer(c);
    setForm({
      salutation: c.salutation, first_name: c.first_name, surname: c.surname,
      address_line1: c.address_line1, address_line2: c.address_line2, address_line3: c.address_line3,
      postcode: c.postcode, phone: c.phone, email: c.email,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingCustomer(null);
    setForm(emptyCustomer);
  }

  async function handleSave() {
    if (!form.first_name.trim() && !form.surname.trim()) {
      alert('Please enter at least a first name or surname');
      return;
    }
    setSaving(true);
    try {
      if (editingCustomer) {
        await updateCustomer({ ...editingCustomer, ...form });
      } else {
        await addCustomer(form);
      }
      cancelForm();
      await loadCustomers();
    } catch (err) {
      alert('Error saving customer: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      await deleteCustomer(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadCustomers();
    } catch (err) {
      alert('Error deleting customer: ' + (err as Error).message);
    }
  }

  function setField(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function displayName(c: Customer): string {
    const parts = [c.salutation, c.first_name, c.surname].filter(Boolean);
    return parts.join(' ') || 'Unnamed';
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Users size={24} /> Customer Database
        <span className="badge badge-primary">{customers.length}</span>
      </h2>

      {/* Search & Add bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          className="input input-bordered flex-1 min-w-[200px]"
          placeholder="Search by name, email, phone, postcode..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn btn-primary gap-1" onClick={handleSearch}>
          <Search size={18} /> Search
        </button>
        <button className="btn btn-success gap-1" onClick={startAdd}>
          <Plus size={18} /> New Customer
        </button>
      </div>

      {/* Customer list */}
      {loading ? (
        <div className="flex justify-center p-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-base-content/50">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No customers yet</p>
          <p className="text-sm">Click "New Customer" to add your first one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <div key={c.id} className="card bg-base-200 shadow-sm">
              <div className="card-body p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div
                    className="flex-1 cursor-pointer min-w-[200px]"
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  >
                    <div className="font-bold text-lg">{displayName(c)}</div>
                    <div className="flex gap-3 text-sm text-base-content/60 flex-wrap">
                      {c.email && (
                        <span className="flex items-center gap-1"><Mail size={12} /> {c.email}</span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span>
                      )}
                      {c.postcode && (
                        <span className="flex items-center gap-1"><MapPin size={12} /> {c.postcode}</span>
                      )}
                      {(saleCounts[c.id] || 0) > 0 && (
                        <span className="flex items-center gap-1 text-primary">
                          <ShoppingBag size={12} /> {saleCounts[c.id]} sale{saleCounts[c.id] !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>
                      <Edit3 size={16} />
                    </button>
                    <button className="btn btn-ghost btn-sm text-error" onClick={() => setDeleteConfirm(c)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === c.id && (
                  <div className="mt-3 pt-3 border-t border-base-300 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-semibold text-base-content/50">Address:</span>
                      <div>
                        {c.address_line1 && <div>{c.address_line1}</div>}
                        {c.address_line2 && <div>{c.address_line2}</div>}
                        {c.address_line3 && <div>{c.address_line3}</div>}
                        {c.postcode && <div>{c.postcode}</div>}
                        {!c.address_line1 && !c.postcode && <div className="text-base-content/30 italic">No address</div>}
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold text-base-content/50">Contact:</span>
                      <div>{c.phone || <span className="text-base-content/30 italic">No phone</span>}</div>
                      <div>{c.email || <span className="text-base-content/30 italic">No email</span>}</div>
                    </div>
                    <div className="text-xs text-base-content/30 sm:col-span-2">
                      Added: {new Date(c.created_at + 'Z').toLocaleDateString('en-GB')}
                      {' · '}{saleCounts[c.id] || 0} sale{(saleCounts[c.id] || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg flex items-center gap-2">
              {editingCustomer ? <><Edit3 size={20} /> Edit Customer</> : <><Plus size={20} /> New Customer</>}
            </h3>
            <div className="mt-4 space-y-3">
              {/* Postcode Lookup — only when adding new */}
              {!editingCustomer && (
                <PostcodeLookup
                  type="customer"
                  label="Check postcode first — avoid duplicates"
                  selected={null}
                  onSelect={(c) => {
                    const cust = c as Customer;
                    setShowForm(false);
                    setEditingCustomer(cust);
                    setForm({
                      salutation: cust.salutation, first_name: cust.first_name, surname: cust.surname,
                      address_line1: cust.address_line1, address_line2: cust.address_line2,
                      address_line3: cust.address_line3, postcode: cust.postcode,
                      phone: cust.phone, email: cust.email,
                    });
                    setShowForm(true);
                  }}
                />
              )}
              <div className="flex gap-2">
                <div className="form-control w-28">
                  <label className="label py-1"><span className="label-text text-xs">Salutation</span></label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.salutation}
                    onChange={e => setField('salutation', e.target.value)}
                  >
                    <option value="">—</option>
                    {SALUTATIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">First Name</span></label>
                  <input
                    type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                    value={form.first_name} onChange={e => setField('first_name', e.target.value)}
                  />
                </div>
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">Surname</span></label>
                  <input
                    type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                    value={form.surname} onChange={e => setField('surname', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Address Line 1</span></label>
                <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                  value={form.address_line1} onChange={e => setField('address_line1', e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Address Line 2</span></label>
                <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                  value={form.address_line2} onChange={e => setField('address_line2', e.target.value)} />
              </div>
              <div className="flex gap-2">
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">Address Line 3</span></label>
                  <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                    value={form.address_line3} onChange={e => setField('address_line3', e.target.value)} />
                </div>
                <div className="form-control w-36">
                  <label className="label py-1"><span className="label-text text-xs">Postcode</span></label>
                  <input type="text" className="input input-bordered input-sm"
                    value={form.postcode} onChange={e => setField('postcode', e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">Phone</span></label>
                  <input type="tel" className="input input-bordered input-sm"
                    value={form.phone} onChange={e => setField('phone', e.target.value)} />
                </div>
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">Email</span></label>
                  <input type="email" className="input input-bordered input-sm"
                    value={form.email} onChange={e => setField('email', e.target.value.toLowerCase())} />
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={cancelForm} disabled={saving}>
                <X size={16} /> Cancel
              </button>
              <button className="btn btn-primary gap-1" onClick={handleSave} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-sm" /> : <Save size={16} />}
                {editingCustomer ? 'Update' : 'Save'} Customer
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !saving && cancelForm()} />
        </dialog>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">Delete Customer?</h3>
            <p className="py-3">
              Are you sure you want to delete <strong>{displayName(deleteConfirm)}</strong>?
              {(saleCounts[deleteConfirm.id] || 0) > 0 && (
                <span className="text-warning block mt-1">
                  This customer has {saleCounts[deleteConfirm.id]} sale record{saleCounts[deleteConfirm.id] !== 1 ? 's' : ''}.
                </span>
              )}
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-error gap-1" onClick={handleDelete}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)} />
        </dialog>
      )}
    </div>
  );
}
