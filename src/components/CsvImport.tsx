import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertTriangle, FileSpreadsheet, ArrowRight } from 'lucide-react';

export interface CsvField {
  key: string;
  label: string;
  required: boolean;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: string[]; // for select type — used as default if CSV column missing
  defaultValue?: string;
}

interface Props {
  title: string;
  fields: CsvField[];
  onImport: (rows: Record<string, string>[]) => Promise<{ imported: number; errors: string[] }>;
  onClose: () => void;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(l => parseLine(l)).filter(r => r.some(c => c));
  return { headers, rows };
}

function guessMapping(csvHeaders: string[], fields: CsvField[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  for (const field of fields) {
    const key = field.key.toLowerCase().replace(/_/g, ' ');
    const label = field.label.toLowerCase();
    let bestIdx = -1;
    for (let i = 0; i < csvHeaders.length; i++) {
      const h = csvHeaders[i].toLowerCase().replace(/_/g, ' ');
      if (h === key || h === label || h.includes(key) || key.includes(h) || h.includes(label) || label.includes(h)) {
        bestIdx = i;
        break;
      }
    }
    mapping[field.key] = bestIdx;
  }
  return mapping;
}

export const CsvImport: React.FC<Props> = ({ title, fields, onImport, onClose }) => {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing' | 'done'>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) { setParseError('CSV file appears to be empty'); return; }
      if (rows.length === 0) { setParseError('CSV has headers but no data rows'); return; }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(guessMapping(headers, fields));
      setStep('map');
    };
    reader.readAsText(file);
  }

  function setFieldMapping(fieldKey: string, csvIndex: number) {
    setMapping(m => ({ ...m, [fieldKey]: csvIndex }));
  }

  function getMappedRows(): Record<string, string>[] {
    return csvRows.map(row => {
      const obj: Record<string, string> = {};
      for (const field of fields) {
        const idx = mapping[field.key];
        if (idx >= 0 && idx < row.length) {
          obj[field.key] = row[idx];
        } else if (field.defaultValue !== undefined) {
          obj[field.key] = field.defaultValue;
        } else {
          obj[field.key] = '';
        }
      }
      return obj;
    });
  }

  function validateMapping(): string[] {
    const errors: string[] = [];
    for (const field of fields) {
      if (field.required && mapping[field.key] === -1 && !field.defaultValue) {
        errors.push(`"${field.label}" is required but not mapped to a CSV column`);
      }
    }
    return errors;
  }

  async function handleImport() {
    setStep('importing');
    try {
      const rows = getMappedRows();
      const res = await onImport(rows);
      setResult(res);
      setStep('done');
    } catch (err) {
      setResult({ imported: 0, errors: [`Import failed: ${err}`] });
      setStep('done');
    }
  }

  const mappingErrors = step === 'map' ? validateMapping() : [];
  const previewRows = step === 'preview' ? getMappedRows().slice(0, 5) : [];

  return (
    <div className="card bg-base-200 p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold flex items-center gap-2">
          <FileSpreadsheet size={18} /> {title}
        </h3>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={16} /></button>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div>
          <p className="text-sm text-base-content/60 mb-3">
            Upload a CSV file. The first row should be column headers.
          </p>
          {parseError && <div className="alert alert-error py-2 mb-2 text-sm">{parseError}</div>}
          <div className="flex gap-2 items-center">
            <input type="file" accept=".csv,.txt" className="file-input file-input-bordered file-input-sm flex-1" ref={fileRef} onChange={handleFileChange} />
          </div>
          <div className="text-xs text-base-content/40 mt-2">
            Expected columns: {fields.map(f => f.label).join(', ')}
          </div>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 'map' && (
        <div>
          <p className="text-sm text-base-content/60 mb-3">
            Map your CSV columns to the fields below. We've guessed where we can.
          </p>
          <div className="text-xs badge badge-ghost mb-3">{csvRows.length} rows found in CSV</div>

          {mappingErrors.length > 0 && (
            <div className="alert alert-warning py-2 mb-3 text-sm">
              <AlertTriangle size={14} />
              <div>{mappingErrors.map((e, i) => <div key={i}>{e}</div>)}</div>
            </div>
          )}

          <div className="space-y-2">
            {fields.map(field => (
              <div key={field.key} className="flex items-center gap-2">
                <div className="w-32 text-sm font-medium">
                  {field.label} {field.required && <span className="text-error">*</span>}
                </div>
                <ArrowRight size={14} className="opacity-40" />
                <select
                  className="select select-bordered select-sm flex-1"
                  value={mapping[field.key] ?? -1}
                  onChange={e => setFieldMapping(field.key, parseInt(e.target.value))}
                >
                  <option value={-1}>{field.defaultValue !== undefined ? `(use default: ${field.defaultValue})` : '— skip —'}</option>
                  {csvHeaders.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              className="btn btn-primary btn-sm"
              disabled={mappingErrors.length > 0}
              onClick={() => setStep('preview')}
            >
              Preview Import
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep('upload')}>Back</button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div>
          <p className="text-sm text-base-content/60 mb-3">
            Preview of first 5 rows (of {csvRows.length} total):
          </p>
          <div className="overflow-x-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  {fields.map(f => <th key={f.key}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {fields.map(f => (
                      <td key={f.key} className="text-xs">{row[f.key] || <span className="text-base-content/30">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary btn-sm gap-1" onClick={handleImport}>
              <Upload size={14} /> Import {csvRows.length} Rows
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep('map')}>Back</button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="text-center py-6">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-2 text-sm">Importing {csvRows.length} rows...</p>
        </div>
      )}

      {/* Step 5: Done */}
      {step === 'done' && result && (
        <div>
          {result.imported > 0 && (
            <div className="alert alert-success py-2 mb-2 text-sm">
              <Check size={14} /> Successfully imported {result.imported} rows
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="alert alert-warning py-2 mb-2 text-sm">
              <AlertTriangle size={14} />
              <div className="max-h-32 overflow-y-auto">
                {result.errors.slice(0, 20).map((e, i) => <div key={i}>{e}</div>)}
                {result.errors.length > 20 && <div>...and {result.errors.length - 20} more</div>}
              </div>
            </div>
          )}
          <button className="btn btn-sm btn-ghost mt-2" onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  );
};
