import { useState, useEffect, useCallback } from 'react';
import { StaffUser, StockItem } from '../types';
import {
  getOwnedStockProfitByCategory,
  getTopSellingItems,
  getSlowestStock,
  getStockAgeDays,
  getSalesTotals,
  getOwnedStockCOGS,
  getConsignmentProfitSummary,
  getSalesSplitByDateRange,
  SalesSplit,
  getDiscountTotalForRange,
} from '../utils/db';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Clock,
  Award,
  AlertTriangle,
  Handshake,
  Package,
  Tag,
} from 'lucide-react';

interface CategoryProfit {
  category: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  count: number;
}

interface TopItem {
  description: string;
  part_number: string;
  total_sold: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface ConsignmentProfit {
  consigner_name: string;
  total_sold: number;
  commission_earned: number;
  owed_to_consigner: number;
}

export function ProfitDashboard({ currentUser }: { currentUser: StaffUser }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Summary
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCogs, setTotalCogs] = useState(0);
  const [split, setSplit] = useState<SalesSplit | null>(null);

  // Sections
  const [categoryProfits, setCategoryProfits] = useState<CategoryProfit[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [slowStock, setSlowStock] = useState<(StockItem & { ageDays: number })[]>([]);
  const [consignmentProfits, setConsignmentProfits] = useState<ConsignmentProfit[]>([]);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [discountCount, setDiscountCount] = useState(0);

  const fmt = (n: number) => `£${n.toFixed(2)}`;
  const pct = (n: number) => `${n.toFixed(1)}%`;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [salesTotals, cogs, cats, top, slow, conProfits, salesSplit] = await Promise.all([
        getSalesTotals(),
        getOwnedStockCOGS(),
        getOwnedStockProfitByCategory(),
        getTopSellingItems(10),
        getSlowestStock(15),
        getConsignmentProfitSummary(),
        getSalesSplitByDateRange('2020-01-01', new Date().toISOString().slice(0, 10)),
      ]);

      setTotalRevenue(salesTotals.total_sales);
      setTotalCogs(cogs);
      setCategoryProfits(cats);
      setTopItems(top);
      setConsignmentProfits(conProfits);
      setSplit(salesSplit);

      // Fetch discounts separately so it can't break the main dashboard
      try {
        const discountData = await getDiscountTotalForRange('2020-01-01', new Date().toISOString().slice(0, 10));
        setDiscountTotal(discountData.totalDiscount);
        setDiscountCount(discountData.discountCount);
      } catch { /* discount card just won't show */ }

      const withAge = slow.map((s) => ({
        ...s,
        ageDays: getStockAgeDays(s.created_at),
      }));
      withAge.sort((a, b) => b.ageDays - a.ageDays);
      setSlowStock(withAge);
    } catch (e: any) {
      setError(e.message || 'Failed to load profit data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stockProfit = (split?.stockSalesTotal || 0) - totalCogs;
  const stockMargin = (split?.stockSalesTotal || 0) > 0 ? (stockProfit / (split?.stockSalesTotal || 1)) * 100 : 0;
  const totalProfit = stockProfit + (split?.consignmentCommission || 0);

  const maxMargin = categoryProfits.length > 0
    ? Math.max(...categoryProfits.map((c) => Math.abs(c.margin)), 1)
    : 100;

  const ageBadge = (days: number) => {
    if (days >= 90) return 'badge badge-error badge-sm';
    if (days >= 60) return 'badge badge-warning badge-sm';
    if (days >= 30) return 'badge badge-sm bg-orange-200 text-orange-800 border-orange-300';
    return 'badge badge-ghost badge-sm';
  };

  const ageColor = (days: number) => {
    if (days >= 90) return 'text-error';
    if (days >= 60) return 'text-warning';
    if (days >= 30) return 'text-orange-500';
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 size={22} /> Profit Dashboard
        </h2>
        <button className="btn btn-ghost btn-sm" onClick={loadData}>
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Summary Cards — Stock vs Consignment split */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Revenue</div>
          <div className="stat-value text-base text-primary">{fmt(totalRevenue)}</div>
        </div>
        <div className="stat bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="stat-title text-xs flex items-center gap-1"><Package size={12} /> Stock Sales</div>
          <div className="stat-value text-base text-blue-700">{fmt(split?.stockSalesTotal || 0)}</div>
        </div>
        <div className="stat bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="stat-title text-xs flex items-center gap-1"><Handshake size={12} /> Consignment Sales</div>
          <div className="stat-value text-base text-purple-700">{fmt(split?.consignmentSalesTotal || 0)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Stock COGS</div>
          <div className="stat-value text-base flex items-center gap-1">
            <TrendingDown size={14} className="text-error" />
            {fmt(totalCogs)}
          </div>
        </div>
        <div className="stat bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="stat-title text-xs">Stock Profit</div>
          <div className={`stat-value text-base ${stockProfit >= 0 ? 'text-success' : 'text-error'}`}>
            {fmt(stockProfit)}
          </div>
          <div className="stat-desc text-xs">{pct(stockMargin)} margin</div>
        </div>
        <div className="stat bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="stat-title text-xs">Commission Earned</div>
          <div className="stat-value text-base text-purple-700">{fmt(split?.consignmentCommission || 0)}</div>
          <div className="stat-desc text-xs">Consignment profit</div>
        </div>
      </div>

      {/* Combined profit card */}
      <div className="alert bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-success" />
          <div>
            <div className="font-bold text-lg text-success">{fmt(totalProfit)}</div>
            <div className="text-xs text-base-content/60">
              Total Profit = Stock Profit ({fmt(stockProfit)}) + Commission ({fmt(split?.consignmentCommission || 0)})
            </div>
          </div>
        </div>
      </div>

      {/* Discounts Given */}
      {discountCount > 0 && (
        <div className="alert bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300">
          <div className="flex items-center gap-3">
            <Tag size={20} className="text-amber-600" />
            <div>
              <div className="font-bold text-lg text-amber-700">{fmt(discountTotal)}</div>
              <div className="text-xs text-base-content/60">
                Discounts Given — {discountCount} discounted sale{discountCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consignment Profit by Consigner */}
      {consignmentProfits.length > 0 && (
        <div className="card bg-purple-50 border border-purple-200 shadow">
          <div className="card-body p-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Handshake size={16} className="text-purple-600" /> Consignment Profit by Consigner
            </h3>
            <div className="overflow-x-auto rounded-lg border border-purple-200">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Consigner</th>
                    <th className="text-right">Total Sold</th>
                    <th className="text-right">Your Commission</th>
                    <th className="text-right">Owed to Consigner</th>
                  </tr>
                </thead>
                <tbody>
                  {consignmentProfits.map((c, i) => (
                    <tr key={i}>
                      <td className="font-medium text-sm">{c.consigner_name}</td>
                      <td className="text-right text-sm">{fmt(c.total_sold)}</td>
                      <td className="text-right text-sm font-semibold text-purple-700">{fmt(c.commission_earned)}</td>
                      <td className="text-right text-sm text-orange-600">{fmt(c.owed_to_consigner)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Best Margins by Category (owned stock only) */}
      <div className="card bg-base-200 shadow">
        <div className="card-body p-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <BarChart3 size={16} /> Best Margins by Category
            <span className="badge badge-sm bg-blue-100 text-blue-700 border-blue-200">Owned Stock Only</span>
          </h3>
          {categoryProfits.length === 0 ? (
            <p className="text-sm opacity-60">No sales data yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-base-300">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Margin %</th>
                    <th className="w-32">Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryProfits.map((c) => (
                    <tr key={c.category}>
                      <td className="font-medium text-xs">{c.category}</td>
                      <td className="text-right text-xs">{fmt(c.revenue)}</td>
                      <td className="text-right text-xs">{fmt(c.cost)}</td>
                      <td className={`text-right text-xs font-semibold ${c.profit >= 0 ? 'text-success' : 'text-error'}`}>
                        {fmt(c.profit)}
                      </td>
                      <td className={`text-right text-xs font-semibold ${c.margin >= 0 ? 'text-success' : 'text-error'}`}>
                        {pct(c.margin)}
                      </td>
                      <td>
                        <div className="w-full bg-base-300 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all ${c.margin >= 0 ? 'bg-success' : 'bg-error'}`}
                            style={{ width: `${Math.min(Math.abs(c.margin) / maxMargin * 100, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top Earners */}
      <div className="card bg-base-200 shadow">
        <div className="card-body p-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Award size={16} className="text-warning" /> Top Earners
          </h3>
          {topItems.length === 0 ? (
            <p className="text-sm opacity-60">No sales data yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-base-300">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Part No.</th>
                    <th className="text-right">Qty Sold</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, idx) => (
                    <tr key={item.part_number + idx}>
                      <td className="text-xs font-bold">{idx + 1}</td>
                      <td className="text-xs font-medium max-w-[200px] truncate">{item.description}</td>
                      <td><span className="badge badge-primary badge-sm font-mono">{item.part_number}</span></td>
                      <td className="text-right text-xs">{item.total_sold}</td>
                      <td className="text-right text-xs font-semibold">{fmt(item.revenue)}</td>
                      <td className="text-right text-xs">{fmt(item.cost)}</td>
                      <td className={`text-right text-xs font-semibold ${item.profit >= 0 ? 'text-success' : 'text-error'}`}>
                        {fmt(item.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slowest Stock (Dogs) */}
      <div className="card bg-base-200 shadow">
        <div className="card-body p-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Clock size={16} className="text-error" /> Slowest Stock (Dogs)
          </h3>
          <p className="text-xs opacity-60 -mt-1">
            Items in stock longest with no or few sales. Consider reducing price or putting on offer.
          </p>
          {slowStock.length === 0 ? (
            <p className="text-sm opacity-60">No stock items found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-base-300">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Part No.</th>
                    <th className="text-right">Age (days)</th>
                    <th className="text-right">Cost Tied Up</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {slowStock.map((item) => (
                    <tr key={item.id}>
                      <td className="text-xs font-medium max-w-[200px] truncate">{item.description}</td>
                      <td><span className="badge badge-primary badge-sm font-mono">{item.part_number}</span></td>
                      <td className="text-right">
                        <span className={ageBadge(item.ageDays)}>
                          {item.ageDays}d
                        </span>
                      </td>
                      <td className={`text-right text-xs font-semibold ${ageColor(item.ageDays)}`}>
                        {fmt(item.cost * item.qty)}
                      </td>
                      <td className="text-xs">{item.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
