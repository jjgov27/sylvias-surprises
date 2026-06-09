import React, { useState, useEffect, useRef } from 'react';
import { StaffUser, Expense } from '../types';
import { getAllExpenses, addExpense, updateExpense, deleteExpense, EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS, getStaffUsers, getExpenseCategories } from '../utils/db';
import { Receipt, Plus, Trash2, Edit3, X, Save, Download, Upload } from 'lucide-react';
import { CsvImport, CsvField } from './CsvImport';

interface Props {
  currentUser: StaffUser;
}

const emptyForm = {
  expense_date: new Date().toISOString().slice(0, 10),
  category: 'General',
  description: '',
  amount: '',
  receipt_photo: '',
  entered_by: '',
  payment_method: 'Cash',
  paid_by: '',
};

export const Expenses: React.FC<Props> = ({ currentUser }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, entered_by: currentUser.initials, paid_by: currentUser.name });
  const [editId, setEditId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState('All');
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dynExpenseCategories, setDynExpenseCategories] = useState<string[]>(EXPENSE_CATEGORIES);

  useEffect(() => { getExpenseCategories().then(setDynExpenseCategories); }, []);

  const expenseCsvFields: CsvField[] = [
    { key: 'expense_date', label: 'Date', required: true, type: 'date' },
    { key: 'category', label: 'Category', required: false, defaultValue: 'General', type: 'select', options: dynExpenseCategories },
    { key: 'description', label: 'Description', required: true, type: 'text' },
    { key: 'amount', label: 'Amount', required: true, type: 'number' },
  ];

  async function handleCsvImport(rows: Record<string, string>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const amt = parseFloat(row.amount?.replace(/[£$,]/g, '') || '0');
        if (isNaN(amt) || amt <= 0) { errors.push(`Row ${i + 1}: Invalid amount "${row.amount}"`); continue; }
        if (!row.description?.trim()) { errors.push(`Row ${i + 1}: Missing description`); continue; }

        // Parse date — try various formats
        let dateStr = row.expense_date?.trim() || new Date().toISOString().slice(0, 10);
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
          const [d, m, y] = dateStr.split('/');
          dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateStr)) {
          const [d, m, y] = dateStr.split('/');
          dateStr = `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        const cat = dynExpenseCategories.includes(row.category) ? row.category : 'General';

        await addExpense({
          expense_date: dateStr,
          category: cat,
          description: row.description.trim(),
          amount: amt,
          receipt_photo: '',
          entered_by: currentUser.initials,
          payment_method: row.payment_method || 'Cash',
          paid_by: row.paid_by || currentUser.name,
        });
        imported++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err}`);
      }
    }
    await load();
    return { imported, errors };
  }

  async function load() {
    setLoading(true);
    const data = await getAllExpenses();
    setExpenses(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    getStaffUsers().then(setStaffList);
  }, []);

  function setField(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => ({ ...f, receipt_photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setFormError('');
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { setFormError('Please enter a valid amount'); return; }
    if (!form.description.trim()) { setFormError('Please enter a description'); return; }

    if (editId !== null) {
      await updateExpense({
        id: editId,
        expense_date: form.expense_date,
        category: form.category,
        description: form.description,
        amount: amt,
        receipt_photo: form.receipt_photo,
        entered_by: form.entered_by,
        payment_method: form.payment_method,
        paid_by: form.paid_by,
        created_at: '',
      });
    } else {
      await addExpense({
        expense_date: form.expense_date,
        category: form.category,
        description: form.description,
        amount: amt,
        receipt_photo: form.receipt_photo,
        entered_by: currentUser.initials,
        payment_method: form.payment_method,
        paid_by: form.paid_by,
      });
    }
    setForm({ ...emptyForm, entered_by: currentUser.initials, paid_by: currentUser.name });
    setEditId(null);
    setShowForm(false);
    await load();
    setSavedMsg(editId !== null ? '✅ Expense updated' : '✅ Expense saved');
    setTimeout(() => setSavedMsg(''), 3000);
  }

  function startEdit(exp: Expense) {
    setForm({
      expense_date: exp.expense_date,
      category: exp.category,
      description: exp.description,
      amount: String(exp.amount),
      receipt_photo: exp.receipt_photo,
      entered_by: exp.entered_by,
      payment_method: exp.payment_method || 'Cash',
      paid_by: exp.paid_by || '',
    });
    setEditId(exp.id);
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    await deleteExpense(id);
    await load();
  }

  async function downloadExpensesPDF() {
    setGenerating(true);
    try {
      const list = filtered.map(e => ({
        date: e.expense_date, category: e.category, description: e.description,
        amount: e.amount, by: e.entered_by,
      }));
      const byCat: Record<string, number> = {};
      filtered.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
      const data = { filter: filterCat, total: totalFiltered, entries: list,
        byCategory: Object.entries(byCat).map(([c, t]) => ({ category: c, total: t })).sort((a, b) => b.total - a.total) };
      const dataJson = JSON.stringify(data);
      const filename = `expenses-${filterCat.toLowerCase().replace(/[^a-z]/g, '')}-${Date.now()}.pdf`;
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
elements = []
elements.append(Paragraph("Sylvia's Surprises — Expenses", ParagraphStyle('T', parent=styles['Title'], fontSize=16, spaceAfter=4)))
elements.append(Paragraph(f"Filter: {data['filter']} | Total: \\u00a3{data['total']:.2f}", ParagraphStyle('S', parent=styles['Normal'], fontSize=10, textColor=HexColor('#666'), spaceAfter=12)))

# By category summary
if data['byCategory']:
    elements.append(Paragraph("Summary by Category", ParagraphStyle('H', parent=styles['Heading2'], fontSize=12, spaceAfter=6)))
    rows = [['Category', 'Total']]
    for c in data['byCategory']:
        rows.append([c['category'], '\\u00a3{:.2f}'.format(c['total'])])
    rows.append(['TOTAL', '\\u00a3{:.2f}'.format(data['total'])])
    t = Table(rows, colWidths=[240, 120])
    t.setStyle(TableStyle([
      ('BACKGROUND',(0,0),(-1,0),HexColor('#f0f0f0')),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
      ('FONTSIZE',(0,0),(-1,-1),9),('GRID',(0,0),(-1,-1),0.5,HexColor('#ccc')),
      ('ALIGN',(1,0),(1,-1),'RIGHT'),('FONTNAME',(0,-1),(-1,-1),'Helvetica-Bold'),
      ('BACKGROUND',(0,-1),(-1,-1),HexColor('#f0f0f0')),
      ('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3),
    ]))
    elements.append(t)
    elements.append(Spacer(1,6*mm))

# Detail
if data['entries']:
    elements.append(Paragraph("Expense Detail", ParagraphStyle('H2', parent=styles['Heading2'], fontSize=12, spaceAfter=6)))
    rows = [['Date', 'Category', 'Description', 'Amount', 'By']]
    from datetime import datetime
    for e in data['entries']:
        d = e['date']
        try: d = datetime.strptime(e['date'], '%Y-%m-%d').strftime('%d/%m/%Y')
        except: pass
        rows.append([d, e['category'], e['description'][:50], '\\u00a3{:.2f}'.format(e['amount']), e['by']])
    t = Table(rows, colWidths=[65, 100, 160, 65, 30])
    t.setStyle(TableStyle([
      ('BACKGROUND',(0,0),(-1,0),HexColor('#f0f0f0')),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
      ('FONTSIZE',(0,0),(-1,-1),8),('GRID',(0,0),(-1,-1),0.5,HexColor('#ccc')),
      ('ALIGN',(3,0),(3,-1),'RIGHT'),
      ('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2),
    ]))
    elements.append(t)

elements.append(Spacer(1,8*mm))
elements.append(Paragraph("Sylvia's Surprises — Memorial Hall, Main Road, Union Mills, IM4 4AD", ParagraphStyle('F', parent=styles['Normal'], fontSize=7, textColor=HexColor('#999'), alignment=1)))
doc.build(elements)
print('OK')
`;
      await window.tasklet.writeFileToDisk('/tmp/gen_expenses_pdf.py', script);
      await window.tasklet.writeFileToDisk('/tmp/expenses_data.json', dataJson);
      const result = await window.tasklet.runCommand(
        `cd /tmp && uv run --with reportlab python3 gen_expenses_pdf.py "$(cat /tmp/expenses_data.json)"`, 120);
      if (result.exitCode === 0) {
        const b64 = await window.tasklet.runCommand(`base64 -w0 '${outPath}'`);
        if (b64.exitCode === 0 && b64.log) {
          const a = document.createElement('a');
          a.href = 'data:application/pdf;base64,' + b64.log.trim();
          a.download = filename;
          a.click();
        }
      } else { console.error('Expenses PDF failed:', result.log); }
    } catch (err) { console.error('Expenses PDF error:', err); }
    finally { setGenerating(false); }
  }

  const filtered = filterCat === 'All' ? expenses : expenses.filter(e => e.category === filterCat);
  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0);
  const fmt = (v: number) => '£' + v.toFixed(2);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Receipt size={22} /> Expenses
        </h2>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm gap-1" onClick={downloadExpensesPDF} disabled={generating}>
            {generating ? <span className="loading loading-spinner loading-xs" /> : <Download size={14} />}
            {generating ? 'Generating...' : 'PDF'}
          </button>
          <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowCsvImport(!showCsvImport)}>
            <Upload size={14} /> Import CSV
          </button>
          <button className="btn btn-primary btn-sm gap-1" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...emptyForm, entered_by: currentUser.initials, paid_by: currentUser.name }); }}>
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* CSV Import */}
      {showCsvImport && (
        <CsvImport
          title="Import Expenses from CSV"
          fields={expenseCsvFields}
          onImport={handleCsvImport}
          onClose={() => setShowCsvImport(false)}
        />
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card bg-base-200 p-4 mb-4">
          <h3 className="font-semibold mb-3">{editId ? 'Edit Expense' : 'New Expense'}</h3>
          {formError && <div className="alert alert-error py-2 mb-2 text-sm">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-xs">Date</span></label>
              <input type="date" className="input input-bordered input-sm" value={form.expense_date} onChange={e => setField('expense_date', e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-xs">Category</span></label>
              <select className="select select-bordered select-sm" value={form.category} onChange={e => setField('category', e.target.value)}>
                {dynExpenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-control sm:col-span-2">
              <label className="label py-0"><span className="label-text text-xs">Description</span></label>
              <input type="text" className="input input-bordered input-sm" style={{ textTransform: 'capitalize' }} placeholder="What was it for?" value={form.description} onChange={e => setField('description', e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-xs">Amount (£)</span></label>
              <input type="text" className="input input-bordered input-sm" placeholder="0.00" value={form.amount} onChange={e => setField('amount', e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-xs">Payment Method</span></label>
              <select className="select select-bordered select-sm" value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}>
                {EXPENSE_PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-xs">Paid By</span></label>
              <select className="select select-bordered select-sm" value={form.paid_by} onChange={e => setField('paid_by', e.target.value)}>
                <option value="">Select who paid...</option>
                {staffList.map(s => <option key={s.id} value={s.name}>{s.name} ({s.initials})</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-xs">Receipt Photo</span></label>
              <div className="flex gap-2 items-center">
                <input type="file" accept="image/*" className="file-input file-input-bordered file-input-sm flex-1" ref={fileRef} onChange={handlePhotoChange} />
                {form.receipt_photo && (
                  <img src={form.receipt_photo} className="w-10 h-10 object-cover rounded cursor-pointer border" onClick={() => setExpandedPhoto(form.receipt_photo)} />
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-primary btn-sm gap-1" onClick={handleSave}>
              <Save size={14} /> {editId ? 'Update' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Save confirmation */}
      {savedMsg && (
        <div className="alert alert-success py-2 mb-3 text-sm">{savedMsg}</div>
      )}

      {/* Filter + Total */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select className="select select-bordered select-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="All">All Categories</option>
          {dynExpenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto badge badge-lg badge-error gap-1">Total: {fmt(totalFiltered)}</div>
      </div>

      {/* Expenses list */}
      {loading ? (
        <div className="text-center py-8"><span className="loading loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-base-content/50">No expenses recorded yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th className="text-right">Amount</th>
                <th>Method</th>
                <th>By</th>
                <th>Paid By</th>
                <th>Receipt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(exp => (
                <tr key={exp.id} className="hover">
                  <td className="text-xs">{new Date(exp.expense_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td><span className="badge badge-ghost badge-sm">{exp.category}</span></td>
                  <td>{exp.description}</td>
                  <td className="text-right font-semibold">{fmt(exp.amount)}</td>
                  <td className="text-xs">{exp.payment_method || '—'}</td>
                  <td className="text-xs">{exp.entered_by}</td>
                  <td className="text-xs">{exp.paid_by || '—'}</td>
                  <td>
                    {exp.receipt_photo ? (
                      <img src={exp.receipt_photo} className="w-8 h-8 object-cover rounded cursor-pointer" onClick={() => setExpandedPhoto(exp.receipt_photo)} />
                    ) : (
                      <span className="text-base-content/30 text-xs">—</span>
                    )}
                  </td>
                  <td className="flex gap-1">
                    <button className="btn btn-ghost btn-xs" onClick={() => startEdit(exp)}><Edit3 size={12} /></button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(exp.id)}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Photo lightbox */}
      {expandedPhoto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setExpandedPhoto(null)}>
          <div className="relative max-w-lg max-h-[80vh]">
            <button className="btn btn-circle btn-sm absolute -top-3 -right-3 z-10" onClick={() => setExpandedPhoto(null)}><X size={16} /></button>
            <img src={expandedPhoto} className="max-w-full max-h-[80vh] rounded-lg shadow-xl" />
          </div>
        </div>
      )}
    </div>
  );
};
