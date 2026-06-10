import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser, StockItem } from '../types';
import { getSetting, setSetting } from '../utils/db';
import {
  ClipboardCheck, MapPin, Shuffle, Check, X, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, FileText, Search, RotateCcw, Eye, Pencil, Clock, CheckCircle2, XCircle,
} from 'lucide-react';

/* ── Types ── */
interface StockCheckSession {
  id: number;
  check_type: string; // 'position' | 'spot'
  location_filter: string;
  started_by: string;
  started_at: string;
  completed_at: string;
  status: string; // 'in_progress' | 'completed'
  total_items: number;
  found_count: number;
  missing_count: number;
  notes: string;
}

interface StockCheckItem {
  id: number;
  check_id: number;
  stock_id: number;
  part_number: string;
  description: string;
  location: string;
  expected_qty: number;
  actual_qty: number;
  status: string; // 'pending' | 'found' | 'missing' | 'discrepancy'
  notes: string;
  checked_by: string;
  checked_at: string;
  signoff_by: string;
  signoff_at: string;
  resolution: string; // '' | 'sold_not_recorded' | 'moved' | 'missing' | 'written_off' | 'found_later'
}

interface Props {
  currentUser: StaffUser;
}

const esc = (s: string) => s.replace(/'/g, "''");

export function StockCheck({ currentUser }: Props) {
  const [tab, setTab] = useState<'new' | 'active' | 'history' | 'summary'>('new');
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [spotCount, setSpotCount] = useState('10');
  const [activeChecks, setActiveChecks] = useState<StockCheckSession[]>([]);
  const [completedChecks, setCompletedChecks] = useState<StockCheckSession[]>([]);
  const [currentCheck, setCurrentCheck] = useState<StockCheckSession | null>(null);
  const [checkItems, setCheckItems] = useState<StockCheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ text: string; onYes: () => void } | null>(null);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [searchHistory, setSearchHistory] = useState('');

  /* ── Init tables ── */
  const ensureTables = useCallback(async () => {
    await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS sylvias_stock_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_type TEXT NOT NULL DEFAULT 'spot',
      location_filter TEXT NOT NULL DEFAULT '',
      started_by TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'in_progress',
      total_items INTEGER NOT NULL DEFAULT 0,
      found_count INTEGER NOT NULL DEFAULT 0,
      missing_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    )`);
    await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS sylvias_stock_check_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_id INTEGER NOT NULL,
      stock_id INTEGER NOT NULL,
      part_number TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      expected_qty INTEGER NOT NULL DEFAULT 0,
      actual_qty INTEGER NOT NULL DEFAULT -1,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      checked_by TEXT NOT NULL DEFAULT '',
      checked_at TEXT NOT NULL DEFAULT '',
      signoff_by TEXT NOT NULL DEFAULT '',
      signoff_at TEXT NOT NULL DEFAULT '',
      resolution TEXT NOT NULL DEFAULT ''
    )`);
  }, []);

  /* ── Load locations ── */
  const loadLocations = useCallback(async () => {
    const rows = await window.tasklet.sqlQuery(
      "SELECT DISTINCT location FROM sylvias_stock WHERE location != '' AND qty > 0 ORDER BY location ASC"
    );
    setLocations(rows.map((r: any) => r.location));
  }, []);

  /* ── Load checks ── */
  const loadChecks = useCallback(async () => {
    const active = await window.tasklet.sqlQuery(
      "SELECT * FROM sylvias_stock_checks WHERE status = 'in_progress' ORDER BY started_at DESC"
    );
    setActiveChecks(active as unknown as StockCheckSession[]);
    const completed = await window.tasklet.sqlQuery(
      "SELECT * FROM sylvias_stock_checks WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 100"
    );
    setCompletedChecks(completed as unknown as StockCheckSession[]);
  }, []);

  useEffect(() => {
    ensureTables().then(() => {
      loadLocations();
      loadChecks();
    });
  }, [ensureTables, loadLocations, loadChecks]);

  /* ── Start Position Check ── */
  const startPositionCheck = async () => {
    if (!selectedLocation) { setMsg('Please select a location'); return; }
    setLoading(true);
    try {
      const items = await window.tasklet.sqlQuery(
        `SELECT * FROM sylvias_stock WHERE location = '${esc(selectedLocation)}' AND qty > 0 ORDER BY description ASC`
      );
      if (items.length === 0) { setMsg('No in-stock items at that location'); setLoading(false); return; }

      await window.tasklet.sqlExec(
        `INSERT INTO sylvias_stock_checks (check_type, location_filter, started_by, total_items)
         VALUES ('position', '${esc(selectedLocation)}', '${esc(currentUser.name)}', ${items.length})`
      );
      const idRows = await window.tasklet.sqlQuery(
        "SELECT id FROM sylvias_stock_checks ORDER BY id DESC LIMIT 1"
      );
      const checkId = Number(idRows[0].id);

      for (const item of items as unknown as StockItem[]) {
        await window.tasklet.sqlExec(
          `INSERT INTO sylvias_stock_check_items (check_id, stock_id, part_number, description, location, expected_qty)
           VALUES (${checkId}, ${item.id}, '${esc(item.part_number)}', '${esc(item.description)}', '${esc(item.location)}', ${item.qty})`
        );
      }

      await loadChecks();
      await openCheck(checkId);
      setMsg('');
    } catch (e: any) { setMsg('Error: ' + e.message); }
    setLoading(false);
  };

  /* ── Start Spot Check ── */
  const startSpotCheck = async () => {
    const count = parseInt(spotCount) || 10;
    setLoading(true);
    try {
      const items = await window.tasklet.sqlQuery(
        `SELECT * FROM sylvias_stock WHERE qty > 0 ORDER BY RANDOM() LIMIT ${count}`
      );
      if (items.length === 0) { setMsg('No in-stock items found'); setLoading(false); return; }

      await window.tasklet.sqlExec(
        `INSERT INTO sylvias_stock_checks (check_type, location_filter, started_by, total_items)
         VALUES ('spot', 'Random ${count}', '${esc(currentUser.name)}', ${items.length})`
      );
      const idRows = await window.tasklet.sqlQuery(
        "SELECT id FROM sylvias_stock_checks ORDER BY id DESC LIMIT 1"
      );
      const checkId = Number(idRows[0].id);

      for (const item of items as unknown as StockItem[]) {
        await window.tasklet.sqlExec(
          `INSERT INTO sylvias_stock_check_items (check_id, stock_id, part_number, description, location, expected_qty)
           VALUES (${checkId}, ${item.id}, '${esc(item.part_number)}', '${esc(item.description)}', '${esc(item.location)}', ${item.qty})`
        );
      }

      await loadChecks();
      await openCheck(checkId);
      setMsg('');
    } catch (e: any) { setMsg('Error: ' + e.message); }
    setLoading(false);
  };

  /* ── Open a check session ── */
  const openCheck = async (checkId: number) => {
    const rows = await window.tasklet.sqlQuery(
      `SELECT * FROM sylvias_stock_checks WHERE id = ${checkId}`
    );
    if (rows.length === 0) return;
    setCurrentCheck(rows[0] as unknown as StockCheckSession);

    const items = await window.tasklet.sqlQuery(
      `SELECT * FROM sylvias_stock_check_items WHERE check_id = ${checkId} ORDER BY location ASC, description ASC`
    );
    setCheckItems(items as unknown as StockCheckItem[]);
    setTab('active');
  };

  /* ── Mark item found ── */
  const markFound = async (item: StockCheckItem) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await window.tasklet.sqlExec(
      `UPDATE sylvias_stock_check_items SET status='found', actual_qty=${item.expected_qty}, checked_by='${esc(currentUser.name)}', checked_at='${now}' WHERE id=${item.id}`
    );
    await refreshCheckItems();
  };

  /* ── Mark item missing ── */
  const markMissing = async (item: StockCheckItem) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await window.tasklet.sqlExec(
      `UPDATE sylvias_stock_check_items SET status='missing', actual_qty=0, checked_by='${esc(currentUser.name)}', checked_at='${now}' WHERE id=${item.id}`
    );
    await refreshCheckItems();
  };

  /* ── Mark discrepancy (wrong qty) ── */
  const markDiscrepancy = async (item: StockCheckItem, actualQty: number) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const status = actualQty === 0 ? 'missing' : 'discrepancy';
    await window.tasklet.sqlExec(
      `UPDATE sylvias_stock_check_items SET status='${status}', actual_qty=${actualQty}, checked_by='${esc(currentUser.name)}', checked_at='${now}' WHERE id=${item.id}`
    );
    await refreshCheckItems();
  };

  /* ── Update notes on an item ── */
  const updateItemNotes = async (itemId: number, notes: string) => {
    await window.tasklet.sqlExec(
      `UPDATE sylvias_stock_check_items SET notes='${esc(notes)}' WHERE id=${itemId}`
    );
  };

  /* ── Update resolution on missing item ── */
  const updateResolution = async (itemId: number, resolution: string) => {
    await window.tasklet.sqlExec(
      `UPDATE sylvias_stock_check_items SET resolution='${esc(resolution)}' WHERE id=${itemId}`
    );
    await refreshCheckItems();
  };

  /* ── Sign off missing item ── */
  const signOffItem = async (item: StockCheckItem) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await window.tasklet.sqlExec(
      `UPDATE sylvias_stock_check_items SET signoff_by='${esc(currentUser.name)}', signoff_at='${now}' WHERE id=${item.id}`
    );
    if (item.resolution === 'written_off') {
      // Update stock qty to 0
      await window.tasklet.sqlExec(
        `UPDATE sylvias_stock SET qty = 0 WHERE id = ${item.stock_id}`
      );
    }
    await refreshCheckItems();
  };

  /* ── Refresh check items ── */
  const refreshCheckItems = async () => {
    if (!currentCheck) return;
    const items = await window.tasklet.sqlQuery(
      `SELECT * FROM sylvias_stock_check_items WHERE check_id = ${currentCheck.id} ORDER BY location ASC, description ASC`
    );
    setCheckItems(items as unknown as StockCheckItem[]);
  };

  /* ── Complete check session ── */
  const completeCheck = async () => {
    if (!currentCheck) return;
    const pending = checkItems.filter(i => i.status === 'pending');
    if (pending.length > 0) {
      setMsg(`${pending.length} item(s) still unchecked. Please check all items before completing.`);
      return;
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const found = checkItems.filter(i => i.status === 'found').length;
    const missing = checkItems.filter(i => i.status === 'missing' || i.status === 'discrepancy').length;

    await window.tasklet.sqlExec(
      `UPDATE sylvias_stock_checks SET status='completed', completed_at='${now}', found_count=${found}, missing_count=${missing} WHERE id=${currentCheck.id}`
    );

    setCurrentCheck(null);
    setCheckItems([]);
    setMsg('Stock check completed! ✅');
    await loadChecks();
    setTab('history');
  };

  /* ── Year summary stats ── */
  const [summaryStats, setSummaryStats] = useState<{
    totalChecks: number; totalItems: number; totalFound: number; totalMissing: number;
    positionChecks: number; spotChecks: number; resolvedMissing: number; signedOff: number;
  } | null>(null);

  const loadSummary = useCallback(async () => {
    const yr = yearFilter;
    const checks = await window.tasklet.sqlQuery(
      `SELECT * FROM sylvias_stock_checks WHERE status='completed' AND started_at LIKE '${yr}%'`
    );
    const allChecks = checks as unknown as StockCheckSession[];
    const totalChecks = allChecks.length;
    const totalItems = allChecks.reduce((s, c) => s + c.total_items, 0);
    const totalFound = allChecks.reduce((s, c) => s + c.found_count, 0);
    const totalMissing = allChecks.reduce((s, c) => s + c.missing_count, 0);
    const positionChecks = allChecks.filter(c => c.check_type === 'position').length;
    const spotChecks = allChecks.filter(c => c.check_type === 'spot').length;

    // Count resolved and signed-off missing items
    let resolvedMissing = 0;
    let signedOff = 0;
    if (totalChecks > 0) {
      const checkIds = allChecks.map(c => c.id).join(',');
      const missingItems = await window.tasklet.sqlQuery(
        `SELECT * FROM sylvias_stock_check_items WHERE check_id IN (${checkIds}) AND (status='missing' OR status='discrepancy')`
      );
      const mi = missingItems as unknown as StockCheckItem[];
      resolvedMissing = mi.filter(i => i.resolution !== '').length;
      signedOff = mi.filter(i => i.signoff_by !== '').length;
    }

    setSummaryStats({ totalChecks, totalItems, totalFound, totalMissing, positionChecks, spotChecks, resolvedMissing, signedOff });
  }, [yearFilter]);

  useEffect(() => {
    if (tab === 'summary') loadSummary();
  }, [tab, loadSummary]);

  /* ── Format date ── */
  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };
  const fmtDateTime = (d: string) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
        dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  const RESOLUTIONS = [
    { value: '', label: 'Select resolution...' },
    { value: 'sold_not_recorded', label: 'Sold but not recorded' },
    { value: 'moved', label: 'Moved to different location' },
    { value: 'missing', label: 'Genuinely missing' },
    { value: 'written_off', label: 'Write off (update stock to 0)' },
    { value: 'found_later', label: 'Found later / miscount' },
  ];

  const pendingCount = checkItems.filter(i => i.status === 'pending').length;
  const foundCount = checkItems.filter(i => i.status === 'found').length;
  const missingCount = checkItems.filter(i => i.status === 'missing' || i.status === 'discrepancy').length;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <ClipboardCheck size={28} className="text-primary" />
        <h1 className="text-2xl font-bold text-primary">Stock Check</h1>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed bg-base-200 inline-flex">
        {(['new', 'active', 'history', 'summary'] as const).map(t => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`}
            onClick={() => { setTab(t); setMsg(''); }}>
            {t === 'new' ? '➕ New Check' : t === 'active' ? `📋 Active${activeChecks.length > 0 || currentCheck ? ` (${activeChecks.length})` : ''}` : t === 'history' ? '📜 History' : '📊 Year Summary'}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`alert ${msg.includes('Error') ? 'alert-error' : msg.includes('✅') ? 'alert-success' : 'alert-warning'} text-sm`}>
          {msg}
          <button className="btn btn-ghost btn-xs" onClick={() => setMsg('')}>✕</button>
        </div>
      )}

      {confirmAction && (
        <div className="alert alert-warning shadow-lg">
          <AlertTriangle size={20} />
          <span>{confirmAction.text}</span>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-warning" onClick={() => { confirmAction.onYes(); setConfirmAction(null); }}>Yes</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirmAction(null)}>No</button>
          </div>
        </div>
      )}

      {/* ═══ NEW CHECK TAB ═══ */}
      {tab === 'new' && !currentCheck && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Position Check */}
          <div className="card bg-base-100 shadow-lg border-2 border-blue-200">
            <div className="card-body">
              <h2 className="card-title text-blue-600"><MapPin size={22} /> Position Check</h2>
              <p className="text-sm text-base-content/60">Check all items at a specific location</p>
              <div className="form-control mt-3">
                <label className="label"><span className="label-text font-semibold">Location</span></label>
                <select className="select select-bordered" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
                  <option value="">Choose a location...</option>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <button className="btn btn-primary mt-4" onClick={startPositionCheck} disabled={loading || !selectedLocation}>
                <MapPin size={18} /> Start Position Check
              </button>
            </div>
          </div>

          {/* Spot Check */}
          <div className="card bg-base-100 shadow-lg border-2 border-emerald-200">
            <div className="card-body">
              <h2 className="card-title text-emerald-600"><Shuffle size={22} /> Daily Spot Check</h2>
              <p className="text-sm text-base-content/60">System picks random items to verify</p>
              <div className="form-control mt-3">
                <label className="label"><span className="label-text font-semibold">Number of items</span></label>
                <input type="number" className="input input-bordered w-32" value={spotCount}
                  onChange={e => setSpotCount(e.target.value)} min="1" max="50" />
              </div>
              <button className="btn btn-success mt-4" onClick={startSpotCheck} disabled={loading}>
                <Shuffle size={18} /> Start Spot Check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ACTIVE CHECK — item list ═══ */}
      {tab === 'active' && currentCheck && (
        <div className="space-y-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="badge badge-lg badge-primary">{currentCheck.check_type === 'position' ? '📍 Position' : '🎲 Spot'} Check #{currentCheck.id}</span>
                {currentCheck.location_filter && <span className="badge badge-outline">{currentCheck.location_filter}</span>}
                <span className="text-sm text-base-content/60">Started by {currentCheck.started_by} · {fmtDateTime(currentCheck.started_at)}</span>
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-3 mt-3">
                <progress className="progress progress-primary flex-1" value={foundCount + missingCount} max={checkItems.length}></progress>
                <span className="text-sm font-mono">{foundCount + missingCount}/{checkItems.length}</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-sm">
                <span className="text-success font-semibold">✅ Found: {foundCount}</span>
                <span className="text-error font-semibold">❌ Missing: {missingCount}</span>
                <span className="text-warning font-semibold">⏳ Pending: {pendingCount}</span>
              </div>
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-2">
            {checkItems.map(item => (
              <div key={item.id} className={`card bg-base-100 shadow-sm border-l-4 ${
                item.status === 'found' ? 'border-l-success' :
                item.status === 'missing' || item.status === 'discrepancy' ? 'border-l-error' :
                'border-l-warning'
              }`}>
                <div className="card-body p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{item.description}</div>
                      <div className="text-xs text-base-content/50 flex flex-wrap gap-2 mt-1">
                        {item.part_number && <span>#{item.part_number}</span>}
                        <span>📍 {item.location || 'No location'}</span>
                        <span>Expected qty: <strong>{item.expected_qty}</strong></span>
                        {item.status !== 'pending' && <span>Actual qty: <strong className={item.actual_qty < item.expected_qty ? 'text-error' : 'text-success'}>{item.actual_qty}</strong></span>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {item.status === 'pending' ? (
                      <div className="flex gap-2 flex-shrink-0">
                        <button className="btn btn-success btn-sm gap-1" onClick={() => markFound(item)}>
                          <Check size={16} /> Found
                        </button>
                        <button className="btn btn-error btn-sm gap-1" onClick={() => markMissing(item)}>
                          <X size={16} /> Missing
                        </button>
                        <button className="btn btn-warning btn-sm btn-outline gap-1" onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}>
                          <Pencil size={14} /> Qty
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`badge ${item.status === 'found' ? 'badge-success' : 'badge-error'}`}>
                          {item.status === 'found' ? '✅ Found' : item.status === 'discrepancy' ? '⚠️ Discrepancy' : '❌ Missing'}
                        </span>
                        {item.signoff_by && <span className="badge badge-outline badge-sm">Signed: {item.signoff_by}</span>}
                        <button className="btn btn-ghost btn-xs" onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}>
                          {expandedItem === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded detail for qty entry or missing item resolution */}
                  {expandedItem === item.id && (
                    <div className="mt-3 pt-3 border-t border-base-300 space-y-3">
                      {item.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-semibold">Actual quantity:</label>
                          <input type="number" className="input input-bordered input-sm w-24"
                            defaultValue={item.expected_qty} min="0"
                            id={`qty-${item.id}`}
                          />
                          <button className="btn btn-sm btn-primary" onClick={() => {
                            const el = document.getElementById(`qty-${item.id}`) as HTMLInputElement;
                            const qty = parseInt(el.value) || 0;
                            markDiscrepancy(item, qty);
                            setExpandedItem(null);
                          }}>Save</button>
                        </div>
                      )}

                      {(item.status === 'missing' || item.status === 'discrepancy') && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold">Resolution:</label>
                            <select className="select select-bordered select-sm"
                              value={item.resolution}
                              onChange={e => updateResolution(item.id, e.target.value)}>
                              {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold">Notes:</label>
                            <input type="text" className="input input-bordered input-sm flex-1"
                              defaultValue={item.notes}
                              onBlur={e => updateItemNotes(item.id, e.target.value)}
                              placeholder="Investigation notes..."
                            />
                          </div>
                          {!item.signoff_by && item.resolution && (
                            <button className="btn btn-warning btn-sm gap-1" onClick={() => signOffItem(item)}>
                              <FileText size={14} /> Sign Off ({currentUser.initials})
                            </button>
                          )}
                          {item.signoff_by && (
                            <div className="text-sm text-success">
                              ✅ Signed off by {item.signoff_by} on {fmtDateTime(item.signoff_at)}
                            </div>
                          )}
                        </div>
                      )}

                      {item.status === 'found' && (
                        <div className="text-sm text-base-content/60">
                          Checked by {item.checked_by} on {fmtDateTime(item.checked_at)}
                          <button className="btn btn-ghost btn-xs ml-2" onClick={() => {
                            // Allow re-checking
                            window.tasklet.sqlExec(`UPDATE sylvias_stock_check_items SET status='pending', actual_qty=-1, checked_by='', checked_at='' WHERE id=${item.id}`);
                            refreshCheckItems();
                          }}>
                            <RotateCcw size={12} /> Re-check
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Complete button */}
          <div className="flex gap-3 justify-end">
            <button className="btn btn-ghost" onClick={() => { setCurrentCheck(null); setTab('active'); }}>
              ← Back
            </button>
            <button className="btn btn-primary" disabled={pendingCount > 0}
              onClick={() => setConfirmAction({ text: 'Complete this stock check? All items have been checked.', onYes: completeCheck })}>
              <CheckCircle2 size={18} /> Complete Check
            </button>
          </div>
        </div>
      )}

      {/* ═══ ACTIVE TAB — list of in-progress checks ═══ */}
      {tab === 'active' && !currentCheck && (
        <div className="space-y-3">
          {activeChecks.length === 0 ? (
            <div className="text-center py-10 text-base-content/50">
              <ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" />
              <p>No active stock checks</p>
              <button className="btn btn-primary btn-sm mt-3" onClick={() => setTab('new')}>Start a New Check</button>
            </div>
          ) : (
            activeChecks.map(c => (
              <div key={c.id} className="card bg-base-100 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => openCheck(c.id)}>
                <div className="card-body p-4 flex-row items-center gap-4">
                  <span className="text-2xl">{c.check_type === 'position' ? '📍' : '🎲'}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{c.check_type === 'position' ? 'Position' : 'Spot'} Check #{c.id}</div>
                    <div className="text-xs text-base-content/50">{c.location_filter} · {c.total_items} items · {fmtDateTime(c.started_at)}</div>
                  </div>
                  <span className="badge badge-warning">In Progress</span>
                  <Eye size={18} className="text-base-content/40" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Search size={16} />
            <input type="text" className="input input-bordered input-sm w-48" placeholder="Search..."
              value={searchHistory} onChange={e => setSearchHistory(e.target.value)} />
          </div>
          {completedChecks.length === 0 ? (
            <div className="text-center py-10 text-base-content/50">No completed checks yet</div>
          ) : (
            completedChecks
              .filter(c => !searchHistory || c.location_filter.toLowerCase().includes(searchHistory.toLowerCase()) || c.started_by.toLowerCase().includes(searchHistory.toLowerCase()))
              .map(c => (
                <div key={c.id} className="card bg-base-100 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                  onClick={() => openCheck(c.id)}>
                  <div className="card-body p-4 flex-row items-center gap-4">
                    <span className="text-2xl">{c.check_type === 'position' ? '📍' : '🎲'}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{c.check_type === 'position' ? 'Position' : 'Spot'} Check #{c.id}</div>
                      <div className="text-xs text-base-content/50">{c.location_filter} · By {c.started_by} · {fmtDate(c.started_at)}</div>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="text-success font-semibold">✅ {c.found_count}</span>
                      <span className="text-error font-semibold">❌ {c.missing_count}</span>
                    </div>
                    <span className="badge badge-success">Completed</span>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ═══ YEAR SUMMARY TAB ═══ */}
      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="font-semibold">Year:</label>
            <select className="select select-bordered select-sm" value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {summaryStats && (
            <div className="space-y-4">
              {/* Big stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card bg-primary text-primary-content shadow">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold">{summaryStats.totalChecks}</div>
                    <div className="text-sm opacity-80">Total Checks</div>
                  </div>
                </div>
                <div className="card bg-info text-info-content shadow">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold">{summaryStats.totalItems}</div>
                    <div className="text-sm opacity-80">Items Verified</div>
                  </div>
                </div>
                <div className="card bg-success text-success-content shadow">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold">{summaryStats.totalFound}</div>
                    <div className="text-sm opacity-80">Found ✅</div>
                  </div>
                </div>
                <div className="card bg-error text-error-content shadow">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold">{summaryStats.totalMissing}</div>
                    <div className="text-sm opacity-80">Discrepancies</div>
                  </div>
                </div>
              </div>

              {/* Detail breakdown */}
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h3 className="card-title text-lg">📊 {yearFilter} Stock Check Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <tbody>
                        <tr><td className="font-semibold">Position Checks</td><td>{summaryStats.positionChecks}</td></tr>
                        <tr><td className="font-semibold">Spot Checks</td><td>{summaryStats.spotChecks}</td></tr>
                        <tr><td className="font-semibold">Total Items Checked</td><td>{summaryStats.totalItems}</td></tr>
                        <tr><td className="font-semibold">Items Confirmed Present</td><td className="text-success">{summaryStats.totalFound}</td></tr>
                        <tr><td className="font-semibold">Discrepancies Found</td><td className="text-error">{summaryStats.totalMissing}</td></tr>
                        <tr><td className="font-semibold">Discrepancies Resolved</td><td>{summaryStats.resolvedMissing} / {summaryStats.totalMissing}</td></tr>
                        <tr><td className="font-semibold">Discrepancies Signed Off</td><td>{summaryStats.signedOff} / {summaryStats.totalMissing}</td></tr>
                        <tr>
                          <td className="font-semibold">Accuracy Rate</td>
                          <td className="font-bold text-lg">
                            {summaryStats.totalItems > 0 ? ((summaryStats.totalFound / summaryStats.totalItems) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 p-3 bg-base-200 rounded-lg text-sm text-base-content/70">
                    <strong>Audit Statement:</strong> In {yearFilter}, {summaryStats.totalChecks} stock check{summaryStats.totalChecks !== 1 ? 's were' : ' was'} performed
                    covering {summaryStats.totalItems} item{summaryStats.totalItems !== 1 ? 's' : ''}.
                    {summaryStats.totalMissing > 0
                      ? ` ${summaryStats.totalMissing} discrepanc${summaryStats.totalMissing !== 1 ? 'ies were' : 'y was'} identified, of which ${summaryStats.signedOff} ${summaryStats.signedOff !== 1 ? 'have' : 'has'} been signed off.`
                      : ' No discrepancies were identified.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
