import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Edit, Trash2, AlertTriangle, Package, Filter, Upload, Tag, Clock, Download } from 'lucide-react';
import { StockItem, StaffUser } from '../types';
import { getAllStock, updateStockQty, deleteStockItem, addStockItem, setStockOnOffer, removeStockOffer, getStockAgeDays, CATEGORIES, LOCATIONS, titleCase, getCategories, getLocations } from '../utils/db';
import { CsvImport, CsvField } from './CsvImport';

interface StockControlProps {
  currentUser: StaffUser;
  onEdit: (item: StockItem) => void;
  onAddNew: () => void;
}

export const StockControl: React.FC<StockControlProps> = ({ currentUser, onEdit, onAddNew }) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [filteredStock, setFilteredStock] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'description' | 'qty' | 'rrp' | 'part_number'>('description');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showZeroOnly, setShowZeroOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [offerItemId, setOfferItemId] = useState<number | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [showAgingOnly, setShowAgingOnly] = useState(false);
  const [agingDays, setAgingDays] = useState(30);
  const [dynCategories, setDynCategories] = useState<string[]>(CATEGORIES);
  const [dynLocations, setDynLocations] = useState<string[]>(LOCATIONS);

  useEffect(() => {
    getCategories().then(setDynCategories);
    getLocations().then(setDynLocations);
  }, []);

  const stockCsvFields: CsvField[] = [
    { key: 'description', label: 'Description', required: true, type: 'text' },
    { key: 'category', label: 'Category', required: false, defaultValue: 'Other', type: 'select', options: dynCategories },
    { key: 'qty', label: 'Quantity', required: false, defaultValue: '1', type: 'number' },
    { key: 'location', label: 'Location', required: false, defaultValue: '', type: 'text' },
    { key: 'cost', label: 'Cost (£)', required: false, defaultValue: '0', type: 'number' },
    { key: 'rrp', label: 'RRP (£)', required: false, defaultValue: '0', type: 'number' },
    { key: 'part_number', label: 'Part Number', required: false, defaultValue: '', type: 'text' },
  ];

  async function handleCsvImport(rows: Record<string, string>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const desc = row.description?.trim();
        if (!desc) { errors.push(`Row ${i + 1}: Missing description`); continue; }

        const qty = parseInt(row.qty || '1') || 1;
        const cost = parseFloat(row.cost?.replace(/[£$,]/g, '') || '0') || 0;
        const rrp = parseFloat(row.rrp?.replace(/[£$,]/g, '') || '0') || 0;
        const cat = dynCategories.includes(row.category) ? row.category : 'Other';
        const loc = row.location?.trim() || '';

        // Auto-generate part number if not provided
        let partNo = row.part_number?.trim() || '';
        if (!partNo) {
          const prefix = cat.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
          const countRows = await window.tasklet.sqlQuery(
            `SELECT COUNT(*) as cnt FROM sylvias_stock WHERE part_number LIKE '${prefix}-%'`
          );
          const count = (countRows[0] as unknown as { cnt: number }).cnt;
          partNo = `${prefix}-${String(count + 1 + imported).padStart(4, '0')}`;
        }

        await addStockItem({
          part_number: partNo,
          description: titleCase(desc),
          photo: '',
          qty,
          location: loc,
          cost,
          rrp,
          entered_by: currentUser.initials,
          category: cat,
        });
        imported++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err}`);
      }
    }
    await loadStock();
    return { imported, errors };
  }

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [stock, search, categoryFilter, sortBy, sortDir, showZeroOnly, showAgingOnly, agingDays]);

  async function loadStock() {
    setLoading(true);
    const items = await getAllStock();
    setStock(items);
    setLoading(false);
  }

  function applyFilters() {
    let items = [...stock];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.description.toLowerCase().includes(q) ||
        i.part_number.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (categoryFilter !== 'All') {
      items = items.filter(i => i.category === categoryFilter);
    }

    // Zero stock filter
    if (showZeroOnly) {
      items = items.filter(i => i.qty === 0);
    }

    // Aging filter
    if (showAgingOnly) {
      items = items.filter(i => getStockAgeDays(i.created_at) >= agingDays);
    }

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'description') cmp = a.description.localeCompare(b.description);
      else if (sortBy === 'qty') cmp = a.qty - b.qty;
      else if (sortBy === 'rrp') cmp = a.rrp - b.rrp;
      else if (sortBy === 'part_number') cmp = a.part_number.localeCompare(b.part_number);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    setFilteredStock(items);
  }

  function downloadCsv(filename: string, csvContent: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function escapeCsvField(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  function exportStockCsv() {
    const headers = ['Part Number','Description','Category','Quantity','Location','Cost','RRP','Offer Price','On Offer','Entered By','Date Added'];
    const rows = filteredStock.map(item => [
      item.part_number,
      item.description,
      item.category || '',
      String(item.qty),
      item.location || '',
      String(item.cost || 0),
      String(item.rrp || 0),
      String(item.offer_price || ''),
      item.on_offer ? 'Yes' : 'No',
      item.entered_by || '',
      item.created_at || ''
    ].map(escapeCsvField));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`sylvias-stock-${date}.csv`, csv);
  }

  function downloadImportTemplate() {
    const headers = ['Description','Category','Quantity','Location','Cost','RRP'];
    const csv = headers.join(',');
    downloadCsv('sylvias-stock-import-template.csv', csv);
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  async function handleQtyChange(id: number, delta: number) {
    const item = stock.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.qty + delta);
    // Optimistic update
    setStock(prev => prev.map(i => i.id === id ? { ...i, qty: newQty } : i));
    await updateStockQty(id, newQty);
  }

  async function handleDelete(id: number) {
    setStock(prev => prev.filter(i => i.id !== id));
    setDeleteConfirm(null);
    await deleteStockItem(id);
  }

  // Stats
  const totalItems = stock.length;
  const totalUnits = stock.reduce((s, i) => s + i.qty, 0);
  const totalValue = stock.reduce((s, i) => s + (i.rrp * i.qty), 0);
  const totalCost = stock.reduce((s, i) => s + (i.cost * i.qty), 0);
  const outOfStock = stock.filter(i => i.qty === 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Items</div>
          <div className="stat-value text-lg text-primary">{totalItems}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Units</div>
          <div className="stat-value text-lg">{totalUnits}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Stock Value (RRP)</div>
          <div className="stat-value text-lg text-success">£{totalValue.toFixed(2)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Cost Value</div>
          <div className="stat-value text-lg">£{totalCost.toFixed(2)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Out of Stock</div>
          <div className={`stat-value text-lg ${outOfStock > 0 ? 'text-error' : 'text-success'}`}>{outOfStock}</div>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-[1em] opacity-50" />
          <input
            type="text"
            className="grow"
            placeholder="Search by description, part no. or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        <select
          className="select select-bordered select-sm"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="All">All Categories</option>
          {dynCategories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-error checkbox-sm"
            checked={showZeroOnly}
            onChange={e => setShowZeroOnly(e.target.checked)}
          />
          <span className="label-text text-sm">Out of stock</span>
        </label>
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-warning checkbox-sm"
            checked={showAgingOnly}
            onChange={e => setShowAgingOnly(e.target.checked)}
          />
          <span className="label-text text-sm">Aging</span>
        </label>
        {showAgingOnly && (
          <select className="select select-bordered select-xs" value={agingDays} onChange={e => setAgingDays(Number(e.target.value))}>
            <option value={30}>30+ days</option>
            <option value={60}>60+ days</option>
            <option value={90}>90+ days</option>
          </select>
        )}
        <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowCsvImport(!showCsvImport)}>
          <Upload size={14} /> Import CSV
        </button>
        <button className="btn btn-outline btn-sm gap-1" onClick={exportStockCsv} title="Export current view to CSV">
          <Download size={14} /> Export CSV
        </button>
        <button className="btn btn-ghost btn-sm gap-1 text-xs" onClick={downloadImportTemplate} title="Download a blank CSV template for importing stock">
          <Download size={14} /> Template
        </button>
        <button className="btn btn-primary btn-sm" onClick={onAddNew}>
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* CSV Import */}
      {showCsvImport && (
        <CsvImport
          title="Import Stock Items from CSV"
          fields={stockCsvFields}
          onImport={handleCsvImport}
          onClose={() => setShowCsvImport(false)}
        />
      )}

      {/* Colour legend */}
      <div className="flex items-center gap-4 text-xs text-base-content/60 mb-2 ml-1">
        <span className="font-semibold">Aging key:</span>
        <span className="flex items-center gap-1"><span className="badge badge-info badge-xs gap-0.5"><Clock size={8} />30d</span> 30–59 days</span>
        <span className="flex items-center gap-1"><span className="badge badge-warning badge-xs gap-0.5"><Clock size={8} />60d</span> 60–89 days</span>
        <span className="flex items-center gap-1"><span className="badge badge-error badge-xs gap-0.5"><Clock size={8} />90d</span> 90+ days</span>
        {stock.some((s: any) => s.offer_active) && <span className="flex items-center gap-1"><span className="badge badge-warning badge-xs">OFFER</span> On offer</span>}
      </div>

      {/* Stock table */}
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead className="bg-base-200">
            <tr>
              <th className="cursor-pointer hover:bg-base-300" onClick={() => toggleSort('part_number')}>
                Part No. {sortBy === 'part_number' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cursor-pointer hover:bg-base-300" onClick={() => toggleSort('description')}>
                Description {sortBy === 'description' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cursor-pointer hover:bg-base-300 text-center" onClick={() => toggleSort('qty')}>
                Qty {sortBy === 'qty' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th>Location</th>
              <th className="cursor-pointer hover:bg-base-300 text-right" onClick={() => toggleSort('rrp')}>
                Cost {sortBy === 'rrp' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right">RRP</th>
              <th>By</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStock.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-base-content/50">
                  <Package className="mx-auto mb-2 opacity-30" size={32} />
                  <p>No stock items found</p>
                </td>
              </tr>
            ) : (
              filteredStock.map(item => (
                <tr key={item.id} className={`${item.qty === 0 ? 'bg-error/10' : ''} hover:bg-base-200 cursor-pointer transition-colors`} onClick={() => onEdit(item)}>
                  <td className="font-mono text-xs">{item.part_number}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {item.photo && (
                        <img src={item.photo} alt="" className="w-8 h-8 rounded object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                      <div>
                        <div className="font-medium text-sm">{item.description}</div>
                        <div className="text-xs text-base-content/50 flex items-center gap-1 flex-wrap">
                          {item.category}
                          {item.entry_type === 'purchase' 
                            ? <span style={{width:10,height:10,borderRadius:2,backgroundColor:'#EAB308',display:'inline-block'}} title="Purchased Stock" />
                            : item.entry_type === 'trade_in'
                            ? <span style={{width:10,height:10,borderRadius:2,backgroundColor:'#22C55E',display:'inline-block'}} title="Trade-In Stock" />
                            : <span style={{width:10,height:10,borderRadius:2,backgroundColor:'#8B6914',display:'inline-block'}} title="Existing Stock" />
                          }
                          {(item as any).on_offer === 1 && (
                            <span className="badge badge-warning badge-xs">OFFER £{((item as any).offer_price || 0).toFixed(2)}</span>
                          )}
                          {(() => {
                            const age = getStockAgeDays(item.created_at);
                            if (age >= 90) return <span className="badge badge-error badge-xs gap-0.5"><Clock size={8} />{age}d</span>;
                            if (age >= 60) return <span className="badge badge-warning badge-xs gap-0.5"><Clock size={8} />{age}d</span>;
                            if (age >= 30) return <span className="badge badge-info badge-xs gap-0.5"><Clock size={8} />{age}d</span>;
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleQtyChange(item.id, -1)}
                        disabled={item.qty === 0}
                      >
                        <Minus size={12} />
                      </button>
                      <span className={`font-bold min-w-[2rem] text-center ${item.qty === 0 ? 'text-error' : ''}`}>
                        {item.qty}
                      </span>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleQtyChange(item.id, 1)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    {item.qty === 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <AlertTriangle size={10} className="text-error" />
                        <span className="text-[10px] text-error font-semibold">OUT OF STOCK</span>
                      </div>
                    )}
                  </td>
                  <td className="text-xs">{item.location}</td>
                  <td className="text-right text-sm">£{item.cost.toFixed(2)}</td>
                  <td className="text-right text-sm font-semibold">£{item.rrp.toFixed(2)}</td>
                  <td>
                    <span className="badge badge-ghost badge-sm font-mono">{item.entered_by}</span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {(item as any).on_offer === 1 ? (
                        <button className="btn btn-ghost btn-xs text-warning" title="Remove offer" onClick={async () => { await removeStockOffer(item.id); await loadStock(); }}>
                          <Tag size={14} />✕
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-xs" title="Put on offer" onClick={() => { setOfferItemId(item.id); setOfferPrice(String(Math.round(item.rrp * 0.8 * 100) / 100)); }}>
                          <Tag size={14} />
                        </button>
                      )}
                      <button className="btn btn-ghost btn-xs" onClick={() => onEdit(item)}>
                        <Edit size={14} />
                      </button>
                      {deleteConfirm === item.id ? (
                        <div className="flex gap-1">
                          <button className="btn btn-error btn-xs" onClick={() => handleDelete(item.id)}>Yes</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => setDeleteConfirm(null)}>No</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteConfirm(item.id)}>
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

      <div className="text-xs text-base-content/40 mt-2 text-right">
        Showing {filteredStock.length} of {totalItems} items
      </div>

      {/* Offer price modal */}
      {offerItemId !== null && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg flex items-center gap-2"><Tag size={20} className="text-warning" /> Set Offer Price</h3>
            <p className="text-sm text-base-content/60 mt-1">
              {stock.find(i => i.id === offerItemId)?.description} — RRP: £{stock.find(i => i.id === offerItemId)?.rrp.toFixed(2)}
            </p>
            <div className="form-control mt-3">
              <label className="label"><span className="label-text">Offer Price (£)</span></label>
              <input type="text" inputMode="decimal" className="input input-bordered" value={offerPrice}
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setOfferPrice(v); }} />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setOfferItemId(null); setOfferPrice(''); }}>Cancel</button>
              <button className="btn btn-warning" disabled={!offerPrice || parseFloat(offerPrice) <= 0} onClick={async () => {
                await setStockOnOffer(offerItemId!, parseFloat(offerPrice) || 0);
                setOfferItemId(null);
                setOfferPrice('');
                await loadStock();
              }}>Set Offer</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setOfferItemId(null); setOfferPrice(''); }} />
        </dialog>
      )}
    </div>
  );
};
