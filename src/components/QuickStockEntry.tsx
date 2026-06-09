import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Save, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Camera, Loader2, X, PackagePlus, PackageCheck, Printer } from 'lucide-react';
import { StaffUser, StockItem } from '../types';
import { addStockItem, titleCase, getLocations, getStaffUsers, getAllStock, addScanStagingBatch } from '../utils/db';

interface QuickStockEntryProps {
  currentUser: StaffUser;
  onNavigate?: (view: string) => void;
}

interface EntryRow {
  id: number;
  description: string;
  partNumber: string;
  qty: string;
  location: string;
  cost: string;
  rrp: string;
  enteredBy: string;
  date: string;
  saved: boolean;
  error: string;
  // Duplicate detection
  dupMatch: StockItem | null;
  dupAction: 'none' | 'add' | 'new';
}

function emptyRow(id: number, initials: string, date: string): EntryRow {
  return { id, description: '', partNumber: '', qty: '1', location: '', cost: '', rrp: '', enteredBy: initials, date, saved: false, error: '', dupMatch: null, dupAction: 'none' };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export const QuickStockEntry: React.FC<QuickStockEntryProps> = ({ currentUser, onNavigate }) => {
  const [rows, setRows] = useState<EntryRow[]>([emptyRow(1, currentUser.initials, todayStr())]);
  const [nextId, setNextId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [dynLocations, setDynLocations] = useState<string[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [existingStock, setExistingStock] = useState<StockItem[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  // Scan state
  const [showScan, setShowScan] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState('');
  const scanFileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const lastRowRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getLocations().then(setDynLocations);
    getStaffUsers().then(setStaffUsers);
    getAllStock().then(setExistingStock);
  }, []);

  // Focus last row description when adding
  useEffect(() => {
    if (lastRowRef.current && !showScan) lastRowRef.current.focus();
  }, [rows.length, showScan]);

  function updateRow(id: number, field: keyof EntryRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, saved: false, error: '' } : r));
  }

  function addRow() {
    const nid = nextId;
    setNextId(nid + 1);
    setRows(prev => [...prev, emptyRow(nid, currentUser.initials, todayStr())]);
  }

  function removeRow(id: number) {
    setRows(prev => {
      const n = prev.filter(r => r.id !== id);
      return n.length === 0 ? [emptyRow(nextId, currentUser.initials, todayStr())] : n;
    });
    if (rows.length <= 1) setNextId(prev => prev + 1);
  }

  // Duplicate detection on description blur
  function handleDescBlur(id: number) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const desc = titleCase(r.description);
      // Find matching existing stock by description (case-insensitive)
      const match = existingStock.find(s =>
        s.description.toLowerCase().trim() === desc.toLowerCase().trim() && desc.trim() !== ''
      );
      return { ...r, description: desc, dupMatch: match || null, dupAction: match ? 'none' : 'new' };
    }));
  }

  function handleDupChoice(id: number, action: 'add' | 'new') {
    setRows(prev => prev.map(r => r.id === id ? { ...r, dupAction: action } : r));
  }

  function handleLocationBlur(id: number) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, location: titleCase(r.location) } : r));
  }
  function handleCostBlur(id: number) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const v = parseFloat(r.cost);
      return { ...r, cost: isNaN(v) ? r.cost : v.toFixed(2) };
    }));
  }
  function handleRrpBlur(id: number) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const v = parseFloat(r.rrp);
      return { ...r, rrp: isNaN(v) ? r.rrp : v.toFixed(2) };
    }));
  }

  function handleKeyDown(e: React.KeyboardEvent, id: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const idx = rows.findIndex(r => r.id === id);
      if (idx === rows.length - 1) addRow();
    }
  }

  async function saveAll() {
    let hasError = false;
    const validated = rows.map(r => {
      if (r.saved) return r;
      if (!r.description.trim()) { hasError = true; return { ...r, error: 'Description required' }; }
      const q = parseInt(r.qty);
      if (isNaN(q) || q < 0) { hasError = true; return { ...r, error: 'Invalid qty' }; }
      const c = parseFloat(r.cost);
      if (r.cost && isNaN(c)) { hasError = true; return { ...r, error: 'Invalid cost' }; }
      const p = parseFloat(r.rrp);
      if (r.rrp && isNaN(p)) { hasError = true; return { ...r, error: 'Invalid RRP' }; }
      // Must choose action if duplicate found
      if (r.dupMatch && r.dupAction === 'none') { hasError = true; return { ...r, error: 'Choose: Add to existing or Create new' }; }
      return { ...r, error: '' };
    });
    if (hasError) { setRows(validated); return; }

    setSaving(true);
    let count = 0;
    const updated = [...validated];
    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      if (r.saved || !r.description.trim()) continue;
      try {
        const qty = parseInt(r.qty) || 1;
        const cost = parseFloat(r.cost) || 0;
        const rrp = parseFloat(r.rrp) || 0;

        if (r.dupMatch && r.dupAction === 'add') {
          // Add qty to existing stock item
          const newQty = (r.dupMatch.qty || 0) + qty;
          await window.tasklet.sqlExec(
            `UPDATE sylvias_stock SET qty = ${newQty} WHERE id = ${r.dupMatch.id}`
          );
        } else {
          // Create new stock item
          await addStockItem({
            description: r.description.trim(),
            part_number: r.partNumber.trim(),
            category: 'Other',
            qty,
            location: r.location.trim(),
            cost,
            rrp,
            entered_by: r.enteredBy || currentUser.initials,
            photo: '',
          });
        }
        updated[i] = { ...r, saved: true, error: '' };
        count++;
      } catch (err: any) {
        updated[i] = { ...r, error: err.message || 'Save failed' };
      }
    }
    setRows(updated);
    setSavedCount(prev => prev + count);
    setSaving(false);
    // Refresh existing stock for future duplicate checks
    getAllStock().then(setExistingStock);
  }

  // ── CSV / Excel import ──
  function parseImportText(text: string): EntryRow[] {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];

    const parsed: EntryRow[] = [];
    let id = nextId;
    const firstLine = lines[0].toLowerCase();
    const startIdx = (firstLine.includes('description') || firstLine.includes('desc')) ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const cells = lines[i].includes('\t') ? lines[i].split('\t') : lines[i].split(',');
      if (cells.length === 0 || !cells[0].trim()) continue;

      const desc = titleCase(cells[0]?.trim() || '');
      const partNo = cells[1]?.trim() || '';
      const qty = cells[2]?.trim() || '1';
      const loc = titleCase(cells[3]?.trim() || '');
      const cost = cells[4]?.trim() || '';
      const rrp = cells[5]?.trim() || '';
      const entBy = cells[6]?.trim() || currentUser.initials;
      let dateStr = todayStr();
      if (cells[7]?.trim()) {
        const raw = cells[7].trim().replace(/\//g, '-');
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
      }

      // Check for duplicate
      const match = existingStock.find(s => s.description.toLowerCase().trim() === desc.toLowerCase().trim() && desc.trim() !== '');
      parsed.push({ id: id++, description: desc, partNumber: partNo, qty, location: loc, cost, rrp, enteredBy: entBy, date: dateStr, saved: false, error: '', dupMatch: match || null, dupAction: match ? 'none' : 'new' });
    }
    return parsed;
  }

  function handleImportPaste() {
    const parsed = parseImportText(importText);
    if (parsed.length === 0) { setImportError('No valid rows found. Expected: Description, Part No, Qty, Location, Cost, RRP, By, Date'); return; }
    setNextId(prev => prev + parsed.length);
    setRows(prev => {
      const nonEmpty = prev.filter(r => r.description.trim() || r.saved);
      return [...nonEmpty, ...parsed];
    });
    setShowImport(false);
    setImportText('');
    setImportError('');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const tmpPath = `/tmp/quick_import_${Date.now()}.xlsx`;
        await window.tasklet.writeFileToDisk(tmpPath, `__BASE64__${base64}`);
        const result = await window.tasklet.runCommand(
          `cd /tmp && python3 -c "
import openpyxl, csv, sys, io
wb = openpyxl.load_workbook('${tmpPath.split('/').pop()}')
ws = wb.active
out = io.StringIO()
w = csv.writer(out)
for row in ws.iter_rows(values_only=True):
    w.writerow(['' if c is None else str(c) for c in row])
print(out.getvalue())
"`,
          30
        );
        if (result.log) {
          const parsed = parseImportText(result.log);
          if (parsed.length === 0) { setImportError('Could not parse Excel file'); return; }
          setNextId(prev => prev + parsed.length);
          setRows(prev => {
            const nonEmpty = prev.filter(r => r.description.trim() || r.saved);
            return [...nonEmpty, ...parsed];
          });
          setShowImport(false);
          setImportText('');
        } else {
          setImportError('Could not read Excel file');
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const parsed = parseImportText(text);
        if (parsed.length === 0) { setImportError('No valid rows found'); return; }
        setNextId(prev => prev + parsed.length);
        setRows(prev => {
          const nonEmpty = prev.filter(r => r.description.trim() || r.saved);
          return [...nonEmpty, ...parsed];
        });
        setShowImport(false);
        setImportText('');
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  }

  // ── Scan Stock List (OCR multi-item) ──
  const cleanupPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Compress image in-browser to avoid large file timeouts
  // Write base64 in chunks to avoid bridge timeout on large strings
  async function writeBase64Chunked(path: string, data: string) {
    const CHUNK = 100000; // ~100KB chunks
    if (data.length <= CHUNK) {
      await window.tasklet.writeFileToDisk(path, data);
      return;
    }
    // Write first chunk (creates file)
    await window.tasklet.writeFileToDisk(path, data.slice(0, CHUNK));
    // Append remaining chunks via runCommand
    for (let i = CHUNK; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      // Use printf to append without newline issues
      await window.tasklet.runCommand(`printf '%s' '${chunk}' >> ${path}`, 15);
    }
  }

  function compressImage(file: File, maxDim = 800, quality = 0.4): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const b64 = dataUrl.split(',')[1];
        resolve(b64);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result as string; };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function handleScanFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setScanMessage('Please upload an image file (photo of your stock list)');
      setScanStatus('error');
      return;
    }

    setScanStatus('uploading');
    setScanMessage('Compressing image...');

    try {
      const base64 = await compressImage(file);

      setScanPreview(`data:image/jpeg;base64,${base64}`);
      setScanMessage('Saving image...');

      const ts = Date.now();
      const b64Path = `/tmp/scan_list_${ts}_b64.txt`;
      const imgPath = `/tmp/scan_list_${ts}.jpg`;
      const resultPath = `/tmp/scan_list_result_${ts}.json`;

      // Write base64 in chunks to avoid bridge timeout
      await writeBase64Chunked(b64Path, base64);
      await window.tasklet.runCommand(`base64 -d ${b64Path} > ${imgPath}`, 30);

      setScanStatus('processing');
      setScanMessage('AI is reading the stock list — this may take 15–30 seconds...');

      const prompt = `SCAN STOCK LIST TASK — AUTOMATED REQUEST FROM THE APP

A photographed/scanned stock list has been saved at: ${imgPath}
This document contains MULTIPLE items — extract ALL of them.

Please:
1. Read/view the image at that path
2. Extract ALL items from the list. This is a handwritten or printed stock list with multiple items.
3. Write a JSON file to ${resultPath} with this exact structure — an array of items:

[
  {
    "description": "Item name",
    "part_number": "",
    "qty": "1",
    "location": "",
    "cost": "",
    "rrp": ""
  }
]

Rules:
- Extract EVERY item you can read from the list
- Use empty string for any field you can't read
- qty defaults to "1" if not specified
- Cost and RRP should be numbers as strings (e.g. "25.00")
- Clean up descriptions — proper capitalisation, fix obvious spelling errors
- If columns are labeled differently (e.g. "Price" might be RRP, "Paid" might be cost), use your best judgment
- Return an array even if there's only one item

IMPORTANT: Write ONLY the JSON file. Do NOT send a chat message back.`;

      await window.tasklet.sendMessageToAgent(prompt);

      attemptRef.current = 0;
      const maxAttempts = 60;

      pollRef.current = setInterval(async () => {
        attemptRef.current++;
        try {
          const content = await window.tasklet.readFileFromDisk(resultPath);
          if (content && content.trim().startsWith('[')) {
            cleanupPoll();
            const parsed = JSON.parse(content) as Array<{
              description?: string;
              part_number?: string;
              qty?: string;
              location?: string;
              cost?: string;
              rrp?: string;
            }>;

            // Save to staging table
            const batch = parsed.map(item => ({
              description: titleCase(item.description || ''),
              part_number: item.part_number || '',
              qty: parseInt(item.qty || '1') || 1,
              location: titleCase(item.location || ''),
              cost: parseFloat(item.cost || '0') || 0,
              rrp: parseFloat(item.rrp || '0') || 0,
              scan_type: 'multiple',
              scanned_by: currentUser.initials,
              notes: '',
            }));
            await addScanStagingBatch(batch);

            setScanStatus('done');
            setScanMessage(`Read ${parsed.length} item${parsed.length !== 1 ? 's' : ''} from the photo! Saved to Scan Review for checking.`);
          }
        } catch {
          // File doesn't exist yet — keep polling
        }

        if (attemptRef.current >= maxAttempts) {
          cleanupPoll();
          setScanStatus('error');
          setScanMessage('Timed out waiting for scan results. Please try again or enter manually.');
        }
      }, 2000);
    } catch (err: any) {
      // Use console.warn to avoid error boundary treating this as a crash
      console.warn('Scan upload issue:', err?.message || err);
      setScanStatus('error');
      setScanMessage('Image too large or upload timed out. Try a smaller photo or enter items manually.');
    }
  }

  function handleScanDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleScanFile(file);
  }

  const unsavedCount = rows.filter(r => !r.saved && r.description.trim()).length;
  const dupsNeedAction = rows.filter(r => !r.saved && r.dupMatch && r.dupAction === 'none').length;
  const totalCost = rows.filter(r => !r.saved).reduce((s, r) => s + ((parseFloat(r.cost) || 0) * (parseInt(r.qty) || 1)), 0);
  const totalRrp = rows.filter(r => !r.saved).reduce((s, r) => s + ((parseFloat(r.rrp) || 0) * (parseInt(r.qty) || 1)), 0);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-base-content">⚡ Quick Stock Entry</h2>
          <p className="text-sm text-base-content/60">Scan a stock list, import from Excel, or type directly</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-outline btn-sm gap-1" onClick={async () => {
            try {
              const data = await window.tasklet.readBinaryFileFromDisk('/tasklet/agent/home/apps/sylvias-surprises/stock_checkin_sheet.pdf');
              const a = document.createElement('a');
              a.href = 'data:application/pdf;base64,' + data;
              a.download = 'Stock_Checkin_Sheet.pdf';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } catch (e) { console.warn('Could not open PDF', e); }
          }}>
            <Printer size={16} /> Print Check-in Sheet
          </button>
          <button
            className="btn btn-sm gap-1"
            style={{ backgroundColor: '#FF6B6B', color: 'white', borderColor: '#FF6B6B' }}
            onClick={() => { setShowScan(!showScan); setScanStatus('idle'); setScanPreview(null); setScanMessage(''); }}
          >
            <Camera size={16} /> 📷 Scan Stock List
          </button>
          <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowImport(!showImport)}>
            <Upload size={16} /> Import Excel / CSV
          </button>
          <button
            className="btn btn-primary btn-sm gap-1"
            onClick={saveAll}
            disabled={saving || unsavedCount === 0 || dupsNeedAction > 0}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={16} />}
            Save All ({unsavedCount})
          </button>
        </div>
      </div>

      {savedCount > 0 && (
        <div className="alert alert-success mb-3 text-sm">
          <CheckCircle size={16} />
          <span>{savedCount} item{savedCount !== 1 ? 's' : ''} saved to stock.</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setSavedCount(0)}>✕</button>
        </div>
      )}

      {dupsNeedAction > 0 && (
        <div className="alert alert-warning mb-3 text-sm">
          <AlertTriangle size={16} />
          <span><strong>{dupsNeedAction}</strong> item{dupsNeedAction !== 1 ? 's match' : ' matches'} existing stock — choose <strong>Add to Existing</strong> or <strong>Create New</strong> before saving.</span>
        </div>
      )}

      {/* Scan panel */}
      {showScan && (
        <div className="card bg-base-200 mb-4 border-2 border-orange-300">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm">📷 Scan Stock List</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => { cleanupPoll(); setShowScan(false); }}>
                <X size={14} /> Close
              </button>
            </div>
            <div className="alert alert-info text-xs mb-3">
              <span>
                📋 Take a photo of your stock list. Block capitals work best.
                Items go to <strong>Scan Review</strong> for checking before entering stock.
              </span>
            </div>

            {(scanStatus === 'idle' || scanStatus === 'error') && (
              <div
                className="border-2 border-dashed border-base-content/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => scanFileRef.current?.click()}
                onDrop={handleScanDrop}
                onDragOver={e => e.preventDefault()}
              >
                <input
                  ref={scanFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleScanFile(f); }}
                />
                <Camera size={40} className="mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-sm">Drop image here or tap to upload</p>
                <p className="text-xs text-base-content/60 mt-1">
                  📱 Tap to take a photo &nbsp;|&nbsp; 💻 Drag & drop or browse
                </p>
              </div>
            )}

            {scanPreview && scanStatus !== 'idle' && (
              <div className="flex justify-center my-2">
                <img src={scanPreview} alt="Stock list" className="max-h-48 rounded-lg shadow-md border border-base-content/10" />
              </div>
            )}

            {scanStatus === 'uploading' && (
              <div className="flex items-center gap-3 justify-center text-info">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-medium">{scanMessage}</span>
              </div>
            )}
            {scanStatus === 'processing' && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3 text-warning">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm font-medium">{scanMessage}</span>
                </div>
                <progress className="progress progress-warning w-48" />
              </div>
            )}
            {scanStatus === 'done' && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3 text-success">
                  <CheckCircle size={18} />
                  <span className="text-sm font-medium">{scanMessage}</span>
                </div>
                <div className="flex gap-2">
                  {onNavigate && (
                    <button className="btn btn-primary btn-sm" onClick={() => onNavigate('scan-review')}>
                      📋 Go to Scan Review
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setScanStatus('idle'); setScanPreview(null); setScanMessage(''); setShowScan(true); }}>
                    <Camera size={14} /> Scan Another
                  </button>
                </div>
              </div>
            )}
            {scanStatus === 'error' && (
              <div className="alert alert-error text-xs mt-2">
                <AlertTriangle size={16} />
                <span>{scanMessage}</span>
                <button className="btn btn-xs btn-ghost" onClick={() => { setScanStatus('idle'); setScanPreview(null); }}>Try Again</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import panel */}
      {showImport && (
        <div className="card bg-base-200 mb-4">
          <div className="card-body p-4">
            <h3 className="font-bold text-sm mb-2">📥 Import from Excel or CSV</h3>
            <p className="text-xs text-base-content/60 mb-2">
              Columns: <strong>Description, Part No, Qty, Location, Cost, RRP, By, Date</strong> — first row can be headers.
            </p>
            <div className="flex gap-2 mb-2">
              <button className="btn btn-sm btn-outline gap-1" onClick={() => fileRef.current?.click()}>
                <FileSpreadsheet size={14} /> Choose File (.xlsx / .csv)
              </button>
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv,.txt,.tsv" onChange={handleFileUpload} />
            </div>
            <p className="text-xs text-base-content/60 mb-1">Or paste spreadsheet data below:</p>
            <textarea
              className="textarea textarea-bordered textarea-sm w-full font-mono text-xs"
              rows={4}
              placeholder={"Waterford Clock\tWC-001\t1\tCab 1\t25\t65\tJJ\t2026-06-05\nSpoons\t\t10\tDrawer 1\t10\t20\tGQ\t2026-06-05"}
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportError(''); }}
            />
            {importError && <p className="text-xs text-error mt-1">{importError}</p>}
            <div className="flex gap-2 mt-2">
              <button className="btn btn-primary btn-sm" onClick={handleImportPaste} disabled={!importText.trim()}>Import Rows</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowImport(false); setImportText(''); setImportError(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {unsavedCount > 0 && (
        <div className="flex gap-4 mb-3 text-sm flex-wrap">
          <span className="badge badge-outline">{unsavedCount} unsaved row{unsavedCount !== 1 ? 's' : ''}</span>
          <span>Cost: <strong>£{totalCost.toFixed(2)}</strong></span>
          <span>RRP: <strong className="text-success">£{totalRrp.toFixed(2)}</strong></span>
        </div>
      )}

      {/* Yellow review warning when items from scan */}
      {rows.some(r => !r.saved && r.description.trim()) && (showScan || scanStatus === 'done') && (
        <div className="alert mb-3 text-sm" style={{ backgroundColor: '#FFF3CD', borderColor: '#FFECB5', color: '#664D03' }}>
          <AlertTriangle size={16} />
          <span><strong>Review before saving!</strong> Check descriptions, quantities and prices are correct.</span>
        </div>
      )}

      {/* Spreadsheet grid */}
      <div className="overflow-x-auto">
        <table className="table table-xs w-full">
          <thead>
            <tr className="text-xs">
              <th className="w-8">#</th>
              <th className="min-w-[180px]">Description *</th>
              <th className="w-28">Part No</th>
              <th className="w-16">Qty</th>
              <th className="w-28">Location</th>
              <th className="w-24">Cost (£)</th>
              <th className="w-24">RRP (£)</th>
              <th className="w-20">By</th>
              <th className="w-32">Date</th>
              <th className="w-16">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <React.Fragment key={row.id}>
                <tr className={`${row.saved ? 'opacity-50' : ''} ${row.error ? 'bg-error/10' : ''} ${row.dupMatch && row.dupAction === 'none' ? 'bg-warning/10' : ''}`}>
                  <td className="text-xs text-base-content/40">{idx + 1}</td>
                  <td>
                    <input
                      ref={idx === rows.length - 1 ? lastRowRef : undefined}
                      type="text"
                      className="input input-bordered input-xs w-full"
                      style={{ textTransform: 'capitalize' }}
                      placeholder="Item description..."
                      value={row.description}
                      onChange={e => updateRow(row.id, 'description', e.target.value)}
                      onBlur={() => handleDescBlur(row.id)}
                      onKeyDown={e => handleKeyDown(e, row.id)}
                      disabled={row.saved}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full"
                      placeholder=""
                      value={row.partNumber}
                      onChange={e => updateRow(row.id, 'partNumber', e.target.value)}
                      onKeyDown={e => handleKeyDown(e, row.id)}
                      disabled={row.saved}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full text-center"
                      value={row.qty}
                      onChange={e => updateRow(row.id, 'qty', e.target.value)}
                      onKeyDown={e => handleKeyDown(e, row.id)}
                      disabled={row.saved}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full"
                      placeholder="Location..."
                      list={`loc-list-${row.id}`}
                      value={row.location}
                      onChange={e => updateRow(row.id, 'location', e.target.value)}
                      onBlur={() => handleLocationBlur(row.id)}
                      onKeyDown={e => handleKeyDown(e, row.id)}
                      disabled={row.saved}
                    />
                    <datalist id={`loc-list-${row.id}`}>
                      {dynLocations.map(l => <option key={l} value={l} />)}
                    </datalist>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full text-right"
                      placeholder="0.00"
                      value={row.cost}
                      onChange={e => updateRow(row.id, 'cost', e.target.value)}
                      onBlur={() => handleCostBlur(row.id)}
                      onKeyDown={e => handleKeyDown(e, row.id)}
                      disabled={row.saved}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full text-right"
                      placeholder="0.00"
                      value={row.rrp}
                      onChange={e => updateRow(row.id, 'rrp', e.target.value)}
                      onBlur={() => handleRrpBlur(row.id)}
                      onKeyDown={e => handleKeyDown(e, row.id)}
                      disabled={row.saved}
                    />
                  </td>
                  <td>
                    <select
                      className="select select-bordered select-xs w-full"
                      value={row.enteredBy}
                      onChange={e => updateRow(row.id, 'enteredBy', e.target.value)}
                      disabled={row.saved}
                    >
                      {staffUsers.map(u => (
                        <option key={u.id} value={u.initials}>{u.initials}</option>
                      ))}
                      {!staffUsers.find(u => u.initials === row.enteredBy) && (
                        <option value={row.enteredBy}>{row.enteredBy}</option>
                      )}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      className="input input-bordered input-xs w-full"
                      value={row.date}
                      onChange={e => updateRow(row.id, 'date', e.target.value)}
                      disabled={row.saved}
                    />
                  </td>
                  <td>
                    {row.saved ? (
                      <span className="badge badge-success badge-xs gap-1"><CheckCircle size={10} /> Saved</span>
                    ) : row.error ? (
                      <span className="tooltip tooltip-left text-error text-xs" data-tip={row.error}><AlertTriangle size={14} /></span>
                    ) : null}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => removeRow(row.id)} title="Remove row">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                {/* Duplicate detection row */}
                {row.dupMatch && !row.saved && (
                  <tr className="bg-warning/5">
                    <td></td>
                    <td colSpan={10}>
                      <div className="flex items-center gap-2 py-1 text-xs flex-wrap">
                        <span className="text-warning font-semibold">⚠️ "{row.dupMatch.description}" already in stock (×{row.dupMatch.qty})</span>
                        <button
                          className={`btn btn-xs gap-1 ${row.dupAction === 'add' ? 'btn-success' : 'btn-outline'}`}
                          onClick={() => handleDupChoice(row.id, 'add')}
                        >
                          <PackagePlus size={12} /> Add to Existing (+{row.qty || 1})
                        </button>
                        <button
                          className={`btn btn-xs gap-1 ${row.dupAction === 'new' ? 'btn-info' : 'btn-outline'}`}
                          onClick={() => handleDupChoice(row.id, 'new')}
                        >
                          <PackageCheck size={12} /> Create New Item
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-3">
        <button className="btn btn-outline btn-sm gap-1" onClick={addRow}>
          <Plus size={14} /> Add Row
        </button>
        <span className="text-xs text-base-content/40 self-center">Press Enter in any field to add a new row</span>
      </div>
    </div>
  );
};
