import React, { useState, useRef, useEffect } from 'react';
import { Customer, Supplier } from '../types';
import { searchCustomers, searchSuppliersByPostcode } from '../utils/db';
import { MapPin, Check, X } from 'lucide-react';

interface Props {
  type: 'customer' | 'supplier';
  label?: string;
  onSelect: (record: Customer | Supplier) => void;
  onClear?: () => void;
  selected?: { name: string; address: string; postcode: string } | null;
  compact?: boolean;
}

export function PostcodeLookup({ type, label, onSelect, onClear, selected, compact }: Props) {
  const [pc, setPc] = useState('');
  const [results, setResults] = useState<Array<{ id: number; name: string; address: string; postcode: string; raw: Customer | Supplier }>>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    const clean = pc.replace(/\s/g, '');
    if (clean.length < 3) { setResults([]); setShowDrop(false); setSearched(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        if (type === 'customer') {
          const rows = await searchCustomers(pc);
          setResults(rows.map(c => ({
            id: c.id,
            name: [c.first_name, c.surname].filter(Boolean).join(' '),
            address: [c.address_line1, c.address_line2, c.address_line3].filter(Boolean).join(', '),
            postcode: c.postcode,
            raw: c,
          })));
        } else {
          const rows = await searchSuppliersByPostcode(pc);
          setResults(rows.map(s => ({
            id: s.id,
            name: s.name,
            address: s.address || '',
            postcode: s.postcode || '',
            raw: s,
          })));
        }
        setShowDrop(true);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [pc, type]);

  const sizeClass = compact ? 'input-xs' : 'input-sm';
  const padClass = compact ? 'p-1.5' : 'p-2';
  const iconSize = compact ? 12 : 14;

  if (selected) {
    return (
      <div className={"flex items-center gap-2 " + padClass + " bg-success/10 border border-success/30 rounded text-sm"}>
        <Check size={iconSize} className="text-success flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold">{selected.name}</span>
          {selected.address && <span className="text-xs ml-2 text-base-content/60">{selected.address}</span>}
          {selected.postcode && <span className="text-xs ml-1 font-mono">{selected.postcode}</span>}
        </div>
        {onClear && <button className="btn btn-ghost btn-xs btn-square" onClick={onClear}><X size={12} /></button>}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1 mb-0.5">
        <MapPin size={12} className="text-primary" />
        <span className="text-xs font-medium text-base-content/70">{label || 'Postcode Lookup'}</span>
      </div>
      <input
        className={"input input-bordered " + sizeClass + " w-full uppercase"}
        placeholder="Type postcode to find existing record..."
        value={pc}
        onChange={e => setPc(e.target.value.toUpperCase())}
        onFocus={() => { if (results.length > 0) setShowDrop(true); }}
        onBlur={() => setTimeout(() => setShowDrop(false), 200)}
      />
      {searching && <div className="text-xs text-base-content/50 mt-0.5">Searching...</div>}
      {showDrop && results.length > 0 && (
        <ul className="absolute z-50 bg-base-100 border border-base-300 rounded shadow-lg max-h-48 overflow-auto w-full mt-0.5">
          {results.map(r => (
            <li key={r.id}
              className="px-3 py-2 hover:bg-primary/10 cursor-pointer border-b border-base-200 last:border-0"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(r.raw); setPc(''); setShowDrop(false); setResults([]); setSearched(false); }}>
              <div className="font-semibold text-sm">{r.name}</div>
              <div className="text-xs text-base-content/60">{[r.address, r.postcode].filter(Boolean).join(', ')}</div>
            </li>
          ))}
        </ul>
      )}
      {searched && !searching && results.length === 0 && (
        <div className="text-xs text-base-content/50 mt-0.5">No matches — enter details manually</div>
      )}
    </div>
  );
}
