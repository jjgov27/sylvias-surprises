import React, { useState, useEffect } from 'react';
import { StaffUser } from '../types';
import {
  getSalesTotals, getExpensesTotals, getStockCostTotal, getStockRetailTotal,
  getExpensesByCategory, getSalesByMonth, getSalesByPaymentMethod,
  getCostOfGoodsSold,
  getSalesTotalsByRange, getExpensesTotalsByRange, getCogsByRange,
  getSalesByMonthInRange, getSalesByPaymentMethodInRange,
  getExpensesByCategoryInRange, getExpensesMonthlyInRange,
  getExpensesByCategoryForPeriod,
  getSalesSplitByDateRange, SalesSplit,
  getSupplierInvoicesTotals,
  getDiscountTotalForRange,
  getBullionCOGSByRange,
} from '../utils/db';
import { BarChart3, TrendingUp, TrendingDown, Package, PoundSterling, Download, Calendar, FileText, Printer } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

type ReportPeriod = 'all-time' | 'this-year' | 'last-year' | 'this-month' | 'custom';

function getTaxYear(offset = 0): { from: string; to: string; label: string } {
  const now = new Date();
  let startYear = now.getFullYear();
  if (now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6)) {
    startYear -= 1;
  }
  startYear += offset;
  return {
    from: `${startYear}-04-06`,
    to: `${startYear + 1}-04-05`,
    label: `${startYear}/${startYear + 1}`,
  };
}

function getPriorYearRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(from + 'T12:00:00');
  const t = new Date(to + 'T12:00:00');
  f.setFullYear(f.getFullYear() - 1);
  t.setFullYear(t.getFullYear() - 1);
  return {
    from: f.toISOString().substring(0, 10),
    to: t.toISOString().substring(0, 10),
  };
}

function getThisMonth(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function formatDate(d: string): string {
  try {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

function formatDateLong(d: string): string {
  try {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return d; }
}

const fmt = (v: number) => '£' + v.toFixed(2);
const fmtVar = (v: number) => v < 0 ? `(£${Math.abs(v).toFixed(2)})` : `£${v.toFixed(2)}`;

export const AccountantReport: React.FC<Props> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>('this-year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Current period data
  const [salesTotals, setSalesTotals] = useState({ total_sales: 0, sale_count: 0 });
  const [expTotals, setExpTotals] = useState({ total_expenses: 0, expense_count: 0 });
  const [stockCost, setStockCost] = useState(0);
  const [stockRetail, setStockRetail] = useState(0);
  const [supplierDebt, setSupplierDebt] = useState(0);
  const [cogs, setCogs] = useState(0);
  const [bullionCogs, setBullionCogs] = useState(0);
  const [expByCat, setExpByCat] = useState<{ category: string; total: number }[]>([]);
  const [expByMonth, setExpByMonth] = useState<{ month: string; total: number }[]>([]);
  const [salesByMonth, setSalesByMonth] = useState<{ month: string; total: number; count: number }[]>([]);
  const [salesByPM, setSalesByPM] = useState<{ method: string; total: number; count: number }[]>([]);
  const [dateLabel, setDateLabel] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);

  // Consignment split data
  const [split, setSplit] = useState<SalesSplit | null>(null);
  const [priorSplit, setPriorSplit] = useState<SalesSplit | null>(null);

  // Discount data
  const [discountInfo, setDiscountInfo] = useState({ totalDiscount: 0, discountCount: 0 });
  const [priorDiscountInfo, setPriorDiscountInfo] = useState({ totalDiscount: 0, discountCount: 0 });

  // Prior period data
  const [priorSalesTotals, setPriorSalesTotals] = useState({ total_sales: 0, sale_count: 0 });
  const [priorExpTotals, setPriorExpTotals] = useState({ total_expenses: 0, expense_count: 0 });
  const [priorCogs, setPriorCogs] = useState(0);
  const [priorBullionCogs, setPriorBullionCogs] = useState(0);
  const [priorExpByCat, setPriorExpByCat] = useState<Record<string, number>>({});
  const [priorSalesByPM, setPriorSalesByPM] = useState<{ method: string; total: number; count: number }[]>([]);
  const [priorLabel, setPriorLabel] = useState('');

  // Detail data
  // Removed: salesDetail and expenseGroups — not needed for accountant's summary

  function getDateRange(): { from: string; to: string } | null {
    if (period === 'all-time') return null;
    if (period === 'this-year') return getTaxYear(0);
    if (period === 'last-year') return getTaxYear(-1);
    if (period === 'this-month') return getThisMonth();
    if (period === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    return null;
  }

  async function loadAll() {
    setLoading(true);
    const range = getDateRange();
    setDateRange(range);

    if (range) {
      const prior = getPriorYearRange(range.from, range.to);

      const [st, et, cg, bcg, ec, em, sm, sp, splitData, discData,
             pst, pet, pcg, pbcg, pec, psp, priorSplitData, pDiscData] = await Promise.all([
        getSalesTotalsByRange(range.from, range.to),
        getExpensesTotalsByRange(range.from, range.to),
        getCogsByRange(range.from, range.to),
        getBullionCOGSByRange(range.from, range.to),
        getExpensesByCategoryInRange(range.from, range.to),
        getExpensesMonthlyInRange(range.from, range.to),
        getSalesByMonthInRange(range.from, range.to),
        getSalesByPaymentMethodInRange(range.from, range.to),
        getSalesSplitByDateRange(range.from, range.to),
        getDiscountTotalForRange(range.from, range.to),
        // Prior year
        getSalesTotalsByRange(prior.from, prior.to),
        getExpensesTotalsByRange(prior.from, prior.to),
        getCogsByRange(prior.from, prior.to),
        getBullionCOGSByRange(prior.from, prior.to),
        getExpensesByCategoryForPeriod(prior.from, prior.to),
        getSalesByPaymentMethodInRange(prior.from, prior.to),
        getSalesSplitByDateRange(prior.from, prior.to),
        getDiscountTotalForRange(prior.from, prior.to),
      ]);

      setSalesTotals(st); setExpTotals(et); setCogs(cg); setBullionCogs(bcg);
      setExpByCat(ec); setExpByMonth(em); setSalesByMonth(sm); setSalesByPM(sp);
      setSplit(splitData); setDiscountInfo(discData);
      setPriorSalesTotals(pst); setPriorExpTotals(pet); setPriorCogs(pcg); setPriorBullionCogs(pbcg);
      setPriorExpByCat(pec); setPriorSalesByPM(psp); setPriorSplit(priorSplitData);
      setPriorDiscountInfo(pDiscData);

      const fromLabel = formatDateLong(range.from);
      const toLabel = formatDateLong(range.to);
      setDateLabel(`${fromLabel} — ${toLabel}`);

      const priorFromLabel = formatDateLong(prior.from);
      const priorToLabel = formatDateLong(prior.to);
      setPriorLabel(`${priorFromLabel} — ${priorToLabel}`);
    } else {
      const [st, et, cg, bcg, ec, sm, sp, splitData, discData] = await Promise.all([
        getSalesTotals(), getExpensesTotals(), getCostOfGoodsSold(),
        getBullionCOGSByRange('2000-01-01', '2099-12-31'),
        getExpensesByCategory(), getSalesByMonth(), getSalesByPaymentMethod(),
        getSalesSplitByDateRange('2000-01-01', '2099-12-31'),
        getDiscountTotalForRange('2000-01-01', '2099-12-31'),
      ]);
      setSalesTotals(st); setExpTotals(et); setCogs(cg); setBullionCogs(bcg); setExpByCat(ec);
      setExpByMonth([]); setSalesByMonth(sm); setSalesByPM(sp);
      setSplit(splitData); setDiscountInfo(discData);
      setPriorSalesTotals({ total_sales: 0, sale_count: 0 });
      setPriorExpTotals({ total_expenses: 0, expense_count: 0 });
      setPriorCogs(0); setPriorBullionCogs(0); setPriorExpByCat({}); setPriorSalesByPM([]);
      setPriorSplit(null); setPriorDiscountInfo({ totalDiscount: 0, discountCount: 0 });
      setDateLabel('All Time'); setPriorLabel('');
    }

    const [sc, sr, supTotals] = await Promise.all([getStockCostTotal(), getStockRetailTotal(), getSupplierInvoicesTotals()]);
    setStockCost(sc);
    setStockRetail(sr);
    setSupplierDebt(supTotals.total_owed);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [period]);

  function handleCustomApply() {
    if (customFrom && customTo) loadAll();
  }

  // Profit calculations — stock only (consignment excluded from COGS)
  const stockSalesTotal = split?.stockSalesTotal || 0;
  const consignmentSalesTotal = split?.consignmentSalesTotal || 0;
  const consignmentCommission = split?.consignmentCommission || 0;
  const consignmentOwed = split?.consignmentOwed || 0;

  const priorStockSalesTotal = priorSplit?.stockSalesTotal || 0;
  const priorConsignmentCommission = priorSplit?.consignmentCommission || 0;

  // Gross profit = Stock sales (already net of discounts) - Stock COGS - Bullion COGS + Consignment commission
  const totalCogs = cogs + bullionCogs;
  const stockGrossProfit = stockSalesTotal - totalCogs;
  const totalGrossProfit = stockGrossProfit + consignmentCommission;
  const netProfit = totalGrossProfit - expTotals.total_expenses;

  const priorTotalCogs = priorCogs + priorBullionCogs;
  const priorStockGrossProfit = priorStockSalesTotal - priorTotalCogs;
  const priorTotalGrossProfit = priorStockGrossProfit + priorConsignmentCommission;
  const priorNetProfit = priorTotalGrossProfit - priorExpTotals.total_expenses;

  // Collect all expense categories across both periods
  const allExpCats = Array.from(new Set([
    ...expByCat.map(e => e.category),
    ...Object.keys(priorExpByCat),
  ])).sort();

  const currentExpByCategory: Record<string, number> = {};
  for (const e of expByCat) currentExpByCategory[e.category] = e.total;

  async function generatePDF() {
    setGenerating(true);
    try {
      const range = dateRange;
      const prior = range ? getPriorYearRange(range.from, range.to) : null;

      const reportData = {
        businessName: "Sylvia's Surprises",
        businessSubtitle: "Antiques, Collectibles & More",
        address: ["Memorial Hall", "Main Road", "Union Mills", "IM4 4AD"],
        phone: "07624 433076",
        email: "gavin@sylviassurprises.im",
        periodLabel: dateLabel,
        priorLabel: priorLabel,
        generatedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        generatedBy: currentUser.name,

        // Income split
        income: {
          current: {
            byMethod: salesByPM.map(m => ({ label: m.method, total: m.total })),
            total: salesTotals.total_sales,
            stockSales: stockSalesTotal,
            consignmentSales: consignmentSalesTotal,
            consignmentCommission: consignmentCommission,
            consignmentOwed: consignmentOwed,
          },
          prior: {
            byMethod: priorSalesByPM.map(m => ({ label: m.method, total: m.total })),
            total: priorSalesTotals.total_sales,
            stockSales: priorStockSalesTotal,
            consignmentSales: priorSplit?.consignmentSalesTotal || 0,
            consignmentCommission: priorConsignmentCommission,
          },
        },
        expenditure: {
          categories: allExpCats.map(cat => ({
            category: cat,
            current: currentExpByCategory[cat] || 0,
            prior: priorExpByCat[cat] || 0,
          })),
          currentTotal: expTotals.total_expenses,
          priorTotal: priorExpTotals.total_expenses,
        },
        discounts: {
          current: discountInfo.totalDiscount,
          currentCount: discountInfo.discountCount,
          prior: priorDiscountInfo.totalDiscount,
          priorCount: priorDiscountInfo.discountCount,
        },
        cogs: { current: cogs, prior: priorCogs },
        bullionCogs: { current: bullionCogs, prior: priorBullionCogs },
        grossProfit: { current: totalGrossProfit, prior: priorTotalGrossProfit },
        netSurplus: { current: netProfit, prior: priorNetProfit },

        salesByMonth: salesByMonth.map(m => ({ month: formatMonth(m.month), total: m.total, count: m.count })),
        salesByPayment: salesByPM.map(p => ({ method: p.method, total: p.total, count: p.count })),

        stockValueAtCost: stockCost,
        stockValueAtRetail: stockRetail,
        hasPrior: !!prior,
      };

      const dataJson = JSON.stringify(reportData);
      const filename = `Sylvias-Accountants-Pack-${period}-${Date.now()}.pdf`;
      const outPath = `/tmp/${filename}`;

      await window.tasklet.writeFileToDisk('/tmp/acct_report_data.json', dataJson);

      const script = `
import json, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

with open('/tmp/acct_report_data.json', 'r') as f:
    data = json.load(f)

W, H = A4
doc = SimpleDocTemplate('${outPath}', pagesize=A4,
    leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm)

# Colours
NAVY = HexColor('#1a365d')
DARK_BG = HexColor('#2d3748')
LIGHT_BG = HexColor('#f7fafc')
BORDER = HexColor('#cbd5e0')
GREEN = HexColor('#276749')
RED = HexColor('#c53030')
GREY = HexColor('#718096')
PURPLE = HexColor('#6b21a8')
WHITE = white

styles = getSampleStyleSheet()
s_title = ParagraphStyle('RTitle', parent=styles['Title'], fontSize=22, textColor=NAVY, fontName='Helvetica-Bold', spaceAfter=2, alignment=TA_CENTER)
s_subtitle = ParagraphStyle('RSub', parent=styles['Normal'], fontSize=11, textColor=GREY, alignment=TA_CENTER, spaceAfter=4)
s_heading = ParagraphStyle('RHead', parent=styles['Heading2'], fontSize=13, textColor=NAVY, fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=6)
s_subhead = ParagraphStyle('RSubHead', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold', textColor=NAVY, spaceBefore=8, spaceAfter=4)
s_normal = styles['Normal']
s_small = ParagraphStyle('Small', parent=s_normal, fontSize=8, textColor=GREY)
s_footer = ParagraphStyle('Footer', parent=s_normal, fontSize=7, textColor=GREY, alignment=TA_CENTER)
s_toc = ParagraphStyle('TOC', parent=s_normal, fontSize=11, spaceBefore=4, spaceAfter=2, leftIndent=10)
s_right = ParagraphStyle('Right', parent=s_normal, fontSize=9, alignment=TA_RIGHT)
s_center = ParagraphStyle('Center', parent=s_normal, fontSize=10, alignment=TA_CENTER)

elements = []

# ═══════════════════════════════════════
# PAGE 1: COVER PAGE
# ═══════════════════════════════════════
elements.append(Spacer(1, 30*mm))
elements.append(Paragraph("<b>SYLVIA'S SURPRISES</b>", s_title))
elements.append(Paragraph("Antiques, Collectibles &amp; More", s_subtitle))
elements.append(Spacer(1, 4*mm))

for line in data['address']:
    elements.append(Paragraph(line, ParagraphStyle('Addr', parent=s_normal, fontSize=10, textColor=GREY, alignment=TA_CENTER)))
elements.append(Spacer(1, 15*mm))

hr_data = [['']]; hr_t = Table(hr_data, colWidths=[160*mm])
hr_t.setStyle(TableStyle([('LINEBELOW', (0,0), (-1,0), 1, BORDER)]))
elements.append(hr_t)
elements.append(Spacer(1, 10*mm))

elements.append(Paragraph("<b>Year-End Accountant's Pack</b>", ParagraphStyle('PackTitle', parent=s_normal, fontSize=16, textColor=NAVY, alignment=TA_CENTER, fontName='Helvetica-Bold', spaceAfter=8)))
elements.append(Paragraph(f"For the financial period {data['periodLabel']}", ParagraphStyle('PackPeriod', parent=s_normal, fontSize=11, textColor=GREY, alignment=TA_CENTER, spaceBefore=4, spaceAfter=6)))
elements.append(Spacer(1, 15*mm))

elements.append(hr_t)
elements.append(Spacer(1, 8*mm))

toc_items = [
    "1. Income &amp; Expenditure Account (Stock Sales, Consignment &amp; Expenses)",
    "2. Sales Analysis by Month",
    "3. Sales Analysis by Payment Method",
    "4. Expenditure Analysis by Category",
]
for item in toc_items:
    elements.append(Paragraph(item, s_toc))
elements.append(Spacer(1, 20*mm))

elements.append(Paragraph(f"Prepared by {data['generatedBy']} on {data['generatedDate']}", ParagraphStyle('Prep', parent=s_normal, fontSize=9, textColor=GREY, alignment=TA_CENTER)))

# ═══════════════════════════════════════
# TABLE HELPER
# ═══════════════════════════════════════
def header_style():
    return [
        ('BACKGROUND', (0,0), (-1,0), DARK_BG),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('FONTSIZE', (0,1), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_BG]),
    ]

def total_row_style(row_idx):
    return [
        ('BACKGROUND', (0, row_idx), (-1, row_idx), HexColor('#edf2f7')),
        ('FONTNAME', (0, row_idx), (-1, row_idx), 'Helvetica-Bold'),
    ]

def highlight_row_style(row_idx, color=None):
    bg = color or HexColor('#e6fffa')
    return [
        ('BACKGROUND', (0, row_idx), (-1, row_idx), bg),
        ('FONTNAME', (0, row_idx), (-1, row_idx), 'Helvetica-Bold'),
    ]

def page_header(title, year_end):
    return [
        Paragraph(f"<b>SYLVIA'S SURPRISES</b>", ParagraphStyle('PH', parent=s_normal, fontSize=9, fontName='Helvetica-Bold', textColor=NAVY)),
        Spacer(1, 2*mm),
    ]

def pounds(v):
    if v == 0: return '-'
    return '\\u00a3{:,.2f}'.format(v)

def pounds_var(v):
    if v == 0: return '-'
    if v < 0: return '(\\u00a3{:,.2f})'.format(abs(v))
    return '\\u00a3{:,.2f}'.format(v)

has_prior = data.get('hasPrior', False)
inc = data['income']['current']
pinc = data['income']['prior']

# ═══════════════════════════════════════
# PAGE 2: INCOME & EXPENDITURE ACCOUNT
# ═══════════════════════════════════════
elements.append(PageBreak())
elements.extend(page_header("Income & Expenditure", data['periodLabel']))
elements.append(Paragraph("1. Income &amp; Expenditure Account", s_heading))

if has_prior:
    col_widths = [200, 80, 80]
    ie_rows = [['', 'Current \\u00a3', 'Prior \\u00a3']]
else:
    col_widths = [200, 100]
    ie_rows = [['', '\\u00a3']]

# ── Stock Sales Income ──
ie_rows.append(['Stock Sales Income', '', ''] if has_prior else ['Stock Sales Income', ''])
stock_income_header_idx = len(ie_rows) - 1

for m in inc['byMethod']:
    label = '  ' + m['label'].title() + ' Sales'
    prior_val = 0
    for pm in pinc['byMethod']:
        if pm['label'] == m['label']:
            prior_val = pm['total']
    row = [label, pounds(m['total'])]
    if has_prior: row.append(pounds(prior_val))
    ie_rows.append(row)

stock_total_row = ['Total Stock Sales', pounds(inc['stockSales'])]
if has_prior: stock_total_row.append(pounds(pinc['stockSales']))
ie_rows.append(stock_total_row)
stock_total_idx = len(ie_rows) - 1

# Discounts — informational note only (revenue already net of discounts)
disc = data.get('discounts', {})
disc_current = disc.get('current', 0)
disc_count = disc.get('currentCount', 0)
if disc_current > 0:
    disc_note = f'  (Includes {disc_count} discounted sale{"s" if disc_count != 1 else ""}, total discounts: {pounds(disc_current)})'
    disc_row = [disc_note, '']
    if has_prior: disc_row.append('')
    ie_rows.append(disc_row)

# Blank
ie_rows.append(['', ''] if not has_prior else ['', '', ''])

# COGS (stock)
cogs_row = ['Cost of Goods Sold (Stock)', pounds(data['cogs']['current'])]
if has_prior: cogs_row.append(pounds(data['cogs']['prior']))
ie_rows.append(cogs_row)

# COGS (bullion) — only show if any bullion was sold
bcogs = data.get('bullionCogs', {})
bcogs_cur = bcogs.get('current', 0)
bcogs_pri = bcogs.get('prior', 0)
if bcogs_cur > 0 or bcogs_pri > 0:
    bcogs_row = ['Cost of Goods Sold (Bullion)', pounds(bcogs_cur)]
    if has_prior: bcogs_row.append(pounds(bcogs_pri))
    ie_rows.append(bcogs_row)
    total_cogs_cur = data['cogs']['current'] + bcogs_cur
    total_cogs_pri = data['cogs']['prior'] + bcogs_pri if has_prior else 0
    tcogs_row = ['Total COGS', pounds(total_cogs_cur)]
    if has_prior: tcogs_row.append(pounds(total_cogs_pri))
    ie_rows.append(tcogs_row)

# Stock Gross Profit (includes bullion COGS deduction)
total_cogs_for_gp = data['cogs']['current'] + bcogs_cur
prior_total_cogs_for_gp = (data['cogs']['prior'] + bcogs_pri) if has_prior else 0
sgp = inc['stockSales'] - total_cogs_for_gp
psgp = pinc['stockSales'] - prior_total_cogs_for_gp if has_prior else 0
sgp_row = ['Owned Stock Gross Profit', pounds(sgp)]
if has_prior: sgp_row.append(pounds(psgp))
ie_rows.append(sgp_row)
sgp_idx = len(ie_rows) - 1

# Blank
ie_rows.append(['', ''] if not has_prior else ['', '', ''])

# ── Consignment Income ──
ie_rows.append(['Consignment Sales', '', ''] if has_prior else ['Consignment Sales', ''])
con_header_idx = len(ie_rows) - 1

con_gross_row = ['  Consignment Sales (gross)', pounds(inc['consignmentSales'])]
if has_prior: con_gross_row.append(pounds(pinc.get('consignmentSales', 0)))
ie_rows.append(con_gross_row)

con_owed_row = ['  Less: Owed to Consigners', pounds(inc.get('consignmentOwed', 0))]
if has_prior:
    prior_owed = pinc.get('consignmentSales', 0) - pinc.get('consignmentCommission', 0)
    con_owed_row.append(pounds(prior_owed if prior_owed > 0 else 0))
ie_rows.append(con_owed_row)

con_comm_row = ['Commission Earned', pounds(inc['consignmentCommission'])]
if has_prior: con_comm_row.append(pounds(pinc.get('consignmentCommission', 0)))
ie_rows.append(con_comm_row)
con_comm_idx = len(ie_rows) - 1

# Blank
ie_rows.append(['', ''] if not has_prior else ['', '', ''])

# ── Total Gross Profit ──
tgp = data['grossProfit']['current']
ptgp = data['grossProfit']['prior'] if has_prior else 0
tgp_row = ['Total Gross Profit', pounds(tgp)]
if has_prior: tgp_row.append(pounds(ptgp))
ie_rows.append(tgp_row)
tgp_idx = len(ie_rows) - 1

# Blank
ie_rows.append(['', ''] if not has_prior else ['', '', ''])

# Expenditure section
ie_rows.append(['Expenditure', '', ''] if has_prior else ['Expenditure', ''])
exp_header_idx = len(ie_rows) - 1
for cat_data in data['expenditure']['categories']:
    row = ['  ' + cat_data['category'], pounds(cat_data['current'])]
    if has_prior: row.append(pounds(cat_data['prior']))
    ie_rows.append(row)

exp_total_row = ['Total Expenditure', pounds(data['expenditure']['currentTotal'])]
if has_prior: exp_total_row.append(pounds(data['expenditure']['priorTotal']))
ie_rows.append(exp_total_row)
exp_total_idx = len(ie_rows) - 1

# Blank
ie_rows.append(['', ''] if not has_prior else ['', '', ''])

# Net Surplus / Deficit
net_current = data['netSurplus']['current']
net_prior = data['netSurplus']['prior'] if has_prior else 0
net_label = 'Net Surplus' if net_current >= 0 else 'Net Deficit'
net_row = [net_label, pounds_var(net_current)]
if has_prior: net_row.append(pounds_var(net_prior))
ie_rows.append(net_row)
net_idx = len(ie_rows) - 1

t = Table(ie_rows, colWidths=col_widths)
style = header_style()
style += [('ALIGN', (1,0), (-1,-1), 'RIGHT')]
# Bold section headers
for i, row in enumerate(ie_rows):
    if row[0] in ('Stock Sales Income', 'Consignment Sales', 'Expenditure'):
        style += [('FONTNAME', (0,i), (0,i), 'Helvetica-Bold')]
style += total_row_style(stock_total_idx)
style += total_row_style(exp_total_idx)
style += highlight_row_style(sgp_idx, HexColor('#ebf8ff'))
style += highlight_row_style(con_comm_idx, HexColor('#f3e8ff'))
style += highlight_row_style(tgp_idx, HexColor('#e6fffa'))
style += highlight_row_style(net_idx, HexColor('#f0fff4') if net_current >= 0 else HexColor('#fff5f5'))
t.setStyle(TableStyle(style))
elements.append(t)

# ═══════════════════════════════════════
# SALES BY MONTH
# ═══════════════════════════════════════
if data['salesByMonth']:
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph("2. Sales Analysis by Month", s_heading))
    rows = [['Month', 'No. of Sales', 'Revenue']]
    total_count = 0
    total_rev = 0
    for m in data['salesByMonth']:
        rows.append([m['month'], str(m['count']), pounds(m['total'])])
        total_count += m['count']
        total_rev += m['total']
    rows.append(['Totals', str(total_count), pounds(total_rev)])
    t = Table(rows, colWidths=[180, 80, 100])
    style = header_style() + [('ALIGN', (1,0), (-1,-1), 'RIGHT')]
    style += total_row_style(len(rows)-1)
    t.setStyle(TableStyle(style))
    elements.append(t)

# ═══════════════════════════════════════
# SALES BY PAYMENT METHOD
# ═══════════════════════════════════════
if data['salesByPayment']:
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph("3. Sales Analysis by Payment Method", s_heading))
    rows = [['Payment Method', 'No. of Sales', 'Total']]
    for p in data['salesByPayment']:
        rows.append([p['method'].title(), str(p['count']), pounds(p['total'])])
    rows.append(['Totals', str(sum(p['count'] for p in data['salesByPayment'])), pounds(sum(p['total'] for p in data['salesByPayment']))])
    t = Table(rows, colWidths=[180, 80, 100])
    style = header_style() + [('ALIGN', (1,0), (-1,-1), 'RIGHT')]
    style += total_row_style(len(rows)-1)
    t.setStyle(TableStyle(style))
    elements.append(t)

# ═══════════════════════════════════════
# EXPENDITURE ANALYSIS BY CATEGORY
# ═══════════════════════════════════════
elements.append(PageBreak())
elements.extend(page_header("Expenditure Analysis", data['periodLabel']))
elements.append(Paragraph("4. Expenditure Analysis by Category", s_heading))

if has_prior:
    rows = [['Category', 'Current \\u00a3', 'Prior \\u00a3', 'Variance \\u00a3']]
    for cat_data in data['expenditure']['categories']:
        variance = cat_data['current'] - cat_data['prior']
        rows.append([cat_data['category'], pounds(cat_data['current']), pounds(cat_data['prior']), pounds_var(variance) if variance != 0 else '-'])
    total_var = data['expenditure']['currentTotal'] - data['expenditure']['priorTotal']
    rows.append(['Total Expenditure', pounds(data['expenditure']['currentTotal']), pounds(data['expenditure']['priorTotal']), pounds_var(total_var) if total_var != 0 else '-'])
    t = Table(rows, colWidths=[160, 70, 70, 70])
else:
    rows = [['Category', '\\u00a3']]
    for cat_data in data['expenditure']['categories']:
        rows.append([cat_data['category'], pounds(cat_data['current'])])
    rows.append(['Total Expenditure', pounds(data['expenditure']['currentTotal'])])
    t = Table(rows, colWidths=[240, 120])

style = header_style() + [('ALIGN', (1,0), (-1,-1), 'RIGHT')]
style += total_row_style(len(rows)-1)
if has_prior:
    for i, row in enumerate(rows[1:], 1):
        if len(row) > 3 and row[3] != '-' and row[3].startswith('('):
            style += [('TEXTCOLOR', (3,i), (3,i), RED)]
t.setStyle(TableStyle(style))
elements.append(t)

# ═══════════════════════════════════════
# FOOTER
# ═══════════════════════════════════════
elements.append(Spacer(1, 15*mm))
elements.append(Paragraph("\\u2500" * 60, ParagraphStyle('HR', parent=s_normal, fontSize=6, textColor=BORDER, alignment=TA_CENTER)))
elements.append(Spacer(1, 3*mm))
elements.append(Paragraph("Sylvia's Surprises \\u2014 Memorial Hall, Main Road, Union Mills, IM4 4AD", s_footer))
elements.append(Paragraph("Tel: 07624 433076 | Email: gavin@sylviassurprises.im", s_footer))

# ═══════════════════════════════════════
# BUILD WITH PAGE NUMBERS
# ═══════════════════════════════════════
from reportlab.platypus import Frame, PageTemplate, BaseDocTemplate

def add_page_number(canvas, doc):
    page_num = canvas.getPageNumber()
    text = f"Page {page_num}"
    canvas.saveState()
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(HexColor('#999999'))
    canvas.drawCentredString(W/2, 12*mm, text)
    if page_num > 1:
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(NAVY)
        canvas.drawString(18*mm, H - 12*mm, "SYLVIA'S SURPRISES")
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(HexColor('#999999'))
        canvas.drawRightString(W - 18*mm, H - 12*mm, f"Period ended {data['periodLabel'].split(' — ')[-1] if ' — ' in data['periodLabel'] else data['periodLabel']}")
    canvas.restoreState()

doc.build(elements, onFirstPage=add_page_number, onLaterPages=add_page_number)
print('OK')
`;

      const scriptPath = '/tmp/gen_acct_pack.py';
      await window.tasklet.writeFileToDisk(scriptPath, script);

      const result = await window.tasklet.runCommand(
        `cd /tmp && python3 gen_acct_pack.py`,
        120
      );

      if (result.exitCode === 0) {
        const b64result = await window.tasklet.runCommand(`base64 -w0 '${outPath}'`);
        if (b64result.exitCode === 0 && b64result.log) {
          const dataUrl = 'data:application/pdf;base64,' + b64result.log.trim();
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = filename;
          a.click();
        }
      } else {
        console.error('PDF generation failed:', result.log);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <div className="text-center py-16"><span className="loading loading-spinner loading-lg" /></div>;
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 size={22} /> Year-End Accountant's Pack
        </h2>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm gap-1" onClick={loadAll}>Refresh</button>
          <button className="btn btn-primary btn-sm gap-1" onClick={generatePDF} disabled={generating}>
            {generating ? <span className="loading loading-spinner loading-xs" /> : <Download size={14} />}
            {generating ? 'Generating PDF...' : 'Download Accountant\'s Pack'}
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="card bg-base-200 p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Calendar size={16} className="opacity-60" />
          <span className="text-sm font-semibold">Period:</span>
          {[
            { value: 'this-year' as ReportPeriod, label: `This Tax Year (${getTaxYear(0).label})` },
            { value: 'last-year' as ReportPeriod, label: `Last Year (${getTaxYear(-1).label})` },
            { value: 'this-month' as ReportPeriod, label: 'This Month' },
            { value: 'all-time' as ReportPeriod, label: 'All Time' },
            { value: 'custom' as ReportPeriod, label: 'Custom' },
          ].map(p => (
            <button
              key={p.value}
              className={`btn btn-xs ${period === p.value ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex gap-2 items-center mt-2">
            <input type="date" className="input input-bordered input-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span className="text-sm">to</span>
            <input type="date" className="input input-bordered input-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            <button className="btn btn-primary btn-xs" onClick={handleCustomApply}>Apply</button>
          </div>
        )}
        {dateLabel && <p className="text-xs text-base-content/50 mt-1"><FileText size={12} className="inline" /> Showing: {dateLabel}</p>}
        {priorLabel && <p className="text-xs text-base-content/50"><FileText size={12} className="inline" /> Compared with: {priorLabel}</p>}
      </div>

      {/* ─── INCOME & EXPENDITURE SUMMARY ─── */}
      <div className="card bg-base-200 p-4 mb-4">
        <h3 className="font-bold text-base mb-3 text-primary">1. Income & Expenditure Account</h3>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr className="bg-base-300">
                <th></th>
                <th className="text-right">Current</th>
                {priorLabel && <th className="text-right">Prior Year</th>}
              </tr>
            </thead>
            <tbody>
              {/* Stock Sales */}
              <tr className="font-semibold bg-blue-50"><td className="text-blue-800">📦 Stock Sales Income</td><td></td>{priorLabel && <td></td>}</tr>
              {salesByPM.map(m => {
                const priorVal = priorSalesByPM.find(p => p.method === m.method)?.total || 0;
                return (
                  <tr key={m.method}>
                    <td className="pl-6">{m.method.charAt(0).toUpperCase() + m.method.slice(1)} Sales</td>
                    <td className="text-right">{fmt(m.total)}</td>
                    {priorLabel && <td className="text-right">{priorVal ? fmt(priorVal) : '-'}</td>}
                  </tr>
                );
              })}
              <tr className="font-bold bg-base-300">
                <td>Total Stock Sales</td>
                <td className="text-right text-blue-700">{fmt(stockSalesTotal)}</td>
                {priorLabel && <td className="text-right">{fmt(priorStockSalesTotal)}</td>}
              </tr>
              {discountInfo.totalDiscount > 0 && (
                <tr className="text-gray-500 text-sm">
                  <td className="pl-6 italic">Includes {discountInfo.discountCount} discounted sale{discountInfo.discountCount !== 1 ? 's' : ''} (total discounts: {fmt(discountInfo.totalDiscount)})</td>
                  <td></td>
                  {priorLabel && <td></td>}
                </tr>
              )}
              <tr><td colSpan={priorLabel ? 3 : 2}></td></tr>

              {/* COGS */}
              <tr><td>Cost of Goods Sold (Stock)</td><td className="text-right">{fmt(cogs)}</td>{priorLabel && <td className="text-right">{priorCogs ? fmt(priorCogs) : '-'}</td>}</tr>
              {(bullionCogs > 0 || priorBullionCogs > 0) && (
                <tr><td>Cost of Goods Sold (Bullion)</td><td className="text-right">{fmt(bullionCogs)}</td>{priorLabel && <td className="text-right">{priorBullionCogs ? fmt(priorBullionCogs) : '-'}</td>}</tr>
              )}
              {(bullionCogs > 0 || priorBullionCogs > 0) && (
                <tr className="bg-base-200"><td className="pl-6 italic text-sm">Total COGS</td><td className="text-right">{fmt(totalCogs)}</td>{priorLabel && <td className="text-right">{fmt(priorTotalCogs)}</td>}</tr>
              )}
              <tr className="font-bold bg-blue-50">
                <td className="text-blue-800">Owned Stock Gross Profit</td>
                <td className="text-right text-blue-700">{fmt(stockGrossProfit)}</td>
                {priorLabel && <td className="text-right">{fmt(priorStockGrossProfit)}</td>}
              </tr>
              <tr><td colSpan={priorLabel ? 3 : 2}></td></tr>

              {/* Consignment */}
              <tr className="font-semibold bg-purple-50"><td className="text-purple-800">🤝 Consignment Sales</td><td></td>{priorLabel && <td></td>}</tr>
              <tr>
                <td className="pl-6">Consignment Sales (gross)</td>
                <td className="text-right">{fmt(consignmentSalesTotal)}</td>
                {priorLabel && <td className="text-right">{fmt(priorSplit?.consignmentSalesTotal || 0)}</td>}
              </tr>
              <tr>
                <td className="pl-6">Less: Owed to Consigners</td>
                <td className="text-right text-orange-600">{fmt(consignmentOwed)}</td>
                {priorLabel && <td className="text-right">{fmt((priorSplit?.consignmentSalesTotal || 0) - priorConsignmentCommission)}</td>}
              </tr>
              <tr className="font-bold bg-purple-50">
                <td className="text-purple-800">Commission Earned</td>
                <td className="text-right text-purple-700">{fmt(consignmentCommission)}</td>
                {priorLabel && <td className="text-right">{fmt(priorConsignmentCommission)}</td>}
              </tr>
              <tr><td colSpan={priorLabel ? 3 : 2}></td></tr>

              {/* Total Gross Profit */}
              <tr className="font-bold bg-success/10">
                <td>Total Gross Profit</td>
                <td className="text-right text-success">{fmt(totalGrossProfit)}</td>
                {priorLabel && <td className="text-right">{fmt(priorTotalGrossProfit)}</td>}
              </tr>
              <tr><td colSpan={priorLabel ? 3 : 2}></td></tr>

              {/* Expenditure */}
              <tr className="font-semibold"><td>Expenditure</td><td></td>{priorLabel && <td></td>}</tr>
              {expByCat.map(c => {
                const priorVal = priorExpByCat[c.category] || 0;
                return (
                  <tr key={c.category}>
                    <td className="pl-6">{c.category}</td>
                    <td className="text-right">{fmt(c.total)}</td>
                    {priorLabel && <td className="text-right">{priorVal ? fmt(priorVal) : '-'}</td>}
                  </tr>
                );
              })}
              <tr className="font-bold bg-base-300">
                <td>Total Expenditure</td>
                <td className="text-right text-error">{fmt(expTotals.total_expenses)}</td>
                {priorLabel && <td className="text-right">{fmt(priorExpTotals.total_expenses)}</td>}
              </tr>
              <tr><td colSpan={priorLabel ? 3 : 2}></td></tr>

              {/* Net */}
              <tr className={`font-bold ${netProfit >= 0 ? 'bg-success/10' : 'bg-error/10'}`}>
                <td>{netProfit >= 0 ? 'Net Surplus' : 'Net Deficit'}</td>
                <td className={`text-right ${netProfit >= 0 ? 'text-success' : 'text-error'}`}>{fmt(Math.abs(netProfit))}</td>
                {priorLabel && <td className="text-right">{fmt(Math.abs(priorNetProfit))}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Assets & Liabilities */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="stat bg-base-200 rounded-lg p-3 inline-block">
          <div className="stat-title text-xs flex items-center gap-1"><Package size={14} /> Stock Value (at cost)</div>
          <div className="stat-value text-lg">{fmt(stockCost)}</div>
          <div className="text-xs text-base-content/60 mt-1">Retail value: {fmt(stockRetail)}</div>
        </div>
        {supplierDebt > 0 && (
          <div className="stat bg-error/10 rounded-lg p-3 inline-block border border-error/30">
            <div className="stat-title text-xs flex items-center gap-1 text-error">📋 Supplier Debt (liability)</div>
            <div className="stat-value text-lg text-error">{fmt(supplierDebt)}</div>
          </div>
        )}
        <div className="stat bg-base-200 rounded-lg p-3 inline-block">
          <div className="stat-title text-xs">Net Stock Position</div>
          <div className={`stat-value text-lg ${stockCost - supplierDebt >= 0 ? 'text-success' : 'text-error'}`}>{fmt(stockCost - supplierDebt)}</div>
        </div>
        {discountInfo.totalDiscount > 0 && (
          <div className="stat bg-warning/10 rounded-lg p-3 inline-block border border-warning/30">
            <div className="stat-title text-xs flex items-center gap-1 text-warning">🏷️ Discounts Given</div>
            <div className="stat-value text-lg text-warning">{fmt(discountInfo.totalDiscount)}</div>
            <div className="text-xs text-base-content/60 mt-1">{discountInfo.discountCount} discounted sale{discountInfo.discountCount !== 1 ? 's' : ''} in period</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Sales by Month */}
        <div className="card bg-base-200 p-4">
          <h3 className="font-bold text-sm mb-3 text-primary flex items-center gap-2"><TrendingUp size={16} /> 2. Sales by Month</h3>
          {salesByMonth.length === 0 ? (
            <p className="text-base-content/50 text-sm">No sales in this period</p>
          ) : (
            <table className="table table-sm">
              <thead><tr><th>Month</th><th className="text-right">Sales</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>
                {salesByMonth.map(m => (
                  <tr key={m.month}>
                    <td>{formatMonth(m.month)}</td>
                    <td className="text-right">{m.count}</td>
                    <td className="text-right font-semibold">{fmt(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sales by Payment Method */}
        <div className="card bg-base-200 p-4">
          <h3 className="font-bold text-sm mb-3 text-primary flex items-center gap-2"><PoundSterling size={16} /> 3. By Payment Method</h3>
          {salesByPM.length === 0 ? (
            <p className="text-base-content/50 text-sm">No sales in this period</p>
          ) : (
            <table className="table table-sm">
              <thead><tr><th>Method</th><th className="text-right">Count</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {salesByPM.map(p => (
                  <tr key={p.method}>
                    <td className="capitalize">{p.method}</td>
                    <td className="text-right">{p.count}</td>
                    <td className="text-right font-semibold">{fmt(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── EXPENDITURE ANALYSIS ─── */}
      <div className="card bg-base-200 p-4 mb-4">
        <h3 className="font-bold text-sm mb-3 text-primary flex items-center gap-2"><TrendingDown size={16} /> 4. Expenditure Analysis by Category</h3>
        {allExpCats.length === 0 ? (
          <p className="text-base-content/50 text-sm">No expenses in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Current</th>
                  {priorLabel && <th className="text-right">Prior</th>}
                  {priorLabel && <th className="text-right">Variance</th>}
                </tr>
              </thead>
              <tbody>
                {allExpCats.map(cat => {
                  const curr = currentExpByCategory[cat] || 0;
                  const prior = priorExpByCat[cat] || 0;
                  const variance = curr - prior;
                  return (
                    <tr key={cat}>
                      <td>{cat}</td>
                      <td className="text-right">{curr ? fmt(curr) : '-'}</td>
                      {priorLabel && <td className="text-right">{prior ? fmt(prior) : '-'}</td>}
                      {priorLabel && (
                        <td className={`text-right ${variance > 0 ? 'text-error' : variance < 0 ? 'text-success' : ''}`}>
                          {variance !== 0 ? fmtVar(variance) : '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr className="font-bold bg-base-300">
                  <td>Total</td>
                  <td className="text-right">{fmt(expTotals.total_expenses)}</td>
                  {priorLabel && <td className="text-right">{fmt(priorExpTotals.total_expenses)}</td>}
                  {priorLabel && (
                    <td className={`text-right ${(expTotals.total_expenses - priorExpTotals.total_expenses) > 0 ? 'text-error' : 'text-success'}`}>
                      {fmtVar(expTotals.total_expenses - priorExpTotals.total_expenses)}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>


    </div>
  );
};
