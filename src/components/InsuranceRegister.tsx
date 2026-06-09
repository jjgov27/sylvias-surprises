import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser } from '../types';
import { Shield, Printer, RefreshCw } from 'lucide-react';

interface StockRow {
  id: number;
  part_number: string;
  description: string;
  category: string;
  location: string;
  qty: number;
  cost: number;
  rrp: number;
}

interface ConsignmentRow {
  id: number;
  consigner_name: string;
  description: string;
  qty_remaining: number;
  selling_price: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  totalCost: number;
  totalRrp: number;
}

interface LocationBreakdown {
  location: string;
  count: number;
  totalCost: number;
  totalRrp: number;
}

interface Props {
  currentUser: StaffUser;
}

export function InsuranceRegister({ currentUser }: Props) {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [consignment, setConsignment] = useState<ConsignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stockRows = await window.tasklet.sqlQuery(
        `SELECT id, part_number, description, category, location, qty, cost, rrp
         FROM sylvias_stock WHERE qty > 0 ORDER BY category ASC, description ASC`
      );
      setStock(stockRows as unknown as StockRow[]);

      const conRows = await window.tasklet.sqlQuery(
        `SELECT id, consigner_name, description, qty_remaining, selling_price
         FROM sylvias_consignment_stock WHERE status IN ('available','partial') AND qty_remaining > 0
         ORDER BY consigner_name ASC, description ASC`
      );
      setConsignment(conRows as unknown as ConsignmentRow[]);

      setReportDate(new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Calculations
  const totalItems = stock.reduce((s, r) => s + r.qty, 0);
  const totalCost = stock.reduce((s, r) => s + (r.cost * r.qty), 0);
  const totalRrp = stock.reduce((s, r) => s + (r.rrp * r.qty), 0);

  const totalConsignmentItems = consignment.reduce((s, r) => s + r.qty_remaining, 0);
  const totalConsignmentValue = consignment.reduce((s, r) => s + (r.selling_price * r.qty_remaining), 0);

  // Category breakdown
  const categoryMap: Record<string, CategoryBreakdown> = {};
  for (const r of stock) {
    const cat = r.category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = { category: cat, count: 0, totalCost: 0, totalRrp: 0 };
    categoryMap[cat].count += r.qty;
    categoryMap[cat].totalCost += r.cost * r.qty;
    categoryMap[cat].totalRrp += r.rrp * r.qty;
  }
  const categories = Object.values(categoryMap).sort((a, b) => b.totalRrp - a.totalRrp);

  // Location breakdown
  const locationMap: Record<string, LocationBreakdown> = {};
  for (const r of stock) {
    const loc = r.location || 'Unknown';
    if (!locationMap[loc]) locationMap[loc] = { location: loc, count: 0, totalCost: 0, totalRrp: 0 };
    locationMap[loc].count += r.qty;
    locationMap[loc].totalCost += r.cost * r.qty;
    locationMap[loc].totalRrp += r.rrp * r.qty;
  }
  const locations = Object.values(locationMap).sort((a, b) => b.totalRrp - a.totalRrp);

  function handlePrint() { window.print(); }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Shield size={24} className="text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-primary">Insurance Register</h1>
            <p className="text-sm text-base-content/50">Stock valuation report for insurance purposes</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm gap-1" onClick={load}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary btn-sm gap-1" onClick={handlePrint}><Printer size={14} /> Print Report</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></div>
      ) : (
        <>
          {/* Report Date */}
          <div className="text-sm text-base-content/50 mb-4">
            Report generated: <span className="font-semibold">{reportDate}</span>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="card bg-base-200 p-4">
              <p className="text-xs text-base-content/50 uppercase">Total Items</p>
              <p className="text-2xl font-bold text-primary">{totalItems}</p>
              <p className="text-xs text-base-content/40">{stock.length} unique lines</p>
            </div>
            <div className="card bg-base-200 p-4">
              <p className="text-xs text-base-content/50 uppercase">Total Cost Value</p>
              <p className="text-2xl font-bold text-info">£{totalCost.toFixed(2)}</p>
            </div>
            <div className="card bg-base-200 p-4">
              <p className="text-xs text-base-content/50 uppercase">Total RRP Value</p>
              <p className="text-2xl font-bold text-success">£{totalRrp.toFixed(2)}</p>
            </div>
            <div className="card bg-base-200 p-4">
              <p className="text-xs text-base-content/50 uppercase">Consignment (on premises)</p>
              <p className="text-2xl font-bold text-warning">{totalConsignmentItems} items</p>
              <p className="text-xs text-base-content/40">Value: £{totalConsignmentValue.toFixed(2)}</p>
            </div>
          </div>

          {/* Category Breakdown */}
          <h2 className="text-lg font-bold text-primary mb-3">Breakdown by Category</h2>
          <div className="overflow-x-auto rounded-lg border border-base-300 mb-6">
            <table className="table table-sm table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Category</th>
                  <th>Items</th>
                  <th>Cost Value</th>
                  <th>RRP Value</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <tr key={c.category}>
                    <td className="font-semibold">{c.category}</td>
                    <td>{c.count}</td>
                    <td className="font-mono">£{c.totalCost.toFixed(2)}</td>
                    <td className="font-mono">£{c.totalRrp.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td>Total</td>
                  <td>{totalItems}</td>
                  <td className="font-mono">£{totalCost.toFixed(2)}</td>
                  <td className="font-mono">£{totalRrp.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Location Breakdown */}
          <h2 className="text-lg font-bold text-primary mb-3">Breakdown by Location</h2>
          <div className="overflow-x-auto rounded-lg border border-base-300 mb-6">
            <table className="table table-sm table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Location</th>
                  <th>Items</th>
                  <th>Cost Value</th>
                  <th>RRP Value</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(l => (
                  <tr key={l.location}>
                    <td className="font-semibold">{l.location}</td>
                    <td>{l.count}</td>
                    <td className="font-mono">£{l.totalCost.toFixed(2)}</td>
                    <td className="font-mono">£{l.totalRrp.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td>Total</td>
                  <td>{totalItems}</td>
                  <td className="font-mono">£{totalCost.toFixed(2)}</td>
                  <td className="font-mono">£{totalRrp.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Full Stock Listing */}
          <h2 className="text-lg font-bold text-primary mb-3">Full Stock Register ({stock.length} lines)</h2>
          <div className="overflow-x-auto rounded-lg border border-base-300 mb-6">
            <table className="table table-xs table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Part #</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Qty</th>
                  <th>Cost (ea)</th>
                  <th>RRP (ea)</th>
                  <th>Total Cost</th>
                  <th>Total RRP</th>
                </tr>
              </thead>
              <tbody>
                {stock.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono">{r.part_number}</td>
                    <td>{r.description}</td>
                    <td className="text-xs">{r.category}</td>
                    <td className="text-xs">{r.location}</td>
                    <td>{r.qty}</td>
                    <td className="font-mono">£{r.cost.toFixed(2)}</td>
                    <td className="font-mono">£{r.rrp.toFixed(2)}</td>
                    <td className="font-mono">£{(r.cost * r.qty).toFixed(2)}</td>
                    <td className="font-mono">£{(r.rrp * r.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Consignment Items */}
          {consignment.length > 0 && (
            <>
              <h2 className="text-lg font-bold text-primary mb-3">Consignment Items (Not Owned — On Premises)</h2>
              <div className="overflow-x-auto rounded-lg border border-base-300 mb-6">
                <table className="table table-sm table-zebra w-full">
                  <thead>
                    <tr className="bg-base-200">
                      <th>Consigner</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Selling Price</th>
                      <th>Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consignment.map(c => (
                      <tr key={c.id}>
                        <td className="font-semibold">{c.consigner_name}</td>
                        <td>{c.description}</td>
                        <td>{c.qty_remaining}</td>
                        <td className="font-mono">£{c.selling_price.toFixed(2)}</td>
                        <td className="font-mono">£{(c.selling_price * c.qty_remaining).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={2}>Total Consignment</td>
                      <td>{totalConsignmentItems}</td>
                      <td></td>
                      <td className="font-mono">£{totalConsignmentValue.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-base-content/30 mt-6 border-t border-base-300 pt-4">
            <p>Sylvia's Surprises — Insurance Valuation Report</p>
            <p>Memorial Hall, Main Road, Union Mills, IM4 4AD</p>
            <p>Generated: {reportDate}</p>
          </div>
        </>
      )}
    </div>
  );
}
