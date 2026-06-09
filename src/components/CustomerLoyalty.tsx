import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser } from '../types';
import { Award, Search, ChevronDown, ChevronUp, X } from 'lucide-react';

interface LoyaltyRow {
  customer_id: number;
  customer_name: string;
  total_spent: number;
  sale_count: number;
  avg_sale: number;
  first_purchase: string;
  last_purchase: string;
}

interface PurchaseRow {
  invoice_number: string;
  sale_date: string;
  total: number;
  payment_method: string;
  items: string;
}

interface Props {
  currentUser: StaffUser;
}

export function CustomerLoyalty({ currentUser }: Props) {
  const [rows, setRows] = useState<LoyaltyRow[]>([]);
  const [filtered, setFiltered] = useState<LoyaltyRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<LoyaltyRow | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [sortField, setSortField] = useState<'total_spent' | 'sale_count' | 'avg_sale'>('total_spent');
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.tasklet.sqlQuery(
        `SELECT s.customer_id, s.customer_name,
                SUM(s.total) as total_spent,
                COUNT(*) as sale_count,
                AVG(s.total) as avg_sale,
                MIN(s.sale_date) as first_purchase,
                MAX(s.sale_date) as last_purchase
         FROM sylvias_sales s
         WHERE s.customer_name != 'Walk-in' AND s.customer_name != ''
         GROUP BY COALESCE(s.customer_id, s.customer_name)
         ORDER BY total_spent DESC`
      );
      setRows(data as unknown as LoyaltyRow[]);
      setFiltered(data as unknown as LoyaltyRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    let result = q ? rows.filter(r => r.customer_name.toLowerCase().includes(q)) : [...rows];
    result.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      return sortAsc ? av - bv : bv - av;
    });
    setFiltered(result);
  }, [search, rows, sortField, sortAsc]);

  const vipThreshold = Math.max(500, (() => {
    if (rows.length < 10) return 0;
    const sorted = [...rows].sort((a, b) => b.total_spent - a.total_spent);
    const idx = Math.max(0, Math.floor(sorted.length * 0.1) - 1);
    return sorted[idx]?.total_spent || 500;
  })());

  const isVip = (r: LoyaltyRow) => r.total_spent >= vipThreshold;

  async function viewPurchases(row: LoyaltyRow) {
    setSelectedCustomer(row);
    setLoadingPurchases(true);
    try {
      let whereClause: string;
      if (row.customer_id) {
        whereClause = `s.customer_id = ${row.customer_id}`;
      } else {
        const name = row.customer_name.replace(/'/g, "''");
        whereClause = `s.customer_name = '${name}'`;
      }
      const data = await window.tasklet.sqlQuery(
        `SELECT s.invoice_number, s.sale_date, s.total, s.payment_method,
                GROUP_CONCAT(si.description, ', ') as items
         FROM sylvias_sales s
         LEFT JOIN sylvias_sale_items si ON s.id = si.sale_id
         WHERE ${whereClause}
         GROUP BY s.id
         ORDER BY s.sale_date DESC`
      );
      setPurchases(data as unknown as PurchaseRow[]);
    } finally {
      setLoadingPurchases(false);
    }
  }

  function toggleSort(field: 'total_spent' | 'sale_count' | 'avg_sale') {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try {
      const iso = d.replace(' ', 'T');
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  };

  const totalCustomers = rows.length;
  const totalSpent = rows.reduce((s, r) => s + r.total_spent, 0);
  const vipCount = rows.filter(isVip).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Award size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">Customer Loyalty Tracker</h1>
          <p className="text-sm text-base-content/50">Ranked by total spend — VIP threshold: £{vipThreshold.toFixed(0)}+</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card bg-base-200 p-4">
          <p className="text-xs text-base-content/50 uppercase">Total Customers</p>
          <p className="text-2xl font-bold text-primary">{totalCustomers}</p>
        </div>
        <div className="card bg-base-200 p-4">
          <p className="text-xs text-base-content/50 uppercase">Total Revenue</p>
          <p className="text-2xl font-bold text-success">£{totalSpent.toFixed(2)}</p>
        </div>
        <div className="card bg-base-200 p-4">
          <p className="text-xs text-base-content/50 uppercase">VIP Customers ⭐</p>
          <p className="text-2xl font-bold text-warning">{vipCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
          <input
            type="text"
            className="input input-bordered w-full pl-9 input-sm"
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X size={14} className="text-base-content/40" />
            </button>
          )}
        </div>
        <span className="text-sm text-base-content/50">{filtered.length} customer{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-base-content/40">
          <Award size={48} className="mx-auto mb-3 opacity-30" />
          <p>No customer sales data found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm table-zebra w-full">
            <thead>
              <tr className="bg-base-200">
                <th className="w-12">#</th>
                <th>Customer</th>
                <th className="cursor-pointer select-none" onClick={() => toggleSort('total_spent')}>
                  <span className="flex items-center gap-1">Total Spent <SortIcon field="total_spent" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleSort('sale_count')}>
                  <span className="flex items-center gap-1">Sales <SortIcon field="sale_count" /></span>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleSort('avg_sale')}>
                  <span className="flex items-center gap-1">Avg Sale <SortIcon field="avg_sale" /></span>
                </th>
                <th>First Purchase</th>
                <th>Last Purchase</th>
                <th className="w-12">VIP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.customer_id || r.customer_name}
                  className="hover cursor-pointer"
                  onClick={() => viewPurchases(r)}
                >
                  <td className="font-mono text-base-content/40">{i + 1}</td>
                  <td className="font-semibold">{r.customer_name}</td>
                  <td className="font-mono">£{r.total_spent.toFixed(2)}</td>
                  <td>{r.sale_count}</td>
                  <td className="font-mono">£{r.avg_sale.toFixed(2)}</td>
                  <td className="text-xs">{fmtDate(r.first_purchase)}</td>
                  <td className="text-xs">{fmtDate(r.last_purchase)}</td>
                  <td className="text-center">{isVip(r) ? '⭐' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Purchase History Modal */}
      {selectedCustomer && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setSelectedCustomer(null)}>✕</button>
            <h3 className="font-bold text-lg text-primary flex items-center gap-2">
              {isVip(selectedCustomer) && '⭐'} {selectedCustomer.customer_name}
            </h3>
            <div className="grid grid-cols-3 gap-3 mt-3 mb-4">
              <div className="bg-base-200 rounded-lg p-3 text-center">
                <p className="text-xs text-base-content/50">Total Spent</p>
                <p className="font-bold text-success">£{selectedCustomer.total_spent.toFixed(2)}</p>
              </div>
              <div className="bg-base-200 rounded-lg p-3 text-center">
                <p className="text-xs text-base-content/50">No. of Sales</p>
                <p className="font-bold">{selectedCustomer.sale_count}</p>
              </div>
              <div className="bg-base-200 rounded-lg p-3 text-center">
                <p className="text-xs text-base-content/50">Average Sale</p>
                <p className="font-bold">£{selectedCustomer.avg_sale.toFixed(2)}</p>
              </div>
            </div>

            <h4 className="font-semibold mb-2">Purchase History</h4>
            {loadingPurchases ? (
              <div className="flex justify-center py-6">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : purchases.length === 0 ? (
              <p className="text-sm text-base-content/40 py-4 text-center">No purchases found</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="table table-sm table-zebra w-full">
                  <thead>
                    <tr className="bg-base-200">
                      <th>Invoice</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">{p.invoice_number}</td>
                        <td className="text-xs">{fmtDate(p.sale_date)}</td>
                        <td className="font-mono">£{p.total.toFixed(2)}</td>
                        <td className="text-xs max-w-xs truncate">{p.items || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => setSelectedCustomer(null)} />
        </div>
      )}
    </div>
  );
}
