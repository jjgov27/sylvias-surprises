import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser } from '../types';
import { getSalesSplitByDateRange, getOwnedStockCOGSByRange, getExpensesByCategoryInRange, getExpensesTotalsByRange, getRefundsTotalByRange, formatPaymentMethod } from '../utils/db';
import { BarChart3, Printer } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

export function PnlReport({ currentUser }: Props) {
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const today = now.toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [split, cogs, expByCat, expTotals, refundsTotal] = await Promise.all([
        getSalesSplitByDateRange(dateFrom, dateTo),
        getOwnedStockCOGSByRange(dateFrom, dateTo),
        getExpensesByCategoryInRange(dateFrom, dateTo),
        getExpensesTotalsByRange(dateFrom, dateTo),
        getRefundsTotalByRange(dateFrom, dateTo),
      ]);

      const grossSalesOwned = split.stockSalesTotal;
      const netSalesOwned = grossSalesOwned - refundsTotal;
      const grossProfitOwned = netSalesOwned - cogs;
      const commissionEarned = split.consignmentCommission;
      const totalIncome = grossProfitOwned + commissionEarned;
      const totalExpenses = expTotals.total_expenses;
      const netProfit = totalIncome - totalExpenses;

      setData({
        grossSalesOwned,
        refundsTotal,
        netSalesOwned,
        cogs,
        grossProfitOwned,
        consignmentSalesTotal: split.consignmentSalesTotal,
        commissionEarned,
        consignmentOwed: split.consignmentOwed,
        totalIncome,
        expensesByCategory: expByCat,
        totalExpenses,
        netProfit,
        stockSalesCount: split.stockSalesCount,
        consignmentSalesCount: split.consignmentSalesCount,
      });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <BarChart3 size={24} /> Profit & Loss Statement
      </h2>

      {/* Date range */}
      <div className="flex gap-3 mb-6 items-end flex-wrap">
        <div className="form-control">
          <label className="label py-1"><span className="label-text text-sm">From</span></label>
          <input type="date" className="input input-bordered input-sm" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-control">
          <label className="label py-1"><span className="label-text text-sm">To</span></label>
          <input type="date" className="input input-bordered input-sm" value={dateTo}
            onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-outline btn-sm gap-1" onClick={() => window.print()}>
          <Printer size={14} /> Print
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><span className="loading loading-spinner loading-lg" /></div>
      ) : !data ? (
        <div className="text-center py-8 text-base-content/50">No data available.</div>
      ) : (
        <div className="bg-white text-black p-8 shadow-lg rounded-lg print:shadow-none" id="pnl-report">
          {/* Header */}
          <div className="text-center border-b-2 pb-4 mb-6" style={{ borderColor: '#5C3D2E' }}>
            <h1 className="text-2xl font-bold" style={{ color: '#5C3D2E' }}>Sylvia's Surprises</h1>
            <p className="text-sm" style={{ color: '#888' }}>Antiques, Collectibles & More</p>
            <h2 className="text-lg font-bold mt-2">Profit & Loss Statement</h2>
            <p className="text-sm" style={{ color: '#888' }}>{formatDate(dateFrom)} — {formatDate(dateTo)}</p>
          </div>

          {/* INCOME */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-3 pb-1 border-b-2" style={{ color: '#5C3D2E', borderColor: '#5C3D2E' }}>INCOME</h3>

            {/* Stock Sales */}
            <div className="mb-4">
              <div className="font-semibold text-sm mb-1" style={{ color: '#5C3D2E' }}>Stock Sales (Owned Goods)</div>
              <div className="ml-4 space-y-1">
                <Row label="Gross Sales" value={data.grossSalesOwned} />
                {data.refundsTotal > 0 && <Row label="Less: Refunds" value={-data.refundsTotal} negative />}
                <Row label="Net Sales" value={data.netSalesOwned} bold />
                <Row label="Less: Cost of Goods Sold (COGS)" value={-data.cogs} negative />
                <Row label="Gross Profit on Stock" value={data.grossProfitOwned} bold accent />
              </div>
            </div>

            {/* Consignment Commission */}
            <div className="mb-4">
              <div className="font-semibold text-sm mb-1" style={{ color: '#7B2D8B' }}>Consignment Sales</div>
              <div className="ml-4 space-y-1">
                <Row label="Consignment Sales Total" value={data.consignmentSalesTotal} info />
                <Row label="Less: Owed to Consigners" value={-data.consignmentOwed} negative info />
                <Row label="Commission Earned" value={data.commissionEarned} bold accent />
              </div>
            </div>

            {/* Total Income */}
            <div className="border-t-2 pt-2 mt-4" style={{ borderColor: '#5C3D2E' }}>
              <Row label="TOTAL GROSS INCOME" value={data.totalIncome} bold large />
            </div>
          </div>

          {/* EXPENSES */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-3 pb-1 border-b-2" style={{ color: '#E53E3E', borderColor: '#E53E3E' }}>EXPENSES</h3>
            <div className="ml-4 space-y-1">
              {data.expensesByCategory.length > 0 ? (
                data.expensesByCategory.map((exp: any, idx: number) => (
                  <div key={idx}><Row label={exp.category} value={exp.total} negative /></div>
                ))
              ) : (
                <div className="text-sm text-base-content/50 italic">No expenses recorded in this period.</div>
              )}
            </div>
            <div className="border-t pt-2 mt-2 ml-4">
              <Row label="TOTAL EXPENSES" value={data.totalExpenses} bold negative />
            </div>
          </div>

          {/* NET PROFIT */}
          <div className="border-t-4 pt-4 mt-4" style={{ borderColor: '#5C3D2E' }}>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold" style={{ color: '#5C3D2E' }}>NET PROFIT / (LOSS)</span>
              <span className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {data.netProfit < 0 && '('}£{Math.abs(data.netProfit).toFixed(2)}{data.netProfit < 0 && ')'}
              </span>
            </div>
            <div className="mt-2 text-sm" style={{ color: '#888' }}>
              Gross Profit on Stock £{data.grossProfitOwned.toFixed(2)} + Commission £{data.commissionEarned.toFixed(2)} − Expenses £{data.totalExpenses.toFixed(2)}
            </div>
          </div>

          {/* Summary metrics */}
          <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#F5EDE3' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: '#5C3D2E' }}>Key Metrics</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><span className="text-base-content/50">Stock Sales:</span> <span className="font-bold">{data.stockSalesCount}</span></div>
              <div><span className="text-base-content/50">Consignment Sales:</span> <span className="font-bold">{data.consignmentSalesCount}</span></div>
              <div><span className="text-base-content/50">Gross Margin:</span> <span className="font-bold">{data.netSalesOwned > 0 ? ((data.grossProfitOwned / data.netSalesOwned) * 100).toFixed(1) : '0.0'}%</span></div>
              <div><span className="text-base-content/50">Net Margin:</span> <span className="font-bold">{data.totalIncome > 0 ? ((data.netProfit / data.totalIncome) * 100).toFixed(1) : '0.0'}%</span></div>
              <div><span className="text-base-content/50">Expense Ratio:</span> <span className="font-bold">{data.totalIncome > 0 ? ((data.totalExpenses / data.totalIncome) * 100).toFixed(1) : '0.0'}%</span></div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs" style={{ color: '#999' }}>
            <p>Sylvia's Surprises — Memorial Hall, Main Road, Union Mills, IM4 4AD</p>
            <p>Report generated {new Date().toLocaleDateString('en-GB')} at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, negative, accent, large, info }: {
  label: string; value: number; bold?: boolean; negative?: boolean; accent?: boolean; large?: boolean; info?: boolean;
}) {
  return (
    <div className={`flex justify-between ${large ? 'text-lg' : 'text-sm'}`}>
      <span className={`${bold ? 'font-bold' : ''} ${info ? 'italic' : ''}`} style={accent ? { color: '#2E7D32' } : undefined}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${negative && value > 0 ? 'text-red-600' : accent ? 'text-green-700' : ''}`}>
        {negative && value > 0 && '('}£{Math.abs(value).toFixed(2)}{negative && value > 0 && ')'}
      </span>
    </div>
  );
}
