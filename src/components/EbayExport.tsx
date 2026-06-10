import { useState, useEffect } from 'react';
import { StockItem, StaffUser } from '../types';
import { getAllStock as getStock } from '../utils/db';
import { Package, Download, CheckSquare, Square, Filter, Search, ShoppingBag, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

// eBay condition IDs
const EBAY_CONDITIONS: Record<string, { id: number; label: string }> = {
  'New': { id: 1000, label: 'New' },
  'New other': { id: 1500, label: 'New other (see details)' },
  'New with defects': { id: 1750, label: 'New with defects' },
  'Certified Refurbished': { id: 2000, label: 'Certified - Refurbished' },
  'Excellent - Refurbished': { id: 2010, label: 'Excellent - Refurbished' },
  'Very Good - Refurbished': { id: 2020, label: 'Very Good - Refurbished' },
  'Good - Refurbished': { id: 2030, label: 'Good - Refurbished' },
  'Used': { id: 3000, label: 'Used' },
  'Very Good': { id: 4000, label: 'Very Good' },
  'Good': { id: 5000, label: 'Good' },
  'Acceptable': { id: 6000, label: 'Acceptable' },
  'For parts': { id: 7000, label: 'For parts or not working' },
};

// Common eBay categories for antiques/collectibles shop
const EBAY_CATEGORIES: Record<string, string> = {
  'Jewellery': '281',
  'Silver': '20094',
  'Gold': '20090',
  'Coins': '11116',
  'Watches': '14324',
  'Antiques': '20081',
  'Collectables': '1',
  'China & Porcelain': '2563',
  'Glass': '3265',
  'Pottery': '38726',
  'Books': '261186',
  'Art': '550',
  'Furniture': '20091',
  'Metalware': '1217',
  'Clocks': '398',
  'Toys': '220',
  'Militaria': '2552',
  'Other': '99',
};

const LISTING_DURATIONS = ['GTC', '3', '5', '7', '10', '30'];

export function EbayExport({ currentUser }: Props) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchQ, setSearchQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [exported, setExported] = useState(false);

  // Default listing settings
  const [defaults, setDefaults] = useState({
    condition: 'Used',
    format: 'FixedPrice',
    duration: 'GTC',
    location: 'Union Mills, Isle of Man',
    shippingService: 'UK_RoyalMailSecondClassStandard',
    shippingCost: '3.95',
    freeShipping: false,
    handlingTime: '3',
    returnsAccepted: true,
    returnsPeriod: '30',
    priceMarkup: '0',  // % markup on RRP for eBay listing
    descriptionPrefix: '',
    descriptionSuffix: 'Thank you for shopping with Sylvia\'s Surprises!',
  });

  useEffect(() => {
    loadStock();
  }, []);

  async function loadStock() {
    setLoading(true);
    try {
      const items = await getStock();
      setStock(items);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const categories = ['All', ...Array.from(new Set(stock.map(s => s.category))).sort()];

  const filtered = stock.filter(item => {
    if (inStockOnly && item.qty <= 0) return false;
    if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return item.description.toLowerCase().includes(q) ||
        item.part_number.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q);
    }
    return true;
  });

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
  }

  function toggleItem(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function calculateListingPrice(item: StockItem): number {
    const base = item.on_offer && item.offer_price > 0 ? item.offer_price : item.rrp;
    const markup = parseFloat(defaults.priceMarkup) || 0;
    return Math.round((base * (1 + markup / 100)) * 100) / 100;
  }

  function escapeCSV(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }

  function buildDescription(item: StockItem): string {
    let desc = '';
    if (defaults.descriptionPrefix) desc += defaults.descriptionPrefix + '\n\n';
    desc += item.description;
    if (item.part_number) desc += `\n\nPart Number: ${item.part_number}`;
    if (item.category) desc += `\nCategory: ${item.category}`;
    if (defaults.descriptionSuffix) desc += '\n\n' + defaults.descriptionSuffix;
    return desc;
  }

  function generateCSV() {
    const items = filtered.filter(i => selected.has(i.id));
    if (items.length === 0) return;

    // eBay File Exchange headers
    const headers = [
      '*Action(SiteID=3)',  // 3 = UK
      '*Category',
      '*Title',
      '*Description',
      '*ConditionID',
      '*Format',
      '*Duration',
      '*StartPrice',
      '*Quantity',
      'CustomLabel',
      '*Location',
      'ShippingType',
      'ShippingService-1:Option',
      'ShippingService-1:Cost',
      '*DispatchTimeMax',
      'ReturnsAcceptedOption',
      'ReturnsWithinOption',
    ];

    const rows = items.map(item => {
      const condId = EBAY_CONDITIONS[defaults.condition]?.id || 3000;
      const catNum = EBAY_CATEGORIES[item.category] || EBAY_CATEGORIES['Other'];
      const price = calculateListingPrice(item);

      return [
        'Add',
        catNum,
        escapeCSV(item.description.substring(0, 80)), // eBay title max 80 chars
        escapeCSV(buildDescription(item)),
        String(condId),
        defaults.format,
        defaults.duration,
        price.toFixed(2),
        String(item.qty),
        escapeCSV(item.part_number || `SS-${item.id}`),
        escapeCSV(defaults.location),
        defaults.freeShipping ? 'Free' : 'Flat',
        defaults.freeShipping ? '' : defaults.shippingService,
        defaults.freeShipping ? '0.00' : parseFloat(defaults.shippingCost).toFixed(2),
        defaults.handlingTime,
        defaults.returnsAccepted ? 'ReturnsAccepted' : 'ReturnsNotAccepted',
        defaults.returnsAccepted ? `Days_${defaults.returnsPeriod}` : '',
      ].join(',');
    });

    const csv = headers.join(',') + '\n' + rows.join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sylvias-ebay-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 4000);
  }

  if (loading) {
    return <div className="p-6 text-center text-base-content/60">Loading stock...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingBag size={24} className="text-primary" />
          <h2 className="text-xl font-bold">eBay Export</h2>
          <span className="badge badge-outline badge-sm">{selected.size} selected</span>
        </div>
        <button
          className="btn btn-primary gap-2"
          disabled={selected.size === 0}
          onClick={generateCSV}
        >
          <Download size={16} />
          Export CSV ({selected.size})
        </button>
      </div>

      {/* Success toast */}
      {exported && (
        <div className="alert alert-success py-2">
          <span>✅ CSV downloaded! Upload it to eBay Seller Hub → Listings → Bulk Actions → Upload.</span>
        </div>
      )}

      {/* Info box */}
      <div className="alert alert-info py-3">
        <Info size={16} />
        <div>
          <p className="font-semibold">How to use</p>
          <p className="text-sm">Select items below, adjust listing settings, then click Export CSV. Upload the file to <strong>eBay Seller Hub → Listings → Bulk upload</strong> (File Exchange format). Review listings in eBay before publishing.</p>
        </div>
      </div>

      {/* Listing Settings */}
      <div className="card bg-base-200 border border-base-300">
        <div
          className="card-body p-4 cursor-pointer"
          onClick={() => setShowSettings(!showSettings)}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              ⚙️ Listing Defaults
              <span className="text-sm font-normal text-base-content/60">
                ({defaults.condition} • {defaults.format === 'FixedPrice' ? 'Buy It Now' : 'Auction'} • {defaults.duration === 'GTC' ? 'Good Til Cancelled' : defaults.duration + ' days'})
              </span>
            </h3>
            {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
        {showSettings && (
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">Condition</span></label>
              <select
                className="select select-bordered select-sm"
                value={defaults.condition}
                onChange={e => setDefaults(d => ({ ...d, condition: e.target.value }))}
              >
                {Object.entries(EBAY_CONDITIONS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">Format</span></label>
              <select
                className="select select-bordered select-sm"
                value={defaults.format}
                onChange={e => setDefaults(d => ({ ...d, format: e.target.value }))}
              >
                <option value="FixedPrice">Buy It Now (Fixed Price)</option>
                <option value="Auction">Auction</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">Duration</span></label>
              <select
                className="select select-bordered select-sm"
                value={defaults.duration}
                onChange={e => setDefaults(d => ({ ...d, duration: e.target.value }))}
              >
                {LISTING_DURATIONS.map(d => (
                  <option key={d} value={d}>{d === 'GTC' ? 'Good Til Cancelled' : d + ' days'}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">Location</span></label>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={defaults.location}
                onChange={e => setDefaults(d => ({ ...d, location: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">Handling Time (days)</span></label>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={defaults.handlingTime}
                onChange={e => setDefaults(d => ({ ...d, handlingTime: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">Price Markup %</span></label>
              <input
                type="text"
                className="input input-bordered input-sm"
                placeholder="0 = use RRP as-is"
                value={defaults.priceMarkup}
                onChange={e => setDefaults(d => ({ ...d, priceMarkup: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label cursor-pointer gap-2 py-1">
                <span className="label-text text-xs">Free Shipping</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={defaults.freeShipping}
                  onChange={e => setDefaults(d => ({ ...d, freeShipping: e.target.checked }))}
                />
              </label>
            </div>
            {!defaults.freeShipping && (
              <>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs">Shipping Service</span></label>
                  <select
                    className="select select-bordered select-sm"
                    value={defaults.shippingService}
                    onChange={e => setDefaults(d => ({ ...d, shippingService: e.target.value }))}
                  >
                    <option value="UK_RoyalMailSecondClassStandard">Royal Mail 2nd Class</option>
                    <option value="UK_RoyalMailFirstClassStandard">Royal Mail 1st Class</option>
                    <option value="UK_RoyalMailSecondClassRecorded">Royal Mail 2nd Class Signed</option>
                    <option value="UK_RoyalMailFirstClassRecorded">Royal Mail 1st Class Signed</option>
                    <option value="UK_RoyalMailSpecialDeliveryNextDay">Special Delivery Next Day</option>
                    <option value="UK_Parcelforce48">Parcelforce 48</option>
                    <option value="UK_OtherCourier">Other Courier</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs">Shipping Cost (£)</span></label>
                  <input
                    type="text"
                    className="input input-bordered input-sm"
                    value={defaults.shippingCost}
                    onChange={e => setDefaults(d => ({ ...d, shippingCost: e.target.value }))}
                  />
                </div>
              </>
            )}
            <div className="form-control">
              <label className="label cursor-pointer gap-2 py-1">
                <span className="label-text text-xs">Returns Accepted</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={defaults.returnsAccepted}
                  onChange={e => setDefaults(d => ({ ...d, returnsAccepted: e.target.checked }))}
                />
              </label>
            </div>
            {defaults.returnsAccepted && (
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Return Period</span></label>
                <select
                  className="select select-bordered select-sm"
                  value={defaults.returnsPeriod}
                  onChange={e => setDefaults(d => ({ ...d, returnsPeriod: e.target.value }))}
                >
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                </select>
              </div>
            )}
            <div className="form-control col-span-full">
              <label className="label py-1"><span className="label-text text-xs">Description Prefix (added before item description)</span></label>
              <textarea
                className="textarea textarea-bordered textarea-sm"
                rows={2}
                placeholder="e.g. Welcome to Sylvia's Surprises eBay shop!"
                value={defaults.descriptionPrefix}
                onChange={e => setDefaults(d => ({ ...d, descriptionPrefix: e.target.value }))}
              />
            </div>
            <div className="form-control col-span-full">
              <label className="label py-1"><span className="label-text text-xs">Description Suffix (added after item description)</span></label>
              <textarea
                className="textarea textarea-bordered textarea-sm"
                rows={2}
                value={defaults.descriptionSuffix}
                onChange={e => setDefaults(d => ({ ...d, descriptionSuffix: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            className="input input-bordered input-sm w-full pl-9"
            placeholder="Search items..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        <select
          className="select select-bordered select-sm"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="label cursor-pointer gap-2">
          <span className="label-text text-xs">In stock only</span>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={inStockOnly}
            onChange={e => setInStockOnly(e.target.checked)}
          />
        </label>
        <button className="btn btn-outline btn-sm gap-1" onClick={toggleAll}>
          {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
          {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto border border-base-300 rounded-lg">
        <table className="table table-sm table-zebra">
          <thead>
            <tr className="bg-base-200">
              <th className="w-10"></th>
              <th>Description</th>
              <th>Part #</th>
              <th>Category</th>
              <th className="text-right">Qty</th>
              <th className="text-right">RRP</th>
              <th className="text-right">eBay Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-base-content/50">No items match your filters</td></tr>
            ) : filtered.map(item => {
              const isSelected = selected.has(item.id);
              const ebayPrice = calculateListingPrice(item);
              return (
                <tr
                  key={item.id}
                  className={`cursor-pointer hover ${isSelected ? 'bg-primary/10' : ''}`}
                  onClick={() => toggleItem(item.id)}
                >
                  <td>
                    {isSelected ? (
                      <CheckSquare size={16} className="text-primary" />
                    ) : (
                      <Square size={16} className="text-base-content/30" />
                    )}
                  </td>
                  <td className="font-medium">{item.description}</td>
                  <td className="text-base-content/60 text-xs">{item.part_number || '—'}</td>
                  <td><span className="badge badge-ghost badge-sm">{item.category}</span></td>
                  <td className="text-right">{item.qty}</td>
                  <td className="text-right">£{item.rrp.toFixed(2)}</td>
                  <td className="text-right font-medium">
                    £{ebayPrice.toFixed(2)}
                    {parseFloat(defaults.priceMarkup) > 0 && (
                      <span className="text-xs text-success ml-1">+{defaults.priceMarkup}%</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-base-content/50 text-center">
        Showing {filtered.length} items • {selected.size} selected for export
      </div>
    </div>
  );
}
