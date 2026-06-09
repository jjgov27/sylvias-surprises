import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Loader2, CheckCircle, AlertTriangle, X, FileText, List } from 'lucide-react';
import { addScanStagingItem, addScanStagingBatch, clearPendingScanStaging, titleCase } from '../utils/db';

interface ScanResult {
  description?: string;
  part_number?: string;
  qty?: string;
  condition?: string;
  category?: string;
  location?: string;
  cost?: string;
  rrp?: string;
  offer_price?: string;
  acquisition_type?: string;
  supplier_name?: string;
  source_type?: string;
  purchase_date?: string;
  payment_method?: string;
  purchased_by?: string;
  notes?: string;
}

interface ScanEntryProps {
  onCancel: () => void;
  scannedBy: string;
  onGoToReview?: () => void; // navigate to Scan Review screen
  onResult?: (data: ScanResult) => void; // legacy — no longer used for stock creation
  onSavedToStaging?: () => void;
}

export const ScanEntry: React.FC<ScanEntryProps> = ({ onCancel, scannedBy, onGoToReview, onResult, onSavedToStaging }) => {
  const [scanMode, setScanMode] = useState<'choose' | 'ready'>('choose');
  const [itemCount, setItemCount] = useState<'single' | 'multiple'>('single');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setMessage('Please upload an image file (photo or scan of the form)');
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setMessage('Compressing image...');

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          resolve(dataUrl.split(',')[1]);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        const reader = new FileReader();
        reader.onload = () => { img.src = reader.result as string; };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      setPreview(`data:image/jpeg;base64,${base64}`);

      const ts = Date.now();
      const b64Path = `/tmp/scan_form_${ts}_b64.txt`;
      const imgPath = `/tmp/scan_form_${ts}.jpg`;
      const resultPath = `/tmp/scan_result_${ts}.json`;

      await window.tasklet.writeFileToDisk(b64Path, base64);
      await window.tasklet.runCommand(`base64 -d ${b64Path} > ${imgPath}`, 30);

      setStatus('processing');
      setMessage('AI is reading the form — this may take 15–30 seconds...');

      const isMultiple = itemCount === 'multiple';

      // Clear any existing pending staging items before adding new scan results
      if (isMultiple) {
        await clearPendingScanStaging();
      }

      const prompt = isMultiple
        ? `SCAN STOCK LIST TASK — AUTOMATED REQUEST FROM THE APP

A photographed/scanned stock list has been saved at: ${imgPath}
This document contains MULTIPLE items.

Please:
1. Read/view the image at that path
2. Extract ALL items from the list
3. Write a JSON file to ${resultPath} with this exact structure — an ARRAY of items:

[
  {
    "description": "Item name",
    "part_number": "",
    "qty": "1",
    "condition": "",
    "category": "",
    "location": "",
    "cost": "",
    "rrp": "",
    "notes": ""
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
- For category, try to match: Clocks & Watches, Vintage China, Jewellery, Books & Maps, Furniture, Art & Prints, Curios & Oddities, Silverware, Glassware, Textiles & Linen, Toys & Games, Kitchenware, Militaria, Tools & Hardware, 50 Pence Pieces, Other
- For location, try to match: Front Window, Display Cabinet 1/2/3, Wall Display, Back Room, Shelf A/B/C, Counter, Storage, Other

IMPORTANT: Write ONLY the JSON file. Do NOT send a chat message back.`
        : `SCAN ENTRY FORM TASK — AUTOMATED REQUEST FROM THE APP

A scanned/photographed stock entry form has been saved at: ${imgPath}
This document contains a SINGLE item.

Please:
1. Read/view the image at that path
2. Extract all handwritten or printed fields from the form
3. Write a JSON file to ${resultPath} with this exact structure (use empty strings for unreadable/missing fields):

{
  "description": "",
  "part_number": "",
  "qty": "",
  "condition": "",
  "category": "",
  "location": "",
  "cost": "",
  "rrp": "",
  "offer_price": "",
  "acquisition_type": "existing or purchased",
  "supplier_name": "",
  "source_type": "",
  "purchase_date": "YYYY-MM-DD",
  "payment_method": "",
  "purchased_by": "",
  "notes": ""
}

For category, match to one of: Clocks & Watches, Vintage China, Jewellery, Books & Maps, Furniture, Art & Prints, Curios & Oddities, Silverware, Glassware, Textiles & Linen, Toys & Games, Kitchenware, Militaria, Tools & Hardware, 50 Pence Pieces, Other.
For location, match to one of: Front Window, Display Cabinet 1/2/3, Wall Display, Back Room, Shelf A/B/C, Counter, Storage, Other.
For acquisition_type, use "existing" if Existing Stock is ticked, "purchased" if Purchased is ticked.
For payment_method in purchased items, match to: Cash, SumUp, Bank Transfer, PayPal, Direct Debit, Standing Order, Card, Other.

IMPORTANT: Write ONLY the JSON file. Do NOT send a chat message back.`;

      await window.tasklet.sendMessageToAgent(prompt);

      attemptRef.current = 0;
      const maxAttempts = 60;

      pollRef.current = setInterval(async () => {
        attemptRef.current++;
        try {
          const content = await window.tasklet.readFileFromDisk(resultPath);
          if (!content) return;
          const trimmed = content.trim();

          if (isMultiple && trimmed.startsWith('[')) {
            cleanup();
            const parsed = JSON.parse(trimmed) as ScanResult[];
            // Save all to staging
            const batch = parsed.map(item => ({
              description: titleCase(item.description || ''),
              part_number: item.part_number || '',
              qty: parseInt(item.qty || '1') || 1,
              location: titleCase(item.location || ''),
              cost: parseFloat(item.cost || '0') || 0,
              rrp: parseFloat(item.rrp || '0') || 0,
              scan_type: 'multiple',
              scanned_by: scannedBy,
              notes: item.notes || '',
            }));
            await addScanStagingBatch(batch);
            setSavedCount(batch.length);
            setStatus('done');
            setMessage(`${batch.length} item${batch.length !== 1 ? 's' : ''} saved to Scan Review for checking!`);
            if (onSavedToStaging) onSavedToStaging();
          } else if (!isMultiple && trimmed.startsWith('{')) {
            cleanup();
            const parsed = JSON.parse(trimmed) as ScanResult;
            // Save single item to staging
            await addScanStagingItem({
              description: titleCase(parsed.description || ''),
              part_number: parsed.part_number || '',
              qty: parseInt(parsed.qty || '1') || 1,
              condition: parsed.condition || '',
              category: parsed.category || '',
              location: titleCase(parsed.location || ''),
              cost: parseFloat(parsed.cost || '0') || 0,
              rrp: parseFloat(parsed.rrp || '0') || 0,
              offer_price: parseFloat(parsed.offer_price || '0') || 0,
              acquisition_type: parsed.acquisition_type || 'existing',
              supplier_name: parsed.supplier_name || '',
              source_type: parsed.source_type || '',
              purchase_date: parsed.purchase_date || '',
              payment_method: parsed.payment_method || '',
              purchased_by: parsed.purchased_by || '',
              notes: parsed.notes || '',
              scan_type: 'single',
              scanned_by: scannedBy,
            });
            setSavedCount(1);
            setStatus('done');
            setMessage('Item saved to Scan Review for checking!');
            if (onSavedToStaging) onSavedToStaging();
          }
        } catch {
          // File doesn't exist yet — keep polling
        }

        if (attemptRef.current >= maxAttempts) {
          cleanup();
          setStatus('error');
          setMessage('Timed out waiting for scan results. Please try again or enter manually.');
        }
      }, 2000);
    } catch (err: any) {
      console.warn('Scan issue:', err?.message || err);
      setStatus('error');
      setMessage('Image too large or upload timed out. Try a smaller photo.');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-base-content">📷 Scan Stock Entry Form</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => { cleanup(); onCancel(); }}>
          <X size={18} /> Cancel
        </button>
      </div>

      <div className="card bg-base-200">
        <div className="card-body gap-4">

          {/* Step 1: Choose single or multiple */}
          {scanMode === 'choose' && (
            <>
              <div className="alert alert-info text-sm">
                <span>📋 How many items are on this document?</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setItemCount('single'); setScanMode('ready'); }}
                  className={`card bg-base-100 hover:bg-primary/10 border-2 border-base-300 hover:border-primary cursor-pointer transition-all`}
                >
                  <div className="card-body items-center text-center py-6">
                    <FileText size={36} className="text-primary mb-2" />
                    <p className="font-bold text-lg">Single Item</p>
                    <p className="text-xs text-base-content/60">One item on the form</p>
                  </div>
                </button>
                <button
                  onClick={() => { setItemCount('multiple'); setScanMode('ready'); }}
                  className={`card bg-base-100 hover:bg-primary/10 border-2 border-base-300 hover:border-primary cursor-pointer transition-all`}
                >
                  <div className="card-body items-center text-center py-6">
                    <List size={36} className="text-primary mb-2" />
                    <p className="font-bold text-lg">Multiple Items</p>
                    <p className="text-xs text-base-content/60">A list of several items</p>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Step 2: Upload */}
          {scanMode === 'ready' && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className={`badge ${itemCount === 'single' ? 'badge-info' : 'badge-secondary'} gap-1`}>
                  {itemCount === 'single' ? <><FileText size={12} /> Single Item</> : <><List size={12} /> Multiple Items</>}
                </span>
                <button className="btn btn-ghost btn-xs" onClick={() => { setScanMode('choose'); setStatus('idle'); setPreview(null); setMessage(''); }}>
                  Change
                </button>
              </div>

              <div className="alert alert-info text-sm">
                <span>
                  {itemCount === 'single'
                    ? '📋 Take a photo of the filled-in stock entry form. The system will read all fields.'
                    : '📋 Take a photo of your stock list. The system will read ALL items from it.'}
                </span>
              </div>

              {/* Upload area */}
              {status === 'idle' || status === 'error' ? (
                <div
                  className="border-2 border-dashed border-base-content/20 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                  onClick={() => fileRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                  <Upload size={48} className="mx-auto mb-3 opacity-40" />
                  <p className="font-semibold text-base-content">
                    Drop image here or tap to upload
                  </p>
                  <p className="text-sm text-base-content/60 mt-1">
                    📱 On mobile: tap to take a photo<br />
                    💻 On desktop: drag & drop or click to browse
                  </p>
                </div>
              ) : null}
            </>
          )}

          {/* Preview */}
          {preview && status !== 'idle' && (
            <div className="flex justify-center">
              <img src={preview} alt="Scanned form" className="max-h-64 rounded-lg shadow-md border border-base-content/10" />
            </div>
          )}

          {/* Status */}
          {status === 'uploading' && (
            <div className="flex items-center gap-3 justify-center text-info">
              <Loader2 size={20} className="animate-spin" />
              <span className="font-medium">{message}</span>
            </div>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 text-warning">
                <Loader2 size={20} className="animate-spin" />
                <span className="font-medium">{message}</span>
              </div>
              <progress className="progress progress-warning w-64" />
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 text-success">
                <CheckCircle size={20} />
                <span className="font-medium">{message}</span>
              </div>
              <p className="text-sm text-base-content/60">
                {savedCount === 1 ? 'This item is' : 'These items are'} waiting in <strong>Scan Review</strong> — check and approve before they enter live stock.
              </p>
              <div className="flex gap-2">
                {onGoToReview && (
                  <button className="btn btn-primary btn-sm" onClick={onGoToReview}>
                    📋 Go to Scan Review
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => { setStatus('idle'); setPreview(null); setMessage(''); setScanMode('choose'); setSavedCount(0); }}>
                  <Camera size={16} /> Scan Another
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="alert alert-error text-sm">
              <AlertTriangle size={18} />
              <span>{message}</span>
            </div>
          )}

          {/* Retry / Cancel buttons */}
          {(status === 'error') && (
            <div className="flex gap-2 justify-center">
              <button className="btn btn-primary btn-sm" onClick={() => { setStatus('idle'); setPreview(null); setMessage(''); }}>
                <Camera size={16} /> Try Again
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { cleanup(); onCancel(); }}>
                Enter Manually
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
