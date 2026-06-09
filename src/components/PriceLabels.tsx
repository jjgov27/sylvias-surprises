import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Search, Printer, CheckSquare, Grid, List } from 'lucide-react';
import { StaffUser, StockItem } from '../types';
import { getAllStock, searchStock, getStockOnOffer } from '../utils/db';

type LabelSize = 'small' | 'medium' | 'large';

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .label-grid { 
    display: flex !important; 
    flex-wrap: wrap !important; 
    gap: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .label-card {
    border: 2px dashed #999 !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin: 4px !important;
    padding: 12px !important;
    background: white !important;
    color: black !important;
    box-shadow: none !important;
  }
  .label-small { width: calc(25% - 8px) !important; }
  .label-medium { width: calc(50% - 8px) !important; }
  .label-large { width: calc(100% - 8px) !important; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible !important; }
  .print-area { position: absolute; top: 0; left: 0; width: 100%; }
}
`;

export function PriceLabels({ currentUser }: { currentUser: StaffUser }) {
  const [allStock, setAllStock] = useState<StockItem[]>([]);
  const [results, setResults] = useState<StockItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadStock = useCallback(async () => {
    try {
      setLoading(true);
      const items = await getAllStock();
      setAllStock(items);
      setResults(items);
    } catch (e: any) {
      setError(e.message || 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStock(); }, [loadStock]);

  const handleSearch = useCallback(async () => {
    try {
      setError('');
      if (!query.trim()) {
        setResults(allStock);
        return;
      }
      const items = await searchStock(query.trim());
      setResults(items);
    } catch (e: any) {
      setError(e.message || 'Search failed');
    }
  }, [query, allStock]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  const handleSelectAll = useCallback(async () => {
    try {
      const inStock = results.filter(i => i.qty > 0);
      const newSet = new Set(selected);
      inStock.forEach(i => newSet.add(i.id));
      setSelected(newSet);
    } catch (e: any) {
      setError(e.message || 'Failed to select items');
    }
  }, [results, selected]);

  const handleSelectOnOffer = useCallback(async () => {
    try {
      const items = await getStockOnOffer();
      const newSet = new Set(selected);
      items.forEach(i => newSet.add(i.id));
      setSelected(newSet);
      // Also make sure offer items appear in results
      if (query.trim()) {
        setQuery('');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load offer items');
    }
  }, [selected, query]);

  const toggleItem = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const selectedItems = allStock.filter(i => selected.has(i.id));

  const gridClass = labelSize === 'small'
    ? 'grid-cols-2 sm:grid-cols-4'
    : labelSize === 'medium'
    ? 'grid-cols-1 sm:grid-cols-2'
    : 'grid-cols-1';

  const labelSizeClass = labelSize === 'small'
    ? 'label-small'
    : labelSize === 'medium'
    ? 'label-medium'
    : 'label-large';

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* Controls - hidden when printing */}
      <div className="no-print space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Price Labels</h2>
          {selected.size > 0 && (
            <span className="badge badge-primary badge-sm">{selected.size} selected</span>
          )}
        </div>

        {error && (
          <div className="alert alert-error mb-3 text-sm">
            <span>{error}</span>
          </div>
        )}

        {/* Search & Actions */}
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  className="input input-bordered input-sm w-full pl-8"
                  placeholder="Search stock by description, part number or location..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <Search className="w-4 h-4 absolute left-2 top-2 text-base-content/40" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className="btn btn-sm btn-secondary" onClick={handleSelectAll}>
                  <CheckSquare className="w-4 h-4" /> Select All In Stock
                </button>
                <button className="btn btn-sm btn-accent" onClick={handleSelectOnOffer}>
                  <Tag className="w-4 h-4" /> Select On Offer
                </button>
                {selected.size > 0 && (
                  <button className="btn btn-sm btn-ghost" onClick={clearSelection}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Results list */}
            <div className="mt-3 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="text-center py-4 text-sm opacity-60">Loading stock...</div>
              ) : results.length === 0 ? (
                <div className="text-center py-4 text-sm opacity-60">No items found</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-base-300">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th className="w-8"></th>
                        <th>Description</th>
                        <th>Part #</th>
                        <th>Qty</th>
                        <th className="text-right">Price</th>
                        <th>Offer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(item => (
                        <tr
                          key={item.id}
                          className={`cursor-pointer hover ${selected.has(item.id) ? 'bg-primary/10' : ''}`}
                          onClick={() => toggleItem(item.id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary checkbox-xs"
                              checked={selected.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                            />
                          </td>
                          <td className="font-medium">{item.description}</td>
                          <td className="text-xs opacity-70">{item.part_number}</td>
                          <td>{item.qty}</td>
                          <td className="text-right">£{item.rrp.toFixed(2)}</td>
                          <td>
                            {item.on_offer ? (
                              <span className="badge badge-warning badge-xs">£{item.offer_price.toFixed(2)}</span>
                            ) : (
                              <span className="text-xs opacity-40">–</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Label options & Print */}
        {selected.size > 0 && (
          <div className="card bg-base-200 shadow">
            <div className="card-body p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Label Size:</span>
                  <div className="join">
                    <button
                      className={`join-item btn btn-xs ${labelSize === 'small' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setLabelSize('small')}
                    >
                      <Grid className="w-3 h-3" /> Small
                    </button>
                    <button
                      className={`join-item btn btn-xs ${labelSize === 'medium' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setLabelSize('medium')}
                    >
                      <Grid className="w-3 h-3" /> Medium
                    </button>
                    <button
                      className={`join-item btn btn-xs ${labelSize === 'large' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setLabelSize('large')}
                    >
                      <List className="w-3 h-3" /> Large
                    </button>
                  </div>
                </div>
                <div className="flex-1" />
                <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4" /> Print {selected.size} Label{selected.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Label preview / print area */}
      {selectedItems.length > 0 && (
        <div className="print-area">
          <div className="no-print flex items-center gap-2 mb-2">
            <h3 className="text-sm font-bold opacity-70">Preview</h3>
          </div>
          <div className={`label-grid grid ${gridClass} gap-3`}>
            {selectedItems.map(item => {
              const isOffer = item.on_offer === 1 && item.offer_price > 0;
              const displayPrice = isOffer ? item.offer_price : item.rrp;

              return (
                <div
                  key={item.id}
                  className={`label-card ${labelSizeClass} border-2 border-dashed border-base-300 rounded-lg p-4 flex flex-col items-center justify-center text-center bg-base-100`}
                >
                  <div className={`font-bold text-primary ${labelSize === 'small' ? 'text-xs' : labelSize === 'medium' ? 'text-sm' : 'text-base'}`}>
                    Sylvia's Surprises
                  </div>
                  <div className="divider my-1" style={{ margin: '4px 0' }}></div>
                  <div className={`font-semibold ${labelSize === 'small' ? 'text-xs' : labelSize === 'medium' ? 'text-sm' : 'text-base'} leading-tight`}>
                    {item.description}
                  </div>
                  <div className={`opacity-50 mt-1 ${labelSize === 'small' ? 'text-[10px]' : 'text-xs'}`}>
                    {item.part_number}
                  </div>
                  <div className="mt-2">
                    {isOffer ? (
                      <div className="flex flex-col items-center gap-0">
                        <span className={`line-through opacity-40 ${labelSize === 'small' ? 'text-xs' : 'text-sm'}`}>
                          £{item.rrp.toFixed(2)}
                        </span>
                        <span className={`font-bold text-error ${labelSize === 'small' ? 'text-base' : labelSize === 'medium' ? 'text-lg' : 'text-2xl'}`}>
                          £{item.offer_price.toFixed(2)}
                        </span>
                        <span className={`badge badge-error ${labelSize === 'small' ? 'badge-xs' : 'badge-sm'} mt-1`}>
                          OFFER
                        </span>
                      </div>
                    ) : (
                      <span className={`font-bold ${labelSize === 'small' ? 'text-base' : labelSize === 'medium' ? 'text-lg' : 'text-2xl'}`}>
                        £{item.rrp.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected.size === 0 && (
        <div className="no-print text-center py-8 opacity-50 text-sm">
          <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Select items above to generate price labels
        </div>
      )}
    </div>
  );
}
