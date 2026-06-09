import React, { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw, Camera, Hash, Tag, Plus, X, ScanLine, Printer, AlertTriangle } from 'lucide-react';
import { PostcodeLookup } from './PostcodeLookup';
import { StockItem, StaffUser, Supplier } from '../types';
import {
  addStockItem, addPurchasedStockItem, updateStockItem, CATEGORIES, LOCATIONS, STOCK_PAYMENT_METHODS,
  getLearnedItemNames, titleCase, getStaffUsers, getAllStock,
  getAllSuppliers, addSupplier, SOURCE_TYPES, getCategories, getLocations,
  addSupplierInvoice,
} from '../utils/db';
import { ScanEntry } from './ScanEntry';

interface StockEntryProps {
  currentUser: StaffUser;
  editItem?: StockItem | null;
  onSaved: () => void;
  onCancel: () => void;
  onNavigate?: (view: string) => void;
}

type AcquisitionType = 'existing' | 'purchased';

export const StockEntry: React.FC<StockEntryProps> = ({ currentUser, editItem, onSaved, onCancel, onNavigate }) => {
  const [partNumber, setPartNumber] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [qty, setQty] = useState('1');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [rrp, setRrp] = useState('');
  const [category, setCategory] = useState('Other');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allItemNames, setAllItemNames] = useState<string[]>([]);
  const descRef = useRef<HTMLInputElement>(null);
  const [partNumberManual, setPartNumberManual] = useState(false);

  // Acquisition fields
  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType>('existing');
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [sourceType, setSourceType] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState('Cash');
  const [purchasedBy, setPurchasedBy] = useState(currentUser.name);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

  // Inline new supplier form
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
  const newSupRef = useRef<HTMLInputElement>(null);

  const [dynCategories, setDynCategories] = useState<string[]>(CATEGORIES);
  const [dynLocations, setDynLocations] = useState<string[]>(LOCATIONS);
  const [showScan, setShowScan] = useState(false);
  const [scanFilled, setScanFilled] = useState(false);

  // Duplicate detection
  const [existingStock, setExistingStock] = useState<StockItem[]>([]);
  const [dupWarning, setDupWarning] = useState<{ description: string; qty: number } | null>(null);

  // No part number initials prompt
  const [showNoPartPrompt, setShowNoPartPrompt] = useState(false);
  const [noPartInitials, setNoPartInitials] = useState('');

  // On Account (not yet paid)
  const [onAccount, setOnAccount] = useState(false);
  const [accountDueDate, setAccountDueDate] = useState('');

  useEffect(() => {
    getCategories().then(setDynCategories);
    getLocations().then(setDynLocations);
    getAllStock().then(setExistingStock);
  }, []);

  useEffect(() => {
    if (editItem) {
      setPartNumber(editItem.part_number);
      setDescription(editItem.description);
      setPhoto(editItem.photo);
      setQty(String(editItem.qty));
      setLocation(editItem.location);
      setCost(String(editItem.cost));
      setRrp(String(editItem.rrp));
      setCategory(editItem.category);
      setPartNumberManual(true);
      // Set acquisition type based on existing entry_type
      if (editItem.entry_type === 'purchase') {
        setAcquisitionType('purchased');
        setSupplierId(editItem.supplier_id || null);
        setSourceType(editItem.source_type || '');
        setPurchaseDate(editItem.purchase_date || new Date().toISOString().slice(0, 10));
        setPurchasePaymentMethod(editItem.purchase_payment_method || 'Cash');
        setPurchasedBy(editItem.purchased_by || currentUser.name);
      } else {
        setAcquisitionType('existing');
      }
    }
    loadItemNames();
    getAllSuppliers().then(setSuppliers);
    getStaffUsers().then(setStaffList);
  }, [editItem]);

  /* Part number is always manual — no auto-generation */

  async function loadItemNames() {
    const names = await getLearnedItemNames();
    setAllItemNames(names);
  }

  function handleCategoryChange(newCat: string) {
    setCategory(newCat);
    setPartNumberManual(false);
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
    setNewSupName(''); setNewSupSourceType(''); setNewSupContactName('');
    setNewSupPhone(''); setNewSupEmail(''); setNewSupAddress(''); setNewSupPostcode(''); setNewSupNotes('');
    setSupplierError('');
    setTimeout(() => newSupRef.current?.focus(), 100);
  }

  function cancelNewSupplier() {
    setShowNewSupplier(false);
    setSupplierError('');
  }

  async function handleSaveNewSupplier() {
    setSupplierError('');
    if (!newSupName.trim()) { setSupplierError('Supplier name is required'); return; }
    setSavingSupplier(true);
    try {
      const newId = await addSupplier({
        name: newSupName.trim(), source_type: newSupSourceType,
        contact_name: newSupContactName.trim(), phone: newSupPhone.trim(),
        email: newSupEmail.trim(), address: newSupAddress.trim(), postcode: newSupPostcode.trim(), notes: newSupNotes.trim(),
      });
      const updated = await getAllSuppliers();
      setSuppliers(updated);
      setSupplierId(newId);
      setShowNewSupplier(false);
    } catch (err) {
      console.error('Failed to add supplier:', err);
      setSupplierError('Failed to save supplier. Please try again.');
    } finally { setSavingSupplier(false); }
  }

  function handleScanResult(data: Record<string, string | undefined>) {
    if (data.description) setDescription(titleCase(data.description));
    if (data.part_number) { setPartNumber(data.part_number.toUpperCase()); setPartNumberManual(true); }
    if (data.qty) setQty(data.qty);
    if (data.category) {
      const match = dynCategories.find(c => c.toLowerCase() === (data.category || '').toLowerCase());
      if (match) setCategory(match);
    }
    if (data.location) {
      const match = dynLocations.find(l => l.toLowerCase() === (data.location || '').toLowerCase());
      if (match) setLocation(match);
    }
    if (data.cost) setCost(data.cost.replace(/[^0-9.]/g, ''));
    if (data.rrp) setRrp(data.rrp.replace(/[^0-9.]/g, ''));
    if (data.acquisition_type === 'purchased') {
      setAcquisitionType('purchased');
      if (data.purchase_date) setPurchaseDate(data.purchase_date);
      if (data.payment_method) setPurchasePaymentMethod(data.payment_method);
      if (data.purchased_by) setPurchasedBy(data.purchased_by);
      // Try to match supplier by name
      if (data.supplier_name) {
        const supMatch = suppliers.find(s => s.name.toLowerCase() === (data.supplier_name || '').toLowerCase());
        if (supMatch) setSupplierId(supMatch.id);
      }
      if (data.source_type) setSourceType(data.source_type);
    } else {
      setAcquisitionType('existing');
    }
    setShowScan(false);
    setScanFilled(true);
    setSuccess('✨ Form filled from scan — please review all fields before saving.');
  }

  async function handleSave() {
    setError('');
    setSuccess('');

    if (!description.trim()) { setError('Description is required'); return; }

    // If part number is blank and we haven't got initials yet, show prompt
    if (!partNumber.trim() && !noPartInitials && !editItem) {
      setShowNoPartPrompt(true);
      return;
    }

    await doSave();
  }

  async function doSave() {
    setSaving(true);
    const npi = noPartInitials.trim().toUpperCase();
    try {
      if (editItem) {
        await updateStockItem({
          ...editItem,
          part_number: partNumber.trim(),
          description: description.trim(),
          photo, qty: parseInt(qty) || 1, location,
          cost: parseFloat(cost) || 0, rrp: parseFloat(rrp) || 0,
          entered_by: currentUser.initials, category,
          entry_type: acquisitionType === 'purchased' ? 'purchase' : (editItem.entry_type || 'legacy'),
          supplier_id: acquisitionType === 'purchased' ? supplierId : editItem.supplier_id,
          source_type: acquisitionType === 'purchased' ? sourceType : (editItem.source_type || ''),
          purchase_date: acquisitionType === 'purchased' ? purchaseDate : (editItem.purchase_date || ''),
          purchase_payment_method: acquisitionType === 'purchased' ? purchasePaymentMethod : (editItem.purchase_payment_method || ''),
          purchased_by: acquisitionType === 'purchased' ? purchasedBy : (editItem.purchased_by || ''),
          no_partnumber_initials: !partNumber.trim() ? npi : '',
        });
        setSuccess('Item updated successfully! ✅');
      } else if (acquisitionType === 'purchased') {
        await addPurchasedStockItem({
          part_number: partNumber.trim(),
          description: description.trim(),
          photo, qty: parseInt(qty) || 1, location,
          cost: parseFloat(cost) || 0, rrp: parseFloat(rrp) || 0,
          entered_by: currentUser.initials, category,
          supplier_id: supplierId, source_type: sourceType,
          purchase_date: purchaseDate, purchase_payment_method: onAccount ? 'on_account' : purchasePaymentMethod,
          purchased_by: purchasedBy,
          no_partnumber_initials: npi,
        });
        // If on account, create a supplier invoice
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
            notes: `Stock entry by ${currentUser.initials}`,
            entered_by: currentUser.initials,
          });
          setSuccess('Purchase recorded & supplier invoice created! ✅');
        } else {
          setSuccess('Purchase recorded & added to stock! ✅');
        }
        resetForm();
      } else {
        await addStockItem({
          part_number: partNumber.trim(),
          description: description.trim(),
          photo, qty: parseInt(qty) || 1, location,
          cost: parseFloat(cost) || 0, rrp: parseFloat(rrp) || 0,
          entered_by: currentUser.initials, category,
          no_partnumber_initials: npi,
        });
        setSuccess('Item added to stock! ✅');
        resetForm();
      }

      setTimeout(() => { onSaved(); }, 800);
    } catch (err) {
      console.error('Failed to save stock item:', err);
      setError('Failed to save. Please try again.');
    } finally { setSaving(false); setShowNoPartPrompt(false); setNoPartInitials(''); }
  }

  function resetForm() {
    setDescription(''); setPhoto(''); setQty('1'); setLocation('');
    setCost(''); setRrp(''); setCategory('Other');
    setAcquisitionType('existing');
    setSupplierId(null); setSourceType('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPurchasePaymentMethod('Cash'); setPurchasedBy(currentUser.name);
    setError(''); setSuccess('');
    setPartNumberManual(false);
    setShowNoPartPrompt(false); setNoPartInitials('');
    setOnAccount(false); setAccountDueDate('');
    descRef.current?.focus();
  }

  // If scan mode is active, show the ScanEntry screen instead
  if (showScan) {
    return <ScanEntry onCancel={() => setShowScan(false)} scannedBy={currentUser.initials} onGoToReview={onNavigate ? () => { setShowScan(false); onNavigate('scan-review'); } : undefined} />;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-base-content">
          {editItem ? '✏️ Edit Stock Item' : '📦 New Stock Entry'}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {!editItem && (
            <>
              <button className="btn btn-outline btn-sm gap-1" onClick={async () => {
                try {
                  const data = await window.tasklet.readBinaryFileFromDisk('/tasklet/agent/home/apps/sylvias-surprises/stock_entry_sheet.pdf');
                  const a = document.createElement('a');
                  a.href = 'data:application/pdf;base64,' + data;
                  a.download = 'Stock_Entry_Sheet.pdf';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } catch (e) { console.warn('Could not open PDF', e); }
              }}>
                <Printer size={16} /> Print Blank Form
              </button>
              <button className="btn btn-secondary btn-sm gap-1" onClick={() => setShowScan(true)}>
                <ScanLine size={16} /> Scan Form
              </button>
            </>
          )}
          <div className="badge badge-success text-white whitespace-nowrap">
            {currentUser.name} ({currentUser.initials})
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-3 text-sm"><span>{error}</span></div>}
      {success && <div className="alert alert-success mb-3 text-sm"><span>{success}</span></div>}
      {scanFilled && (
        <div className="alert alert-warning mb-3 text-sm">
          <span>📷 Fields filled from scan — <strong>please review all values</strong> before saving. AI may misread handwriting.</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setScanFilled(false)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="card bg-base-200">
        <div className="card-body gap-3">

          {/* Description with autocomplete */}
          <div className="form-control relative">
            <label className="label"><span className="label-text font-semibold">Description *</span></label>
            <label className="input input-bordered flex items-center gap-2">
              <Tag className="h-[1em] opacity-50" />
              <input
                ref={descRef} type="text" className="grow"
                value={description}
                onChange={e => handleDescriptionChange(e.target.value)}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                  // Duplicate detection
                  const desc = description.trim().toLowerCase();
                  if (!editItem && desc.length >= 3) {
                    const match = existingStock.find(s => s.description.toLowerCase().trim() === desc);
                    if (match) setDupWarning({ description: match.description, qty: match.qty });
                    else setDupWarning(null);
                  } else {
                    setDupWarning(null);
                  }
                }}
                onFocus={() => description.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="e.g. Victorian Mantel Clock"
              />
            </label>
            {showSuggestions && (
              <ul className="menu bg-base-300 rounded-box shadow-lg absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <li key={i}><button className="text-sm" onMouseDown={() => selectSuggestion(s)}>{s}</button></li>
                ))}
              </ul>
            )}
            {dupWarning && (
              <div className="alert alert-warning py-1 px-3 mt-1 text-xs">
                <span>⚠️ <strong>"{dupWarning.description}"</strong> already in stock (×{dupWarning.qty}) — saving will create a separate item.</span>
              </div>
            )}
          </div>

          {/* Part Number */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Part Number</span></label>
            <label className="input input-bordered flex items-center gap-2">
              <Hash className="h-[1em] opacity-50" />
              <input type="text" className="grow font-mono" value={partNumber}
                onChange={e => { setPartNumber(e.target.value.toUpperCase()); setPartNumberManual(true); }}
                />
            </label>

          </div>

          {/* Category */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Category</span></label>
            <select className="select select-bordered w-full" value={category} onChange={e => handleCategoryChange(e.target.value)}>
              {dynCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Quantity and Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Quantity</span></label>
              <input type="text" inputMode="numeric" className="input input-bordered w-full" value={qty}
                onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setQty(v); }}
                placeholder="1" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Location</span></label>
              <select className="select select-bordered w-full" value={location} onChange={e => setLocation(e.target.value)}>
                <option value="">Select location...</option>
                {dynLocations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Cost and RRP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Cost Price (£)</span></label>
              <input type="text" inputMode="decimal" className="input input-bordered w-full" value={cost}
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setCost(v); }}
                placeholder="0.00" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">RRP / Selling Price (£)</span></label>
              <input type="text" inputMode="decimal" className="input input-bordered w-full" value={rrp}
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setRrp(v); }}
                placeholder="0.00" />
            </div>
          </div>

          {/* ───── Acquisition Section ───── */}
          <div className="divider text-sm text-base-content/50 my-1">How did you get this item?</div>

          {/* Acquisition Type Toggle */}
          <div className="flex gap-2">
            <button
              className={`btn btn-sm flex-1 ${acquisitionType === 'existing' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setAcquisitionType('existing')}
            >
              🟫 Existing Stock
            </button>
            <button
              className={`btn btn-sm flex-1 ${acquisitionType === 'purchased' ? 'btn-warning' : 'btn-outline'}`}
              onClick={() => setAcquisitionType('purchased')}
            >
              🟨 Purchased
            </button>
          </div>
          <p className="text-xs text-base-content/50 -mt-2">
            {acquisitionType === 'existing'
              ? 'Item you already had or brought from home — no purchase tracking needed'
              : 'Item you bought from a supplier — records who, when, and how you paid'}
          </p>

          {/* Purchase Details (only shown when "Purchased") */}
          {acquisitionType === 'purchased' && (
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 space-y-3">
              {/* Supplier */}
              <div className="form-control">
                <label className="label py-0"><span className="label-text font-semibold text-sm">Supplier</span></label>
                {!showNewSupplier ? (
                  <select className="select select-bordered select-sm w-full" value={supplierId ?? ''}
                    onChange={e => {
                      if (e.target.value === '__new__') { openNewSupplierForm(); }
                      else { setSupplierId(e.target.value ? Number(e.target.value) : null); }
                    }}>
                    <option value="">No supplier selected</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.source_type ? ` (${s.source_type})` : ''}</option>)}
                    <option value="__new__">➕ Add New Supplier...</option>
                  </select>
                ) : (
                  <div className="bg-base-300 rounded-xl p-3 space-y-2 border border-primary/30 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-primary">➕ New Supplier</span>
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
                        setSupplierId(sup.id);
                        setShowNewSupplier(false);
                      }}
                    />
                    <input ref={newSupRef} type="text" className="input input-bordered input-sm w-full" value={newSupName} onChange={e => setNewSupName(titleCase(e.target.value))} placeholder="Supplier name *" />
                    <input type="text" className="input input-bordered input-sm w-full" style={{textTransform: 'capitalize'}} value={newSupAddress} onChange={e => setNewSupAddress(e.target.value)} placeholder="Address" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" className="input input-bordered input-sm w-full" style={{textTransform: 'uppercase'}} value={newSupPostcode} onChange={e => setNewSupPostcode(e.target.value.toUpperCase())} placeholder="Postcode" />
                      <input type="text" className="input input-bordered input-sm w-full" value={newSupContactName} onChange={e => setNewSupContactName(titleCase(e.target.value))} placeholder="Contact name" />
                      <input type="text" className="input input-bordered input-sm w-full" value={newSupPhone} onChange={e => setNewSupPhone(e.target.value)} placeholder="Phone" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" className="input input-bordered input-sm w-full" value={newSupEmail} onChange={e => setNewSupEmail(e.target.value.toLowerCase())} placeholder="Email" />
                      <select className="select select-bordered select-sm w-full" value={newSupSourceType} onChange={e => setNewSupSourceType(e.target.value)}>
                        <option value="">Source type...</option>
                        {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <input type="text" className="input input-bordered input-sm w-full" value={newSupNotes} onChange={e => setNewSupNotes(e.target.value)} placeholder="Notes" />
                    <div className="flex gap-2">
                      <button className={`btn btn-primary btn-sm flex-1 ${savingSupplier ? 'loading' : ''}`} onClick={handleSaveNewSupplier} disabled={savingSupplier}>
                        {savingSupplier ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />} Save
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelNewSupplier}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Source Type */}
              <div className="form-control">
                <label className="label py-0"><span className="label-text font-semibold text-sm">Source Type</span></label>
                <select className="select select-bordered select-sm w-full" value={sourceType} onChange={e => setSourceType(e.target.value)}>
                  <option value="">Select source type...</option>
                  {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Purchase Date + Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text font-semibold text-sm">Purchase Date</span></label>
                  <input type="date" className="input input-bordered input-sm w-full" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text font-semibold text-sm">Payment Method</span></label>
                  <select className="select select-bordered select-sm w-full" value={purchasePaymentMethod} onChange={e => setPurchasePaymentMethod(e.target.value)}>
                    {STOCK_PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* On Account toggle */}
              <div className="form-control">
                <label className="label py-0 cursor-pointer justify-start gap-2">
                  <input type="checkbox" className="toggle toggle-warning toggle-sm" checked={onAccount} onChange={e => setOnAccount(e.target.checked)} />
                  <span className="label-text font-semibold text-sm">On Account (not yet paid)</span>
                </label>
              </div>

              {onAccount && (
                <div className="alert alert-warning py-2 text-sm">
                  <AlertTriangle size={16} />
                  <span>This will create a supplier invoice for £{(parseFloat(cost) || 0) * (parseInt(qty) || 1)} — viewable in <strong>Supplier Invoices</strong></span>
                </div>
              )}

              {onAccount && (
                <div className="form-control">
                  <label className="label py-0"><span className="label-text font-semibold text-sm">Due Date (optional)</span></label>
                  <input type="date" className="input input-bordered input-sm w-full" value={accountDueDate} onChange={e => setAccountDueDate(e.target.value)} />
                </div>
              )}

              {/* Purchased By */}
              <div className="form-control">
                <label className="label py-0"><span className="label-text font-semibold text-sm">Purchased By</span></label>
                <select className="select select-bordered select-sm w-full" value={purchasedBy} onChange={e => setPurchasedBy(e.target.value)}>
                  <option value="">Select who purchased...</option>
                  {staffList.map(s => <option key={s.id} value={s.name}>{s.name} ({s.initials})</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Photo URL */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Photo</span></label>
            <label className="input input-bordered flex items-center gap-2">
              <Camera className="h-[1em] opacity-50" />
              <input type="text" className="grow" value={photo} onChange={e => setPhoto(e.target.value)} placeholder="Paste image URL or leave blank" />
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
            <input type="text" className="input input-bordered w-full bg-base-300"
              value={`${currentUser.name} (${currentUser.initials})`} readOnly />
          </div>

          {/* No Part Number initials prompt */}
          {showNoPartPrompt && (
            <div className="card bg-base-200 border border-warning shadow-lg mb-3">
              <div className="card-body p-4 space-y-2">
                <h3 className="card-title text-warning text-base">⚠️ No Part Number entered</h3>
                <p className="text-sm text-base-content/80">Please enter your initials to confirm this item should be saved without a part number.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input input-bordered input-sm w-24 uppercase bg-base-100"
                    placeholder="INITIALS"
                    value={noPartInitials}
                    onChange={(e) => setNoPartInitials(e.target.value.toUpperCase())}
                    maxLength={4}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && noPartInitials.trim()) doSave(); }}
                  />
                  <button className="btn btn-warning btn-sm text-warning-content" onClick={doSave} disabled={!noPartInitials.trim() || saving}>
                    {saving ? <span className="loading loading-spinner loading-xs" /> : null}
                    Confirm & Save Without Part No.
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowNoPartPrompt(false); setNoPartInitials(''); }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button className={`btn btn-primary flex-1 ${saving ? 'loading' : ''}`} onClick={handleSave} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : <Save size={18} />}
              {editItem ? 'Update Item' : acquisitionType === 'purchased' ? 'Record Purchase & Add to Stock' : 'Add to Stock'}
            </button>
            {!editItem && (
              <button className="btn btn-ghost" onClick={resetForm}>
                <RotateCcw size={18} /> Clear
              </button>
            )}
            <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};
