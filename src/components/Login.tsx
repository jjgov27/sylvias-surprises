import React, { useState, useEffect, useRef } from 'react';
import { LogIn, Lock, Delete } from 'lucide-react';
import { StaffUser } from '../types';

interface LoginProps {
  onLogin: (user: StaffUser) => void;
  onBack: () => void;
}

type Staff = StaffUser & { has_pin?: number };

export const Login: React.FC<LoginProps> = ({ onLogin, onBack }) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState(''); // used when creating a PIN (first entry)
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { if (selected) setTimeout(() => inputRef.current?.focus(), 50); }, [selected, firstPin]);

  async function loadStaff() {
    try {
      const res = await fetch('/api/auth/staff-list', { credentials: 'include' });
      setStaffList(res.ok ? await res.json() : []);
    } catch {
      setStaffList([]);
    }
    setLoading(false);
  }

  const creating = !!selected && !selected.has_pin;

  function choose(user: Staff) {
    setSelected(user); setPin(''); setFirstPin(''); setError('');
  }

  async function submit(value: string) {
    if (!selected || busy) return;
    setError('');
    if (!/^\d{4}$/.test(value)) { setError('PIN must be 4 digits'); return; }

    let body: any = { id: selected.id, pin: value };
    if (creating) {
      if (!firstPin) { setFirstPin(value); setPin(''); return; }
      if (value !== firstPin) { setError("PINs didn't match — please start again"); setFirstPin(''); setPin(''); return; }
      body = { id: selected.id, newPin: value };
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.');
        setPin('');
        setBusy(false);
        return;
      }
      onLogin({ ...selected, ...data.user });
    } catch {
      setError('Unable to connect. Please try again.');
      setPin('');
    }
    setBusy(false);
  }

  function typeDigit(d: string) {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div className="card bg-base-200 shadow-xl w-full max-w-md">
        <div className="card-body">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-base-content">🪔 Sylvia's Surprises</h2>
            <p className="text-base-content/60 mt-1">Staff Login</p>
          </div>

          {error && (
            <div className="alert alert-error text-sm"><span>{error}</span></div>
          )}

          {!selected ? (
            <>
              {staffList.length === 0 ? (
                <p className="text-center text-sm text-base-content/60">No staff accounts found. Please contact the shop owner.</p>
              ) : (
                <div className="mb-2">
                  <label className="label"><span className="label-text font-semibold">Select your name:</span></label>
                  <div className="flex flex-col gap-2">
                    {staffList.map(user => (
                      <button key={user.id} className="btn btn-outline btn-primary justify-start gap-3" onClick={() => choose(user)}>
                        <div className="badge badge-primary badge-sm font-mono">{user.initials}</div>
                        {user.name}
                        <Lock size={14} className="ml-auto opacity-50" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="font-semibold text-lg">{selected.name}</div>
              <div className="text-sm text-base-content/60 mb-3">
                {creating
                  ? (firstPin ? 'Enter your new PIN again to confirm' : 'First time in — choose a 4-digit PIN')
                  : 'Enter your 4-digit PIN'}
              </div>

              {/* PIN dots */}
              <div className="flex justify-center gap-3 mb-3" onClick={() => inputRef.current?.focus()}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid #7c3aed', background: i < pin.length ? '#7c3aed' : 'transparent' }} />
                ))}
              </div>
              {/* Hidden input so keyboards work too */}
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                maxLength={4}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(v);
                  if (v.length === 4) submit(v);
                }}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                aria-label="PIN"
              />

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                  <button key={d} className="btn btn-lg" disabled={busy} onClick={() => typeDigit(d)}>{d}</button>
                ))}
                <button className="btn btn-lg btn-ghost" disabled={busy || !pin} onClick={() => setPin('')} title="Clear">C</button>
                <button className="btn btn-lg" disabled={busy} onClick={() => typeDigit('0')}>0</button>
                <button className="btn btn-lg btn-ghost" disabled={busy || !pin} onClick={() => setPin(pin.slice(0, -1))} title="Back"><Delete size={18} /></button>
              </div>

              {busy && <div className="mt-3"><span className="loading loading-spinner loading-sm text-primary" /></div>}

              <button className="btn btn-ghost btn-sm mt-3" onClick={() => { setSelected(null); setPin(''); setFirstPin(''); setError(''); }}>
                ← Not you? Pick another name
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-base-300">
            <button className="btn btn-ghost btn-sm w-full" onClick={onBack}>
              <LogIn size={14} /> ← Back to Website
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
