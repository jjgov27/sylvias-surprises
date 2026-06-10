import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser, StockItem } from '../types';
import {
  ClipboardCheck, MapPin, Shuffle, Check, AlertTriangle,
  Calendar, FileText, Search, Eye, Printer, CheckCircle2, Download,
} from 'lucide-react';

/* ── Types ── */
interface StockCheckSession {
  id: number;
  check_number: string; // SC-001
  check_type: string; // 'position' | 'spot'
  location_filter: string;
  started_by: string;
  started_at: string;
  completed_at: string;
  status: string; // 'pending_check' | 'in_progress' | 'completed_ok' | 'completed_discrepancy'
  total_items: number;
  found_count: number;
  missing_count: number;
  signed_by: string;
  signed_at: string;
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
  checked: number; // 0 = not yet checked off, 1 = confirmed present
  notes: string;
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
  const [signName, setSignName] = useState('');
  const [searchHistory, setSearchHistory] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [pdfLoading, setPdfLoading] = useState(false);

  /* ── Init tables (updated schema) ── */
  const ensureTables = useCallback(async () => {
    await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS sylvias_stock_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_number TEXT NOT NULL DEFAULT '',
      check_type TEXT NOT NULL DEFAULT 'spot',
      location_filter TEXT NOT NULL DEFAULT '',
      started_by TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_check',
      total_items INTEGER NOT NULL DEFAULT 0,
      found_count INTEGER NOT NULL DEFAULT 0,
      missing_count INTEGER NOT NULL DEFAULT 0,
      signed_by TEXT NOT NULL DEFAULT '',
      signed_at TEXT NOT NULL DEFAULT '',
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
      checked INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    )`);
    // Add columns if upgrading from old schema
    try { await window.tasklet.sqlExec("ALTER TABLE sylvias_stock_checks ADD COLUMN check_number TEXT NOT NULL DEFAULT ''"); } catch {}
    try { await window.tasklet.sqlExec("ALTER TABLE sylvias_stock_checks ADD COLUMN signed_by TEXT NOT NULL DEFAULT ''"); } catch {}
    try { await window.tasklet.sqlExec("ALTER TABLE sylvias_stock_checks ADD COLUMN signed_at TEXT NOT NULL DEFAULT ''"); } catch {}
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
      "SELECT * FROM sylvias_stock_checks WHERE status IN ('pending_check','in_progress') ORDER BY started_at DESC"
    );
    setActiveChecks(active as unknown as StockCheckSession[]);
    const completed = await window.tasklet.sqlQuery(
      "SELECT * FROM sylvias_stock_checks WHERE status IN ('completed_ok','completed_discrepancy') ORDER BY completed_at DESC LIMIT 100"
    );
    setCompletedChecks(completed as unknown as StockCheckSession[]);
  }, []);

  useEffect(() => {
    ensureTables().then(() => {
      loadLocations();
      loadChecks();
    });
  }, [ensureTables, loadLocations, loadChecks]);

  /* ── Generate next check number ── */
  const nextCheckNumber = async (): Promise<string> => {
    const rows = await window.tasklet.sqlQuery(
      "SELECT check_number FROM sylvias_stock_checks ORDER BY id DESC LIMIT 1"
    );
    if (rows.length === 0) return 'SC-001';
    const last = String(rows[0].check_number || '');
    const match = last.match(/SC-(\d+)/);
    if (!match) return 'SC-001';
    const next = parseInt(match[1]) + 1;
    return 'SC-' + String(next).padStart(3, '0');
  };

  /* ── Start Position Check ── */
  const startPositionCheck = async () => {
    if (!selectedLocation) { setMsg('Please select a location'); return; }
    setLoading(true);
    try {
      const items = await window.tasklet.sqlQuery(
        `SELECT * FROM sylvias_stock WHERE location = '${esc(selectedLocation)}' AND qty > 0 ORDER BY description ASC`
      );
      if (items.length === 0) { setMsg('No in-stock items at that location'); setLoading(false); return; }

      const checkNum = await nextCheckNumber();
      await window.tasklet.sqlExec(
        `INSERT INTO sylvias_stock_checks (check_number, check_type, location_filter, started_by, total_items, status)
         VALUES ('${esc(checkNum)}', 'position', '${esc(selectedLocation)}', '${esc(currentUser.name)}', ${items.length}, 'pending_check')`
      );
      const idRows = await window.tasklet.sqlQuery("SELECT id FROM sylvias_stock_checks ORDER BY id DESC LIMIT 1");
      const checkId = Number(idRows[0].id);

      for (const item of items as unknown as StockItem[]) {
        await window.tasklet.sqlExec(
          `INSERT INTO sylvias_stock_check_items (check_id, stock_id, part_number, description, location, expected_qty)
           VALUES (${checkId}, ${item.id}, '${esc(item.part_number)}', '${esc(item.description)}', '${esc(item.location)}', ${item.qty})`
        );
      }

      await loadChecks();
      await openCheck(checkId);
      setMsg('✅ Check created! Print the checklist, then come back to verify.');
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

      const checkNum = await nextCheckNumber();
      await window.tasklet.sqlExec(
        `INSERT INTO sylvias_stock_checks (check_number, check_type, location_filter, started_by, total_items, status)
         VALUES ('${esc(checkNum)}', 'spot', 'Random ${count}', '${esc(currentUser.name)}', ${items.length}, 'pending_check')`
      );
      const idRows = await window.tasklet.sqlQuery("SELECT id FROM sylvias_stock_checks ORDER BY id DESC LIMIT 1");
      const checkId = Number(idRows[0].id);

      for (const item of items as unknown as StockItem[]) {
        await window.tasklet.sqlExec(
          `INSERT INTO sylvias_stock_check_items (check_id, stock_id, part_number, description, location, expected_qty)
           VALUES (${checkId}, ${item.id}, '${esc(item.part_number)}', '${esc(item.description)}', '${esc(item.location)}', ${item.qty})`
        );
      }

      await loadChecks();
      await openCheck(checkId);
      setMsg('✅ Check created! Print the checklist, then come back to verify.');
    } catch (e: any) { setMsg('Error: ' + e.message); }
    setLoading(false);
  };

  /* ── Open a check session ── */
  const openCheck = async (checkId: number) => {
    const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_stock_checks WHERE id = ${checkId}`);
    if (rows.length === 0) return;
    setCurrentCheck(rows[0] as unknown as StockCheckSession);
    const items = await window.tasklet.sqlQuery(
      `SELECT * FROM sylvias_stock_check_items WHERE check_id = ${checkId} ORDER BY location ASC, description ASC`
    );
    setCheckItems(items as unknown as StockCheckItem[]);
    setTab('active');
    setSignName('');
    setMsg('');
  };

  /* ── Toggle item checked ── */
  const toggleChecked = async (item: StockCheckItem) => {
    if (currentCheck && (currentCheck.status === 'completed_ok' || currentCheck.status === 'completed_discrepancy')) return;
    const newVal = item.checked ? 0 : 1;
    await window.tasklet.sqlExec(`UPDATE sylvias_stock_check_items SET checked = ${newVal} WHERE id = ${item.id}`);
    // Mark check as in_progress if it was pending_check
    if (currentCheck && currentCheck.status === 'pending_check') {
      await window.tasklet.sqlExec(`UPDATE sylvias_stock_checks SET status = 'in_progress' WHERE id = ${currentCheck.id}`);
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
    // Re-read the check session too
    const rows = await window.tasklet.sqlQuery(`SELECT * FROM sylvias_stock_checks WHERE id = ${currentCheck.id}`);
    if (rows.length > 0) setCurrentCheck(rows[0] as unknown as StockCheckSession);
  };

  /* ── Submit / complete the check ── */
  const submitCheck = async () => {
    if (!currentCheck) return;
    const checkedCount = checkItems.filter(i => i.checked).length;
    const missingItems = checkItems.filter(i => !i.checked);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (missingItems.length > 0) {
      // Has discrepancies — require signature
      if (!signName.trim()) {
        setMsg('Please enter your name to sign off on discrepancies');
        return;
      }
      await window.tasklet.sqlExec(
        `UPDATE sylvias_stock_checks SET
          status = 'completed_discrepancy',
          completed_at = '${now}',
          found_count = ${checkedCount},
          missing_count = ${missingItems.length},
          signed_by = '${esc(signName.trim())}',
          signed_at = '${now}'
        WHERE id = ${currentCheck.id}`
      );
    } else {
      // All items present
      await window.tasklet.sqlExec(
        `UPDATE sylvias_stock_checks SET
          status = 'completed_ok',
          completed_at = '${now}',
          found_count = ${checkedCount},
          missing_count = 0
        WHERE id = ${currentCheck.id}`
      );
    }

    setCurrentCheck(null);
    setCheckItems([]);
    setMsg(missingItems.length > 0
      ? `⚠️ Check submitted with ${missingItems.length} discrepanc${missingItems.length > 1 ? 'ies' : 'y'} — signed by ${signName.trim()}`
      : '✅ Stock check completed — all items present!');
    await loadChecks();
    setTab('history');
  };

  /* ── Print checklist PDF ── */
  const printChecklist = async (check: StockCheckSession, items: StockCheckItem[]) => {
    setPdfLoading(true);
    try {
      const pythonScript = `
import json, sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

check = json.loads(sys.argv[1])
items = json.loads(sys.argv[2])

doc = SimpleDocTemplate('/tmp/stockcheck.pdf', pagesize=A4,
    topMargin=15*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)
styles = getSampleStyleSheet()
title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=16, spaceAfter=4*mm)
sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, textColor=colors.grey)
header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=9, textColor=colors.white)
cell_style = ParagraphStyle('Cell', parent=styles['Normal'], fontSize=9)
small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, textColor=colors.grey)

story = []
story.append(Paragraph("Sylvia's Surprises — Stock Check", title_style))
story.append(Paragraph(f"Check {check['check_number']} — {'Position Check: ' + check['location_filter'] if check['check_type'] == 'position' else 'Spot Check (' + check['location_filter'] + ')'}", sub_style))
story.append(Paragraph(f"Created by {check['started_by']} — {check['started_at'][:16]}", sub_style))
story.append(Paragraph(f"Total items: {len(items)}", sub_style))
story.append(Spacer(1, 6*mm))

# Table
data = [['✓', 'Item', 'Part No.', 'Location', 'Exp Qty', 'Notes']]
for item in items:
    data.append([
        '☐',
        Paragraph(item['description'][:60], cell_style),
        item['part_number'] or '—',
        item['location'] or '—',
        str(item['expected_qty']),
        ''
    ])

col_widths = [8*mm, 75*mm, 25*mm, 30*mm, 15*mm, 30*mm]
t = Table(data, colWidths=col_widths, repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4338ca')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTSIZE', (0, 0), (-1, 0), 9),
    ('FONTSIZE', (0, 1), (-1, -1), 9),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ('ALIGN', (0, 0), (0, -1), 'CENTER'),
    ('ALIGN', (4, 0), (4, -1), 'CENTER'),
]))
story.append(t)

story.append(Spacer(1, 10*mm))
story.append(Paragraph("Checked by: ____________________    Date: _______________    Signature: ____________________", sub_style))
story.append(Spacer(1, 5*mm))
story.append(Paragraph("All items present?  YES  /  NO      If NO — list discrepancies overleaf and submit on screen.", small_style))

doc.build(story)
print('OK')
`;

      const checkJson = JSON.stringify({
        check_number: check.check_number,
        check_type: check.check_type,
        location_filter: check.location_filter,
        started_by: check.started_by,
        started_at: check.started_at,
      });
      const itemsJson = JSON.stringify(items.map(i => ({
        description: i.description,
        part_number: i.part_number,
        location: i.location,
        expected_qty: i.expected_qty,
      })));

      // Write script and data to /tmp
      await window.tasklet.runCommand(`cat > /tmp/sc_print.py << 'PYEOF'
${pythonScript}
PYEOF`);
      await window.tasklet.runCommand(`cat > /tmp/sc_check.json << 'JEOF'
${checkJson}
JEOF`);
      await window.tasklet.runCommand(`cat > /tmp/sc_items.json << 'JEOF'
${itemsJson}
JEOF`);

      const result = await window.tasklet.runCommand(
        `cd /tmp && python3 sc_print.py "$(cat sc_check.json)" "$(cat sc_items.json)" 2>&1`
      );

      if (result.log.includes('OK')) {
        // Read PDF as base64 and download
        const b64Result = await window.tasklet.runCommand('base64 -w0 /tmp/stockcheck.pdf');
        const b64 = b64Result.log.trim();
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `StockCheck-${check.check_number}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setMsg('✅ Checklist PDF downloaded — print it and go check!');
      } else {
        setMsg('Error generating PDF: ' + result.log);
      }
    } catch (e: any) { setMsg('Error: ' + e.message); }
    setPdfLoading(false);
  };

  /* ── Print discrepancy report ── */
  const printDiscrepancyReport = async (check: StockCheckSession) => {
    setPdfLoading(true);
    try {
      const items = await window.tasklet.sqlQuery(
        `SELECT * FROM sylvias_stock_check_items WHERE check_id = ${check.id} ORDER BY location ASC, description ASC`
      );
      const allItems = items as unknown as StockCheckItem[];
      const missingItems = allItems.filter(i => !i.checked);

      const pythonScript = `
import json, sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

check = json.loads(sys.argv[1])
items = json.loads(sys.argv[2])

doc = SimpleDocTemplate('/tmp/discrepancy.pdf', pagesize=A4,
    topMargin=15*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)
styles = getSampleStyleSheet()
title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=16, spaceAfter=4*mm)
sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, textColor=colors.grey)
cell_style = ParagraphStyle('Cell', parent=styles['Normal'], fontSize=9)
red_style = ParagraphStyle('Red', parent=styles['Title'], fontSize=14, textColor=colors.red, spaceAfter=4*mm)

story = []
story.append(Paragraph("Sylvia's Surprises — Discrepancy Report", title_style))
story.append(Paragraph(f"Check {check['check_number']} — {'Position Check: ' + check['location_filter'] if check['check_type'] == 'position' else 'Spot Check'}", sub_style))
story.append(Paragraph(f"Completed: {check['completed_at'][:16]}    Signed by: {check['signed_by']}", sub_style))
story.append(Paragraph(f"Total items checked: {check['total_items']}    Found: {check['found_count']}    Missing: {check['missing_count']}", sub_style))
story.append(Spacer(1, 6*mm))
story.append(Paragraph(f"MISSING / NOT FOUND ({len(items)} item{'s' if len(items) != 1 else ''})", red_style))

data = [['Item', 'Part No.', 'Location', 'Expected Qty']]
for item in items:
    data.append([
        Paragraph(item['description'][:60], cell_style),
        item['part_number'] or chr(8212),
        item['location'] or chr(8212),
        str(item['expected_qty']),
    ])

col_widths = [80*mm, 25*mm, 35*mm, 20*mm]
t = Table(data, colWidths=col_widths, repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTSIZE', (0, 0), (-1, 0), 9),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fef2f2')]),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ('ALIGN', (3, 0), (3, -1), 'CENTER'),
]))
story.append(t)

story.append(Spacer(1, 10*mm))
story.append(Paragraph(f"Signed: {check['signed_by']}    Date: {check['signed_at'][:10] if check['signed_at'] else ''}", sub_style))

doc.build(story)
print('OK')
`;

      const checkJson = JSON.stringify({
        check_number: check.check_number || 'SC-???',
        check_type: check.check_type,
        location_filter: check.location_filter,
        completed_at: check.completed_at,
        signed_by: check.signed_by,
        signed_at: check.signed_at,
        total_items: check.total_items,
        found_count: check.found_count,
        missing_count: check.missing_count,
      });
      const itemsJson = JSON.stringify(missingItems.map(i => ({
        description: i.description,
        part_number: i.part_number,
        location: i.location,
        expected_qty: i.expected_qty,
      })));

      await window.tasklet.runCommand(`cat > /tmp/sc_disc.py << 'PYEOF'
${pythonScript}
PYEOF`);
      await window.tasklet.runCommand(`cat > /tmp/sc_disc_check.json << 'JEOF'
${checkJson}
JEOF`);
      await window.tasklet.runCommand(`cat > /tmp/sc_disc_items.json << 'JEOF'
${itemsJson}
JEOF`);

      const result = await window.tasklet.runCommand(
        `cd /tmp && python3 sc_disc.py "$(cat sc_disc_check.json)" "$(cat sc_disc_items.json)" 2>&1`
      );

      if (result.log.includes('OK')) {
        const b64Result = await window.tasklet.runCommand('base64 -w0 /tmp/discrepancy.pdf');
        const b64 = b64Result.log.trim();
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Discrepancy-${check.check_number}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setMsg('Error generating PDF: ' + result.log);
      }
    } catch (e: any) { setMsg('Error: ' + e.message); }
    setPdfLoading(false);
  };

  /* ── Year summary stats ── */
  const [summaryStats, setSummaryStats] = useState<{
    totalChecks: number; totalItems: number; totalFound: number; totalMissing: number;
    positionChecks: number; spotChecks: number; okChecks: number; discrepancyChecks: number;
  } | null>(null);

  const loadSummary = useCallback(async () => {
    const yr = yearFilter;
    const checks = await window.tasklet.sqlQuery(
      `SELECT * FROM sylvias_stock_checks WHERE status IN ('completed_ok','completed_discrepancy') AND started_at LIKE '${yr}%'`
    );
    const allChecks = checks as unknown as StockCheckSession[];
    setSummaryStats({
      totalChecks: allChecks.length,
      totalItems: allChecks.reduce((s, c) => s + c.total_items, 0),
      totalFound: allChecks.reduce((s, c) => s + c.found_count, 0),
      totalMissing: allChecks.reduce((s, c) => s + c.missing_count, 0),
      positionChecks: allChecks.filter(c => c.check_type === 'position').length,
      spotChecks: allChecks.filter(c => c.check_type === 'spot').length,
      okChecks: allChecks.filter(c => c.status === 'completed_ok').length,
      discrepancyChecks: allChecks.filter(c => c.status === 'completed_discrepancy').length,
    });
  }, [yearFilter]);

  useEffect(() => {
    if (tab === 'summary') loadSummary();
  }, [tab, loadSummary]);

  /* ── Format helpers ── */
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

  const checkedCount = checkItems.filter(i => i.checked).length;
  const uncheckedCount = checkItems.filter(i => !i.checked).length;
  const isCompleted = currentCheck && (currentCheck.status === 'completed_ok' || currentCheck.status === 'completed_discrepancy');

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
            onClick={() => { setTab(t); setCurrentCheck(null); setMsg(''); }}>
            {t === 'new' ? '➕ New Check' : t === 'active' ? `📋 Open${activeChecks.length > 0 ? ` (${activeChecks.length})` : ''}` : t === 'history' ? '📜 History' : '📊 Year Summary'}
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
      {tab === 'new' && (
        <div className="space-y-6">
          <div className="alert alert-info text-sm">
            <FileText size={18} />
            <div>
              <strong>How Stock Check works:</strong><br />
              1. Create a check → 2. Print the checklist → 3. Go check items in the shop →
              4. Come back & open the check → 5. Tick off items found → 6. Submit
            </div>
          </div>

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
                  <MapPin size={18} /> Create Position Check
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
                  <Shuffle size={18} /> Create Spot Check
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ACTIVE TAB — check detail (verify items) ═══ */}
      {tab === 'active' && currentCheck && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="badge badge-lg badge-primary font-mono">{currentCheck.check_number}</span>
                <span className="badge badge-lg badge-outline">
                  {currentCheck.check_type === 'position' ? '📍 Position' : '🎲 Spot'} Check
                </span>
                {currentCheck.location_filter && <span className="badge badge-outline">{currentCheck.location_filter}</span>}
                <span className={`badge ${
                  currentCheck.status === 'completed_ok' ? 'badge-success' :
                  currentCheck.status === 'completed_discrepancy' ? 'badge-error' :
                  currentCheck.status === 'in_progress' ? 'badge-warning' : 'badge-info'
                }`}>
                  {currentCheck.status === 'completed_ok' ? '✅ All Present' :
                   currentCheck.status === 'completed_discrepancy' ? '⚠️ Discrepancies' :
                   currentCheck.status === 'in_progress' ? 'Verifying...' : 'Awaiting Check'}
                </span>
              </div>
              <div className="text-sm text-base-content/60 mt-1">
                Created by {currentCheck.started_by} · {fmtDateTime(currentCheck.started_at)}
                {currentCheck.completed_at && <> · Completed {fmtDateTime(currentCheck.completed_at)}</>}
                {currentCheck.signed_by && <> · Signed by <strong>{currentCheck.signed_by}</strong></>}
              </div>

              {/* Print buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                <button className="btn btn-sm btn-outline gap-1" disabled={pdfLoading}
                  onClick={() => printChecklist(currentCheck, checkItems)}>
                  <Printer size={16} /> {pdfLoading ? 'Generating...' : 'Print Checklist'}
                </button>
                {isCompleted && currentCheck.status === 'completed_discrepancy' && (
                  <button className="btn btn-sm btn-outline btn-error gap-1" disabled={pdfLoading}
                    onClick={() => printDiscrepancyReport(currentCheck)}>
                    <Download size={16} /> Print Discrepancy Report
                  </button>
                )}
              </div>

              {/* Progress */}
              {!isCompleted && (
                <div className="flex items-center gap-3 mt-3">
                  <progress className="progress progress-primary flex-1" value={checkedCount} max={checkItems.length}></progress>
                  <span className="text-sm font-mono">{checkedCount}/{checkItems.length} verified</span>
                </div>
              )}
            </div>
          </div>

          {/* Items list — tick off items */}
          <div className="space-y-1">
            {checkItems.map(item => (
              <div key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  item.checked
                    ? 'bg-success/10 border-success/30'
                    : isCompleted ? 'bg-error/10 border-error/30' : 'bg-base-100 border-base-300 hover:bg-base-200'
                }`}
                onClick={() => !isCompleted && toggleChecked(item)}
              >
                {/* Checkbox */}
                <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 border-2 ${
                  item.checked
                    ? 'bg-success border-success text-success-content'
                    : isCompleted ? 'bg-error/20 border-error' : 'border-base-300'
                }`}>
                  {item.checked && <Check size={18} strokeWidth={3} />}
                  {!item.checked && isCompleted && <span className="text-error font-bold text-xs">✕</span>}
                </div>

                {/* Item details */}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${item.checked ? 'line-through text-base-content/50' : ''}`}>
                    {item.description}
                  </div>
                  <div className="text-xs text-base-content/50 flex flex-wrap gap-2">
                    {item.part_number && <span>#{item.part_number}</span>}
                    <span>📍 {item.location || 'No location'}</span>
                    <span>Qty: <strong>{item.expected_qty}</strong></span>
                  </div>
                </div>

                {/* Status indicator */}
                {item.checked ? (
                  <span className="text-success text-sm font-semibold flex-shrink-0">✅ Present</span>
                ) : isCompleted ? (
                  <span className="text-error text-sm font-semibold flex-shrink-0">❌ Not Found</span>
                ) : null}
              </div>
            ))}
          </div>

          {/* Submit area */}
          {!isCompleted && (
            <div className="card bg-base-100 shadow mt-4">
              <div className="card-body p-4 space-y-3">
                {uncheckedCount > 0 ? (
                  <>
                    <div className="text-sm">
                      <span className="text-success font-semibold">{checkedCount} found</span>
                      {' · '}
                      <span className="text-error font-semibold">{uncheckedCount} not checked off (will be recorded as discrepancies)</span>
                    </div>
                    <div className="alert alert-warning text-sm">
                      <AlertTriangle size={18} />
                      <span>There are unchecked items. To submit, please sign below to confirm the discrepancies.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="font-semibold text-sm">Sign (your name):</label>
                      <input type="text" className="input input-bordered input-sm w-64" value={signName}
                        onChange={e => setSignName(e.target.value)} placeholder="e.g. Gavin" />
                      <span className="text-xs text-base-content/50">{fmtDate(new Date().toISOString())}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-success font-semibold">
                    ✅ All {checkItems.length} items verified as present!
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setCurrentCheck(null); }}>
                    ← Back
                  </button>
                  <button className="btn btn-primary btn-sm"
                    disabled={uncheckedCount > 0 && !signName.trim()}
                    onClick={() => setConfirmAction({
                      text: uncheckedCount > 0
                        ? `Submit with ${uncheckedCount} discrepanc${uncheckedCount > 1 ? 'ies' : 'y'}? This will be recorded and signed by ${signName.trim()}.`
                        : 'Submit — all items present?',
                      onYes: submitCheck
                    })}>
                    <CheckCircle2 size={16} /> Submit Check
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View-only footer for completed checks */}
          {isCompleted && (
            <div className="flex gap-3 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => { setCurrentCheck(null); }}>
                ← Back to History
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ ACTIVE TAB — list of open checks ═══ */}
      {tab === 'active' && !currentCheck && (
        <div className="space-y-3">
          {activeChecks.length === 0 ? (
            <div className="text-center py-10 text-base-content/50">
              <ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" />
              <p>No open stock checks</p>
              <button className="btn btn-primary btn-sm mt-3" onClick={() => setTab('new')}>Start a New Check</button>
            </div>
          ) : (
            activeChecks.map(c => (
              <div key={c.id} className="card bg-base-100 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => openCheck(c.id)}>
                <div className="card-body p-4 flex-row items-center gap-4">
                  <span className="text-2xl">{c.check_type === 'position' ? '📍' : '🎲'}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{c.check_number} — {c.check_type === 'position' ? 'Position' : 'Spot'} Check</div>
                    <div className="text-xs text-base-content/50">{c.location_filter} · {c.total_items} items · {fmtDateTime(c.started_at)}</div>
                  </div>
                  <span className={`badge ${c.status === 'in_progress' ? 'badge-warning' : 'badge-info'}`}>
                    {c.status === 'in_progress' ? 'Verifying' : 'Awaiting Check'}
                  </span>
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
              .filter(c => !searchHistory ||
                (c.check_number || '').toLowerCase().includes(searchHistory.toLowerCase()) ||
                c.location_filter.toLowerCase().includes(searchHistory.toLowerCase()) ||
                c.started_by.toLowerCase().includes(searchHistory.toLowerCase()))
              .map(c => (
                <div key={c.id} className="card bg-base-100 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                  onClick={() => openCheck(c.id)}>
                  <div className="card-body p-4 flex-row items-center gap-4">
                    <span className="text-2xl">{c.check_type === 'position' ? '📍' : '🎲'}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{c.check_number} — {c.check_type === 'position' ? 'Position' : 'Spot'} Check</div>
                      <div className="text-xs text-base-content/50">
                        {c.location_filter} · By {c.started_by} · {fmtDate(c.completed_at)}
                        {c.signed_by && <> · Signed: {c.signed_by}</>}
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="text-success font-semibold">✅ {c.found_count}</span>
                      {c.missing_count > 0 && <span className="text-error font-semibold">❌ {c.missing_count}</span>}
                    </div>
                    <span className={`badge ${c.status === 'completed_ok' ? 'badge-success' : 'badge-error'}`}>
                      {c.status === 'completed_ok' ? 'All Present' : 'Discrepancies'}
                    </span>
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
                    <div className="text-sm opacity-80">Items Checked</div>
                  </div>
                </div>
                <div className="card bg-success text-success-content shadow">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold">{summaryStats.okChecks}</div>
                    <div className="text-sm opacity-80">Clean Checks ✅</div>
                  </div>
                </div>
                <div className="card bg-error text-error-content shadow">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold">{summaryStats.discrepancyChecks}</div>
                    <div className="text-sm opacity-80">With Discrepancies</div>
                  </div>
                </div>
              </div>

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
                        <tr><td className="font-semibold">Total Discrepancies</td><td className="text-error">{summaryStats.totalMissing}</td></tr>
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
                      ? ` ${summaryStats.totalMissing} discrepanc${summaryStats.totalMissing !== 1 ? 'ies were' : 'y was'} identified across ${summaryStats.discrepancyChecks} check${summaryStats.discrepancyChecks !== 1 ? 's' : ''}.`
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
