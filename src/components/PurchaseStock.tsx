import React, { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw, Camera, Hash, Tag, Plus, X, AlertTriangle } from 'lucide-react';
import { PostcodeLookup } from './PostcodeLookup';
import { StaffUser, Supplier } from '../types';
import {
  addPurchasedStockItem, CATEGORIES, LOCATIONS, STOCK_PAYMENT_METHODS,
  getLearnedItemNames, titleCase, getStaffUsers,
  getAllSuppliers, addSupplier, SOURCE_TYPES, getCategories, getLocations,
  addSupplierInvoice,
} from '../utils/db';

interface PurchaseStockProps {
  currentUser: StaffUser;
  onSaved: () => void;
  onCancel: () => void;
}

export const PurchaseStock: React.FC<PurchaseStockProps> = ({ currentUser, onSaved, onCancel }) => {
  const [partNumber, setPartNumber] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [qty, setQty] = useState('1');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [rrp, setRrp] = useState('');
  const [category, setCategory] = useState('Other');
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [sourceType, setSourceType] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState('Cash');
  const [purchasedBy, setPurchasedBy] = useState(currentUser.name);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allItemNames, setAllItemNames] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  // Part number is always manual — no auto-generation
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupSourceType, setNewSupSourceType] = useState('');
  const [newSupContactName, setNewSupContactName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');
  const [newSupPostcode, setNewSupPostcode] = useState('');
  const [newSupNotes, setNewSupNotes] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState('');
  const descRef = useRef<HTMLInputElement>(null);
  const newSupRef = useRef<HTMLInputElement>(null);
  const [dynCategories, setDynCategories] = useState<string[]>(CATEGORIES);
  const [dynLocations, setDynLocations] = useState<string[]>(LOCATIONS);
  const [onAccount, setOnAccount] = useState(false);
  const [accountDueDate, setAccountDueDate] = useState('');

  useEffect(() => {
    loadItemNames();
    getAllSuppliers().then(setSuppliers);
    getStaffUsers().then(setStaffList);
    getCategories().then(setDynCategories);
    getLocations().then(setDynLocations);
  }, []);

  // Part number is always blank by default — manual entry only

  async function loadItemNames() {
    const names = await getLearnedItemNames();
    setAllItemNames(names);
  }

  function handleCategoryChange(newCat: string) {
    setCategory(newCat);
  }

  function handleDescriptionChange(val: string) {
    setDescription(titleCase(val));
    if (val.length >= 2 && allItemNames.length > 0) {
      const lower = val.toLowerCase();
      const matches = allItemNames.filter(n => n.toLowerCase().includes(lower));
      setSuggestions(matches.slice(0, 8));
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }

  function selectSuggestion(name: string) {
    setDescription(name);
    setShowSuggestions(false);
  }

  function openNewSupplierForm() {
    setShowNewSupplier(true);
    setNewSupName('');
    setNewSupSourceType('');
    setNewSupContactName('');
    setNewSupPhone('');
    setNewSupEmail('');
    setNewSupAddress('');
    setNewSupPostcode('');
    setNewSupNotes('');
    setSupplierError('');
    setTimeout(() => newSupRef.current?.focus(), 100);
  }

  function cancelNewSupplier() {
    setShowNewSupplier(false);
    setSupplierError('');
  }

  async function handleSaveNewSupplier() {
    setSupplierError('');
    if (!newSupName.trim()) {
      setSupplierError('Supplier name is required');
      return;
    }
    setSavingSupplier(true);
    try {
      const newId = await addSupplier({
        name: newSupName.trim(),
        source_type: newSupSourceType,
        contact_name: newSupContactName.trim(),
        phone: newSupPhone.trim(),
        email: newSupEmail.trim(),
        address: newSupAddress.trim(),
        postcode: newSupPostcode.trim(),
        notes: newSupNotes.trim(),
      });
      const updated = await getAllSuppliers();
      setSuppliers(updated);
      setSupplierId(newId);
      setShowNewSupplier(false);
    } catch (err) {
      console.error('Failed to add supplier:', err);
      setSupplierError('Failed to save supplier. Please try again.');
    } finally {
      setSavingSupplier(false);
    }
  }

  async function handleSave() {
    setError('');
    setSuccess('');

    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!partNumber.trim()) {
      setError('Part number is required');
      return;
    }

    setSaving(true);
    try {
      await addPurchasedStockItem({
        part_number: partNumber.trim(),
        description: description.trim(),
        photo,
        qty: parseInt(qty) || 1,
        location,
        cost: parseFloat(cost) || 0,
        rrp: parseFloat(rrp) || 0,
        entered_by: currentUser.initials,
        category,
        supplier_id: supplierId,
        source_type: sourceType,
        purchase_date: purchaseDate,
        purchase_payment_method: onAccount ? 'on_account' : purchasePaymentMethod,
        purchased_by: purchasedBy,
      });
      if (onAccount) {
        const totalCost = (parseFloat(cost) || 0) * (parseInt(qty) || 1);
        const supName = supplierId ? (suppliers.find(s => s.id === supplierId)?.name || '') : '';
        await addSupplierInvoice({
          invoice_ref: '',
          supplier_id: supplierId,
          supplier_name: supName,
          description: description.trim(),
          total_amount: totalCost,
          invoice_date: purchaseDate,
          due_date: accountDueDate || '',
          notes: `Stock purchase by ${currentUser.initials}`,
          entered_by: currentUser.initials,
        });
        setSuccess('Purchase recorded & supplier invoice created! ✅');
      } else {
        setSuccess('Purchase recorded successfully! ✅');
      }
      resetForm();
      setTimeout(() => { onSaved(); }, 800);
    } catch (err) {
      console.error('Failed to save purchase:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setDescription('');
    setPhoto('');
    setQty('1');
    setLocation('');
    setCost('');
    setRrp('');
    setCategory('Other');
    setSupplierId(null);
    setSourceType('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPurchasePaymentMethod('Cash');
    setPurchasedBy(currentUser.name);
    setError('');
    setSuccess('');
    setOnAccount(false);
    setAccountDueDate('');
    descRef.current?.focus();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-base-content">🛒 Purchase New Stock</h2>
        <div className="badge badge-success text-white whitespace-nowrap">
          {currentUser.name} ({currentUser.initials})
        </div>
      </div>

      <div className="alert alert-success mb-4 text-sm">
        <span>📦 Items purchased here are tracked separately from existing stock. They'll show as 🆕 New Purchase in Stock Control.</span>
      </div>

      {error && <div className="alert alert-error mb-3 text-sm"><span>{error}</span></div>}
      {success && <div className="alert alert-success mb-3 text-sm"><span>{success}</span></div>}

      <div className="card bg-base-200">
        <div className="card-body gap-3">

          {/* Description with autocomplete */}
          <div className="form-control relative">
            <label className="label"><span className="label-text font-semibold">Description *</span></label>
            <label className="input input-bordered flex items-center gap-2">
              <Tag className="h-[1em] opacity-50" />
              <input
                ref={descRef}
                type="text"
                className="grow"
                value={description}
                onChange={e => handleDescriptionChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => description.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="e.g. Victorian Mantel Clock"
              />
            </label>
            {showSuggestions && (
              <ul className="menu bg-base-300 rounded-box shadow-lg absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button className="text-sm" onMouseDown={() => selectSuggestion(s)}>{s}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Part Number */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Part Number</span></label>
            <label className="input input-bordered flex items-center gap-2">
              <Hash className="h-[1em] opacity-50" />
              <input
                type="text"
                className="grow font-mono"
                value={partNumber}
                onChange={e => { setPartNumber(e.target.value.toUpperCase()); }}
              />
            </label>
          </div>

          {/* Category */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Category</span></label>
            <select
              className="select select-bordered w-full"
              value={category}
              onChange={e => handleCategoryChange(e.target.value)}
            >
              {dynCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Quantity and Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Quantity</span></label>
              <input
                type="text"
                inputMode="numeric"
                className="input input-bordered w-full"
                value={qty}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || /^\d+$/.test(v)) setQty(v);
                }}
                placeholder="1"
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Location</span></label>
              <select
                className="select select-bordered w-full"
                value={location}
                onChange={e => setLocation(e.target.value)}
              >
                <option value="">Select location...</option>
                {dynLocations.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cost and RRP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Cost Price (£)</span></label>
              <input
                type="text"
                inputMode="decimal"
                className="input input-bordered w-full"
                value={cost}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setCost(v);
                }}
                placeholder="0.00"
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">RRP / Selling Price (£)</span></label>
              <input
                type="text"
                inputMode="decimal"
                className="input input-bordered w-full"
                value={rrp}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setRrp(v);
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Supplier */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Supplier</span></label>
            {!showNewSupplier ? (
              <div className="flex gap-2">
                <select
                  className="select select-bordered flex-1"
                  value={supplierId ?? ''}
                  onChange={e => {
                    if (e.target.value === '__new__') {
                      openNewSupplierForm();
                    } else {
                      setSupplierId(e.target.value ? Number(e.target.value) : null);
                    }
                  }}
                >
                  <option value="">No supplier selected</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.source_type ? ` (${s.source_type})` : ''}</option>
                  ))}
                  <option value="__new__">➕ Add New Supplier...</option>
                </select>
              </div>
            ) : (
              <div className="bg-base-300 rounded-xl p-4 space-y-3 border border-primary/30">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-primary">➕ New Supplier</span>
                  <button className="btn btn-ghost btn-xs btn-circle" onClick={cancelNewSupplier}><X size={14} /></button>
                </div>
                {supplierError && <div className="text-error text-xs">{supplierError}</div>}
                <PostcodeLookup
                  type="supplier"
                  label="Find existing supplier by postcode"
                  compact
                  selected={null}
                  onSelect={(s) => {
                    const sup = s as Supplier;
                    setSupplierId(String(sup.id));
                    setShowNewSupplier(false);
                  }}
                />
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs">Name *</span></label>
                  <input ref={newSupRef} type="text" className="input input-bordered input-sm w-full" value={newSupName} onChange={e => setNewSupName(titleCase(e.target.value))} placeholder="Supplier name" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs">Address</span></label>
                  <input type="text" className="input input-bordered input-sm w-full" style={{textTransform: 'capitalize'}} value={newSupAddress} onChange={e => setNewSupAddress(e.target.value)} placeholder="Address" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">Postcode</span></label>
                    <input type="text" className="input input-bordered input-sm w-full" style={{textTransform: 'uppercase'}} value={newSupPostcode} onChange={e => setNewSupPostcode(e.target.value.toUpperCase())} placeholder="e.g. IM4 4AD" />
                  </div>
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">Contact Name</span></label>
                    <input type="text" className="input input-bordered input-sm w-full" value={newSupContactName} onChange={e => setNewSupContactName(titleCase(e.target.value))} placeholder="Contact name" />
                  </div>
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">Phone</span></label>
                    <input type="text" className="input input-bordered input-sm w-full" value={newSupPhone} onChange={e => setNewSupPhone(e.target.value)} placeholder="Phone number" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">Email</span></label>
                    <input type="text" className="input input-bordered input-sm w-full" value={newSupEmail} onChange={e => setNewSupEmail(e.target.value.toLowerCase())} placeholder="Email" />
                  </div>
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">Source Type</span></label>
                    <select className="select select-bordered select-sm w-full" value={newSupSourceType} onChange={e => setNewSupSourceType(e.target.value)}>
                      <option value="">Select...</option>
                      {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs">Notes</span></label>
                  <input type="text" className="input input-bordered input-sm w-full" value={newSupNotes} onChange={e => setNewSupNotes(e.target.value)} placeholder="Any notes" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button className={`btn btn-primary btn-sm flex-1 ${savingSupplier ? 'loading' : ''}`} onClick={handleSaveNewSupplier} disabled={savingSupplier}>
                    {savingSupplier ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
                    Save Supplier
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={cancelNewSupplier}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Source Type */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Source Type</span></label>
            <select
              className="select select-bordered w-full"
              value={sourceType}
              onChange={e => setSourceType(e.target.value)}
            >
              <option value="">Select source type...</option>
              {SOURCE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Purchase Date and Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Purchase Date</span></label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Payment Method</span></label>
              <select
                className="select select-bordered w-full"
                value={purchasePaymentMethod}
                onChange={e => setPurchasePaymentMethod(e.target.value)}
              >
                {STOCK_PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* On Account toggle */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-2">
              <input type="checkbox" className="toggle toggle-warning" checked={onAccount} onChange={e => setOnAccount(e.target.checked)} />
              <span className="label-text font-semibold">On Account (not yet paid)</span>
            </label>
          </div>

          {onAccount && (
            <div className="alert alert-warning py-2 text-sm">
              <AlertTriangle size={16} />
              <span>This will create a supplier invoice for £{((parseFloat(cost) || 0) * (parseInt(qty) || 1)).toFixed(2)} — viewable in <strong>Supplier Invoices</strong></span>
            </div>
          )}

          {onAccount && (
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Due Date (optional)</span></label>
              <input type="date" className="input input-bordered w-full" value={accountDueDate} onChange={e => setAccountDueDate(e.target.value)} />
            </div>
          )}

          {/* Purchased By */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Purchased By</span></label>
            <select
              className="select select-bordered w-full"
              value={purchasedBy}
              onChange={e => setPurchasedBy(e.target.value)}
            >
              <option value="">Select who purchased...</option>
              {staffList.map(s => (
                <option key={s.id} value={s.name}>{s.name} ({s.initials})</option>
              ))}
            </select>
          </div>

          {/* Photo URL */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Photo</span></label>
            <label className="input input-bordered flex items-center gap-2">
              <Camera className="h-[1em] opacity-50" />
              <input
                type="text"
                className="grow"
                value={photo}
                onChange={e => setPhoto(e.target.value)}
                placeholder="Paste image URL or leave blank"
              />
            </label>
            {photo && (
              <div className="mt-2">
                <img src={photo} alt="Preview" className="rounded-lg max-h-32 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>

          {/* Entered By (read-only) */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Entered By</span></label>
            <input
              type="text"
              className="input input-bordered w-full bg-base-300"
              value={`${currentUser.name} (${currentUser.initials})`}
              readOnly
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              className={`btn btn-primary flex-1 ${saving ? 'loading' : ''}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Save size={18} />
              )}
              Record Purchase
            </button>
            <button className="btn btn-ghost" onClick={resetForm}>
              <RotateCcw size={18} /> Clear
            </button>
            <button className="btn btn-outline" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
