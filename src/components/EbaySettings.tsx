import React, { useState, useEffect, useRef } from 'react';

type Pol = { id: string; name: string } | null;
type Setup = { fulfillment: Pol; payment: Pol; return: Pol; location: string | null; ready: boolean } | null;
type SyncResult = { at: string; newSales: { invoice: string; total: number }[]; ended: string[]; qtyUpdated: number; errors: string[] } | null;
type Status = { configured: boolean; env: string; appIdHint: string | null; hasRuName: boolean; keysOk: boolean; apiOk: boolean; categoryTreeId: string | null; connected: boolean; connectedAt: string | null; setup: Setup; lastSync: SyncResult; error: string | null };
type Listing = { id: number; stock_id: number; sku: string; listing_id: string; title: string; price: number; qty: number; status: string; note: string; part_number: string | null; stock_qty: number | null; updated_at: string; url: string | null };
type Order = { order_id: string; sale_id: number | null; buyer: string; total: number; postage: number; note: string; invoice_number: string | null; created_at: string; ship_name?: string; ship_address?: string; ship_phone?: string; buyer_username?: string; status?: string; carrier?: string; tracking?: string; posted_at?: string; posted_by?: string };
type OrderDetail = Order & { sale_date?: string; items: { part_number?: string; title: string; quantity: number; unit: number; total: number }[] };

const SHOP = { name: "Sylvia's Surprises", lines: ['Memorial Hall, Main Road', 'Union Mills', 'Isle of Man', 'IM4 4AD'], phone: '07624 433076', email: 'gavin@sylviassurprises.im' };
const h = (x: any) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function printHtml(title: string, body: string, css = '') {
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) { alert('Please allow pop-ups for this site to print.'); return; }
  win.document.write(`<html><head><title>${h(title)}</title><style>body{font-family:Helvetica,Arial,sans-serif;color:#222;margin:0;padding:28px}table{border-collapse:collapse;width:100%}th,td{padding:7px 8px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}th{background:#f3f4f6}.r{text-align:right}.brand{color:#7c3aed}@media print{body{padding:12mm}.pb{page-break-before:always}}${css}</style></head><body>${body}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 450);
}
function addrHtml(o: OrderDetail) { return `<b>${h(o.ship_name || o.buyer)}</b><br>${h(o.ship_address || '').replace(/\n/g, '<br>')}`; }
function packingSlipHtml(o: OrderDetail) {
  const date = (o.sale_date || o.created_at || '').slice(0, 10).split('-').reverse().join('/');
  const rows = o.items.map(i => `<tr><td>${h(i.part_number || '')}</td><td>${h(i.title)}</td><td class="r">${i.quantity}</td><td class="r">£${Number(i.unit || 0).toFixed(2)}</td><td class="r">£${Number(i.total || 0).toFixed(2)}</td></tr>`).join('');
  const post = Number(o.postage || 0);
  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7c3aed;padding-bottom:12px">
    <div><div class="brand" style="font-size:26px;font-weight:700">${SHOP.name}</div><div style="font-size:12px;color:#555">Antiques, Collectibles &amp; More<br>${SHOP.lines.join(', ')}<br>${SHOP.phone} · ${SHOP.email}</div></div>
    <div style="text-align:right"><div style="font-size:22px;font-weight:700">INVOICE</div><div style="font-size:13px">No. <b>${h(o.invoice_number || '')}</b><br>Date ${h(date)}<br>eBay order ${h(o.order_id)}</div><div style="margin-top:6px;display:inline-block;background:#dcfce7;color:#166534;font-weight:700;padding:3px 10px;border-radius:10px;font-size:12px">PAID via eBay</div></div>
  </div>
  <div style="display:flex;gap:40px;margin:18px 0"><div><div style="font-size:11px;color:#777;text-transform:uppercase">Deliver to</div><div style="font-size:14px;line-height:1.45">${addrHtml(o)}</div>${o.ship_phone ? `<div style="font-size:12px;color:#555">Tel ${h(o.ship_phone)}</div>` : ''}</div><div><div style="font-size:11px;color:#777;text-transform:uppercase">eBay buyer</div><div style="font-size:14px">${h(o.buyer_username || '')}</div></div></div>
  <table><thead><tr><th>Part no.</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <table style="width:280px;margin-left:auto;margin-top:10px"><tr><td>Items</td><td class="r">£${Number(o.total || 0).toFixed(2)}</td></tr><tr><td>Postage</td><td class="r">£${post.toFixed(2)}</td></tr><tr><td><b>Paid by buyer</b></td><td class="r"><b>£${(Number(o.total || 0) + post).toFixed(2)}</b></td></tr><tr><td style="color:#166534">Amount paid</td><td class="r" style="color:#166534">£${(Number(o.total || 0) + post).toFixed(2)}</td></tr><tr><td>Balance due</td><td class="r">£0.00</td></tr></table>
  <div class="pb"></div>
  <div style="margin-top:30px;border-top:2px dashed #999;padding-top:16px">
    <div style="font-size:20px;font-weight:700">PACKING SLIP</div>
    <div style="font-size:13px;color:#555;margin-bottom:10px">Invoice ${h(o.invoice_number || '')} · eBay order ${h(o.order_id)}</div>
    <div style="font-size:14px;line-height:1.45;margin-bottom:12px">${addrHtml(o)}</div>
    <table><thead><tr><th style="width:30px">✓</th><th>Part no.</th><th>Item</th><th class="r">Qty</th></tr></thead><tbody>${o.items.map(i => `<tr><td><div style="width:16px;height:16px;border:1.5px solid #333"></div></td><td>${h(i.part_number || '')}</td><td>${h(i.title)}</td><td class="r">${i.quantity}</td></tr>`).join('')}</tbody></table>
    <div style="margin-top:20px;font-size:13px">Packed by: ____________ &nbsp;&nbsp; Date: ____________</div>
    <div style="margin-top:22px;font-size:12px;color:#555">Thank you for buying from ${SHOP.name}! If anything is wrong, please message us through eBay before leaving feedback.</div>
  </div>`;
}
function labelHtml(o: OrderDetail) {
  return `<div style="width:150mm;min-height:100mm;border:2px solid #222;border-radius:4px;padding:8mm;box-sizing:border-box">
    <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px">Deliver to</div>
    <div style="font-size:22px;line-height:1.35;margin:4px 0 14px">${addrHtml(o)}</div>
    <div style="border-top:1px solid #999;padding-top:6px;font-size:11px;color:#444">If undelivered please return to: ${SHOP.name}, ${SHOP.lines.join(', ')}</div>
    <div style="font-size:10px;color:#777;margin-top:4px">Ref ${h(o.invoice_number || '')} · eBay ${h(o.order_id)}</div>
  </div>`;
}

type StockRow = { id: number; part_number: string; description: string; qty: number; rrp: number; offer_price: number; on_offer: number; photo: string; category: string };
type Aspect = { name: string; mode: string; values: string[] };

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 16 };
const btn = (bg: string, outline = false): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + bg, background: outline ? '#fff' : bg, color: outline ? bg : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 });
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', margin: '10px 0 4px' };
const gbp = (n: number) => '£' + Number(n || 0).toFixed(2);
const esc = (s: string) => s.replace(/'/g, "''");

async function api(path: string, body?: any) {
  const r = await fetch(path, body === undefined ? { credentials: 'include' } : { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || (r.status === 404 ? 'Server not updated yet — try again in a minute' : 'Error ' + r.status));
  return d;
}

const Row = ({ ok, text, detail }: { ok: boolean | null; text: string; detail?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
    <span style={{ fontSize: 18 }}>{ok === null ? '⏳' : ok ? '✅' : '⬜'}</span>
    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{text}</div>{detail && <div style={{ fontSize: 12, color: '#6b7280' }}>{detail}</div>}</div>
  </div>
);
const Msg = ({ kind, children }: { kind: 'ok' | 'err' | 'info'; children: React.ReactNode }) => (
  <div style={{ background: kind === 'ok' ? '#f0fdf4' : kind === 'err' ? '#fef2f2' : '#eff6ff', color: kind === 'ok' ? '#166534' : kind === 'err' ? '#dc2626' : '#1e40af', border: '1px solid ' + (kind === 'ok' ? '#bbf7d0' : kind === 'err' ? '#fecaca' : '#bfdbfe'), padding: '8px 12px', borderRadius: 8, fontSize: 13, margin: '8px 0' }}>{children}</div>
);

export function EbaySettings() {
  const [s, setS] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [returnMsg, setReturnMsg] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupSteps, setSetupSteps] = useState<string[]>([]);
  const [policies, setPolicies] = useState<{ fulfillment: Pol[]; payment: Pol[]; return: Pol[] } | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<SyncResult>(null);
  const [confirmEnd, setConfirmEnd] = useState<number | null>(null);
  const [listErr, setListErr] = useState('');
  const [alertSet, setAlertSet] = useState(false);
  const [alertUrl, setAlertUrl] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [postFor, setPostFor] = useState<string | null>(null);
  const [carrier, setCarrier] = useState('Isle of Man Post');
  const [tracking, setTracking] = useState('');
  const [postMsg, setPostMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [postBusy, setPostBusy] = useState(false);

  async function check() {
    setLoading(true); setErr('');
    try { setS(await api('/api/ebay/status')); } catch (e: any) { setErr(e.message); setS(null); }
    setLoading(false);
  }
  async function loadListings() {
    try { const d = await api('/api/ebay/listings'); setListings(d.listings); setOrders(d.orders); setAlertSet(!!d.alertSet); setListErr(''); } catch (e: any) { setListErr(e.message); }
  }
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('ebay');
    if (p) {
      setReturnMsg(p);
      window.history.replaceState({}, '', window.location.pathname);
    }
    check(); loadListings();
  }, []);

  async function runSetup(choose?: any) {
    setSetupBusy(true); setSetupSteps([]);
    try { const d = await api('/api/ebay/setup', { choose }); setSetupSteps(d.steps); setPolicies(d.policies); await check(); }
    catch (e: any) { setSetupSteps(['❌ ' + e.message]); }
    setSetupBusy(false);
  }
  async function disconnect() { setConfirmDisconnect(false); try { await api('/api/ebay/disconnect', {}); await check(); } catch (e: any) { setErr(e.message); } }
  async function syncNow() {
    setSyncBusy(true);
    try { setSyncMsg(await api('/api/ebay/sync', {})); await loadListings(); } catch (e: any) { setSyncMsg({ at: new Date().toISOString(), newSales: [], ended: [], qtyUpdated: 0, errors: [e.message] }); }
    setSyncBusy(false);
  }
  async function endListing(id: number) {
    setConfirmEnd(null);
    try { await api('/api/ebay/end', { id }); await loadListings(); } catch (e: any) { setListErr(e.message); }
  }
  async function printOrder(id: string, kind: 'slip' | 'label') {
    try {
      const o: OrderDetail = await api('/api/ebay/order/' + encodeURIComponent(id));
      if (kind === 'slip') printHtml('Invoice ' + (o.invoice_number || ''), packingSlipHtml(o));
      else printHtml('Address label ' + (o.invoice_number || ''), labelHtml(o));
    } catch (e: any) { setListErr(e.message); }
  }
  async function markPosted(id: string) {
    setPostBusy(true); setPostMsg(null);
    try { const d = await api('/api/ebay/mark-posted', { order_id: id, carrier, tracking }); setPostMsg({ kind: 'ok', text: '✅ Marked as posted. ' + (d.note || '') }); setPostFor(null); setTracking(''); await loadListings(); }
    catch (e: any) { setPostMsg({ kind: 'err', text: e.message }); }
    setPostBusy(false);
  }
  async function saveAlert(clear = false) {
    setAlertMsg(null);
    try { const d = await api('/api/ebay/alert-link', { url: clear ? '' : alertUrl }); setAlertSet(d.set); setAlertUrl(''); setAlertMsg({ kind: 'ok', text: d.set ? '✅ Alert link saved.' : 'Alert link removed — no sale emails will be sent.' }); }
    catch (e: any) { setAlertMsg({ kind: 'err', text: e.message }); }
  }
  async function testAlert() {
    setAlertMsg(null);
    try { await api('/api/ebay/alert-test', {}); setAlertMsg({ kind: 'ok', text: '✅ Test sent — an email should arrive in a minute or two.' }); }
    catch (e: any) { setAlertMsg({ kind: 'err', text: e.message }); }
  }
  async function removeRecord(id: number) { try { await api('/api/ebay/remove-record', { id }); await loadListings(); } catch (e: any) { setListErr(e.message); } }

  const sandbox = s?.env !== 'production';
  const ready = !!(s?.connected && s?.setup?.ready);
  const lastSync = syncMsg || s?.lastSync || null;
  const activeListings = listings.filter(l => l.status === 'listed');
  const otherListings = listings.filter(l => l.status !== 'listed');

  return (
    <div>
      {returnMsg && (
        <Msg kind={returnMsg === 'connected' ? 'ok' : 'err'}>
          {returnMsg === 'connected' ? '✅ eBay account connected. Next: click “Set up seller account” below.' : returnMsg === 'declined' ? 'eBay sign-in was cancelled — nothing changed.' : returnMsg === 'expired' ? 'That eBay sign-in link expired — please click Connect to eBay again.' : 'eBay sign-in did not complete — please try Connect to eBay again.'}
        </Msg>
      )}

      {/* 1. Connection */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>🛒 1. eBay Connection</h3>
          {s && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: sandbox ? '#fef3c7' : '#dcfce7', color: sandbox ? '#92400e' : '#166534' }}>{sandbox ? '🧪 Practice site (Sandbox)' : '🟢 Real eBay (Production)'}</span>}
        </div>
        {err && <Msg kind="err">{err}</Msg>}
        {loading && !s && <Row ok={null} text="Checking with eBay…" />}
        {s && <>
          <Row ok={s.configured} text="eBay keys added to this site" detail={s.configured ? 'App ID ' + s.appIdHint : 'Not set — add EBAY_APP_ID and EBAY_CERT_ID in Railway Variables'} />
          <Row ok={s.keysOk && s.apiOk} text="eBay accepted the keys" detail={s.configured && !(s.keysOk && s.apiOk) ? (s.error || '') : undefined} />
          <Row ok={s.hasRuName} text="Seller sign-in link (RuName)" detail={s.hasRuName ? 'Ready' : 'Not set — add EBAY_RUNAME in Railway Variables'} />
          <Row ok={s.connected} text="eBay seller account connected" detail={s.connected ? 'Connected ' + (s.connectedAt ? new Date(s.connectedAt).toLocaleString('en-GB') : '') : 'Click Connect to eBay and sign in with the shop’s eBay account'} />
        </>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {s && s.keysOk && s.hasRuName && <a href="/api/ebay/connect" style={{ ...btn('#0064d2'), textDecoration: 'none' }}>🔗 {s.connected ? 'Reconnect to eBay' : 'Connect to eBay'}</a>}
          {s?.connected && !confirmDisconnect && <button style={btn('#dc2626', true)} onClick={() => setConfirmDisconnect(true)}>Disconnect</button>}
          <button onClick={check} disabled={loading} style={btn('#7c3aed', true)}>{loading ? 'Checking…' : '🔄 Check again'}</button>
        </div>
        {confirmDisconnect && (
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 12px', marginTop: 10, fontSize: 13 }}>
            Disconnect the eBay account? Existing listings stay on eBay, but sales will stop syncing until you reconnect.
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}><button style={btn('#dc2626')} onClick={disconnect}>Yes, disconnect</button><button style={btn('#6b7280', true)} onClick={() => setConfirmDisconnect(false)}>No</button></div>
          </div>
        )}
      </div>

      {/* 2. Seller setup */}
      {s?.connected && (
        <div style={card}>
          <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>⚙️ 2. Seller account setup</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>Checks the eBay account has postage, payment and returns policies and adds the shop as the item location.{sandbox ? ' On the practice site, simple policies are created automatically.' : ''}</p>
          {s.setup && <>
            <Row ok={!!s.setup.fulfillment} text="Postage policy" detail={s.setup.fulfillment?.name || 'None found'} />
            <Row ok={!!s.setup.payment} text="Payment policy" detail={s.setup.payment?.name || 'None found'} />
            <Row ok={!!s.setup.return} text="Returns policy" detail={s.setup.return?.name || 'None found'} />
            <Row ok={!!s.setup.location} text="Item location" detail={s.setup.location ? "Sylvia's Surprises, Union Mills IM4 4AD" : 'Not set'} />
          </>}
          {policies && (['fulfillment', 'payment', 'return'] as const).some(k => policies[k].length > 1) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
              {(['fulfillment', 'payment', 'return'] as const).map(k => policies[k].length > 1 && (
                <div key={k}><span style={label}>{k === 'fulfillment' ? 'Postage' : k === 'payment' ? 'Payment' : 'Returns'} policy to use</span>
                  <select style={input} value={s.setup?.[k]?.id || ''} onChange={e => runSetup({ ...Object.fromEntries((['fulfillment', 'payment', 'return'] as const).map(x => [x, s.setup?.[x]?.id])), [k]: e.target.value })}>
                    {policies[k].map(p => p && <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
              ))}
            </div>
          )}
          {setupSteps.length > 0 && <Msg kind={setupSteps.some(x => x.startsWith('❌') || x.startsWith('Missing')) ? 'err' : 'info'}>{setupSteps.map((x, i) => <div key={i}>• {x}</div>)}</Msg>}
          <button style={{ ...btn('#7c3aed'), marginTop: 10, opacity: setupBusy ? 0.6 : 1 }} disabled={setupBusy} onClick={() => runSetup()}>{setupBusy ? 'Setting up…' : s.setup?.ready ? '🔄 Re-check setup' : '⚙️ Set up seller account'}</button>
        </div>
      )}

      {/* 3. List an item */}
      {ready && <ListItem onListed={loadListings} listedIds={new Set(activeListings.map(l => l.stock_id))} />}

      {/* 4. Listings + sync */}
      {s?.connected && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>📦 4. eBay listings & sales</h3>
            <button style={{ ...btn('#16a34a'), opacity: syncBusy ? 0.6 : 1 }} disabled={syncBusy} onClick={syncNow}>{syncBusy ? 'Syncing…' : '🔄 Sync with eBay now'}</button>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0' }}>Syncs automatically every 10 minutes: eBay sales are recorded as paid sales (payment “eBay”) and taken out of stock; items sold in the shop have their eBay listing ended.</p>
          {lastSync && (
            <Msg kind={lastSync.errors.length ? 'err' : 'ok'}>
              Last sync {new Date(lastSync.at).toLocaleString('en-GB')}: {lastSync.newSales.length} new eBay sale{lastSync.newSales.length === 1 ? '' : 's'}{lastSync.newSales.length ? ' (' + lastSync.newSales.map(x => x.invoice + ' ' + gbp(x.total)).join(', ') + ')' : ''}, {lastSync.ended.length} listing{lastSync.ended.length === 1 ? '' : 's'} ended{lastSync.qtyUpdated ? ', ' + lastSync.qtyUpdated + ' quantity update(s)' : ''}.
              {lastSync.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
            </Msg>
          )}
          {listErr && <Msg kind="err">{listErr}</Msg>}
          <h4 style={{ fontSize: 14, margin: '12px 0 6px' }}>On eBay now ({activeListings.length})</h4>
          {activeListings.length === 0 ? <div style={{ fontSize: 13, color: '#9ca3af' }}>Nothing listed yet.</div> : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}><th style={{ padding: 6 }}>Part no.</th><th>Title</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'center' }}>Qty</th><th></th></tr></thead>
              <tbody>{activeListings.map(l => (
                <React.Fragment key={l.id}>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{l.part_number || '—'}</td>
                    <td>{l.url ? <a href={l.url} target="_blank" rel="noreferrer" style={{ color: '#0064d2' }}>{l.title}</a> : l.title}</td>
                    <td style={{ textAlign: 'right' }}>{gbp(l.price)}</td>
                    <td style={{ textAlign: 'center' }}>{l.qty}</td>
                    <td style={{ textAlign: 'right' }}>{confirmEnd !== l.id && <button style={{ ...btn('#dc2626', true), padding: '4px 10px' }} onClick={() => setConfirmEnd(l.id)}>End</button>}</td>
                  </tr>
                  {confirmEnd === l.id && <tr><td colSpan={5}><div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', margin: '4px 0', fontSize: 13 }}>End this eBay listing? The item stays in shop stock.<span style={{ marginLeft: 10 }}><button style={{ ...btn('#dc2626'), padding: '4px 10px' }} onClick={() => endListing(l.id)}>Yes, end it</button> <button style={{ ...btn('#6b7280', true), padding: '4px 10px' }} onClick={() => setConfirmEnd(null)}>No</button></span></div></td></tr>}
                </React.Fragment>
              ))}</tbody>
            </table>
          )}
          {otherListings.length > 0 && <>
            <h4 style={{ fontSize: 14, margin: '16px 0 6px' }}>Sold, ended or failed</h4>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}><tbody>{otherListings.slice(0, 30).map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 5 }}><span style={{ fontWeight: 700, color: l.status === 'sold' ? '#16a34a' : l.status === 'error' ? '#dc2626' : '#6b7280' }}>{l.status === 'sold' ? 'SOLD' : l.status === 'error' ? 'FAILED' : 'ENDED'}</span></td>
                <td>{l.title}</td><td style={{ color: '#6b7280' }}>{l.note}</td>
                <td style={{ textAlign: 'right' }}><button style={{ ...btn('#6b7280', true), padding: '2px 8px', fontSize: 11 }} onClick={() => removeRecord(l.id)}>Clear</button></td>
              </tr>))}</tbody></table>
          </>}
        </div>
      )}

      {/* 5. eBay orders to post */}
      {s?.connected && (
        <div style={card}>
          <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>📮 5. eBay orders — pack & post</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>Each eBay sale already has a paid invoice in Sylvia's. Print the invoice & packing slip and the address label, take the parcel to Isle of Man Post, then click <b>Mark as posted</b> — eBay emails the buyer.</p>
          {postMsg && <Msg kind={postMsg.kind}>{postMsg.text}</Msg>}
          {orders.length === 0 ? <div style={{ fontSize: 13, color: '#9ca3af' }}>No eBay sales yet.</div> : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}><th style={{ padding: 6 }}>Status</th><th>Invoice</th><th>Buyer</th><th style={{ textAlign: 'right' }}>Items</th><th style={{ textAlign: 'right' }}>Postage</th><th></th></tr></thead>
              <tbody>{orders.map(o => (
                <React.Fragment key={o.order_id}>
                  <tr style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                    <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{o.status === 'posted' ? <span style={{ fontWeight: 700, color: '#16a34a' }}>✅ POSTED</span> : <span style={{ fontWeight: 700, color: '#d97706' }}>📦 TO POST</span>}{o.status === 'posted' && <div style={{ fontSize: 11, color: '#6b7280' }}>{o.carrier}{o.tracking ? ' · ' + o.tracking : ''}<br />{(o.posted_at || '').slice(0, 16)} {o.posted_by}</div>}</td>
                    <td>{o.invoice_number}<div style={{ fontSize: 11, color: '#6b7280' }}>{(o.created_at || '').slice(0, 16)}</div></td>
                    <td>{o.ship_name || o.buyer}{o.ship_address && <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'pre-line' }}>{o.ship_address}</div>}</td>
                    <td style={{ textAlign: 'right' }}>{gbp(o.total)}</td>
                    <td style={{ textAlign: 'right' }}>{gbp(o.postage)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                        <button style={{ ...btn('#0064d2', true), padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => printOrder(o.order_id, 'slip')}>🖨️ Invoice & packing slip</button>
                        <button style={{ ...btn('#0064d2', true), padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => printOrder(o.order_id, 'label')}>🏷️ Address label</button>
                        {o.status !== 'posted' && postFor !== o.order_id && <button style={{ ...btn('#16a34a'), padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => { setPostFor(o.order_id); setPostMsg(null); setTracking(''); setCarrier('Isle of Man Post'); }}>✅ Mark as posted</button>}
                      </div>
                    </td>
                  </tr>
                  {postFor === o.order_id && <tr><td colSpan={6}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10, margin: '4px 0 8px', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div><span style={label}>Posted with</span><select style={{ ...input, width: 180 }} value={carrier} onChange={e => setCarrier(e.target.value)}>{['Isle of Man Post', 'Royal Mail', 'Parcelforce', 'DPD', 'Evri', 'Other'].map(c => <option key={c}>{c}</option>)}</select></div>
                      <div style={{ flex: 1, minWidth: 180 }}><span style={label}>Tracking number (optional)</span><input style={input} value={tracking} onChange={e => setTracking(e.target.value.toUpperCase())} placeholder="Leave blank if none" /></div>
                      <button style={{ ...btn('#16a34a'), opacity: postBusy ? 0.6 : 1 }} disabled={postBusy} onClick={() => markPosted(o.order_id)}>{postBusy ? 'Saving…' : 'Confirm posted'}</button>
                      <button style={btn('#6b7280', true)} onClick={() => setPostFor(null)}>Cancel</button>
                    </div>
                  </td></tr>}
                </React.Fragment>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {/* 6. Sale alert email */}
      {s?.configured && (
        <div style={card}>
          <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>📧 6. Email me when something sells on eBay</h3>
          <Row ok={alertSet} text="Sale alert link" detail={alertSet ? 'Saved — an email is sent for each new eBay sale' : 'Not set — paste the alert link from Tasklet below'} />
          {alertMsg && <Msg kind={alertMsg.kind}>{alertMsg.text}</Msg>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input style={{ ...input, flex: 1, minWidth: 220 }} value={alertUrl} onChange={e => setAlertUrl(e.target.value.trim())} placeholder={alertSet ? 'Paste a new link to replace it' : 'https://webhooks.tasklet.ai/…'} />
            <button style={btn('#7c3aed')} disabled={!alertUrl} onClick={() => saveAlert()}>Save</button>
            {alertSet && <button style={btn('#16a34a', true)} onClick={testAlert}>Send test</button>}
            {alertSet && <button style={btn('#dc2626', true)} onClick={() => saveAlert(true)}>Remove</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function ListItem({ onListed, listedIds }: { onListed: () => void; listedIds: Set<number> }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<StockRow[]>([]);
  const [item, setItem] = useState<StockRow | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [postage, setPostage] = useState('');
  const [catQ, setCatQ] = useState('');
  const [cats, setCats] = useState<{ id: string; name: string; path: string }[]>([]);
  const [catNote, setCatNote] = useState('');
  const [cat, setCat] = useState<{ id: string; name: string } | null>(null);
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [aspectVals, setAspectVals] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<{ value: string; label: string }[]>([]);
  const [condition, setCondition] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; text: string; url?: string | null } | null>(null);
  const timer = useRef<any>(null);
  const [pics, setPics] = useState<{ photo: string; is_main: number }[]>([]);

  // Arrived from Stock Control's 🛒 button — pre-select that item
  useEffect(() => {
    let id: string | null = null;
    try { id = sessionStorage.getItem('ebay_list_stock_id'); sessionStorage.removeItem('ebay_list_stock_id'); } catch {}
    if (!id) return;
    (async () => {
      const rows = await (window as any).tasklet.sqlQuery(`SELECT id, part_number, description, qty, rrp, offer_price, on_offer, photo, category FROM sylvias_stock WHERE id = ${Number(id)}`);
      const r = (rows as StockRow[])[0];
      if (!r) return;
      if (listedIds.has(r.id)) { setResult({ kind: 'err', text: 'That item is already on eBay — see the listings below.' }); return; }
      if (r.qty < 1) { setResult({ kind: 'err', text: 'That item is out of stock.' }); return; }
      pick(r);
    })();
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const t = esc(q.trim());
      const rows = await (window as any).tasklet.sqlQuery(`SELECT id, part_number, description, qty, rrp, offer_price, on_offer, photo, category FROM sylvias_stock WHERE qty > 0 AND (description LIKE '%${t}%' OR part_number LIKE '%${t}%') ORDER BY description LIMIT 15`);
      setResults(rows as StockRow[]);
    }, 250);
  }, [q]);

  function pick(r: StockRow) {
    setItem(r); setResults([]); setQ(''); setResult(null); setErrors({});
    setPics(r.photo ? [{ photo: r.photo, is_main: 1 }] : []);
    api('/api/stock/' + r.id + '/photos').then(d => setPics(d.photos || [])).catch(() => {});
    setTitle(r.description.slice(0, 80));
    setDesc(r.description + (r.part_number ? '\n\nRef: ' + r.part_number : '') + "\n\nFrom Sylvia's Surprises — Antiques, Collectibles & More, Isle of Man.");
    setPrice(String(r.on_offer && r.offer_price > 0 ? r.offer_price : r.rrp || ''));
    setQty('1'); setPostage('');
    setCat(null); setCats([]); setAspects([]); setAspectVals({}); setConditions([]); setCondition('');
    setCatQ(r.category && r.category !== 'Other' ? r.category : r.description.split(' ').slice(0, 4).join(' '));
  }
  async function findCats() {
    setCatNote('');
    try { const d = await api('/api/ebay/categories?q=' + encodeURIComponent(catQ)); setCats(d.suggestions); if (d.note) setCatNote(d.note); else if (!d.suggestions.length) setCatNote('No suggestions — try different words.'); }
    catch (e: any) { setCatNote(e.message); }
  }
  async function chooseCat(c: { id: string; name: string }) {
    setCat(c); setCats([]); setAspects([]); setConditions([]); setCondition('');
    try {
      const d = await api('/api/ebay/category-details?id=' + c.id);
      setAspects(d.aspects);
      setAspectVals(Object.fromEntries(d.aspects.map((a: Aspect) => [a.name, a.name === 'Brand' ? 'Unbranded' : ''])));
      setConditions(d.conditions);
      const used = d.conditions.find((x: any) => x.value === 'USED_EXCELLENT') || d.conditions[0];
      setCondition(used ? used.value : '');
    } catch (e: any) { setCatNote(e.message); }
  }
  async function submit() {
    if (!item) return;
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Enter a title';
    const p = parseFloat(price); if (!(p > 0)) e.price = 'Enter a price';
    const n = parseInt(qty, 10); if (!(n >= 1)) e.qty = 'At least 1'; else if (n > item.qty) e.qty = 'Only ' + item.qty + ' in stock';
    if (!cat) e.cat = 'Choose an eBay category';
    const pp = parseFloat(postage); if (postage.trim() === '' || !(pp >= 0)) e.postage = 'Enter the UK postage price (0 for free postage)';
    aspects.forEach(a => { if (!String(aspectVals[a.name] || '').trim()) e['a_' + a.name] = 'Required by eBay'; });
    setErrors(e); if (Object.keys(e).length) return;
    setBusy(true); setResult(null);
    try {
      const d = await api('/api/ebay/list', { stock_id: item.id, title, description: desc, price: p, qty: n, category_id: cat!.id, condition, aspects: aspectVals, postage: pp });
      setResult({ kind: 'ok', text: '✅ Listed on eBay' + (d.photo ? ' with ' + (d.photos || 1) + ' photo' + ((d.photos || 1) === 1 ? '' : 's') : ' (no photo — add some in Stock Control and list again for better sales)'), url: d.url });
      setItem(null); onListed();
    } catch (err: any) { setResult({ kind: 'err', text: err.message }); onListed(); }
    setBusy(false);
  }
  const fe = (k: string) => errors[k] ? <div style={{ color: '#dc2626', fontSize: 12, marginTop: 2 }}>{errors[k]}</div> : null;

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>📤 3. List an item on eBay</h3>
      {result && <Msg kind={result.kind}>{result.text} {result.url && <a href={result.url} target="_blank" rel="noreferrer" style={{ color: '#0064d2', fontWeight: 600 }}>View on eBay ↗</a>}</Msg>}
      {!item && (
        <div style={{ position: 'relative' }}>
          <span style={label}>Find a stock item (part number or description)</span>
          <input style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Start typing…" />
          {results.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, marginTop: 2, maxHeight: 280, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              {results.map(r => (
                <div key={r.id} onClick={() => !listedIds.has(r.id) && pick(r)} style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', cursor: listedIds.has(r.id) ? 'default' : 'pointer', display: 'flex', gap: 8, alignItems: 'center', opacity: listedIds.has(r.id) ? 0.5 : 1 }}>
                  {r.photo ? <img src={r.photo} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ width: 32, textAlign: 'center' }}>📷</span>}
                  <div style={{ flex: 1, fontSize: 13 }}><b>{r.part_number || '—'}</b> {r.description}<div style={{ fontSize: 11, color: '#6b7280' }}>Qty {r.qty} · {gbp(r.on_offer && r.offer_price > 0 ? r.offer_price : r.rrp)}{listedIds.has(r.id) ? ' · already on eBay' : ''}{!r.photo ? ' · no photo' : ''}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {item && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#f9fafb', borderRadius: 8, padding: 10 }}>
            {item.photo ? <img src={item.photo} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 56, height: 56, borderRadius: 6, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</div>}
            <div style={{ flex: 1, fontSize: 13 }}><b>{item.part_number || '—'}</b> {item.description}<div style={{ color: '#6b7280' }}>In stock: {item.qty}</div></div>
            <button style={btn('#6b7280', true)} onClick={() => setItem(null)}>Change</button>
          </div>
          {pics.length > 0 && (
            <div style={{ margin: '8px 0' }}>
              <span style={label}>Photos going to eBay ({pics.length}) — main photo first</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pics.map((p, i) => <img key={i} src={p.photo} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: p.is_main ? '2px solid #16a34a' : '1px solid #e5e7eb' }} title={p.is_main ? 'Main photo' : ''} />)}
              </div>
            </div>
          )}
          {!item.photo && <Msg kind="info">This item has no photo. eBay listings sell much better with one — add it in Stock Control first if you can.</Msg>}
          <span style={label}>eBay title ({title.length}/80)</span>
          <input style={input} value={title} maxLength={80} onChange={e => setTitle(e.target.value)} />{fe('title')}
          <span style={label}>Description</span>
          <textarea style={{ ...input, minHeight: 90 }} value={desc} onChange={e => setDesc(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><span style={label}>Price (£)</span><input style={input} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />{fe('price')}</div>
            <div><span style={label}>Quantity to list</span><input style={input} inputMode="numeric" value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, ''))} />{fe('qty')}</div>
            <div><span style={label}>UK postage (£)</span><input style={input} inputMode="decimal" value={postage} placeholder="e.g. 4.50" onChange={e => setPostage(e.target.value.replace(/[^\d.]/g, ''))} />{fe('postage')}<div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>What the buyer pays to post this item (0 = free)</div></div>
          </div>
          <span style={label}>eBay category</span>
          {cat ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><b>{cat.name}</b> <span style={{ color: '#6b7280' }}>#{cat.id}</span><button style={{ ...btn('#6b7280', true), padding: '3px 10px' }} onClick={() => setCat(null)}>Change</button></div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={input} value={catQ} onChange={e => setCatQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') findCats(); }} placeholder="e.g. royal doulton figurine" />
                <button style={btn('#0064d2')} onClick={findCats}>Suggest</button>
              </div>
              {cats.map(c => <div key={c.id} onClick={() => chooseCat(c)} style={{ padding: '6px 8px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><b>{c.name}</b> <span style={{ color: '#6b7280', fontSize: 11 }}>{c.path}</span></div>)}
              {catNote && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{catNote}</div>}
              {/^\d+$/.test(catQ.trim()) && <button style={{ ...btn('#6b7280', true), marginTop: 6, padding: '4px 10px' }} onClick={() => chooseCat({ id: catQ.trim(), name: 'Category' })}>Use category number {catQ.trim()}</button>}
            </>
          )}
          {fe('cat')}
          {cat && conditions.length > 0 && <><span style={label}>Condition</span><select style={input} value={condition} onChange={e => setCondition(e.target.value)}>{conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></>}
          {cat && aspects.length > 0 && <>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>eBay requires these details for this category:</div>
            {aspects.map(a => (
              <div key={a.name}>
                <span style={label}>{a.name}</span>
                {a.mode === 'SELECTION_ONLY' && a.values.length ? (
                  <select style={input} value={aspectVals[a.name] || ''} onChange={e => setAspectVals({ ...aspectVals, [a.name]: e.target.value })}><option value="">— choose —</option>{a.values.map(v => <option key={v} value={v}>{v}</option>)}</select>
                ) : (
                  <><input style={input} list={'asp-' + a.name} value={aspectVals[a.name] || ''} onChange={e => setAspectVals({ ...aspectVals, [a.name]: e.target.value })} /><datalist id={'asp-' + a.name}>{a.values.map(v => <option key={v} value={v} />)}</datalist></>
                )}
                {fe('a_' + a.name)}
              </div>
            ))}
          </>}
          <button style={{ ...btn('#16a34a'), marginTop: 14, padding: '10px 22px', fontSize: 14, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submit}>{busy ? 'Listing…' : '📤 List on eBay'}</button>
        </div>
      )}
    </div>
  );
}
