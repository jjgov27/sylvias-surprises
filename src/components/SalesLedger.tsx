import React, { useState, useEffect } from 'react';
import { StaffUser, Sale, SaleItem, Expense } from '../types';
import { getSalesByDateRange, getSaleItems, getExpensesByDateRange, getSalesSplitByDateRange, SalesSplit, deleteSaleWithAudit, deleteExpenseWithAudit, editSaleTotalWithAudit, getAuditLog, AuditEntry } from '../utils/db';
import { ChevronDown, ChevronRight, Calendar, TrendingUp, TrendingDown, Download, Handshake, Package, Trash2, Edit3, History } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
  onViewInvoice?: (saleId: number) => void;
}

type LedgerEntry =
  | { type: 'sale'; data: Sale }
  | { type: 'expense'; data: Expense };

export const SalesLedger: React.FC<Props> = ({ currentUser, onViewInvoice }) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [split, setSplit] = useState<SalesSplit | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<SaleItem[]>([]);
  const [allSaleItems, setAllSaleItems] = useState<Record<number, SaleItem[]>>({});
  const [viewFilter, setViewFilter] = useState<'all' | 'sales' | 'expenses' | 'consignment'>('all');
  const [generating, setGenerating] = useState(false);
  // Delete/edit confirmation state
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'sale' | 'expense'; id: number; label: string } | null>(null);
  const [editSale, setEditSale] = useState<{ id: number; invoice: string; currentTotal: number } | null>(null);
  const [editTotal, setEditTotal] = useState('');
  const [editReason, setEditReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  // Audit trail
  const [showAudit, setShowAudit] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  async function loadData() {
    setLoading(true);
    const [salesData, expData, splitData] = await Promise.all([
      getSalesByDateRange(dateFrom, dateTo),
      getExpensesByDateRange(dateFrom, dateTo),
      getSalesSplitByDateRange(dateFrom, dateTo),
    ]);
    setSales(salesData);
    setExpenses(expData);
    setSplit(splitData);

    // Pre-load all sale items in ONE query to avoid rate limits
    const itemMap: Record<number, SaleItem[]> = {};
    if (salesData.length > 0) {
      const saleIds = salesData.map((s: Sale) => s.id).join(',');
      const allItems = await window.tasklet.sqlQuery(
        `SELECT * FROM sylvias_sale_items WHERE sale_id IN (${saleIds}) ORDER BY id`
      );
      (allItems || []).forEach((item: any) => {
        if (!itemMap[item.sale_id]) itemMap[item.sale_id] = [];
        itemMap[item.sale_id].push(item as SaleItem);
      });
    }
    setAllSaleItems(itemMap);

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [dateFrom, dateTo]);

  async function handleDeleteSale(saleId: number) {
    setActionBusy(true);
    try {
      await deleteSaleWithAudit(saleId, currentUser.initials, deleteReason || 'No reason given');
      setConfirmDelete(null);
      setDeleteReason('');
      setActionMsg({ text: 'Sale deleted successfully', type: 'success' });
      setTimeout(() => setActionMsg(null), 3000);
      loadData();
    } catch (e) { setActionMsg({ text: 'Failed to delete sale', type: 'error' }); }
    finally { setActionBusy(false); }
  }

  async function handleDeleteExpense(expenseId: number) {
    setActionBusy(true);
    try {
      await deleteExpenseWithAudit(expenseId, currentUser.initials, deleteReason || 'No reason given');
      setConfirmDelete(null);
      setDeleteReason('');
      setActionMsg({ text: 'Expense deleted successfully', type: 'success' });
      setTimeout(() => setActionMsg(null), 3000);
      loadData();
    } catch (e) { setActionMsg({ text: 'Failed to delete expense', type: 'error' }); }
    finally { setActionBusy(false); }
  }

  async function handleEditSaleTotal() {
    if (!editSale) return;
    const newVal = parseFloat(editTotal);
    if (isNaN(newVal) || newVal < 0) { setActionMsg({ text: 'Please enter a valid amount', type: 'error' }); return; }
    setActionBusy(true);
    try {
      await editSaleTotalWithAudit(editSale.id, newVal, currentUser.initials, editReason || 'No reason given');
      setEditSale(null);
      setEditTotal('');
      setEditReason('');
      setActionMsg({ text: 'Sale updated successfully', type: 'success' });
      setTimeout(() => setActionMsg(null), 3000);
      loadData();
    } catch (e) { setActionMsg({ text: 'Failed to update sale', type: 'error' }); }
    finally { setActionBusy(false); }
  }

  async function loadAuditLog() {
    const entries = await getAuditLog(undefined, undefined, 100);
    setAuditEntries(entries);
    setShowAudit(true);
  }

  async function toggleExpand(key: string, saleId?: number) {
    if (expandedId === key) {
      setExpandedId(null);
      setExpandedItems([]);
    } else {
      if (saleId !== undefined) {
        const items = await getSaleItems(saleId);
        setExpandedItems(items);
      }
      setExpandedId(key);
    }
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalDiscounts = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netTotal = totalRevenue - totalDiscounts - totalExpenses;

  // Build combined ledger entries grouped by date
  const byDate: Record<string, LedgerEntry[]> = {};

  if (viewFilter !== 'expenses') {
    sales.forEach(s => {
      const d = s.sale_date.slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({ type: 'sale', data: s });
    });
  }

  if (viewFilter !== 'sales' && viewFilter !== 'consignment') {
    expenses.forEach(e => {
      const d = e.expense_date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({ type: 'expense', data: e });
    });
  }

  function setToday() { setDateFrom(today); setDateTo(today); }
  function setThisMonth() { setDateFrom(monthStart); setDateTo(today); }
  function setAllTime() { setDateFrom('2020-01-01'); setDateTo(today); }

  async function downloadLedgerPDF() {
    setGenerating(true);
    try {
      const data = {
        from: dateFrom, to: dateTo,
        totalRevenue, totalExpenses, netTotal,
        saleCount: sales.length,
        stockSalesTotal: split?.stockSalesTotal || 0,
        consignmentSalesTotal: split?.consignmentSalesTotal || 0,
        consignmentCommission: split?.consignmentCommission || 0,
        consignmentOwed: split?.consignmentOwed || 0,
        entries: [] as { date: string; type: string; details: string; category: string; by: string; amount: number }[],
      };
      if (viewFilter !== 'expenses') {
        sales.forEach(s => data.entries.push({
          date: s.sale_date.slice(0, 10), type: 'Sale',
          details: `${s.invoice_number || '-'} — ${s.customer_name}`,
          category: s.payment_method, by: s.sold_by, amount: s.total,
        }));
      }
      if (viewFilter !== 'sales' && viewFilter !== 'consignment') {
        expenses.forEach(e => data.entries.push({
          date: e.expense_date, type: 'Expense',
          details: e.description, category: e.category,
          by: e.entered_by, amount: -e.amount,
        }));
      }
      data.entries.sort((a, b) => a.date.localeCompare(b.date));

      const dataJson = JSON.stringify(data);
      const filename = `ledger-${dateFrom}-to-${dateTo}.pdf`;
      const outPath = `/tmp/${filename}`;

      const script = `
import json, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

data = json.loads(sys.argv[1])
doc = SimpleDocTemplate('${outPath}', pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=20*mm, bottomMargin=15*mm)
styles = getSampleStyleSheet()
title_style = ParagraphStyle('T', parent=styles['Title'], fontSize=16, spaceAfter=4)
subtitle_style = ParagraphStyle('S', parent=styles['Normal'], fontSize=10, textColor=HexColor('#666'), spaceAfter=10)
heading_style = ParagraphStyle('H', parent=styles['Heading2'], fontSize=12, spaceBefore=12, spaceAfter=6)
elements = []
elements.append(Paragraph("Sylvia's Surprises — Ledger", title_style))
from datetime import datetime
def fmt_date(d):
    try: return datetime.strptime(d, '%Y-%m-%d').strftime('%d/%m/%Y')
    except: return d
elements.append(Paragraph(f"{fmt_date(data['from'])} to {fmt_date(data['to'])}", subtitle_style))

# Summary with stock/consignment split
summary = [['Total Sales', 'Stock Sales', 'Consignment Sales', 'Commission Earned', 'Expenses', 'Net'],
  ['\\u00a3{:.2f}'.format(data['totalRevenue']),
   '\\u00a3{:.2f}'.format(data['stockSalesTotal']),
   '\\u00a3{:.2f}'.format(data['consignmentSalesTotal']),
   '\\u00a3{:.2f}'.format(data['consignmentCommission']),
   '\\u00a3{:.2f}'.format(data['totalExpenses']),
   '\\u00a3{:.2f}'.format(data['netTotal'])]]
t = Table(summary, colWidths=[75,75,85,85,75,75])
t.setStyle(TableStyle([
  ('BACKGROUND',(0,0),(-1,0),HexColor('#f0f0f0')),
  ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
  ('FONTSIZE',(0,0),(-1,-1),8),
  ('GRID',(0,0),(-1,-1),0.5,HexColor('#ccc')),
  ('ALIGN',(0,1),(-1,-1),'RIGHT'),
  ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),
]))
elements.append(t)
elements.append(Spacer(1,6*mm))

# Detail
if data['entries']:
    rows = [['Date','Type','Details','Category','By','Amount']]
    for e in data['entries']:
        sign = '+' if e['amount'] >= 0 else ''
        rows.append([fmt_date(e['date']), e['type'], e['details'][:40], e['category'].title(), e['by'],
                      sign + '\\u00a3{:.2f}'.format(e['amount'])])
    t = Table(rows, colWidths=[60,45,150,70,30,65])
    t.setStyle(TableStyle([
      ('BACKGROUND',(0,0),(-1,0),HexColor('#f0f0f0')),
      ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
      ('FONTSIZE',(0,0),(-1,-1),8),
      ('GRID',(0,0),(-1,-1),0.5,HexColor('#ccc')),
      ('ALIGN',(5,0),(5,-1),'RIGHT'),
      ('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2),
    ]))
    elements.append(t)

elements.append(Spacer(1,8*mm))
elements.append(Paragraph("Sylvia's Surprises — Memorial Hall, Main Road, Union Mills, IM4 4AD", ParagraphStyle('F', parent=styles['Normal'], fontSize=7, textColor=HexColor('#999'), alignment=1)))
doc.build(elements)
print('OK')
`;
      await window.tasklet.writeFileToDisk('/tmp/gen_ledger_pdf.py', script);
      await window.tasklet.writeFileToDisk('/tmp/ledger_data.json', dataJson);
      const result = await window.tasklet.runCommand(
        `cd /tmp && uv run --with reportlab python3 gen_ledger_pdf.py "$(cat /tmp/ledger_data.json)"`, 120);
      if (result.exitCode === 0) {
        const b64 = await window.tasklet.runCommand(`base64 -w0 '${outPath}'`);
        if (b64.exitCode === 0 && b64.log) {
          const a = document.createElement('a');
          a.href = 'data:application/pdf;base64,' + b64.log.trim();
          a.download = filename;
          a.click();
        }
      } else { console.error('Ledger PDF failed:', result.log); }
    } catch (err) { console.error('Ledger PDF error:', err); }
    finally { setGenerating(false); }
  }

  const fmt = (v: number) => '£' + v.toFixed(2);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar size={22} /> Ledger
        </h2>
        <button className="btn btn-primary btn-sm gap-1" onClick={downloadLedgerPDF} disabled={generating}>
          {generating ? <span className="loading loading-spinner loading-xs" /> : <Download size={14} />}
          {generating ? 'Generating...' : 'Download PDF'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end mb-4">
        <div className="form-control">
          <label className="label py-0"><span className="label-text text-xs">From</span></label>
          <input type="date" className="input input-bordered input-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-control">
          <label className="label py-0"><span className="label-text text-xs">To</span></label>
          <input type="date" className="input input-bordered input-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-outline btn-sm" onClick={setToday}>Today</button>
        <button className="btn btn-outline btn-sm" onClick={setThisMonth}>This Month</button>
        <button className="btn btn-outline btn-sm" onClick={setAllTime}>All Time</button>
      </div>

      {/* View filter */}
      <div className="flex gap-1 mb-4">
        <button className={`btn btn-sm ${viewFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewFilter('all')}>All</button>
        <button className={`btn btn-sm ${viewFilter === 'sales' ? 'btn-success' : 'btn-ghost'}`} onClick={() => setViewFilter('sales')}>
          <TrendingUp size={14} /> Sales
        </button>
        <button className={`btn btn-sm ${viewFilter === 'expenses' ? 'btn-error' : 'btn-ghost'}`} onClick={() => setViewFilter('expenses')}>
          <TrendingDown size={14} /> Expenses
        </button>
      </div>

      {/* Summary cards — with stock/consignment split */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Sales</div>
          <div className="stat-value text-base text-success">{fmt(totalRevenue)}</div>
          {totalDiscounts > 0 && <div className="stat-desc text-secondary">Discounts: -{fmt(totalDiscounts)}</div>}
          <div className="stat-desc text-xs">{sales.length} transactions</div>
        </div>
        <div className="stat bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="stat-title text-xs flex items-center gap-1"><Package size={12} /> Stock Sales</div>
          <div className="stat-value text-base text-blue-700">{fmt(split?.stockSalesTotal || 0)}</div>
          <div className="stat-desc text-xs">Owned stock</div>
        </div>
        <div className="stat bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="stat-title text-xs flex items-center gap-1"><Handshake size={12} /> Consignment</div>
          <div className="stat-value text-base text-purple-700">{fmt(split?.consignmentSalesTotal || 0)}</div>
          <div className="stat-desc text-xs">Commission: {fmt(split?.consignmentCommission || 0)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Expenses</div>
          <div className="stat-value text-base text-error">{fmt(totalExpenses)}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Net Total</div>
          <div className={`stat-value text-base ${netTotal >= 0 ? 'text-success' : 'text-error'}`}>{fmt(netTotal)}</div>
        </div>
        {(split?.consignmentOwed || 0) > 0 && (
          <div className="stat bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="stat-title text-xs">Owed to Consigners</div>
            <div className="stat-value text-base text-orange-700">{fmt(split?.consignmentOwed || 0)}</div>
          </div>
        )}
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`alert ${actionMsg.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}>
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Inline delete confirmation banner */}
      {confirmDelete && (
        <div className="alert bg-yellow-50 border-yellow-300 border mb-4">
          <div className="w-full">
            <p className="font-semibold text-yellow-800">
              ⚠️ Delete {confirmDelete.type === 'sale' ? 'Sale' : 'Expense'}: {confirmDelete.label}?
            </p>
            <p className="text-sm text-yellow-700 mt-1">This will be permanently removed. An audit trail record will be kept.</p>
            <div className="form-control mt-2">
              <label className="label py-0"><span className="label-text text-xs font-semibold">Reason for deletion</span></label>
              <input className="input input-bordered input-sm w-full max-w-md" placeholder="e.g. Duplicate entry, entered in error..."
                value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-error btn-sm" disabled={actionBusy}
                onClick={() => confirmDelete.type === 'sale' ? handleDeleteSale(confirmDelete.id) : handleDeleteExpense(confirmDelete.id)}>
                {actionBusy ? <span className="loading loading-spinner loading-xs" /> : null} Yes, Delete
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setConfirmDelete(null); setDeleteReason(''); }}>No, Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Inline edit sale total banner */}
      {editSale && (
        <div className="alert bg-yellow-50 border-yellow-300 border mb-4">
          <div className="w-full">
            <p className="font-semibold text-yellow-800">
              ✏️ Edit Sale Total: {editSale.invoice} (currently £{editSale.currentTotal.toFixed(2)})
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs font-semibold">New Total (£)</span></label>
                <input className="input input-bordered input-sm w-32" value={editTotal}
                  onChange={e => setEditTotal(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-control flex-1 min-w-[200px]">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Reason for change</span></label>
                <input className="input input-bordered input-sm w-full" value={editReason}
                  onChange={e => setEditReason(e.target.value)} placeholder="e.g. Incorrect amount, price adjustment..." />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-warning btn-sm" disabled={actionBusy} onClick={handleEditSaleTotal}>
                {actionBusy ? <span className="loading loading-spinner loading-xs" /> : null} Yes, Update
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditSale(null); setEditTotal(''); setEditReason(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Audit trail button */}
      <div className="flex justify-end mb-2">
        <button className="btn btn-ghost btn-xs gap-1" onClick={loadAuditLog}>
          <History size={12} /> Audit Trail
        </button>
      </div>

      {/* Audit trail modal */}
      {showAudit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-xl p-6 w-[700px] max-w-[95%] max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><History size={18} /> Audit Trail</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAudit(false)}>✕</button>
            </div>
            {auditEntries.length === 0 ? (
              <p className="text-center text-base-content/50 py-8">No audit entries yet</p>
            ) : (
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>ID</th>
                    <th>By</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map(a => {
                    let detailSummary = '';
                    try {
                      const d = JSON.parse(a.details);
                      if (d.reason) detailSummary = d.reason;
                      if (d.old_total !== undefined) detailSummary += ` (£${d.old_total.toFixed(2)} → £${d.new_total.toFixed(2)})`;
                      if (d.sale?.invoice) detailSummary += ` [${d.sale.invoice}]`;
                    } catch { detailSummary = a.details; }
                    return (
                      <tr key={a.id}>
                        <td className="text-xs whitespace-nowrap">{new Date(a.performed_at + 'Z').toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td><span className={`badge badge-sm ${a.action === 'DELETE' ? 'badge-error' : 'badge-warning'}`}>{a.action}</span></td>
                        <td className="text-xs">{a.table_name.replace('sylvias_', '')}</td>
                        <td className="text-xs">#{a.record_id}</td>
                        <td className="font-semibold">{a.performed_by}</td>
                        <td className="text-xs max-w-[200px] truncate" title={detailSummary}>{detailSummary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><span className="loading loading-spinner" /></div>
      ) : Object.keys(byDate).length === 0 ? (
        <div className="text-center py-8 text-base-content/50">No entries found for this period</div>
      ) : (
        Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([date, entries]) => {
          const dayIncome = entries.filter(e => e.type === 'sale').reduce((s, e) => s + (e.data as Sale).total, 0);
          const dayExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + (e.data as Expense).amount, 0);
          return (
            <div key={date} className="mb-4">
              <div className="flex justify-between items-center bg-base-200 rounded-t-lg px-3 py-2">
                <span className="font-semibold text-sm">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <div className="flex gap-2">
                  {dayIncome > 0 && <span className="badge badge-success badge-sm">+{fmt(dayIncome)}</span>}
                  {dayExpense > 0 && <span className="badge badge-error badge-sm">-{fmt(dayExpense)}</span>}
                </div>
              </div>
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th>Type</th>
                    <th>Invoice #</th>
                    <th>Description</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>By</th>
                    <th className="text-right">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    if (entry.type === 'sale') {
                      const sale = entry.data as Sale;
                      const key = `sale-${sale.id}`;
                      const saleItems = allSaleItems[sale.id] || [];
                      const descSummary = saleItems.length > 0
                        ? saleItems.map(i => (i.qty > 1 ? `${i.qty}× ` : '') + i.description).join(', ')
                        : (sale.notes || '-');
                      const itemCount = saleItems.length;
                      const descTruncated = descSummary.length > 80 ? descSummary.slice(0, 77) + '...' : descSummary;
                      const statusBadge = sale.status === 'paid' ? 'badge-success' :
                        sale.status === 'overdue' ? 'badge-error' :
                        sale.status === 'partial' ? 'badge-warning' :
                        sale.status === 'unpaid' ? 'badge-info' : 'badge-ghost';
                      const statusLabel = sale.status ? sale.status.charAt(0).toUpperCase() + sale.status.slice(1) : 'Paid';
                      const fmtPayment = (m: string) => {
                        if (!m) return '-';
                        const map: Record<string, string> = { bank_transfer: 'Bank Transfer', sumup: 'SumUp', ebay: 'eBay', cash: 'Cash', paypal: 'PayPal', crypto: 'Crypto', trade_in: 'Trade-In', account: 'Account', credit_note: 'Credit Note', gift_voucher: 'Gift Voucher' };
                        return map[m.toLowerCase()] || m.charAt(0).toUpperCase() + m.slice(1);
                      };
                      return (
                        <React.Fragment key={key}>
                          <tr className="hover cursor-pointer" onClick={() => toggleExpand(key, sale.id)}>
                            <td>{expandedId === key ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                            <td><span className="badge badge-success badge-sm gap-1"><TrendingUp size={10} /> Sale</span></td>
                            <td>
                              {sale.invoice_number && onViewInvoice ? (
                                <button className="link link-primary font-mono text-xs font-semibold" onClick={e => { e.stopPropagation(); onViewInvoice(sale.id); }}>
                                  {sale.invoice_number}
                                </button>
                              ) : (
                                <span className="font-mono text-xs font-semibold">{sale.invoice_number || '-'}</span>
                              )}
                            </td>
                            <td className="text-sm" title={descSummary}>
                              <div className="flex items-center gap-1">
                                <span>{descTruncated}</span>
                                {itemCount > 1 && <span className="badge badge-ghost badge-xs">{itemCount} items</span>}
                              </div>
                            </td>
                            <td className="text-sm">{sale.customer_name || '-'}</td>
                            <td><span className="badge badge-ghost badge-sm whitespace-nowrap">{fmtPayment(sale.payment_method)}</span></td>
                            <td><span className={`badge ${statusBadge} badge-sm`}>{statusLabel}</span></td>
                            <td>{sale.sold_by}</td>
                            <td className="text-right">
                              <span className="font-semibold text-success">+{fmt(sale.total)}</span>
                              {(sale.discount || 0) > 0 && (
                                <div className="text-xs text-secondary">Disc: -{fmt(sale.discount)}</div>
                              )}
                              {sale.balance_due != null && sale.balance_due > 0 && (
                                <div className="text-xs text-error">Bal: {fmt(sale.balance_due)}</div>
                              )}
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button className="btn btn-ghost btn-xs" title="Edit total"
                                  onClick={e => { e.stopPropagation(); setEditSale({ id: sale.id, invoice: sale.invoice_number || `#${sale.id}`, currentTotal: sale.total }); setEditTotal(String(sale.total)); setEditReason(''); setConfirmDelete(null); }}>
                                  <Edit3 size={12} />
                                </button>
                                <button className="btn btn-ghost btn-xs text-error" title="Delete sale"
                                  onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'sale', id: sale.id, label: `${sale.invoice_number || '#' + sale.id} — ${sale.customer_name} — ${fmt(sale.total)}` }); setDeleteReason(''); setEditSale(null); }}>
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedId === key && (
                            <tr>
                              <td colSpan={10} className="bg-base-200/50 p-3">
                                <table className="table table-xs w-full">
                                  <thead>
                                    <tr>
                                      <th>Part No</th>
                                      <th>Description</th>
                                      <th>Type</th>
                                      <th>Qty</th>
                                      <th className="text-right">Unit</th>
                                      <th className="text-right">Line Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedItems.map(item => (
                                      <tr key={item.id}>
                                        <td className="font-mono text-xs">{item.part_number}</td>
                                        <td>{item.description}</td>
                                        <td>
                                          {item.is_consignment === 1 ? (
                                            <span className="badge badge-sm bg-purple-100 text-purple-700 border-purple-300 gap-1">
                                              <Handshake size={10} /> Consignment
                                            </span>
                                          ) : (
                                            <span className="badge badge-sm bg-blue-100 text-blue-700 border-blue-300 gap-1">
                                              <Package size={10} /> Stock
                                            </span>
                                          )}
                                        </td>
                                        <td>{item.qty}</td>
                                        <td className="text-right">{fmt(item.unit_price)}</td>
                                        <td className="text-right">{fmt(item.line_total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {sale.notes && <p className="text-xs text-base-content/50 mt-2">Notes: {sale.notes}</p>}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    } else {
                      const exp = entry.data as Expense;
                      const key = `exp-${exp.id}`;
                      const fmtExpPay = (m: string) => {
                        if (!m) return '-';
                        const map: Record<string, string> = { bank_transfer: 'Bank Transfer', sumup: 'SumUp', ebay: 'eBay', cash: 'Cash', paypal: 'PayPal', crypto: 'Crypto', direct_debit: 'Direct Debit', standing_order: 'Standing Order', card: 'Card', trade_in: 'Trade-In', credit_note: 'Credit Note', gift_voucher: 'Gift Voucher' };
                        return map[m.toLowerCase()] || m.charAt(0).toUpperCase() + m.slice(1);
                      };
                      return (
                        <tr key={key} className="hover">
                          <td></td>
                          <td><span className="badge badge-error badge-sm gap-1"><TrendingDown size={10} /> Expense</span></td>
                          <td>—</td>
                          <td className="text-sm">{exp.description}</td>
                          <td className="text-sm"><span className="badge badge-ghost badge-xs">{exp.category}</span></td>
                          <td><span className="badge badge-ghost badge-sm whitespace-nowrap">{fmtExpPay(exp.payment_method)}</span></td>
                          <td>—</td>
                          <td>{exp.paid_by || exp.entered_by}</td>
                          <td className="text-right font-semibold text-error">-{fmt(exp.amount)}</td>
                          <td>
                            <button className="btn btn-ghost btn-xs text-error" title="Delete expense"
                              onClick={() => { setConfirmDelete({ type: 'expense', id: exp.id, label: `${exp.description} — ${fmt(exp.amount)}` }); setDeleteReason(''); setEditSale(null); }}>
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
};
