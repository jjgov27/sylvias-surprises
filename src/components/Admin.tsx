import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser } from '../types';
import {
  getAllSettings, setSetting, getBankAccounts, addBankAccount, updateBankAccount,
  deleteBankAccount, clearTableData, clearAllTestData, getTableCounts,
  BankAccount, titleCase, getCategories, saveCategories, getLocations, saveLocations,
  getExpenseCategories, saveExpenseCategories, getStockMissingPartNumbers,
  findAllDuplicates, DuplicateGroup, mergeStockItems, deleteCustomerById, deleteExpenseById, deleteSupplierById,
} from '../utils/db';
import { StockItem } from '../types';
import { EmailSettings } from './EmailSettings';

interface Props { currentUser: StaffUser; }

const SETTING_KEYS = [
  { key: 'business_name', label: 'Business Name', placeholder: "Sylvia's Surprises" },
  { key: 'business_tagline', label: 'Tagline', placeholder: 'Antiques, Collectibles & More' },
  { key: 'business_address_1', label: 'Address Line 1', placeholder: 'Memorial Hall' },
  { key: 'business_address_2', label: 'Address Line 2', placeholder: 'Main Road' },
  { key: 'business_address_3', label: 'Address Line 3', placeholder: 'Union Mills' },
  { key: 'business_postcode', label: 'Postcode', placeholder: 'IM4 4AD' },
  { key: 'business_phone', label: 'Phone', placeholder: '07624 433076' },
  { key: 'business_email', label: 'Email', placeholder: 'gavin@sylviassurprises.im' },
  { key: 'business_hours', label: 'Opening Hours', placeholder: 'Tue-Sat, 10am-5pm' },
  { key: 'business_vat_number', label: 'VAT Number', placeholder: 'N/A' },
  { key: 'business_company_number', label: 'Company Number', placeholder: '' },
  { key: 'float_opening_balance', label: 'Float Starting Balance (£)', placeholder: '0.00' },
];

const CLEARABLE_TABLES: { table: string; label: string; icon: string; danger?: boolean }[] = [
  { table: 'sylvias_sale_items', label: 'Sale Items', icon: '📦' },
  { table: 'sylvias_payments', label: 'Invoice Payments', icon: '💳' },
  { table: 'sylvias_sales', label: 'Sales', icon: '🧾' },
  { table: 'sylvias_stock', label: 'Stock', icon: '📋' },
  { table: 'sylvias_customers', label: 'Customers', icon: '👥' },
  { table: 'sylvias_expenses', label: 'Expenses', icon: '💸' },
  { table: 'sylvias_float', label: 'Float Records', icon: '🏦' },
  { table: 'sylvias_consignees', label: 'Consignees', icon: '🤝' },
  { table: 'sylvias_consignment_items', label: 'Consignment Items', icon: '📦' },
  { table: 'sylvias_reservations', label: 'Reservations', icon: '📌' },
  { table: 'sylvias_wishlist', label: 'Wish List', icon: '📋' },
  { table: 'sylvias_suppliers', label: 'Suppliers', icon: '🚚' },
  { table: 'sylvias_bullion', label: 'Bullion', icon: '🪙' },
  { table: 'sylvias_learned_items', label: 'Learned Item Names', icon: '📝' },
  { table: 'sylvias_gift_vouchers', label: 'Gift Vouchers', icon: '🎁' },
  { table: 'sylvias_scan_staging', label: 'Scan Staging', icon: '📷' },
  { table: 'sylvias_refunds', label: 'Refunds', icon: '↩️' },
  { table: 'sylvias_credit_notes', label: 'Credit Notes', icon: '📄' },
  { table: 'sylvias_supplier_invoices', label: 'Supplier Invoices', icon: '📑' },
  { table: 'sylvias_supplier_invoice_payments', label: 'Supplier Payments', icon: '💰' },
  { table: 'sylvias_eod_cashup', label: 'EOD CashUp', icon: '🧮' },
  { table: 'sylvias_bank_transactions', label: 'Bank Transactions', icon: '💱' },
];

type Tab = 'business' | 'bank' | 'categories' | 'maintenance' | 'duplicates' | 'email' | 'reset';

export function Admin({ currentUser }: Props) {
  const [tab, setTab] = useState<Tab>('business');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');

  // Bank accounts
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [editAcct, setEditAcct] = useState<BankAccount | null>(null);
  const [showAcctForm, setShowAcctForm] = useState(false);
  const [acctName, setAcctName] = useState('');
  const [bankName, setBankName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [acctNumber, setAcctNumber] = useState('');
  const [openingBal, setOpeningBal] = useState('');
  const [acctNotes, setAcctNotes] = useState('');

  // Categories & Locations
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategoriesState] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [catSaved, setCatSaved] = useState('');

  // Maintenance
  const [missingPartNos, setMissingPartNos] = useState<StockItem[]>([]);
  const [maintLoading, setMaintLoading] = useState(false);

  // Duplicate Checker
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [dupScanning, setDupScanning] = useState(false);
  const [dupScanned, setDupScanned] = useState(false);
  const [dupMsg, setDupMsg] = useState('');
  const [dupFilter, setDupFilter] = useState<string>('All');
  const [dupKeep, setDupKeep] = useState<Record<string, number>>({}); // group key → id to keep
  const [dupConfirm, setDupConfirm] = useState<{ msg: string; action: () => Promise<void> } | null>(null);

  // Reset
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [resetResult, setResetResult] = useState('');

  const loadSettings = useCallback(async () => {
    const s = await getAllSettings();
    setSettings(s);
    setDirty({});
  }, []);

  const loadAccounts = useCallback(async () => {
    setAccounts(await getBankAccounts());
  }, []);

  const loadCounts = useCallback(async () => {
    setTableCounts(await getTableCounts());
  }, []);

  const loadCats = useCallback(async () => {
    setCategories(await getCategories());
    setLocations(await getLocations());
    setExpenseCategoriesState(await getExpenseCategories());
  }, []);

  useEffect(() => {
    loadSettings();
    loadAccounts();
    loadCounts();
    loadCats();
  }, [loadSettings, loadAccounts, loadCounts, loadCats]);

  const handleSettingChange = (key: string, value: string) => {
    setDirty(prev => ({ ...prev, [key]: value }));
  };

  const getSettingValue = (key: string) => {
    if (key in dirty) return dirty[key];
    return settings[key] || '';
  };

  const saveSettings = async () => {
    setErr(''); setSaved('');
    try {
      for (const [key, value] of Object.entries(dirty)) {
        const v = value as string;
        const finalVal = key === 'business_postcode' ? v.toUpperCase() :
                         key === 'business_email' ? v.toLowerCase() :
                         key.startsWith('business_address') || key === 'business_name' || key === 'business_tagline' ? titleCase(v) :
                         v;
        await setSetting(key, finalVal);
      }
      await loadSettings();
      setSaved('Settings saved! ✅');
      setTimeout(() => setSaved(''), 3000);
    } catch (e: any) { setErr(e.message); }
  };

  const resetAcctForm = () => {
    setAcctName(''); setBankName(''); setSortCode(''); setAcctNumber('');
    setOpeningBal(''); setAcctNotes(''); setEditAcct(null); setShowAcctForm(false);
  };

  const handleEditAcct = (a: BankAccount) => {
    setEditAcct(a); setAcctName(a.account_name); setBankName(a.bank_name);
    setSortCode(a.sort_code); setAcctNumber(a.account_number);
    setOpeningBal(String(a.opening_balance)); setAcctNotes(a.notes);
    setShowAcctForm(true);
  };

  const handleSaveAcct = async () => {
    if (!acctName.trim()) { setErr('Account name is required'); return; }
    setErr('');
    const data = {
      account_name: titleCase(acctName.trim()),
      bank_name: titleCase(bankName.trim()),
      sort_code: sortCode.trim(),
      account_number: acctNumber.trim(),
      opening_balance: parseFloat(openingBal) || 0,
      notes: acctNotes.trim(),
    };
    if (editAcct) {
      await updateBankAccount(editAcct.id, data);
    } else {
      await addBankAccount(data);
    }
    resetAcctForm();
    loadAccounts();
    setSaved('Bank account saved! ✅');
    setTimeout(() => setSaved(''), 3000);
  };

  const handleDeleteAcct = async (id: number) => {
    if (!confirm('Delete this bank account?')) return;
    await deleteBankAccount(id);
    loadAccounts();
  };

  const handleClearTable = async (tableName: string) => {
    setResetResult('');
    const r = await clearTableData(tableName);
    setConfirmReset(null);
    await loadCounts();
    setResetResult(`Cleared ${r.deleted} record(s) from ${tableName.replace('sylvias_', '')} ✅`);
    setTimeout(() => setResetResult(''), 4000);
  };

  const handleClearAll = async () => {
    setResetResult('');
    const r = await clearAllTestData();
    setConfirmResetAll(false);
    await loadCounts();
    const total = Object.values(r).reduce((a, b) => a + b, 0);
    setResetResult(`All test data cleared! ${total} total records removed ✅`);
    setTimeout(() => setResetResult(''), 5000);
  };

  const s = (key: string) => ({ fontSize: 12, fontWeight: 600 as const, color: '#374151', marginBottom: 4, display: 'block' as const });
  const inp = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 };

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>⚙️ Admin &amp; Settings</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>Business details, bank accounts, and test data management</p>

      {err && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {saved && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{saved}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
        {([
          { id: 'business' as Tab, label: '🏪 Business Details' },
          { id: 'bank' as Tab, label: '🏦 Bank Accounts' },
          { id: 'categories' as Tab, label: '📂 Categories & Locations' },
          { id: 'maintenance' as Tab, label: '🔧 Maintenance' },
          { id: 'duplicates' as Tab, label: '🔍 Duplicate Checker' },
          { id: 'email' as Tab, label: '📧 Email Settings' },
          { id: 'reset' as Tab, label: '🧹 Test Data Reset' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px', fontSize: 14, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: tab === t.id ? '3px solid #7c3aed' : '3px solid transparent',
              color: tab === t.id ? '#7c3aed' : '#6b7280', marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Business Details Tab ── */}
      {tab === 'business' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {SETTING_KEYS.map(sk => (
              <div key={sk.key}>
                <label style={s(sk.key)}>{sk.label}</label>
                <input
                  style={{ ...inp, textTransform: sk.key === 'business_postcode' ? 'uppercase' : sk.key === 'business_email' ? 'lowercase' : 'capitalize' } as any}
                  value={getSettingValue(sk.key)}
                  onChange={e => handleSettingChange(sk.key, e.target.value)}
                  placeholder={sk.placeholder}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button onClick={saveSettings}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              💾 Save All Settings
            </button>
            {Object.keys(dirty).length > 0 && (
              <span style={{ fontSize: 13, color: '#f59e0b', alignSelf: 'center' }}>⚠️ You have unsaved changes</span>
            )}
          </div>
        </div>
      )}

      {/* ── Bank Accounts Tab ── */}
      {tab === 'bank' && (
        <div>
          {accounts.length > 0 && (
            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              {accounts.map(a => (
                <div key={a.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🏦 {a.account_name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {a.bank_name && <span>{a.bank_name} · </span>}
                      {a.sort_code && <span>SC: {a.sort_code} · </span>}
                      {a.account_number && <span>Acc: {a.account_number} · </span>}
                      <span style={{ fontWeight: 600, color: '#059669' }}>Opening: £{a.opening_balance.toFixed(2)}</span>
                    </div>
                    {a.notes && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{a.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleEditAcct(a)} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>✏️ Edit</button>
                    <button onClick={() => handleDeleteAcct(a.id)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showAcctForm ? (
            <button onClick={() => { resetAcctForm(); setShowAcctForm(true); }}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              + Add Bank Account
            </button>
          ) : (
            <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{editAcct ? 'Edit' : 'New'} Bank Account</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s('')}>Account Name *</label>
                  <input style={{ ...inp, textTransform: 'capitalize' }} value={acctName} onChange={e => setAcctName(e.target.value)} placeholder="e.g. Business Current" />
                </div>
                <div>
                  <label style={s('')}>Bank Name</label>
                  <input style={{ ...inp, textTransform: 'capitalize' }} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Lloyds, Isle of Man Bank" />
                </div>
                <div>
                  <label style={s('')}>Sort Code</label>
                  <input style={inp} value={sortCode} onChange={e => setSortCode(e.target.value)} placeholder="00-00-00" />
                </div>
                <div>
                  <label style={s('')}>Account Number</label>
                  <input style={inp} value={acctNumber} onChange={e => setAcctNumber(e.target.value)} placeholder="12345678" />
                </div>
                <div>
                  <label style={s('')}>Opening Balance (£)</label>
                  <input style={inp} value={openingBal} onChange={e => setOpeningBal(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label style={s('')}>Notes</label>
                  <input style={inp} value={acctNotes} onChange={e => setAcctNotes(e.target.value)} placeholder="Optional notes" />
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button onClick={handleSaveAcct}
                  style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  💾 {editAcct ? 'Update' : 'Save'} Account
                </button>
                <button onClick={resetAcctForm}
                  style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {accounts.length === 0 && !showAcctForm && (
            <p style={{ color: '#9ca3af', marginTop: 12, fontSize: 13 }}>No bank accounts added yet. Add your first account above.</p>
          )}
        </div>
      )}

      {/* ── Categories & Locations Tab ── */}
      {tab === 'categories' && (
        <div>
          {catSaved && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{catSaved}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
            {/* Stock Categories */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>🏷️ Stock Categories</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input style={{ ...inp, flex: 1, textTransform: 'capitalize' }} value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newCategory.trim()) { const v = titleCase(newCategory.trim()); if (!categories.includes(v)) { const updated = [...categories, v]; setCategories(updated); saveCategories(updated); setCatSaved('Category added ✅'); setTimeout(() => setCatSaved(''), 2000); } setNewCategory(''); }}}
                  placeholder="New category..." />
                <button onClick={() => { const v = titleCase(newCategory.trim()); if (!v) return; if (!categories.includes(v)) { const updated = [...categories, v]; setCategories(updated); saveCategories(updated); setCatSaved('Category added ✅'); setTimeout(() => setCatSaved(''), 2000); } setNewCategory(''); }}
                  style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
                {categories.map((c, i) => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 14 }}>{c}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {i > 0 && <button onClick={() => { const arr = [...categories]; [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; setCategories(arr); saveCategories(arr); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>▲</button>}
                      {i < categories.length - 1 && <button onClick={() => { const arr = [...categories]; [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; setCategories(arr); saveCategories(arr); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>▼</button>}
                      <button onClick={() => { const arr = categories.filter((_, j) => j !== i); setCategories(arr); saveCategories(arr); setCatSaved(`"${c}" removed`); setTimeout(() => setCatSaved(''), 2000); }}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{categories.length} categories</div>
            </div>

            {/* Locations */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>📍 Locations</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input style={{ ...inp, flex: 1, textTransform: 'capitalize' }} value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newLocation.trim()) { const v = titleCase(newLocation.trim()); if (!locations.includes(v)) { const updated = [...locations, v]; setLocations(updated); saveLocations(updated); setCatSaved('Location added ✅'); setTimeout(() => setCatSaved(''), 2000); } setNewLocation(''); }}}
                  placeholder="New location..." />
                <button onClick={() => { const v = titleCase(newLocation.trim()); if (!v) return; if (!locations.includes(v)) { const updated = [...locations, v]; setLocations(updated); saveLocations(updated); setCatSaved('Location added ✅'); setTimeout(() => setCatSaved(''), 2000); } setNewLocation(''); }}
                  style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
                {locations.map((l, i) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 14 }}>{l}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {i > 0 && <button onClick={() => { const arr = [...locations]; [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; setLocations(arr); saveLocations(arr); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>▲</button>}
                      {i < locations.length - 1 && <button onClick={() => { const arr = [...locations]; [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; setLocations(arr); saveLocations(arr); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>▼</button>}
                      <button onClick={() => { const arr = locations.filter((_, j) => j !== i); setLocations(arr); saveLocations(arr); setCatSaved(`"${l}" removed`); setTimeout(() => setCatSaved(''), 2000); }}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{locations.length} locations</div>
            </div>

            {/* Expense Categories */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>💸 Expense Categories</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input style={{ ...inp, flex: 1, textTransform: 'capitalize' }} value={newExpenseCat}
                  onChange={e => setNewExpenseCat(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newExpenseCat.trim()) { const v = titleCase(newExpenseCat.trim()); if (!expenseCategories.includes(v)) { const updated = [...expenseCategories, v]; setExpenseCategoriesState(updated); saveExpenseCategories(updated); setCatSaved('Expense category added ✅'); setTimeout(() => setCatSaved(''), 2000); } setNewExpenseCat(''); }}}
                  placeholder="New expense category..." />
                <button onClick={() => { const v = titleCase(newExpenseCat.trim()); if (!v) return; if (!expenseCategories.includes(v)) { const updated = [...expenseCategories, v]; setExpenseCategoriesState(updated); saveExpenseCategories(updated); setCatSaved('Expense category added ✅'); setTimeout(() => setCatSaved(''), 2000); } setNewExpenseCat(''); }}
                  style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
                {expenseCategories.map((c, i) => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 14 }}>{c}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {i > 0 && <button onClick={() => { const arr = [...expenseCategories]; [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; setExpenseCategoriesState(arr); saveExpenseCategories(arr); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>▲</button>}
                      {i < expenseCategories.length - 1 && <button onClick={() => { const arr = [...expenseCategories]; [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; setExpenseCategoriesState(arr); saveExpenseCategories(arr); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>▼</button>}
                      <button onClick={() => { const arr = expenseCategories.filter((_, j) => j !== i); setExpenseCategoriesState(arr); saveExpenseCategories(arr); setCatSaved(`"${c}" removed`); setTimeout(() => setCatSaved(''), 2000); }}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{expenseCategories.length} expense categories</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Maintenance Tab ── */}
      {tab === 'maintenance' && (
        <div>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🔧 Stock Maintenance Reports</h3>

          {/* Missing Part Numbers */}
          <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>⚠️ Items Without Part Numbers</div>
                <div style={{ fontSize: 12, color: '#92400e' }}>Stock items saved without a part/item number. These should be assigned numbers when possible.</div>
              </div>
              <button className="btn btn-warning btn-sm" onClick={async () => {
                setMaintLoading(true);
                setMissingPartNos(await getStockMissingPartNumbers());
                setMaintLoading(false);
              }}>
                {maintLoading ? <span className="loading loading-spinner loading-xs" /> : null}
                Generate Report
              </button>
            </div>

            {missingPartNos.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  {missingPartNos.length} item{missingPartNos.length !== 1 ? 's' : ''} missing part numbers
                </div>
                <table className="table table-xs table-zebra w-full">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Location</th>
                      <th>Qty</th>
                      <th>Cost</th>
                      <th>RRP</th>
                      <th>Entered By</th>
                      <th>Authorised By</th>
                      <th>Date Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingPartNos.map(item => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td style={{ fontWeight: 600 }}>{item.description}</td>
                        <td>{item.category}</td>
                        <td>{item.location}</td>
                        <td>{item.qty}</td>
                        <td>£{(item.cost || 0).toFixed(2)}</td>
                        <td>£{(item.rrp || 0).toFixed(2)}</td>
                        <td>{item.entered_by}</td>
                        <td>{(item as any).no_partnumber_initials || <span className="text-error font-bold">—</span>}</td>
                        <td>{item.created_at ? new Date(item.created_at.replace(' ', 'T')).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-2">
                  <button className="btn btn-outline btn-sm" onClick={() => {
                    const header = 'ID,Description,Category,Location,Qty,Cost,RRP,Entered By,Authorised By,Date Added';
                    const rows = missingPartNos.map(i => 
                      `${i.id},"${i.description}","${i.category}","${i.location}",${i.qty},${i.cost},${i.rrp},"${i.entered_by}","${(i as any).no_partnumber_initials || ''}","${i.created_at || ''}"`
                    );
                    const csv = [header, ...rows].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'missing_part_numbers.csv'; a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    📥 Export CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Duplicate Checker Tab ── */}
      {tab === 'duplicates' && (
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af', marginBottom: 4 }}>🔍 Duplicate Checker</div>
            <div style={{ fontSize: 13, color: '#1e40af' }}>
              Scans Stock, Customers, Expenses and Suppliers for potential duplicate entries.
              Stock duplicates can be merged (quantities combined). Other duplicates can be deleted.
            </div>
          </div>

          <button onClick={async () => {
            setDupScanning(true); setDupMsg(''); setDupKeep({});
            try {
              const g = await findAllDuplicates();
              setDupGroups(g);
              setDupScanned(true);
              setDupMsg(g.length === 0 ? '✅ No duplicates found — everything looks clean!' : `Found ${g.length} duplicate group${g.length > 1 ? 's' : ''}`);
            } catch(e: any) { setDupMsg('❌ Error: ' + e.message); }
            setDupScanning(false);
          }} disabled={dupScanning}
            style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14, marginBottom: 16 }}>
            {dupScanning ? '⏳ Scanning...' : '🔍 Scan for Duplicates'}
          </button>

          {dupMsg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: dupGroups.length === 0 && dupScanned ? '#f0fdf4' : '#fefce8', color: dupGroups.length === 0 && dupScanned ? '#16a34a' : '#854d0e', border: `1px solid ${dupGroups.length === 0 && dupScanned ? '#86efac' : '#fde68a'}` }}>{dupMsg}</div>}

          {/* Confirmation banner */}
          {dupConfirm && (
            <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626', marginBottom: 8 }}>⚠️ Are you sure?</div>
              <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12, whiteSpace: 'pre-line' }}>{dupConfirm.msg}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={async () => {
                  const action = dupConfirm.action;
                  setDupConfirm(null);
                  await action();
                }} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  ✅ Yes, do it
                </button>
                <button onClick={() => setDupConfirm(null)}
                  style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}

          {dupScanned && dupGroups.length > 0 && (
            <>
              {/* Bulk action buttons */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {dupGroups.filter(g => g.area === 'Stock').length > 0 && (
                  <button onClick={() => {
                    const stockGroups = dupGroups.filter(g => g.area === 'Stock');
                    const total = stockGroups.reduce((n, g) => n + g.items.length - 1, 0);
                    setDupConfirm({
                      msg: `Merge ALL ${stockGroups.length} stock duplicate group${stockGroups.length > 1 ? 's' : ''}?\n\nFor each group, the OLDEST item (lowest ID) is kept and all others are merged into it (quantities combined).\n\n${total} duplicate${total > 1 ? 's' : ''} will be removed.`,
                      action: async () => {
                        setDupScanning(true);
                        try {
                          for (const group of stockGroups) {
                            const sorted = [...group.items].sort((a, b) => a.id - b.id);
                            const keepId = sorted[0].id;
                            const removeIds = sorted.slice(1).map(i => i.id);
                            await mergeStockItems(keepId, removeIds);
                          }
                          setDupMsg(`✅ Merged ${stockGroups.length} stock group${stockGroups.length > 1 ? 's' : ''} — ${total} duplicate${total > 1 ? 's' : ''} removed`);
                          const g = await findAllDuplicates(); setDupGroups(g); setDupKeep({});
                          setTimeout(() => setDupMsg(g.length === 0 ? '✅ No duplicates found — everything looks clean!' : `Found ${g.length} duplicate group${g.length > 1 ? 's' : ''}`), 3000);
                        } catch(e: any) { setDupMsg('❌ Error: ' + e.message); }
                        setDupScanning(false);
                      }
                    });
                  }} disabled={dupScanning}
                    style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                    🔗 Merge All Stock Duplicates ({dupGroups.filter(g => g.area === 'Stock').length} group{dupGroups.filter(g => g.area === 'Stock').length > 1 ? 's' : ''})
                  </button>
                )}
                {dupGroups.filter(g => g.area === 'Customers').length > 0 && (
                  <button onClick={() => {
                    const custGroups = dupGroups.filter(g => g.area === 'Customers');
                    const total = custGroups.reduce((n, g) => n + g.items.length - 1, 0);
                    setDupConfirm({
                      msg: `Auto-clean ALL ${custGroups.length} customer duplicate group${custGroups.length > 1 ? 's' : ''}?\n\nFor each group, the OLDEST record is kept and ${total} newer duplicate${total > 1 ? 's' : ''} will be DELETED.\n\nThis cannot be undone.`,
                      action: async () => {
                        setDupScanning(true);
                        try {
                          for (const group of custGroups) {
                            const sorted = [...group.items].sort((a, b) => a.id - b.id);
                            for (let i = 1; i < sorted.length; i++) await deleteCustomerById(sorted[i].id);
                          }
                          setDupMsg(`✅ Cleaned ${custGroups.length} customer group${custGroups.length > 1 ? 's' : ''} — ${total} duplicate${total > 1 ? 's' : ''} removed`);
                          const g = await findAllDuplicates(); setDupGroups(g); setDupKeep({});
                          setTimeout(() => setDupMsg(g.length === 0 ? '✅ No duplicates found — everything looks clean!' : `Found ${g.length} duplicate group${g.length > 1 ? 's' : ''}`), 3000);
                        } catch(e: any) { setDupMsg('❌ Error: ' + e.message); }
                        setDupScanning(false);
                      }
                    });
                  }} disabled={dupScanning}
                    style={{ background: '#ec4899', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                    🧹 Clean All Customer Duplicates ({dupGroups.filter(g => g.area === 'Customers').length})
                  </button>
                )}
                {dupGroups.filter(g => g.area === 'Expenses').length > 0 && (
                  <button onClick={() => {
                    const expGroups = dupGroups.filter(g => g.area === 'Expenses');
                    const total = expGroups.reduce((n, g) => n + g.items.length - 1, 0);
                    setDupConfirm({
                      msg: `Auto-clean ALL ${expGroups.length} expense duplicate group${expGroups.length > 1 ? 's' : ''}?\n\nFor each group, the OLDEST record is kept and ${total} newer duplicate${total > 1 ? 's' : ''} will be DELETED.\n\nThis cannot be undone.`,
                      action: async () => {
                        setDupScanning(true);
                        try {
                          for (const group of expGroups) {
                            const sorted = [...group.items].sort((a, b) => a.id - b.id);
                            for (let i = 1; i < sorted.length; i++) await deleteExpenseById(sorted[i].id);
                          }
                          setDupMsg(`✅ Cleaned ${expGroups.length} expense group${expGroups.length > 1 ? 's' : ''} — ${total} duplicate${total > 1 ? 's' : ''} removed`);
                          const g = await findAllDuplicates(); setDupGroups(g); setDupKeep({});
                          setTimeout(() => setDupMsg(g.length === 0 ? '✅ No duplicates found — everything looks clean!' : `Found ${g.length} duplicate group${g.length > 1 ? 's' : ''}`), 3000);
                        } catch(e: any) { setDupMsg('❌ Error: ' + e.message); }
                        setDupScanning(false);
                      }
                    });
                  }} disabled={dupScanning}
                    style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                    🧹 Clean All Expense Duplicates ({dupGroups.filter(g => g.area === 'Expenses').length})
                  </button>
                )}
                {dupGroups.filter(g => g.area === 'Suppliers').length > 0 && (
                  <button onClick={() => {
                    const supGroups = dupGroups.filter(g => g.area === 'Suppliers');
                    const total = supGroups.reduce((n, g) => n + g.items.length - 1, 0);
                    setDupConfirm({
                      msg: `Auto-clean ALL ${supGroups.length} supplier duplicate group${supGroups.length > 1 ? 's' : ''}?\n\nFor each group, the OLDEST record is kept and ${total} newer duplicate${total > 1 ? 's' : ''} will be DELETED.\n\nThis cannot be undone.`,
                      action: async () => {
                        setDupScanning(true);
                        try {
                          for (const group of supGroups) {
                            const sorted = [...group.items].sort((a, b) => a.id - b.id);
                            for (let i = 1; i < sorted.length; i++) await deleteSupplierById(sorted[i].id);
                          }
                          setDupMsg(`✅ Cleaned ${supGroups.length} supplier group${supGroups.length > 1 ? 's' : ''} — ${total} duplicate${total > 1 ? 's' : ''} removed`);
                          const g = await findAllDuplicates(); setDupGroups(g); setDupKeep({});
                          setTimeout(() => setDupMsg(g.length === 0 ? '✅ No duplicates found — everything looks clean!' : `Found ${g.length} duplicate group${g.length > 1 ? 's' : ''}`), 3000);
                        } catch(e: any) { setDupMsg('❌ Error: ' + e.message); }
                        setDupScanning(false);
                      }
                    });
                  }} disabled={dupScanning}
                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                    🧹 Clean All Supplier Duplicates ({dupGroups.filter(g => g.area === 'Suppliers').length})
                  </button>
                )}
              </div>

              {/* Area filter */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {['All', ...new Set(dupGroups.map(g => g.area))].map(a => (
                  <button key={a} onClick={() => setDupFilter(a)}
                    style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: dupFilter === a ? 700 : 500, cursor: 'pointer',
                      background: dupFilter === a ? '#7c3aed' : '#f3f4f6', color: dupFilter === a ? '#fff' : '#374151', border: dupFilter === a ? 'none' : '1px solid #d1d5db' }}>
                    {a} {a === 'All' ? `(${dupGroups.length})` : `(${dupGroups.filter(g => g.area === a).length})`}
                  </button>
                ))}
              </div>

              {/* Duplicate groups */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {dupGroups.filter(g => dupFilter === 'All' || g.area === dupFilter).map((group, gi) => {
                  const gKey = `${group.area}-${group.matchField}-${group.matchValue}`;
                  const keepId = dupKeep[gKey];
                  return (
                    <div key={gi} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <span style={{ background: group.area === 'Stock' ? '#dbeafe' : group.area === 'Customers' ? '#fce7f3' : group.area === 'Expenses' ? '#fef3c7' : '#d1fae5',
                            color: group.area === 'Stock' ? '#1e40af' : group.area === 'Customers' ? '#9d174d' : group.area === 'Expenses' ? '#92400e' : '#065f46',
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, marginRight: 8 }}>{group.area}</span>
                          <span style={{ fontSize: 13, color: '#6b7280' }}>Matching {group.matchField}: <strong style={{ color: '#111' }}>{group.matchValue}</strong></span>
                        </div>
                        <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                          {group.items.length} items
                        </span>
                      </div>

                      {/* Instruction banner */}
                      <div style={{ background: group.area === 'Stock' ? '#eff6ff' : '#fef3c7', border: `1px solid ${group.area === 'Stock' ? '#93c5fd' : '#fcd34d'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: group.area === 'Stock' ? '#1e40af' : '#92400e' }}>
                        {group.area === 'Stock'
                          ? '👇 Select the item to KEEP — the others will be merged into it (quantities combined) and removed'
                          : '👇 Tick the record you want to DELETE'}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {group.items.map(item => (
                          <div key={item.id}
                            onClick={() => setDupKeep(prev => ({ ...prev, [gKey]: group.area === 'Stock' ? item.id : (prev[gKey] === item.id ? 0 : item.id) }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                              background: keepId === item.id ? (group.area === 'Stock' ? '#f0fdf4' : '#fef2f2') : '#f9fafb',
                              border: keepId === item.id ? `2px solid ${group.area === 'Stock' ? '#22c55e' : '#ef4444'}` : '1px solid #e5e7eb',
                              transition: 'all 0.15s' }}>
                            {group.area === 'Stock' ? (
                              <input type="radio" name={gKey} checked={keepId === item.id} readOnly
                                style={{ accentColor: '#22c55e', width: 18, height: 18 }} />
                            ) : (
                              <input type="checkbox" checked={keepId === item.id} readOnly
                                style={{ accentColor: '#dc2626', width: 18, height: 18 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label} <span style={{ color: '#9ca3af', fontSize: 11 }}>#{item.id}</span></div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>{item.detail}</div>
                            </div>
                            {keepId === item.id && group.area === 'Stock' && (
                              <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8 }}>✅ KEEP THIS ONE</span>
                            )}
                            {keepId === item.id && group.area !== 'Stock' && (
                              <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8 }}>🗑️ DELETE THIS</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Action buttons — always visible with clear state */}
                      <div style={{ marginTop: 12 }}>
                        {group.area === 'Stock' && !keepId && (
                          <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>↑ Select an item above to enable merge</div>
                        )}
                        {group.area === 'Stock' && keepId && (
                          <button onClick={() => {
                            const removeIds = group.items.filter(i => i.id !== keepId).map(i => i.id);
                            setDupConfirm({
                              msg: `Merge ${removeIds.length} duplicate(s) into item #${keepId}?\n\nQuantities will be combined and duplicates removed.`,
                              action: async () => {
                                await mergeStockItems(keepId, removeIds);
                                setDupMsg('✅ Stock items merged successfully');
                                const g = await findAllDuplicates(); setDupGroups(g);
                                setTimeout(() => setDupMsg(g.length === 0 ? '✅ No duplicates found — everything looks clean!' : `Found ${g.length} duplicate group${g.length > 1 ? 's' : ''}`), 2000);
                              }
                            });
                          }} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                            🔗 Merge All Into #{keepId} — combine quantities, remove {group.items.length - 1} duplicate{group.items.length > 2 ? 's' : ''}
                          </button>
                        )}
                        {group.area !== 'Stock' && !keepId && (
                          <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>↑ Tick the record you want to delete</div>
                        )}
                        {group.area !== 'Stock' && keepId > 0 && (
                          <button onClick={() => {
                            setDupConfirm({
                              msg: `Delete ${group.area.toLowerCase()} record #${keepId}?\n\nThis cannot be undone.`,
                              action: async () => {
                                if (group.area === 'Customers') await deleteCustomerById(keepId);
                                else if (group.area === 'Expenses') await deleteExpenseById(keepId);
                                else if (group.area === 'Suppliers') await deleteSupplierById(keepId);
                                setDupMsg(`✅ ${group.area} record #${keepId} deleted`);
                                const g = await findAllDuplicates(); setDupGroups(g);
                                setTimeout(() => setDupMsg(g.length === 0 ? '✅ No duplicates found — everything looks clean!' : `Found ${g.length} duplicate group${g.length > 1 ? 's' : ''}`), 2000);
                              }
                            });
                          }} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                            🗑️ Delete Record #{keepId}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Email Settings Tab ── */}
      {tab === 'email' && (
        <EmailSettings currentUser={currentUser} />
      )}

      {/* ── Test Data Reset Tab ── */}
      {tab === 'reset' && (
        <div>
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 4 }}>⚠️ Warning — Data Deletion</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>
              Clearing data is <strong>permanent</strong> and cannot be undone. Use these controls when testing the app and you need a fresh start.
              Staff accounts are NOT deleted (you'd be locked out!).
            </div>
          </div>

          {resetResult && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{resetResult}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {CLEARABLE_TABLES.map(t => (
              <div key={t.table} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 14 }}>{t.icon} {t.label}</span>
                  <span style={{ marginLeft: 8, background: tableCounts[t.table] ? '#dbeafe' : '#f3f4f6', color: tableCounts[t.table] ? '#1e40af' : '#9ca3af', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                    {tableCounts[t.table] || 0}
                  </span>
                </div>
                {confirmReset === t.table ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleClearTable(t.table)}
                      style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Yes, Clear
                    </button>
                    <button onClick={() => setConfirmReset(null)}
                      style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmReset(t.table)}
                    disabled={!tableCounts[t.table]}
                    style={{
                      background: tableCounts[t.table] ? '#fef2f2' : '#f9fafb',
                      border: `1px solid ${tableCounts[t.table] ? '#fecaca' : '#e5e7eb'}`,
                      borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: tableCounts[t.table] ? 'pointer' : 'default',
                      color: tableCounts[t.table] ? '#dc2626' : '#9ca3af',
                    }}>
                    🗑️ Clear
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '2px solid #fecaca', paddingTop: 16 }}>
            {confirmResetAll ? (
              <div style={{ background: '#fef2f2', border: '2px solid #dc2626', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 16, marginBottom: 8 }}>🚨 Are you absolutely sure?</div>
                <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12 }}>This will delete ALL data (except staff accounts and admin settings). This cannot be undone.</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={handleClearAll}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                    🗑️ Yes, Clear Everything
                  </button>
                  <button onClick={() => setConfirmResetAll(false)}
                    style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 14 }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmResetAll(true)}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
                💣 Clear All Test Data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
