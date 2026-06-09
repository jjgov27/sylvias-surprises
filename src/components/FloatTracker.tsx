import React, { useState, useEffect, useCallback } from 'react';
import { Banknote, Save, Calendar, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { StaffUser, FloatRecord } from '../types';
import { saveFloat, getAllFloats, getFloatByDate, getDailySummary } from '../utils/db';

export function FloatTracker({ currentUser }: { currentUser: StaffUser }) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [openingStr, setOpeningStr] = useState('');
  const [closingStr, setClosingStr] = useState('');
  const [cashIn, setCashIn] = useState(0);
  const [cashOut, setCashOut] = useState(0);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<FloatRecord[]>([]);
  const [cashSalesToday, setCashSalesToday] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const opening = parseFloat(openingStr) || 0;
  const closing = parseFloat(closingStr) || 0;
  const expected = opening + cashIn - cashOut;
  const difference = closing - expected;

  const loadHistory = useCallback(async () => {
    try {
      const rows = await getAllFloats();
      setHistory(rows);
    } catch (err: any) {
      setError('Failed to load float history: ' + (err.message || err));
    }
  }, []);

  const loadDateData = useCallback(async (date: string) => {
    try {
      setError('');
      // Load daily summary for cash in / cash out
      const summary = await getDailySummary(date);
      setCashIn(summary.cashTotal);
      setCashOut(summary.expensesTotal);
      setCashSalesToday(summary.cashTotal);

      // Load existing float record for this date
      const existing = await getFloatByDate(date);
      if (existing) {
        setOpeningStr(String(existing.opening_amount));
        setClosingStr(String(existing.closing_amount));
        setNotes(existing.notes);
      } else {
        setOpeningStr('');
        setClosingStr('');
        setNotes('');
      }
    } catch (err: any) {
      setError('Failed to load data for date: ' + (err.message || err));
    }
  }, []);

  useEffect(() => {
    loadDateData(selectedDate);
    loadHistory();
  }, [selectedDate, loadDateData, loadHistory]);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const openVal = parseFloat(openingStr);
    const closeVal = parseFloat(closingStr);

    if (isNaN(openVal)) {
      setError('Please enter a valid opening float amount.');
      return;
    }
    if (isNaN(closeVal)) {
      setError('Please enter a valid closing float amount.');
      return;
    }

    setSaving(true);
    try {
      const exp = openVal + cashIn - cashOut;
      const diff = closeVal - exp;

      await saveFloat({
        float_date: selectedDate,
        opening_amount: openVal,
        closing_amount: closeVal,
        cash_in: cashIn,
        cash_out: cashOut,
        difference: Math.round(diff * 100) / 100,
        notes,
        entered_by: currentUser.initials,
      });

      setSuccess('Float saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
      await loadHistory();
    } catch (err: any) {
      setError('Failed to save float: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const diffColor = (val: number) => {
    if (val === 0) return 'text-success';
    if (val < 0) return 'text-error';
    return 'text-info';
  };

  const diffIcon = (val: number) => {
    if (val === 0) return <CheckCircle className="w-4 h-4 inline text-success" />;
    if (val < 0) return <TrendingDown className="w-4 h-4 inline text-error" />;
    return <TrendingUp className="w-4 h-4 inline text-info" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Banknote className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">Float Tracker</h2>
      </div>

      {/* Success alert */}
      {success && (
        <div className="alert alert-success mb-3 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>{success}</span>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="alert alert-error mb-3 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Today's Opening</div>
          <div className="stat-value text-lg">£{opening.toFixed(2)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Today's Closing</div>
          <div className="stat-value text-lg">£{closing.toFixed(2)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Difference</div>
          <div className={`stat-value text-lg ${diffColor(difference)}`}>
            {diffIcon(difference)} £{difference.toFixed(2)}
          </div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Cash Sales Today</div>
          <div className="stat-value text-lg">£{cashSalesToday.toFixed(2)}</div>
        </div>
      </div>

      {/* Entry Form */}
      <div className="card bg-base-200 shadow">
        <div className="card-body p-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Daily Float Entry
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {/* Date Picker */}
            <div>
              <label className="label py-1"><span className="label-text text-xs">Date</span></label>
              <input
                type="date"
                className="input input-bordered input-sm w-full"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {/* Opening Float */}
            <div>
              <label className="label py-1"><span className="label-text text-xs">Opening Float (£)</span></label>
              <input
                type="text"
                inputMode="decimal"
                className="input input-bordered input-sm w-full"
                placeholder="0.00"
                value={openingStr}
                onChange={(e) => setOpeningStr(e.target.value)}
              />
            </div>

            {/* Closing Float */}
            <div>
              <label className="label py-1"><span className="label-text text-xs">Closing Float (£)</span></label>
              <input
                type="text"
                inputMode="decimal"
                className="input input-bordered input-sm w-full"
                placeholder="0.00"
                value={closingStr}
                onChange={(e) => setClosingStr(e.target.value)}
              />
            </div>

            {/* Cash In (auto) */}
            <div>
              <label className="label py-1"><span className="label-text text-xs">Cash In (from sales)</span></label>
              <input
                type="text"
                className="input input-bordered input-sm w-full bg-base-300"
                value={`£${cashIn.toFixed(2)}`}
                readOnly
              />
            </div>

            {/* Cash Out (auto) */}
            <div>
              <label className="label py-1"><span className="label-text text-xs">Cash Out (expenses)</span></label>
              <input
                type="text"
                className="input input-bordered input-sm w-full bg-base-300"
                value={`£${cashOut.toFixed(2)}`}
                readOnly
              />
            </div>

            {/* Expected */}
            <div>
              <label className="label py-1"><span className="label-text text-xs">Expected Closing</span></label>
              <input
                type="text"
                className="input input-bordered input-sm w-full bg-base-300"
                value={`£${expected.toFixed(2)}`}
                readOnly
              />
            </div>
          </div>

          {/* Difference display */}
          <div className="mt-2">
            <label className="label py-1"><span className="label-text text-xs">Actual vs Expected Difference</span></label>
            <div className={`text-lg font-bold ${diffColor(difference)}`}>
              {diffIcon(difference)}{' '}
              {difference === 0 ? 'Balanced' : difference > 0 ? `Over by £${difference.toFixed(2)}` : `Short by £${Math.abs(difference).toFixed(2)}`}
            </div>
          </div>

          {/* Notes */}
          <div className="mt-2">
            <label className="label py-1"><span className="label-text text-xs">Notes</span></label>
            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              rows={2}
              placeholder="Any notes about the float..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Save Button */}
          <div className="mt-3">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Float'}
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card bg-base-200 shadow">
        <div className="card-body p-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            Float History
          </h3>

          {history.length === 0 ? (
            <p className="text-sm opacity-60 mt-2">No float records yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-base-300 mt-2">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Opening</th>
                    <th className="text-right">Cash In</th>
                    <th className="text-right">Cash Out</th>
                    <th className="text-right">Closing</th>
                    <th className="text-right">Difference</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((rec) => (
                    <tr
                      key={rec.id}
                      className={rec.float_date === selectedDate ? 'bg-primary/10' : ''}
                      onClick={() => setSelectedDate(rec.float_date)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="font-mono text-xs">{rec.float_date}</td>
                      <td className="text-right">£{rec.opening_amount.toFixed(2)}</td>
                      <td className="text-right">£{rec.cash_in.toFixed(2)}</td>
                      <td className="text-right">£{rec.cash_out.toFixed(2)}</td>
                      <td className="text-right">£{rec.closing_amount.toFixed(2)}</td>
                      <td className={`text-right font-semibold ${diffColor(rec.difference)}`}>
                        {rec.difference === 0 ? '—' : (rec.difference > 0 ? '+' : '') + '£' + rec.difference.toFixed(2)}
                      </td>
                      <td><span className="badge badge-primary badge-sm">{rec.entered_by}</span></td>
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
