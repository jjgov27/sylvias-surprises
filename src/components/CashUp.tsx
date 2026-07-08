import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser, FloatRecord } from '../types';
import { getFloatByDate, saveFloat, formatPaymentMethod, getStaffUsers, getAllSalesByMethodForDate, getAllExpensesByMethodForDate, getAllRefundsByMethodForDate, getCashSalesForDate, getCashRefundsForDate, getCashExpensesForDate, getDiscountTotalForDate } from '../utils/db';
import { Calculator, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, User, Printer, Trash2, Gift } from 'lucide-react';

interface StockRemovalSummary {
  type: string;
  count: number;
  totalRetail: number;
  totalCost: number;
  items: { description: string; part_number: string; quantity: number; cost: number; retail: number; reason: string; initials: string }[];
}

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
  const [discountTotal, setDiscountTotal] = useState(0);
  const [discountCount, setDiscountCount] = useState(0);
  const [removalSummaries, setRemovalSummaries] = useState<StockRemovalSummary[]>([]);
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
      const [sales, refunds, expenses, floatRec, users, discInfo, removals] = await Promise.all([
        getAllSalesByMethodForDate(date),
        getAllRefundsByMethodForDate(date),
        getAllExpensesByMethodForDate(date),
        getFloatByDate(date),
        getStaffUsers(),
        getDiscountTotalForDate(date),
        (async () => {
          try {
            const rows = await window.tasklet.sqlQuery(
              `SELECT r.*, s.description, s.part_number FROM sylvias_stock_removals r
               LEFT JOIN sylvias_stock s ON s.id = r.stock_id
               WHERE date(r.created_at) = '${date}'
               ORDER BY r.created_at DESC`
            ) as any[];
            const byType: Record<string, StockRemovalSummary> = {};
            for (const r of rows) {
              const t = r.type || 'wastage';
              if (!byType[t]) byType[t] = { type: t, count: 0, totalRetail: 0, totalCost: 0, items: [] };
              byType[t].count += r.quantity;
              byType[t].totalRetail += r.retail_at_removal * r.quantity;
              byType[t].totalCost += r.cost_at_removal * r.quantity;
              byType[t].items.push({
                description: r.description || 'Unknown',
                part_number: r.part_number || '',
                quantity: r.quantity,
                cost: r.cost_at_removal * r.quantity,
                retail: r.retail_at_removal * r.quantity,
                reason: r.reason,
                initials: r.initials,
              });
            }
            return Object.values(byType);
          } catch { return []; }
        })(),
      ]);
      // getAllSalesByMethodForDate now queries sylvias_payments directly — single source of truth
      setSalesByMethod(sales);
      setRefundsByMethod(refunds);
      setExpensesByMethod(expenses);
      setDiscountTotal(discInfo.totalDiscount);
      setDiscountCount(discInfo.discountCount);
      setRemovalSummaries(removals);
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

  async function handlePrint() {
    const reportData = {
      date,
      dateFormatted: formatDate(date),
      cashedUpBy,
      salesByMethod: Object.fromEntries(
        Object.entries(salesByMethod).map(([k, v]) => [k, Number(v)])
      ),
      refundsByMethod: Object.fromEntries(
        Object.entries(refundsByMethod).map(([k, v]) => [k, Number(v)])
      ),
      expensesByMethod: Object.fromEntries(
        Object.entries(expensesByMethod).map(([k, v]) => [k, Number(v)])
      ),
      totalSales,
      totalRefunds,
      totalExpenses,
      discountTotal,
      discountCount,
      removalSummaries: removalSummaries.map(s => ({
        type: s.type,
        count: s.count,
        totalRetail: s.totalRetail,
        totalCost: s.totalCost,
        items: s.items,
      })),
      openingFloat: openingVal,
      closingFloat: closingVal,
      expectedCash,
      discrepancy,
      cashSales,
      cashRefunds,
      cashExpenses,
      methodConfig: METHOD_CONFIG.map(m => ({ key: m.key, label: m.label })),
      nonIncomeKeys: NON_INCOME_METHODS,
    };

    const pyScript = `
import json
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

with open('/tmp/cashup_data.json', 'r') as _f:
    data = json.loads(_f.read())
pdf_path = '/tmp/cashup_report.pdf'
doc = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=15*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)
styles = getSampleStyleSheet()
title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=18, spaceAfter=4)
heading_style = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=13, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor('#1a1a2e'))
sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=9, textColor=colors.grey)
normal = styles['Normal']
bold_style = ParagraphStyle('Bold', parent=normal, fontName='Helvetica-Bold')

elements = []
elements.append(Paragraph("Sylvia's Surprises", ParagraphStyle('Shop', parent=styles['Normal'], fontSize=10, textColor=colors.grey)))
elements.append(Paragraph("End of Day Cash-Up", title_style))
elements.append(Paragraph(f"{data['dateFormatted']}", sub_style))
elements.append(Paragraph(f"Cashed up by: <b>{data['cashedUpBy']}</b>", normal))
elements.append(Spacer(1, 8))
elements.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e0e0e0')))

# --- Day's Takings ---
elements.append(Paragraph("Day's Takings - Full Breakdown", heading_style))
tbl = [['Payment Method', 'Sales', 'Refunds', 'Net']]
method_labels = {m['key']: m['label'] for m in data['methodConfig']}
all_keys = set(list(data['salesByMethod'].keys()) + list(data['refundsByMethod'].keys()))
non_income = data['nonIncomeKeys']
for m in data['methodConfig']:
    k = m['key']
    s = data['salesByMethod'].get(k, 0)
    r = data['refundsByMethod'].get(k, 0)
    if s == 0 and r == 0:
        continue
    tbl.append([m['label'], f"\\u00a3{s:.2f}", f"-\\u00a3{r:.2f}" if r > 0 else '\\u2014', f"\\u00a3{s-r:.2f}"])
# Any extra methods not in config
for k in sorted(all_keys):
    if k in method_labels:
        continue
    s = data['salesByMethod'].get(k, 0)
    r = data['refundsByMethod'].get(k, 0)
    if s == 0 and r == 0:
        continue
    label = k.replace('_', ' ').title()
    if k in non_income:
        label += ' (pre-paid)'
    tbl.append([label, f"\\u00a3{s:.2f}", f"-\\u00a3{r:.2f}" if r > 0 else '\\u2014', f"\\u00a3{s-r:.2f}"])

ts = data['totalSales']
tr = data['totalRefunds']
tbl.append(['Total Sales', f"\\u00a3{ts:.2f}", f"-\\u00a3{tr:.2f}" if tr > 0 else '\\u2014', f"\\u00a3{ts-tr:.2f}"])

t = Table(tbl, colWidths=[55*mm, 35*mm, 35*mm, 35*mm])
style_cmds = [
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f0f0')),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
    ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#cccccc')),
    ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#333333')),
    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ('FONTSIZE', (0, -1), (-1, -1), 10),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
]
t.setStyle(TableStyle(style_cmds))
elements.append(t)

# --- Expenses ---
te = data['totalExpenses']
if te > 0:
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Expenses Paid Out", heading_style))
    exp_tbl = [['Method', 'Amount']]
    for method, amount in data['expensesByMethod'].items():
        if amount > 0:
            exp_tbl.append([method.replace('_',' ').title(), f"-\\u00a3{amount:.2f}"])
    exp_tbl.append(['Total Expenses', f"-\\u00a3{te:.2f}"])
    et = Table(exp_tbl, colWidths=[80*mm, 40*mm])
    et.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fff3e0')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#cccccc')),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#333333')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, 1), (1, -1), colors.HexColor('#c62828')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(et)

# --- Discounts ---
if data['discountTotal'] > 0:
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Discounts Given", heading_style))
    elements.append(Paragraph(f"<b>{data['discountCount']}</b> sale(s) discounted today. Total discounts: <b>\\u00a3{data['discountTotal']:.2f}</b>", normal))
    elements.append(Paragraph("Sale totals above are after discounts (actual money received).", sub_style))

# --- Wastage & Gifts ---
for summary in data.get('removalSummaries', []):
    label = 'Wastage' if summary['type'] == 'wastage' else 'Gifts'
    emoji = '\\u26a0' if summary['type'] == 'wastage' else '\\U0001f381'
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"{label}", heading_style))
    elements.append(Paragraph(f"{summary['count']} item(s) - \\u00a3{summary['totalCost']:.2f} cost value (retail: \\u00a3{summary['totalRetail']:.2f})", bold_style))
    rem_tbl = [['Item', 'Part No.', 'Qty', 'Cost', 'Reason', 'By']]
    for item in summary['items']:
        rem_tbl.append([
            item['description'][:25],
            item.get('part_number', '') or '\\u2014',
            str(item['quantity']),
            f"\\u00a3{item.get('cost', 0):.2f}",
            item['reason'][:20],
            item['initials'],
        ])
    rt = Table(rem_tbl, colWidths=[40*mm, 22*mm, 12*mm, 22*mm, 38*mm, 14*mm])
    rt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fff8e1') if summary['type'] == 'wastage' else colors.HexColor('#e3f2fd')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (2, 0), (3, -1), 'CENTER'),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#cccccc')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(rt)

# --- Cash Reconciliation ---
elements.append(Spacer(1, 6))
elements.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e0e0e0')))
elements.append(Paragraph("Cash Till Reconciliation", heading_style))
cash_lines = [
    ['Opening float', f"\\u00a3{data['openingFloat']:.2f}"],
    ['+ Cash sales', f"\\u00a3{data['cashSales']:.2f}"],
]
if data['cashRefunds'] > 0:
    cash_lines.append(['\\u2212 Cash refunds', f"\\u00a3{data['cashRefunds']:.2f}"])
if data['cashExpenses'] > 0:
    cash_lines.append(['\\u2212 Cash expenses', f"\\u00a3{data['cashExpenses']:.2f}"])
cash_lines.append(['Expected cash', f"\\u00a3{data['expectedCash']:.2f}"])
cash_lines.append(['Actual closing float', f"\\u00a3{data['closingFloat']:.2f}"])
disc = data['discrepancy']
if abs(disc) < 0.01:
    cash_lines.append(['Discrepancy', 'BALANCED'])
elif disc > 0:
    cash_lines.append(['Discrepancy', f"OVER by \\u00a3{disc:.2f}"])
else:
    cash_lines.append(['Discrepancy', f"SHORT by \\u00a3{abs(disc):.2f}"])

ct = Table(cash_lines, colWidths=[80*mm, 50*mm])
cash_style = [
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ('TOPPADDING', (0, 0), (-1, -1), 2),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ('LINEABOVE', (0, -3), (-1, -3), 1, colors.HexColor('#333333')),
    ('FONTNAME', (0, -3), (-1, -3), 'Helvetica-Bold'),
    ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#333333')),
    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
]
if abs(disc) < 0.01:
    cash_style.append(('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#2e7d32')))
elif disc > 0:
    cash_style.append(('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#e65100')))
else:
    cash_style.append(('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#c62828')))
ct.setStyle(TableStyle(cash_style))
elements.append(ct)

# --- Day's Net Position ---
elements.append(Spacer(1, 6))
elements.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e0e0e0')))
elements.append(Paragraph("Day's Net Position", heading_style))
net_tbl = [
    ['Total Takings', 'Total Expenses', 'Net for Day'],
    [f"\\u00a3{ts - tr:.2f}", f"-\\u00a3{te:.2f}", f"\\u00a3{ts - tr - te:.2f}"],
]
nt = Table(net_tbl, colWidths=[50*mm, 50*mm, 50*mm])
nt.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8eaf6')),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 10),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 1), (-1, 1), 14),
    ('TEXTCOLOR', (0, 1), (0, 1), colors.HexColor('#2e7d32')),
    ('TEXTCOLOR', (1, 1), (1, 1), colors.HexColor('#c62828')),
    ('TEXTCOLOR', (2, 1), (2, 1), colors.HexColor('#1565c0')),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#cccccc')),
]))
elements.append(nt)

# --- Footer ---
elements.append(Spacer(1, 12))
elements.append(Paragraph(f"Report generated for Sylvia's Surprises | Cashed up by: {data['cashedUpBy']}", sub_style))

doc.build(elements)
print('OK')
`;

    try {
      const jsonStr = JSON.stringify(reportData);
      // Write script and data to files first (avoids shell escaping issues)
      await window.tasklet.writeFileToDisk('/tmp/cashup_gen.py', pyScript);
      await window.tasklet.writeFileToDisk('/tmp/cashup_data.json', jsonStr);
      const result = await window.tasklet.runCommand('cd /tmp && python3 cashup_gen.py 2>&1');
      const b64Result = await window.tasklet.runCommand('base64 -w0 /tmp/cashup_report.pdf');
      const b64 = (b64Result as any).log?.trim();
      if (!b64) throw new Error('No PDF output: ' + (result as any).log);
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CashUp-${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try again.');
    }
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

          {/* Discounts Given */}
          {discountTotal > 0 && (
            <div className="card bg-base-200 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg flex items-center gap-2">🏷️ Discounts Given</h3>
                  <div className="badge badge-secondary badge-lg font-bold text-lg">−£{discountTotal.toFixed(2)}</div>
                </div>
                <p className="text-sm text-base-content/60 mt-1">
                  {discountCount} sale{discountCount !== 1 ? 's' : ''} had a discount today.
                  Sale totals above are <strong>after</strong> discounts (actual money received).
                </p>
              </div>
            </div>
          )}

          {/* Wastage & Gifts */}
          {removalSummaries.length > 0 && removalSummaries.map(summary => (
            <div key={summary.type} className="card bg-base-200 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {summary.type === 'wastage' ? <><Trash2 size={18} className="text-warning" /> ⚠️ Wastage</> : <><Gift size={18} className="text-info" /> 🎁 Gifts</>}
                  </h3>
                  <div className={`badge ${summary.type === 'wastage' ? 'badge-warning' : 'badge-info'} badge-lg font-bold`}>
                    {summary.count} item{summary.count !== 1 ? 's' : ''} · £{summary.totalCost.toFixed(2)} cost
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-xs w-full">
                    <thead>
                      <tr className="text-xs">
                        <th>Item</th>
                        <th>Part No.</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Cost</th>
                        <th>Reason</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.items.map((item, i) => (
                        <tr key={i}>
                          <td className="font-semibold">{item.description}</td>
                          <td className="text-xs text-base-content/50">{item.part_number || '—'}</td>
                          <td className="text-center">{item.quantity}</td>
                          <td className="text-right">£{item.cost.toFixed(2)}</td>
                          <td className="text-sm max-w-[150px] truncate" title={item.reason}>{item.reason}</td>
                          <td className="font-mono text-xs">{item.initials}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-base-content/50 mt-1">
                  Retail value: £{summary.totalRetail.toFixed(2)} · {summary.type === 'wastage' ? 'Items written off as damaged/unusable' : 'Items given away (raffle, donation, etc.)'}
                </p>
              </div>
            </div>
          ))}

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
