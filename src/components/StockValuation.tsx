import React, { useState, useEffect } from 'react';
import { StaffUser } from '../types';
import { Package, PoundSterling, TrendingUp, Download, Printer, BarChart3, Layers } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

interface CategorySummary {
  category: string;
  item_count: number;
  total_units: number;
  cost_value: number;
  retail_value: number;
  margin: number;
  margin_pct: number;
}

interface ValuationData {
  totalItems: number;
  totalUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  totalMargin: number;
  marginPct: number;
  categories: CategorySummary[];
  zeroStockCount: number;
  avgCostPerUnit: number;
  avgRetailPerUnit: number;
  bullionHeldValue: number;
  bullionHeldCount: number;
}

export function StockValuation({ currentUser }: Props) {
  const [data, setData] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'category' | 'cost_value' | 'retail_value' | 'margin' | 'total_units'>('cost_value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [removals, setRemovals] = useState<RemovalSummary>({ wastageCount: 0, wastageQty: 0, wastageCost: 0, wastageRetail: 0, giftCount: 0, giftQty: 0, giftCost: 0, giftRetail: 0 });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Category breakdown — only items with qty > 0
      const catRows = await window.tasklet.sqlQuery(
        `SELECT category,
                COUNT(*) as item_count,
                COALESCE(SUM(qty), 0) as total_units,
                COALESCE(SUM(cost * qty), 0) as cost_value,
                COALESCE(SUM(rrp * qty), 0) as retail_value
         FROM sylvias_stock
         WHERE qty > 0
         GROUP BY category
         ORDER BY SUM(cost * qty) DESC`
      ) as unknown as { category: string; item_count: number; total_units: number; cost_value: number; retail_value: number }[];

      // Zero-stock count
      const zeroRows = await window.tasklet.sqlQuery(
        `SELECT COUNT(*) as cnt FROM sylvias_stock WHERE qty = 0`
      ) as unknown as { cnt: number }[];

      // Wastage & Gifts
      try {
        const remData = await getStockRemovalsSummary();
        setRemovals(remData);
      } catch(e) { console.error('Removals fetch error:', e); }

      // Bullion held
      const bullionRows = await window.tasklet.sqlQuery(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(purchase_price + premium_paid), 0) as cost FROM sylvias_bullion WHERE status = 'held'`
      ) as unknown as { cnt: number; cost: number }[];

      const categories: CategorySummary[] = catRows.map(r => ({
        ...r,
        margin: r.retail_value - r.cost_value,
        margin_pct: r.cost_value > 0 ? ((r.retail_value - r.cost_value) / r.cost_value) * 100 : 0,
      }));

      const totalItems = categories.reduce((s, c) => s + c.item_count, 0);
      const totalUnits = categories.reduce((s, c) => s + c.total_units, 0);
      const totalCostValue = categories.reduce((s, c) => s + c.cost_value, 0);
      const totalRetailValue = categories.reduce((s, c) => s + c.retail_value, 0);
      const totalMargin = totalRetailValue - totalCostValue;

      setData({
        totalItems,
        totalUnits,
        totalCostValue,
        totalRetailValue,
        totalMargin,
        marginPct: totalCostValue > 0 ? (totalMargin / totalCostValue) * 100 : 0,
        categories,
        zeroStockCount: zeroRows[0]?.cnt || 0,
        avgCostPerUnit: totalUnits > 0 ? totalCostValue / totalUnits : 0,
        avgRetailPerUnit: totalUnits > 0 ? totalRetailValue / totalUnits : 0,
        bullionHeldValue: bullionRows[0]?.cost || 0,
        bullionHeldCount: bullionRows[0]?.cnt || 0,
      });
    } catch (err) {
      console.error('Failed to load stock valuation:', err);
    }
    setLoading(false);
  }

  function sortedCategories(): CategorySummary[] {
    if (!data) return [];
    return [...data.categories].sort((a, b) => {
      const av = sortBy === 'category' ? a.category.toLowerCase() : (a as any)[sortBy];
      const bv = sortBy === 'category' ? b.category.toLowerCase() : (b as any)[sortBy];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'category' ? 'asc' : 'desc');
    }
  }

  function sortArrow(col: typeof sortBy) {
    if (sortBy !== col) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function fmt(n: number) {
    return '£' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  async function generatePDF() {
    if (!data || pdfBusy) return;
    setPdfBusy(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const cats = sortedCategories();

      const pyScript = `
import sys
sys.stdout.reconfigure(encoding='utf-8')
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm

doc = SimpleDocTemplate("/tmp/stock-valuation.pdf", pagesize=A4,
    topMargin=20*mm, bottomMargin=20*mm, leftMargin=15*mm, rightMargin=15*mm)
styles = getSampleStyleSheet()
elements = []

title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=18, spaceAfter=4)
sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, textColor=colors.grey)
section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=13, spaceBefore=12, spaceAfter=6)
note_style = ParagraphStyle('Note', parent=styles['Normal'], fontSize=9, textColor=colors.grey)

elements.append(Paragraph("Sylvia's Surprises — Stock Valuation", title_style))
elements.append(Paragraph("${dateStr} at ${timeStr}", sub_style))
elements.append(Spacer(1, 8*mm))

# Summary cards as a table
summary_data = [
    ['Total Items (in stock)', '${data.totalItems}'],
    ['Total Units', '${data.totalUnits}'],
    ['Cost Value', '${fmt(data.totalCostValue)}'],
    ['Retail Value', '${fmt(data.totalRetailValue)}'],
    ['Potential Margin', '${fmt(data.totalMargin)} (${data.marginPct.toFixed(1)}%)'],
    ['Avg Cost / Unit', '${fmt(data.avgCostPerUnit)}'],
    ['Avg Retail / Unit', '${fmt(data.avgRetailPerUnit)}'],
    ['Out-of-Stock Lines', '${data.zeroStockCount}'],
${data.bullionHeldCount > 0 ? `    ['Bullion Held (${data.bullionHeldCount} items)', '${fmt(data.bullionHeldValue)}'],` : ''}
]
summary_table = Table(summary_data, colWidths=[140*mm, 40*mm])
summary_table.setStyle(TableStyle([
    ('FONTSIZE', (0, 0), (-1, -1), 10),
    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
    ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.Color(0.85, 0.85, 0.85)),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]))
elements.append(summary_table)
elements.append(Spacer(1, 8*mm))

elements.append(Paragraph("Breakdown by Category", section_style))

cat_header = ['Category', 'Items', 'Units', 'Cost Value', 'Retail Value', 'Margin', 'Margin %']
cat_data = [cat_header]
${cats.map(c => `cat_data.append(['${c.category.replace(/'/g, "\\'")}', '${c.item_count}', '${c.total_units}', '${fmt(c.cost_value)}', '${fmt(c.retail_value)}', '${fmt(c.margin)}', '${c.margin_pct.toFixed(1)}%'])`).join('\n')}
cat_data.append(['TOTAL', '${data.totalItems}', '${data.totalUnits}', '${fmt(data.totalCostValue)}', '${fmt(data.totalRetailValue)}', '${fmt(data.totalMargin)}', '${data.marginPct.toFixed(1)}%'])

cat_table = Table(cat_data, colWidths=[50*mm, 18*mm, 18*mm, 28*mm, 28*mm, 28*mm, 20*mm])
cat_table.setStyle(TableStyle([
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.15, 0.15, 0.25)),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('BACKGROUND', (0, -1), (-1, -1), colors.Color(0.92, 0.92, 0.95)),
    ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
    ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.Color(0.85, 0.85, 0.85)),
    ('LINEABOVE', (0, -1), (-1, -1), 1, colors.Color(0.3, 0.3, 0.3)),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]))
elements.append(cat_table)
elements.append(Spacer(1, 5*mm))
elements.append(Paragraph("Generated by Sylvia's Surprises POS — values at cost price paid", note_style))

doc.build(elements)
print("OK")
`;

      const res = await window.tasklet.runCommand(`python3 << 'PYEOF'\n${pyScript}\nPYEOF`);
      if (!res.log.includes('OK')) {
        alert('PDF generation failed: ' + res.log);
        setPdfBusy(false);
        return;
      }

      // Read and download
      const b64Res = await window.tasklet.runCommand('base64 -w0 /tmp/stock-valuation.pdf');
      const raw = atob(b64Res.log.trim());
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-valuation-${now.toISOString().substring(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF error: ' + (err as Error).message);
    }
    setPdfBusy(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-red-500">Failed to load stock valuation data.</div>;
  }

  const sorted = sortedCategories();

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="text-blue-600" size={28} />
            Stock Valuation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Live snapshot — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            onClick={generatePDF}
            disabled={pdfBusy}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {pdfBusy ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cost Value</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{fmt(data.totalCostValue)}</div>
          <div className="text-xs text-gray-400 mt-1">{data.totalItems} lines · {data.totalUnits} units</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Retail Value</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{fmt(data.totalRetailValue)}</div>
          <div className="text-xs text-gray-400 mt-1">At full selling price</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Potential Margin</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{fmt(data.totalMargin)}</div>
          <div className="text-xs text-gray-400 mt-1">{data.marginPct.toFixed(1)}% markup</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg / Unit</div>
          <div className="text-lg font-bold text-gray-800 mt-1">{fmt(data.avgCostPerUnit)} cost</div>
          <div className="text-sm text-emerald-600">{fmt(data.avgRetailPerUnit)} retail</div>
        </div>
      </div>

      {/* Bullion held */}
      {data.bullionHeldCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🪙</span>
          <div>
            <div className="font-semibold text-yellow-800">Bullion Held: {fmt(data.bullionHeldValue)}</div>
            <div className="text-sm text-yellow-700">{data.bullionHeldCount} item{data.bullionHeldCount !== 1 ? 's' : ''} held as assets (not included in stock figures above)</div>
          </div>
        </div>
      )}

      {/* Out-of-stock info */}
      {data.zeroStockCount > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-sm text-gray-600">
          <span>📦</span>
          <span>{data.zeroStockCount} stock line{data.zeroStockCount !== 1 ? 's' : ''} currently at zero quantity (not included in valuation)</span>
        </div>
      )}

      {/* Wastage & Gifts (all-time stock losses) */}
      {(removals.wastageCost > 0 || removals.giftCost > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <Trash2 size={18} className="text-red-600" />
            Stock Losses (All Time)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {removals.wastageCost > 0 && (
              <>
                <div className="bg-white rounded-lg p-3 border border-red-100">
                  <div className="text-xs font-medium text-red-600 uppercase">Wastage (cost)</div>
                  <div className="text-lg font-bold text-red-700 mt-1">{fmt(removals.wastageCost)}</div>
                  <div className="text-xs text-gray-400">{removals.wastageQty} unit{removals.wastageQty !== 1 ? 's' : ''} · {removals.wastageCount} record{removals.wastageCount !== 1 ? 's' : ''}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-red-100">
                  <div className="text-xs font-medium text-red-400 uppercase">Wastage (retail)</div>
                  <div className="text-lg font-bold text-red-400 mt-1">{fmt(removals.wastageRetail)}</div>
                  <div className="text-xs text-gray-400">Retail value lost</div>
                </div>
              </>
            )}
            {removals.giftCost > 0 && (
              <>
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <div className="text-xs font-medium text-indigo-600 uppercase">Gifts (cost)</div>
                  <div className="text-lg font-bold text-indigo-700 mt-1">{fmt(removals.giftCost)}</div>
                  <div className="text-xs text-gray-400">{removals.giftQty} unit{removals.giftQty !== 1 ? 's' : ''} · {removals.giftCount} record{removals.giftCount !== 1 ? 's' : ''}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <div className="text-xs font-medium text-indigo-400 uppercase">Gifts (retail)</div>
                  <div className="text-lg font-bold text-indigo-400 mt-1">{fmt(removals.giftRetail)}</div>
                  <div className="text-xs text-gray-400">Retail value given</div>
                </div>
              </>
            )}
          </div>
          <div className="mt-2 text-xs text-red-600">
            Total stock asset reduction: {fmt(removals.wastageCost + removals.giftCost)} at cost ({fmt(removals.wastageRetail + removals.giftRetail)} retail)
          </div>
        </div>
      )}

      {/* Category Breakdown Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <BarChart3 size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-700">Breakdown by Category</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:bg-gray-700 select-none"
                  onClick={() => toggleSort('category')}
                >
                  Category{sortArrow('category')}
                </th>
                <th
                  className="text-right px-4 py-3 cursor-pointer hover:bg-gray-700 select-none"
                  onClick={() => toggleSort('total_units')}
                >
                  Units{sortArrow('total_units')}
                </th>
                <th
                  className="text-right px-4 py-3 cursor-pointer hover:bg-gray-700 select-none"
                  onClick={() => toggleSort('cost_value')}
                >
                  Cost Value{sortArrow('cost_value')}
                </th>
                <th
                  className="text-right px-4 py-3 cursor-pointer hover:bg-gray-700 select-none"
                  onClick={() => toggleSort('retail_value')}
                >
                  Retail Value{sortArrow('retail_value')}
                </th>
                <th
                  className="text-right px-4 py-3 cursor-pointer hover:bg-gray-700 select-none"
                  onClick={() => toggleSort('margin')}
                >
                  Margin{sortArrow('margin')}
                </th>
                <th className="text-right px-4 py-3">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((cat, i) => (
                <tr key={cat.category} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{cat.category}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{cat.total_units}</td>
                  <td className="px-4 py-3 text-right text-gray-800 font-medium">{fmt(cat.cost_value)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(cat.retail_value)}</td>
                  <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmt(cat.margin)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{cat.margin_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <td className="px-4 py-3 text-gray-800">TOTAL</td>
                <td className="px-4 py-3 text-right text-gray-800">{data.totalUnits}</td>
                <td className="px-4 py-3 text-right text-gray-800">{fmt(data.totalCostValue)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{fmt(data.totalRetailValue)}</td>
                <td className="px-4 py-3 text-right text-blue-700">{fmt(data.totalMargin)}</td>
                <td className="px-4 py-3 text-right text-gray-800">{data.marginPct.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Visual bar chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Layers size={18} className="text-gray-600" />
          Category Distribution (by cost value)
        </h3>
        <div className="space-y-2">
          {sorted.slice(0, 12).map(cat => {
            const pct = data.totalCostValue > 0 ? (cat.cost_value / data.totalCostValue) * 100 : 0;
            return (
              <div key={cat.category} className="flex items-center gap-3">
                <div className="w-32 text-xs text-gray-600 truncate text-right">{cat.category}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-end pr-2 text-[10px] text-white font-medium whitespace-nowrap"
                    style={{ width: `${Math.max(pct, 3)}%`, minWidth: pct > 0 ? '40px' : '0' }}
                  >
                    {pct >= 5 ? `${pct.toFixed(1)}%` : ''}
                  </div>
                </div>
                <div className="w-20 text-xs text-gray-500 text-right">{fmt(cat.cost_value)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
