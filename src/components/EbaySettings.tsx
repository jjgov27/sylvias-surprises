import React, { useState, useEffect } from 'react';

type Status = { configured: boolean; env: string; appIdHint: string | null; hasRuName: boolean; keysOk: boolean; apiOk: boolean; categoryTreeId: string | null; error: string | null };

const Row = ({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
    <span style={{ fontSize: 20 }}>{ok === null ? '⏳' : ok ? '✅' : '⬜'}</span>
    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>{detail && <div style={{ fontSize: 12, color: '#6b7280' }}>{detail}</div>}</div>
  </div>
);

export function EbaySettings() {
  const [s, setS] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function check() {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/ebay/status', { credentials: 'include' });
      if (!r.ok) throw new Error(r.status === 404 ? 'Server not updated yet — try again in a minute' : 'Could not check (' + r.status + ')');
      setS(await r.json());
    } catch (e: any) { setErr(e.message); setS(null); }
    setLoading(false);
  }
  useEffect(() => { check(); }, []);

  const sandbox = s?.env !== 'production';
  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>🛒 eBay Connection</h3>
          {s && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: sandbox ? '#fef3c7' : '#dcfce7', color: sandbox ? '#92400e' : '#166534' }}>{sandbox ? '🧪 Practice site (Sandbox)' : '🟢 Real eBay (Production)'}</span>}
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>Checks this site can talk to eBay. Listing items and syncing sales will be added here in the next stages.</p>
        {err && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>{err}</div>}
        {loading && !s && <Row ok={null} label="Checking with eBay…" />}
        {s && <>
          <Row ok={s.configured} label="eBay keys added to this site" detail={s.configured ? 'App ID ' + s.appIdHint : 'Not set — add EBAY_APP_ID and EBAY_CERT_ID in Railway Variables'} />
          <Row ok={s.keysOk} label="eBay accepted the keys" detail={s.configured && !s.keysOk ? (s.error || '') : undefined} />
          <Row ok={s.apiOk} label="Test call to eBay UK worked" detail={s.apiOk ? 'eBay UK category list reached (tree ' + s.categoryTreeId + ')' : (s.keysOk ? s.error || '' : undefined)} />
          <Row ok={s.hasRuName} label="Seller sign-in link (RuName)" detail={s.hasRuName ? 'Ready' : 'Next step — needed for “Connect to eBay”'} />
        </>}
        <button onClick={check} disabled={loading} style={{ marginTop: 14, padding: '8px 18px', borderRadius: 8, border: '1px solid #7c3aed', background: '#7c3aed', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'Checking…' : '🔄 Check again'}</button>
      </div>
    </div>
  );
}
