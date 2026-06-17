import React, { useState, useRef, useEffect } from 'react';
import { runSql } from '../utils/db';

interface BulkRow {
  id: number;
  description: string;
  part_number: string;
  qty: string;
  location: string;
  cost: string;
  rrp: string;
  category: string;
  no_partnumber_initials: string;
}

const DEFAULT_CATEGORIES = [
  'Clocks & Watches', 'Vintage China', 'Jewellery', 'Books & Maps', 'Furniture',
  'Art & Prints', 'Curios & Oddities', 'Silverware', 'Glassware', 'Textiles & Linen',
  'Toys & Games', 'Kitchenware', 'Militaria', 'Tools & Hardware', 'Other',
];

const DEFAULT_LOCATIONS = [
  'Front Window', 'Display Cabinet 1', 'Display Cabinet 2', 'Display Cabinet 3',
  'Wall Display', 'Back Room', 'Shelf A', 'Shelf B', 'Shelf C', 'Counter', 'Storage', 'Other',
];

const emptyRow = (id: number): BulkRow => ({
  id, description: '', part_number: '', qty: '1', location: '', cost: '', rrp: '', category: 'Other', no_partnumber_initials: '',
});

interface Props {
  staffName: string;
  staffInitials: string;
  onBack: () => void;
}

export default function BulkStockEntry({ staffName, staffInitials, onBack }: Props) {
  const [rows, setRows] = useState<BulkRow[]>(() => Array.from({ length: 10 }, (_, i) => emptyRow(i)));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: number; errors: string[] } | null>(null);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const nextId = useRef(10);

  // Load custom categories/locations
  useEffect(() => {
    (async () => {
      try {
        const catRows = await runSql("SELECT value FROM sylvias_settings WHERE key='custom_categories'");
        if (catRows.length > 0 && catRows[0].value) {
          const arr = JSON.parse(catRows[0].value);
          if (Array.isArray(arr) && arr.length > 0) setCategories(arr);
        }
      } catch {}
      try {
        const locRows = await runSql("SELECT value FROM sylvias_settings WHERE key='custom_locations'");
        if (locRows.length > 0 && locRows[0].value) {
          const arr = JSON.parse(locRows[0].value);
          if (Array.isArray(arr) && arr.length > 0) setLocations(arr);
        }
      } catch {}
    })();
  }, []);

  const updateRow = (id: number, field: keyof BulkRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRows = (count: number) => {
    const newRows = Array.from({ length: count }, () => {
      const row = emptyRow(nextId.current);
      nextId.current++;
      return row;
    });
    setRows(prev => [...prev, ...newRows]);
  };

  const removeRow = (id: number) => {
    setRows(prev => {
      const updated = prev.filter(r => r.id !== id);
      return updated.length === 0 ? [emptyRow(nextId.current++)] : updated;
    });
  };

  const clearAll = () => {
    nextId.current = 0;
    setRows(Array.from({ length: 10 }, (_, i) => { nextId.current = i + 1; return emptyRow(i); }));
    setResult(null);
  };

  const filledRows = rows.filter(r => r.description.trim() !== '');

  const handleSave = async () => {
    if (filledRows.length === 0) return;

    // Validate
    const errors: string[] = [];
    filledRows.forEach((r, i) => {
      if (!r.description.trim()) errors.push(`Row ${i + 1}: Description is required`);
      if (!r.part_number.trim() && !r.no_partnumber_initials.trim()) {
        errors.push(`Row ${i + 1} ("${r.description.trim().slice(0, 30)}"): Part number is blank — initials required`);
      }
      const cost = parseFloat(r.cost) || 0;
      const rrp = parseFloat(r.rrp) || 0;
      if (rrp > 0 && cost > rrp) errors.push(`Row ${i + 1} ("${r.description.trim().slice(0, 30)}"): Cost (£${cost}) exceeds RRP (£${rrp})`);
    });

    if (errors.length > 0) {
      setResult({ ok: 0, errors });
      return;
    }

    setSaving(true);
    setResult(null);
    let ok = 0;
    const saveErrors: string[] = [];

    for (const r of filledRows) {
      const desc = r.description.trim().replace(/'/g, "''");
      const pn = r.part_number.trim().replace(/'/g, "''");
      const loc = r.location.replace(/'/g, "''");
      const cat = r.category.replace(/'/g, "''");
      const initials = r.no_partnumber_initials.trim().replace(/'/g, "''");
      const qty = parseInt(r.qty) || 1;
      const cost = parseFloat(r.cost) || 0;
      const rrp = parseFloat(r.rrp) || 0;

      const sql = `INSERT INTO sylvias_stock (part_number, description, qty, location, cost, rrp, entered_by, category, no_partnumber_initials, entry_type) VALUES ('${pn}', '${desc}', ${qty}, '${loc}', ${cost}, ${rrp}, '${staffInitials}', '${cat}', '${initials}', 'legacy')`;

      try {
        await runSql(sql);
        ok++;
      } catch (e: any) {
        saveErrors.push(`"${r.description.trim().slice(0, 30)}": ${e.message || 'Unknown error'}`);
      }
    }

    setResult({ ok, errors: saveErrors });
    setSaving(false);

    // Remove successfully saved rows, keep errored ones
    if (saveErrors.length === 0) {
      clearAll();
    }
  };

  // Handle paste from spreadsheet
  const handlePaste = (e: React.ClipboardEvent, rowId: number, fieldIndex: number) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return; // Single cell paste — let default handle it
    e.preventDefault();

    const fields: (keyof BulkRow)[] = ['description', 'part_number', 'qty', 'location', 'cost', 'rrp', 'category'];
    const lines = text.split('\n').filter(l => l.trim());

    setRows(prev => {
      const updated = [...prev];
      const startIdx = updated.findIndex(r => r.id === rowId);
      if (startIdx === -1) return prev;

      lines.forEach((line, lineIdx) => {
        const cells = line.split('\t');
        const targetIdx = startIdx + lineIdx;

        // Add rows if needed
        while (targetIdx >= updated.length) {
          updated.push(emptyRow(nextId.current++));
        }

        cells.forEach((cell, cellIdx) => {
          const fIdx = fieldIndex + cellIdx;
          if (fIdx < fields.length) {
            (updated[targetIdx] as any)[fields[fIdx]] = cell.trim();
          }
        });
      });

      return updated;
    });
  };

  const fieldDefs: { key: keyof BulkRow; label: string; width: string; type: 'text' | 'number' | 'select'; options?: string[] }[] = [
    { key: 'description', label: 'Description *', width: '250px', type: 'text' },
    { key: 'part_number', label: 'Part No.', width: '100px', type: 'text' },
    { key: 'no_partnumber_initials', label: 'No PN Initials', width: '90px', type: 'text' },
    { key: 'qty', label: 'Qty', width: '60px', type: 'number' },
    { key: 'location', label: 'Location', width: '140px', type: 'select', options: locations },
    { key: 'cost', label: 'Cost £', width: '80px', type: 'number' },
    { key: 'rrp', label: 'RRP £', width: '80px', type: 'number' },
    { key: 'category', label: 'Category', width: '150px', type: 'select', options: categories },
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '8px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>📦 Bulk Stock Entry</h2>
        <span style={{ color: '#6b7280', fontSize: '14px' }}>Logged in as {staffName} ({staffInitials})</span>
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' }}>
        <strong>💡 Tips:</strong> Tab between fields • Paste from Excel/Sheets (columns: Description, Part No, Qty, Location, Cost, RRP, Category) • Leave Part No. blank and enter initials • Description is required
      </div>

      {result && (
        <div style={{
          background: result.errors.length > 0 ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${result.errors.length > 0 ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: '8px', padding: '12px 16px', marginBottom: '16px'
        }}>
          {result.ok > 0 && <div style={{ color: '#166534', fontWeight: 600 }}>✅ {result.ok} item{result.ok !== 1 ? 's' : ''} saved successfully!</div>}
          {result.errors.map((err, i) => <div key={i} style={{ color: '#991b1b', fontSize: '14px' }}>❌ {err}</div>)}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '8px 4px', borderBottom: '2px solid #e5e7eb', width: '30px', textAlign: 'center' }}>#</th>
              {fieldDefs.map(f => (
                <th key={f.key} style={{ padding: '8px 4px', borderBottom: '2px solid #e5e7eb', textAlign: 'left', minWidth: f.width, whiteSpace: 'nowrap' }}>
                  {f.label}
                </th>
              ))}
              <th style={{ padding: '8px 4px', borderBottom: '2px solid #e5e7eb', width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ background: row.description.trim() ? '#ffffff' : '#fafafa' }}>
                <td style={{ padding: '4px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>{idx + 1}</td>
                {fieldDefs.map((f, fIdx) => (
                  <td key={f.key} style={{ padding: '2px', borderBottom: '1px solid #f3f4f6' }}>
                    {f.type === 'select' ? (
                      <select
                        value={(row as any)[f.key]}
                        onChange={e => updateRow(row.id, f.key, e.target.value)}
                        style={{ width: '100%', padding: '6px 4px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px', background: 'white' }}
                      >
                        <option value="">—</option>
                        {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={(row as any)[f.key]}
                        onChange={e => updateRow(row.id, f.key, e.target.value)}
                        onPaste={e => handlePaste(e, row.id, fIdx)}
                        style={{
                          width: '100%', padding: '6px 4px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                        inputMode={f.type === 'number' ? 'decimal' : undefined}
                      />
                    )}
                  </td>
                ))}
                <td style={{ padding: '2px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                  <button onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '4px' }} title="Remove row">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => addRows(5)} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>+ 5 Rows</button>
        <button onClick={() => addRows(20)} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>+ 20 Rows</button>
        <button onClick={clearAll} style={{ padding: '8px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', color: '#991b1b' }}>Clear All</button>

        <div style={{ flex: 1 }} />

        <span style={{ color: '#6b7280', fontSize: '14px' }}>
          {filledRows.length} item{filledRows.length !== 1 ? 's' : ''} to save
        </span>

        <button
          onClick={handleSave}
          disabled={saving || filledRows.length === 0}
          style={{
            padding: '10px 24px', background: filledRows.length > 0 ? '#16a34a' : '#d1d5db',
            color: 'white', border: 'none', borderRadius: '6px', cursor: filledRows.length > 0 ? 'pointer' : 'default',
            fontWeight: 600, fontSize: '15px', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '💾 Saving...' : `💾 Save ${filledRows.length} Item${filledRows.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
