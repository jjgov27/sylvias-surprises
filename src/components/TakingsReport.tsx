import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Calendar, TrendingUp, Printer, RefreshCw } from 'lucide-react';
import { formatPaymentMethod } from '../utils/db';
import type { StaffUser } from '../types';

interface Props {
  currentUser: StaffUser;
}

interface TakingsRow {
  method: string;
  total: number;
  count: number;
  refunds: number;
  net: number;
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'This Week', days: -1 },  // special: current week Mon–today
  { label: 'Last Week', days: -2 },   // special: previous Mon–Sun
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'This Month', days: -3 },  // special
  { label: 'Last Month', days: -4 },  // special
];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getPresetDates(preset: typeof PRESETS[number]): [string, string] {
  const today = new Date();
  if (preset.days === 0) return [fmt(today), fmt(today)];
  if (preset.days === 7) {
    const from = new Date(today); from.setDate(from.getDate() - 6);
    return [fmt(from), fmt(today)];
  }
  if (preset.days === 30) {
    const from = new Date(today); from.setDate(from.getDate() - 29);
    return [fmt(from), fmt(today)];
  }
  if (preset.days === -1) { // This week
    return [fmt(getMonday(today)), fmt(today)];
  }
  if (preset.days === -2) { // Last week
    const mon = getMonday(today);
    mon.setDate(mon.getDate() - 7);
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    return [fmt(mon), fmt(sun)];
  }
  if (preset.days === -3) { // This month
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return [fmt(from), fmt(today)];
  }
  if (preset.days === -4) { // Last month
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return [fmt(from), fmt(to)];
  }
  return [fmt(today), fmt(today)];
}

const METHOD_ICONS: Record<string, string> = {
  cash: '💵',
  sumup: '💳',
  bank_transfer: '🏦',
  ebay: '🌐',
  paypal: '🅿️',
  card: '💳',
  trade_in: '🔄',
  account: '📋',
  other: '📋',
};

export function TakingsReport({ currentUser }: Props) {
  const [fromDate, setFromDate] = useState(fmt(getMonday(new Date())));
  const [toDate, setToDate] = useState(fmt(new Date()));
  const [activePreset, setActivePreset] = useState('This Week');
  const [rows, setRows] = useState<TakingsRow[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [totalNet, setTotalNet] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Get actual money received — sylvias_payments is the single source of truth
      const paymentsRes = await window.tasklet.sqlQuery(
        `SELECT payment_method as method, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
         FROM sylvias_payments
         WHERE date(payment_date) >= date('${fromDate}') AND date(payment_date) <= date('${toDate}')
         GROUP BY payment_method ORDER BY total DESC`
      );

      // Get refunds by payment method
      const refundsRes = await window.tasklet.sqlQuery(
        `SELECT r.refund_method as method, COALESCE(SUM(r.amount), 0) as total
         FROM sylvias_refunds r
         WHERE date(r.refund_date) >= date('${fromDate}') AND date(r.refund_date) <= date('${toDate}')
         GROUP BY r.refund_method`
      );

      const salesMap: Record<string, {total: number; count: number}> = {};
      (paymentsRes || []).forEach((r: any) => {
        const m = r.method || 'cash';
        salesMap[m] = { total: Number(r.total) || 0, count: Number(r.count) || 0 };
      });

      const refundMap: Record<string, number> = {};
      (refundsRes || []).forEach((r: any) => {
        refundMap[r.method || 'cash'] = Number(r.total) || 0;
      });

      const data: TakingsRow[] = Object.entries(salesMap).map(([method, s]) => {
        const refund = refundMap[method] || 0;
        return {
          method,
          total: s.total,
          count: s.count,
          refunds: refund,
          net: s.total - refund,
        };
      });

      // Add any refund-only methods
      Object.entries(refundMap).forEach(([method, refund]) => {
        if (!data.find(d => d.method === method)) {
          data.push({ method, total: 0, count: 0, refunds: refund, net: -refund });
        }
      });

      // Sort by total descending
      data.sort((a, b) => b.total - a.total);

      setRows(data);
      const tSales = data.reduce((s, r) => s + r.total, 0);
      const tRefunds = data.reduce((s, r) => s + r.refunds, 0);
      setTotalSales(tSales);
      setTotalRefunds(tRefunds);
      setTotalNet(tSales - tRefunds);
      const totalTxCount = data.reduce((s, r) => s + r.count, 0);
      setSaleCount(totalTxCount);
    } catch (e) {
      console.error('TakingsReport load error', e);
    }
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(p: typeof PRESETS[number]) {
    const [f, t] = getPresetDates(p);
    setFromDate(f);
    setToDate(t);
    setActivePreset(p.label);
  }

  function handlePrint() {
    window.print();
  }

  const dateLabel = fromDate === toDate
    ? new Date(fromDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${new Date(fromDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} — ${new Date(toDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <DollarSign size={22} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Takings Report</h2>
          <p className="text-sm text-base-content/60">Reconcile payments against your bank &amp; SumUp</p>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map(p => (
          <button
            key={p.label}
            className={`btn btn-sm ${activePreset === p.label ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-base-content/50" />
          <input type="date" className="input input-bordered input-sm" value={fromDate}
            onChange={e => { setFromDate(e.target.value); setActivePreset(''); }} />
        </div>
        <span className="text-base-content/40">to</span>
        <input type="date" className="input input-bordered input-sm" value={toDate}
          onChange={e => { setToDate(e.target.value); setActivePreset(''); }} />
        <button className="btn btn-sm btn-ghost gap-1" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button className="btn btn-sm btn-ghost gap-1" onClick={handlePrint}>
          <Printer size={14} /> Print
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-primary uppercase tracking-wide">Total Takings</div>
              <div className="text-2xl font-bold text-primary mt-1">£{totalSales.toFixed(2)}</div>
            </div>
            <div className="bg-error/10 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-error uppercase tracking-wide">Refunds</div>
              <div className="text-2xl font-bold text-error mt-1">−£{totalRefunds.toFixed(2)}</div>
            </div>
            <div className="bg-success/10 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-success uppercase tracking-wide">Net Received</div>
              <div className="text-2xl font-bold text-success mt-1">£{totalNet.toFixed(2)}</div>
            </div>
            <div className="bg-base-200 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-base-content/60 uppercase tracking-wide">Transactions</div>
              <div className="text-2xl font-bold mt-1">{saleCount}</div>
            </div>
          </div>

          {/* Period label */}
          <div className="text-sm text-base-content/50 mb-3 flex items-center gap-1">
            <Calendar size={14} /> {dateLabel}
          </div>

          {/* Breakdown table */}
          <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden mb-6">
            <table className="table table-sm">
              <thead>
                <tr className="bg-base-200">
                  <th>Payment Method</th>
                  <th className="text-center">Transactions</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Refunds</th>
                  <th className="text-right font-bold">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-base-content/40">No sales in this period</td></tr>
                ) : rows.map(r => (
                  <tr key={r.method} className="hover">
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="text-lg">{METHOD_ICONS[r.method] || '💰'}</span>
                        <span className="font-semibold">{formatPaymentMethod(r.method)}</span>
                      </span>
                    </td>
                    <td className="text-center">{r.count}</td>
                    <td className="text-right">£{r.total.toFixed(2)}</td>
                    <td className="text-right text-error">{r.refunds > 0 ? `−£${r.refunds.toFixed(2)}` : '—'}</td>
                    <td className="text-right font-bold">£{r.net.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-base-200 font-bold">
                    <td>TOTAL</td>
                    <td className="text-center">{saleCount}</td>
                    <td className="text-right">£{totalSales.toFixed(2)}</td>
                    <td className="text-right text-error">{totalRefunds > 0 ? `−£${totalRefunds.toFixed(2)}` : '—'}</td>
                    <td className="text-right text-success text-lg">£{totalNet.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Per-method reconciliation helper */}
          {rows.length > 0 && (
            <div className="bg-base-200/50 rounded-xl p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <TrendingUp size={16} /> Reconciliation Check
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rows.map(r => (
                  <div key={r.method} className="bg-base-100 rounded-lg p-3 flex items-center justify-between border border-base-300">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{METHOD_ICONS[r.method] || '💰'}</span>
                      <div>
                        <div className="font-semibold text-sm">{formatPaymentMethod(r.method)}</div>
                        <div className="text-xs text-base-content/50">{r.count} transaction{r.count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">£{r.net.toFixed(2)}</div>
                      <div className="text-xs text-base-content/50">should be in {r.method === 'cash' ? 'till' : r.method === 'sumup' ? 'SumUp account' : r.method === 'ebay' ? 'PayPal/eBay' : 'bank account'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
