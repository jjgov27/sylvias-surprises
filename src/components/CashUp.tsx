import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser, FloatRecord } from '../types';
import { getFloatByDate, saveFloat, formatPaymentMethod, getStaffUsers, getAllSalesByMethodForDate, getAllExpensesByMethodForDate, getAllRefundsByMethodForDate, getCashSalesForDate, getCashRefundsForDate, getCashExpensesForDate } from '../utils/db';
import { Calculator, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, User, Printer } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

const METHOD_CONFIG: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'cash', label: '💵 Cash', icon: '💵', color: 'success' },
  { key: 'sumup', label: '💳 SumUp', icon: '💳', color: 'info' },
  { key: 'bank_transfer', label: '🏦 Bank Transfer', icon: '🏦', color: 'secondary' },
  { key: 'ebay', label: '🌐 eBay', icon: '🌐', color: 'warning' },
  { key: 'trade_in', label: '🔄 Trade-In', icon: '🔄', color: 'accent' },
];

export function CashUp({ currentUser }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [salesByMethod, setSalesByMethod] = useState<Record<string, number>>({});
  const [refundsByMethod, setRefundsByMethod] = useState<Record<string, number>>({});
  const [expensesByMethod, setExpensesByMethod] = useState<Record<string, number>>({});
  const [existingFloat, setExistingFloat] = useState<FloatRecord | null>(null);
  const [openingFloat, setOpeningFloat] = useState('');
  const [closingFloat, setClosingFloat] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [cashedUpBy, setCashedUpBy] = useState(currentUser.initials);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setSaved(false);
    try {
      const [sales, refunds, expenses, floatRec, users] = await Promise.all([
        getAllSalesByMethodForDate(date),
        getAllRefundsByMethodForDate(date),
        getAllExpensesByMethodForDate(date),
        getFloatByDate(date),
        getStaffUsers(),
      ]);
      // getAllSalesByMethodForDate now queries sylvias_payments directly — single source of truth
      setSalesByMethod(sales);
      setRefundsByMethod(refunds);
      setExpensesByMethod(expenses);
      setExistingFloat(floatRec);
      setStaffList(users);
      if (floatRec) {
        setOpeningFloat(String(floatRec.opening_amount));
        setClosingFloat(String(floatRec.closing_amount));
        setNotes(floatRec.notes);
        setCashedUpBy(floatRec.entered_by || currentUser.initials);
      } else {
        setOpeningFloat('');
        setClosingFloat('');
        setNotes('');
        setCashedUpBy(currentUser.initials);
      }
    } finally {
      setLoading(false);
    }
  }, [date, currentUser.initials]);

  useEffect(() => { load(); }, [load]);

  const openingVal = parseFloat(openingFloat) || 0;
  const closingVal = parseFloat(closingFloat) || 0;

  // Cash calculations
  const cashSales = salesByMethod['cash'] || 0;
  const cashRefunds = refundsByMethod['cash'] || 0;
  const cashExpenses = expensesByMethod['cash'] || 0;
  const expectedCash = openingVal + cashSales - cashRefunds - cashExpenses;
  const discrepancy = closingVal - expectedCash;

  // Credit notes & gift vouchers are pre-paid — not new income
  const NON_INCOME_METHODS = ['credit_note', 'gift_voucher'];
  const totalSales = Object.entries(salesByMethod).filter(([k]) => !NON_INCOME_METHODS.includes(k)).reduce((a, [, v]) => a + (v as number), 0);
  const totalRefunds = (Object.values(refundsByMethod) as number[]).reduce((a, b) => a + b, 0);
  const totalExpenses = (Object.values(expensesByMethod) as number[]).reduce((a, b) => a + b, 0);

  // All methods that had any activity
  const allMethods = new Set([
    ...Object.keys(salesByMethod),
    ...Object.keys(refundsByMethod),
    ...Object.keys(expensesByMethod),
  ]);

  async function handleSave() {
    const cashIn = cashSales;
    const cashOut = cashRefunds + cashExpenses;
    await saveFloat({
      float_date: date,
      opening_amount: openingVal,
      closing_amount: closingVal,
      cash_in: cashIn,
      cash_out: cashOut,
      difference: discrepancy,
      notes,
      entered_by: cashedUpBy,
    });
    setSaved(true);
    await load();
  }

  function handlePrint() {
    window.print();
  }

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Calculator size={24} /> End of Day Cash-Up
      </h2>

      {/* Date + Cashed Up By */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="font-semibold">Date:</label>
          <input type="date" className="input input-bordered" value={date}
            onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold flex items-center gap-1"><User size={16} /> Cashed Up By:</label>
          <select className="select select-bordered" value={cashedUpBy}
            onChange={e => setCashedUpBy(e.target.value)}>
            {staffList.map(u => (
              <option key={u.id} value={u.initials}>{u.initials} — {u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><span className="loading loading-spinner loading-lg" /></div>
      ) : (
        <>
          {/* Full Sales Breakdown by Payment Method */}
          <div className="card bg-base-200 shadow-sm mb-4">
            <div className="card-body p-4">
              <h3 className="font-bold text-lg mb-3">📊 Day's Takings — Full Breakdown</h3>
              <p className="text-sm text-base-content/60 mb-3">{formatDate(date)}</p>
              
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="bg-base-300">
                      <th>Payment Method</th>
                      <th className="text-right">Sales</th>
                      <th className="text-right">Refunds</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METHOD_CONFIG.map(m => {
                      const sales = salesByMethod[m.key] || 0;
                      const refunds = refundsByMethod[m.key] || 0;
                      const net = sales - refunds;
                      if (sales === 0 && refunds === 0) return null;
                      return (
                        <tr key={m.key}>
                          <td className="font-semibold">{m.label}</td>
                          <td className="text-right text-success">£{sales.toFixed(2)}</td>
                          <td className="text-right text-error">{refunds > 0 ? `-£${refunds.toFixed(2)}` : '—'}</td>
                          <td className="text-right font-bold">£{net.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {/* Any methods not in config */}
                    {[...allMethods].filter(k => !METHOD_CONFIG.find(m => m.key === k)).map(key => {
                      const sales = salesByMethod[key] || 0;
                      const refunds = refundsByMethod[key] || 0;
                      const net = sales - refunds;
                      const isNonIncome = NON_INCOME_METHODS.includes(key);
                      if (sales === 0 && refunds === 0) return null;
                      return (
                        <tr key={key} className={isNonIncome ? 'opacity-60' : ''}>
                          <td className="font-semibold">{formatPaymentMethod(key)} {isNonIncome && <span className="badge badge-xs badge-ghost ml-1">pre-paid</span>}</td>
                          <td className="text-right text-success">£{sales.toFixed(2)}</td>
                          <td className="text-right text-error">{refunds > 0 ? `-£${refunds.toFixed(2)}` : '—'}</td>
                          <td className="text-right font-bold">£{net.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-base-300 font-bold text-lg">
                      <td>Total Sales</td>
                      <td className="text-right text-success">£{totalSales.toFixed(2)}</td>
                      <td className="text-right text-error">{totalRefunds > 0 ? `-£${totalRefunds.toFixed(2)}` : '—'}</td>
                      <td className="text-right text-primary">£{(totalSales - totalRefunds).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Expenses summary */}
              {totalExpenses > 0 && (
                <div className="mt-3 p-3 bg-warning/10 rounded-lg">
                  <div className="font-semibold mb-2">💸 Expenses Paid Out</div>
                  <div className="space-y-1">
                    {Object.entries(expensesByMethod).filter(([_, v]) => (v as number) > 0).map(([method, amount]) => (
                      <div key={method} className="flex justify-between text-sm">
                        <span>{formatPaymentMethod(method)}</span>
                        <span className="font-semibold text-error">-£{(amount as number).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold border-t border-warning/30 pt-1">
                      <span>Total Expenses</span>
                      <span className="text-error">-£{totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Non-Cash Method Summary Cards */}
          {(salesByMethod['sumup'] || salesByMethod['bank_transfer'] || salesByMethod['ebay'] || salesByMethod['trade_in']) ? (
            <div className="card bg-base-200 shadow-sm mb-4">
              <div className="card-body p-4">
                <h3 className="font-bold text-lg mb-3">📋 Non-Cash Payment Summary</h3>
                <p className="text-xs text-base-content/50 mb-3">Check these against your SumUp app, bank account, and eBay records</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {METHOD_CONFIG.filter(m => m.key !== 'cash').map(m => {
                    const sales = salesByMethod[m.key] || 0;
                    const refunds = refundsByMethod[m.key] || 0;
                    const net = sales - refunds;
                    if (sales === 0 && refunds === 0) return null;
                    return (
                      <div key={m.key} className={`p-3 bg-${m.color}/10 rounded-lg text-center`}>
                        <div className="text-xs text-base-content/50">{m.label}</div>
                        <div className={`text-xl font-bold text-${m.color}`}>£{net.toFixed(2)}</div>
                        {refunds > 0 && <div className="text-xs text-error">({refunds.toFixed(2)} refunded)</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Cash Reconciliation — the main till count */}
          <div className="card bg-base-200 shadow-sm mb-4">
            <div className="card-body p-4">
              <h3 className="font-bold text-lg mb-3">💰 Cash Till Reconciliation</h3>
              <p className="text-xs text-base-content/50 mb-3">Count the physical cash in the till and enter below</p>
              <div className="space-y-3">
                <div className="form-control">
                  <label className="label py-1"><span className="label-text font-semibold">Opening Float (£)</span></label>
                  <input type="text" className="input input-bordered w-40" value={openingFloat}
                    onChange={e => setOpeningFloat(e.target.value)} placeholder="0.00" />
                </div>

                {/* Expected calculation */}
                <div className="p-3 bg-base-100 rounded-lg">
                  <div className="text-sm font-semibold mb-2">Expected Cash in Till</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Opening float</span><span>£{openingVal.toFixed(2)}</span></div>
                    <div className="flex justify-between text-success"><span>+ Cash sales</span><span>£{cashSales.toFixed(2)}</span></div>
                    {cashRefunds > 0 && <div className="flex justify-between text-error"><span>− Cash refunds</span><span>£{cashRefunds.toFixed(2)}</span></div>}
                    {cashExpenses > 0 && <div className="flex justify-between text-error"><span>− Cash expenses</span><span>£{cashExpenses.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-bold border-t border-base-300 pt-1">
                      <span>Expected cash</span><span>£{expectedCash.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label py-1"><span className="label-text font-semibold">Actual Closing Float (£)</span></label>
                  <input type="text" className="input input-bordered w-40" value={closingFloat}
                    onChange={e => setClosingFloat(e.target.value)} placeholder="Count the till..." />
                </div>

                {/* Discrepancy */}
                {closingFloat && (
                  <div className={`p-4 rounded-lg ${Math.abs(discrepancy) < 0.01 ? 'bg-success/10 border border-success/30' : Math.abs(discrepancy) <= 5 ? 'bg-warning/10 border border-warning/30' : 'bg-error/10 border border-error/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {Math.abs(discrepancy) < 0.01 ? (
                          <><CheckCircle size={20} className="text-success" /><span className="font-bold text-success">✓ Till balanced perfectly</span></>
                        ) : discrepancy > 0 ? (
                          <><TrendingUp size={20} className="text-warning" /><span className="font-bold text-warning">Till is OVER by £{discrepancy.toFixed(2)}</span></>
                        ) : (
                          <><TrendingDown size={20} className="text-error" /><span className="font-bold text-error">Till is SHORT by £{Math.abs(discrepancy).toFixed(2)}</span></>
                        )}
                      </div>
                      <div className="text-sm font-semibold bg-base-100 px-3 py-1 rounded-full">
                        Verified by: <span className="font-bold text-primary">{cashedUpBy}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-sm">Notes</span></label>
                  <input type="text" className="input input-bordered w-full" value={notes}
                    onChange={e => setNotes(e.target.value)} placeholder="Any notes about the cash-up..." />
                </div>
              </div>
            </div>
          </div>

          {/* Day's Net Position */}
          <div className="card bg-primary/10 shadow-sm mb-4">
            <div className="card-body p-4">
              <h3 className="font-bold text-lg mb-2">📈 Day's Net Position</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-base-content/50">Total Takings</div>
                  <div className="text-xl font-bold text-success">£{(totalSales - totalRefunds).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/50">Total Expenses</div>
                  <div className="text-xl font-bold text-error">-£{totalExpenses.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/50">Net for Day</div>
                  <div className="text-xl font-bold text-primary">£{(totalSales - totalRefunds - totalExpenses).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Save + Print */}
          <div className="flex items-center gap-3 flex-wrap">
            <button className="btn btn-primary btn-lg gap-2" onClick={handleSave}
              disabled={!openingFloat && !closingFloat}>
              <CheckCircle size={20} /> Save Cash-Up
            </button>
            <button className="btn btn-outline gap-2" onClick={handlePrint}>
              <Printer size={18} /> Print Report
            </button>
            {saved && (
              <span className="text-success font-semibold flex items-center gap-1">
                <CheckCircle size={16} /> Saved! Cashed up by <span className="font-bold">{cashedUpBy}</span>
              </span>
            )}
            {existingFloat && !saved && (
              <span className="text-sm text-base-content/50">
                Existing record found (cashed up by {existingFloat.entered_by}) — will update.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
