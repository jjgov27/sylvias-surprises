import React, { useState, useEffect } from 'react';
import { StaffUser } from '../types';
import { titleCase } from '../utils/db';

type Staff = StaffUser & { has_pin?: number };

async function post(url: string, body: any) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export function StaffPins({ currentUser }: { currentUser: StaffUser }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pinFor, setPinFor] = useState<number | null>(null);
  const [pinVal, setPinVal] = useState('');
  const [delFor, setDelFor] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const [newPin, setNewPin] = useState('');

  async function load() {
    const res = await fetch('/api/auth/staff-list', { credentials: 'include' });
    setStaff(res.ok ? await res.json() : []);
  }
  useEffect(() => { load(); }, []);

  function flash(m: string) { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 4000); }

  async function savePin(id: number) {
    setErr('');
    if (!/^\d{4}$/.test(pinVal)) { setErr('PIN must be exactly 4 digits'); return; }
    try { await post('/api/auth/set-pin', { id, pin: pinVal }); setPinFor(null); setPinVal(''); flash('✅ PIN updated'); load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function addStaff() {
    setErr('');
    if (!newName.trim() || !newInit.trim()) { setErr('Please enter a name and initials'); return; }
    if (newInit.trim().length > 4) { setErr('Initials should be 1–4 characters'); return; }
    if (!/^\d{4}$/.test(newPin)) { setErr('PIN must be exactly 4 digits'); return; }
    try {
      await post('/api/auth/register', { name: titleCase(newName.trim()), initials: newInit.trim().toUpperCase(), pin: newPin });
      setNewName(''); setNewInit(''); setNewPin(''); flash('✅ Staff member added'); load();
    } catch (e: any) { setErr(e.message); }
  }

  async function del(id: number) {
    try { await post('/api/auth/delete-staff', { id }); setDelFor(null); flash('Staff member removed'); load(); }
    catch (e: any) { setErr(e.message); setDelFor(null); }
  }

  const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 16 };
  const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 };
  const btn = (bg: string): React.CSSProperties => ({ padding: '7px 14px', background: bg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' });
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  return (
    <div>
      {err && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {msg && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div style={box}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>🔐 Staff &amp; PINs</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>Each person logs in with their own 4-digit PIN. Staff without a PIN will be asked to choose one the next time they log in.</p>
        {staff.map(s => (
          <div key={s.id} style={{ borderTop: '1px solid #f3f4f6', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{s.initials}</span>
              <span style={{ fontWeight: 600 }}>{s.name}{s.initials === currentUser.initials ? ' (you)' : ''}</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', background: s.has_pin ? '#dcfce7' : '#fef3c7', color: s.has_pin ? '#166534' : '#92400e' }}>
                {s.has_pin ? 'PIN set' : 'No PIN yet'}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button style={btn('#7c3aed')} onClick={() => { setPinFor(pinFor === s.id ? null : s.id); setPinVal(''); setDelFor(null); setErr(''); }}>
                  {s.has_pin ? 'Reset PIN' : 'Set PIN'}
                </button>
                {s.initials !== currentUser.initials && (
                  <button style={btn('#dc2626')} onClick={() => { setDelFor(s.id); setPinFor(null); }}>Remove</button>
                )}
              </span>
            </div>
            {pinFor === s.id && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <input style={{ ...inp, width: 120, letterSpacing: 4 }} type="password" inputMode="numeric" placeholder="4 digits" value={pinVal}
                  onChange={e => setPinVal(digits(e.target.value))} onKeyDown={e => e.key === 'Enter' && savePin(s.id)} autoFocus />
                <button style={btn('#16a34a')} onClick={() => savePin(s.id)}>💾 Save PIN</button>
                <button style={{ ...btn('#9ca3af') }} onClick={() => setPinFor(null)}>Cancel</button>
              </div>
            )}
            {delFor === s.id && (
              <div style={{ background: '#fef9c3', border: '1px solid #facc15', borderRadius: 8, padding: '8px 12px', marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                Remove {s.name}? They will no longer be able to log in.
                <button style={btn('#dc2626')} onClick={() => del(s.id)}>Yes</button>
                <button style={btn('#9ca3af')} onClick={() => setDelFor(null)}>No</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={box}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>➕ Add Staff Member</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, flex: '1 1 200px' }} placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)} />
          <input style={{ ...inp, width: 90, textTransform: 'uppercase' }} placeholder="Initials" maxLength={4} value={newInit} onChange={e => setNewInit(e.target.value.toUpperCase())} />
          <input style={{ ...inp, width: 110, letterSpacing: 4 }} type="password" inputMode="numeric" placeholder="PIN" value={newPin} onChange={e => setNewPin(digits(e.target.value))} />
          <button style={btn('#16a34a')} onClick={addStaff}>Add</button>
        </div>
      </div>
    </div>
  );
}
