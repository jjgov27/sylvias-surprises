import React, { useState, useEffect } from 'react';
import { StaffUser } from '../types';
import { esc, getSetting, setSetting } from '../utils/db';
import { Mail, Plus, Trash2, Eye, ToggleLeft, ToggleRight, Send, Users, Clock, ChevronDown, ChevronRight, AlertTriangle, Check, X, RefreshCw } from 'lucide-react';

/* ── Section definitions ── */
export interface EmailSection {
  id: string;
  label: string;
  description: string;
  defaultOn: boolean;
}

export const ALL_SECTIONS: EmailSection[] = [
  { id: 'sales_overview', label: 'Sales Overview', description: 'Total sales, count, stock vs consignment breakdown', defaultOn: true },
  { id: 'sales_by_method', label: 'Sales by Payment Method', description: 'Cash, SumUp, eBay etc. broken down', defaultOn: true },
  { id: 'individual_sales', label: 'Individual Sale Breakdown', description: 'Each sale with items sold and customer name', defaultOn: false },
  { id: 'top_selling', label: 'Top Selling Items', description: 'Most sold items of the day', defaultOn: false },
  { id: 'expenses', label: 'Expenses', description: 'Total expenses and individual items', defaultOn: true },
  { id: 'float_cashup', label: 'Float / Cash-Up', description: 'Opening, closing, difference', defaultOn: true },
  { id: 'low_stock', label: 'Low Stock Alerts', description: 'Items with quantity ≤ 2', defaultOn: false },
  { id: 'new_stock', label: 'New Stock Added', description: 'Items entered today', defaultOn: false },
  { id: 'outstanding_invoices', label: 'Outstanding Invoices', description: 'Unpaid or partially paid invoices', defaultOn: false },
  { id: 'expiring_reservations', label: 'Expiring Reservations', description: 'Reservations expiring in next 3 days', defaultOn: true },
  { id: 'open_wishes', label: 'Open Wishes', description: 'Active items on the wanted board', defaultOn: true },
  { id: 'consignment_breakdown', label: 'Consignment by Consigner', description: 'Sales and commission per consigner today', defaultOn: false },
  { id: 'gift_vouchers', label: 'Gift Vouchers', description: 'Active vouchers and any issued/redeemed today', defaultOn: false },
  { id: 'bullion_summary', label: 'Bullion Summary', description: 'Holdings and any bullion activity today', defaultOn: false },
];

interface EmailRecipient {
  id: number;
  email: string;
  name: string;
  active: number;
  created_at: string;
}

interface SentEmail {
  id: number;
  sent_at: string;
  subject: string;
  recipients: string;
  body_preview: string;
  sections_used: string;
  status: string;
}

interface Props {
  currentUser: StaffUser;
}

export function EmailSettings({ currentUser }: Props) {
  const [tab, setTab] = useState<'sections' | 'recipients' | 'history'>('sections');
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);

  // Recipients form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Confirmation banner
  const [confirmAction, setConfirmAction] = useState<{ type: string; id?: number; label?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Test email
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      // Ensure tables exist
      await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS sylvias_email_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS sylvias_sent_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sent_at TEXT NOT NULL DEFAULT (datetime('now')),
        subject TEXT NOT NULL DEFAULT '',
        recipients TEXT NOT NULL DEFAULT '',
        body_preview TEXT NOT NULL DEFAULT '',
        sections_used TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'sent'
      )`);

      // Load sections
      const raw = await getSetting('email_sections');
      if (raw) {
        setSections(JSON.parse(raw));
      } else {
        // Default sections
        const defaults: Record<string, boolean> = {};
        ALL_SECTIONS.forEach(s => { defaults[s.id] = s.defaultOn; });
        setSections(defaults);
      }

      // Load recipients
      const recs = await window.tasklet.sqlQuery('SELECT * FROM sylvias_email_recipients ORDER BY name ASC');
      setRecipients(recs as unknown as EmailRecipient[]);

      // Load sent emails (last 50)
      const sent = await window.tasklet.sqlQuery('SELECT * FROM sylvias_sent_emails ORDER BY id DESC LIMIT 50');
      setSentEmails(sent as unknown as SentEmail[]);
    } catch (e) {
      console.error('EmailSettings load error:', e);
    }
    setLoading(false);
  }

  async function toggleSection(id: string) {
    const updated = { ...sections, [id]: !sections[id] };
    setSections(updated);
    await setSetting('email_sections', JSON.stringify(updated));
  }

  async function enableAll() {
    const updated: Record<string, boolean> = {};
    ALL_SECTIONS.forEach(s => { updated[s.id] = true; });
    setSections(updated);
    await setSetting('email_sections', JSON.stringify(updated));
  }

  async function resetDefaults() {
    const defaults: Record<string, boolean> = {};
    ALL_SECTIONS.forEach(s => { defaults[s.id] = s.defaultOn; });
    setSections(defaults);
    await setSetting('email_sections', JSON.stringify(defaults));
  }

  async function addRecipient() {
    setAddError('');
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    if (!email) { setAddError('Email address is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAddError('Please enter a valid email address'); return; }
    if (recipients.some(r => r.email.toLowerCase() === email)) { setAddError('This email is already in the list'); return; }

    await window.tasklet.sqlExec(
      `INSERT INTO sylvias_email_recipients (email, name) VALUES ('${esc(email)}', '${esc(name)}')`
    );
    setNewEmail('');
    setNewName('');
    const recs = await window.tasklet.sqlQuery('SELECT * FROM sylvias_email_recipients ORDER BY name ASC');
    setRecipients(recs as unknown as EmailRecipient[]);
  }

  async function toggleRecipientActive(id: number, currentActive: number) {
    await window.tasklet.sqlExec(`UPDATE sylvias_email_recipients SET active = ${currentActive ? 0 : 1} WHERE id = ${id}`);
    const recs = await window.tasklet.sqlQuery('SELECT * FROM sylvias_email_recipients ORDER BY name ASC');
    setRecipients(recs as unknown as EmailRecipient[]);
  }

  async function deleteRecipient(id: number) {
    await window.tasklet.sqlExec(`DELETE FROM sylvias_email_recipients WHERE id = ${id}`);
    setConfirmAction(null);
    const recs = await window.tasklet.sqlQuery('SELECT * FROM sylvias_email_recipients ORDER BY name ASC');
    setRecipients(recs as unknown as EmailRecipient[]);
  }

  function generatePreview() {
    setPreviewLoading(true);
    const enabledSections = ALL_SECTIONS.filter(s => sections[s.id]);
    let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">`;
    html += `<div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #e5e7eb;">`;
    html += `<h1 style="color: #7c3aed; margin: 0;">🏪 Sylvia's Surprises</h1>`;
    html += `<p style="color: #6b7280; margin: 4px 0;">Daily Summary — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>`;
    html += `</div>`;

    if (enabledSections.length === 0) {
      html += `<p style="color: #ef4444; padding: 20px; text-align: center;">No sections enabled — the email will be empty!</p>`;
    } else {
      enabledSections.forEach(s => {
        html += `<div style="margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #7c3aed;">`;
        html += `<h3 style="margin: 0 0 4px 0; color: #1f2937;">${s.label}</h3>`;
        html += `<p style="margin: 0; color: #6b7280; font-size: 14px; font-style: italic;">${s.description} — data will appear here</p>`;
        html += `</div>`;
      });
    }

    html += `<div style="text-align: center; padding: 20px 0; border-top: 2px solid #e5e7eb; margin-top: 20px;">`;
    html += `<p style="color: #9ca3af; font-size: 12px; margin: 0;">Sylvia's Surprises — Memorial Hall, Main Road, Union Mills, IM4 4AD</p>`;
    html += `</div></div>`;

    setPreviewHtml(html);
    setPreviewOpen(true);
    setPreviewLoading(false);
  }

  async function sendTestEmail() {
    const activeRecs = recipients.filter(r => r.active);
    if (activeRecs.length === 0) {
      setTestResult({ ok: false, msg: 'No active recipients — add at least one first' });
      return;
    }
    const enabledSections = ALL_SECTIONS.filter(s => sections[s.id]);
    if (enabledSections.length === 0) {
      setTestResult({ ok: false, msg: 'No sections enabled — enable at least one first' });
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      await window.tasklet.sqlExec(
        `INSERT INTO sylvias_settings (key, value) VALUES ('test_email_requested', '${esc(now)}')
         ON CONFLICT(key) DO UPDATE SET value = '${esc(now)}'`
      );
      setTestResult({ ok: true, msg: `Test email queued for ${activeRecs.map(r => r.name || r.email).join(', ')} — it will arrive in a few minutes` });
    } catch (e: any) {
      setTestResult({ ok: false, msg: 'Failed to queue test email: ' + (e?.message || 'Unknown error') });
    }
    setTestSending(false);
  }

  // View a sent email body
  const [viewingEmail, setViewingEmail] = useState<SentEmail | null>(null);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const activeCount = ALL_SECTIONS.filter(s => sections[s.id]).length;
  const activeRecipients = recipients.filter(r => r.active);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Mail size={28} className="text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Email Settings</h1>
          <p className="text-base-content/60 text-sm">Configure your daily summary email content and recipients</p>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-base-200 rounded-lg p-3 mb-4 flex flex-wrap gap-4 items-center text-sm">
        <span className="flex items-center gap-1.5">
          <ToggleRight size={16} className="text-success" />
          <strong>{activeCount}</strong> sections enabled
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={16} className="text-info" />
          <strong>{activeRecipients.length}</strong> active recipient{activeRecipients.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={16} className="text-warning" />
          Sends daily at <strong>5:00 PM</strong> (Tue–Sat)
        </span>
        <button className="btn btn-sm btn-primary gap-1 ml-auto" onClick={generatePreview}>
          <Eye size={14} /> Preview
        </button>
        <button className={`btn btn-sm btn-success gap-1 ${testSending ? 'loading' : ''}`} onClick={sendTestEmail} disabled={testSending}>
          {!testSending && <Send size={14} />} Send Test
        </button>
      </div>

      {/* Test email result banner */}
      {testResult && (
        <div className={`alert ${testResult.ok ? 'alert-success' : 'alert-warning'} mb-4 py-2`}>
          <span>{testResult.ok ? '✅' : '⚠️'} {testResult.msg}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setTestResult(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs tabs-boxed bg-base-200 mb-4">
        <button className={`tab ${tab === 'sections' ? 'tab-active' : ''}`} onClick={() => setTab('sections')}>
          📋 Summary Content
        </button>
        <button className={`tab ${tab === 'recipients' ? 'tab-active' : ''}`} onClick={() => setTab('recipients')}>
          👥 Recipients ({recipients.length})
        </button>
        <button className={`tab ${tab === 'history' ? 'tab-active' : ''}`} onClick={() => setTab('history')}>
          📧 Sent History ({sentEmails.length})
        </button>
      </div>

      {/* ── SECTIONS TAB ── */}
      {tab === 'sections' && (
        <div>
          <div className="flex gap-2 mb-4">
            <button className="btn btn-sm btn-outline btn-success gap-1" onClick={enableAll}>
              <ToggleRight size={14} /> Enable All
            </button>
            <button className="btn btn-sm btn-outline gap-1" onClick={resetDefaults}>
              <RefreshCw size={14} /> Reset Defaults
            </button>
          </div>

          <div className="space-y-2">
            {ALL_SECTIONS.map(section => {
              const enabled = !!sections[section.id];
              return (
                <div
                  key={section.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${enabled ? 'border-success/30 bg-success/5' : 'border-base-300 bg-base-100 opacity-60'}`}
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex-shrink-0">
                    {enabled ? (
                      <ToggleRight size={28} className="text-success" />
                    ) : (
                      <ToggleLeft size={28} className="text-base-content/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base">{section.label}</div>
                    <div className="text-sm text-base-content/60">{section.description}</div>
                  </div>
                  {section.defaultOn && (
                    <span className="badge badge-sm badge-ghost">Default</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RECIPIENTS TAB ── */}
      {tab === 'recipients' && (
        <div>
          {/* Add form */}
          <div className="card bg-base-200 p-4 mb-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Plus size={16} /> Add Recipient
            </h3>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="label"><span className="label-text text-xs">Name</span></label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="e.g. Gavin Smith"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[250px]">
                <label className="label"><span className="label-text text-xs">Email Address</span></label>
                <input
                  type="email"
                  className="input input-bordered input-sm w-full"
                  placeholder="e.g. gavin@sylviassurprises.im"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addRecipient(); }}
                />
              </div>
              <button className="btn btn-sm btn-primary gap-1" onClick={addRecipient}>
                <Plus size={14} /> Add
              </button>
            </div>
            {addError && (
              <div className="text-error text-sm mt-2 flex items-center gap-1">
                <AlertTriangle size={14} /> {addError}
              </div>
            )}
          </div>

          {/* Recipients list */}
          {recipients.length === 0 ? (
            <div className="text-center py-10 text-base-content/50">
              <Mail size={40} className="mx-auto mb-2 opacity-30" />
              <p>No recipients yet. Add an email address above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recipients.map(r => (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all
                    ${r.active ? 'border-base-300 bg-base-100' : 'border-base-300 bg-base-200 opacity-50'}`}
                >
                  <div className="flex-shrink-0 cursor-pointer" onClick={() => toggleRecipientActive(r.id, r.active)}>
                    {r.active ? (
                      <ToggleRight size={24} className="text-success" />
                    ) : (
                      <ToggleLeft size={24} className="text-base-content/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{r.name || 'Unnamed'}</div>
                    <div className="text-sm text-base-content/60">{r.email}</div>
                  </div>
                  <span className={`badge badge-sm ${r.active ? 'badge-success' : 'badge-ghost'}`}>
                    {r.active ? 'Active' : 'Paused'}
                  </span>

                  {/* Delete with inline confirmation */}
                  {confirmAction?.type === 'delete' && confirmAction.id === r.id ? (
                    <div className="flex items-center gap-1 bg-warning/20 border border-warning/40 rounded-lg px-2 py-1">
                      <span className="text-xs font-semibold text-warning-content">Remove?</span>
                      <button className="btn btn-xs btn-success" onClick={() => deleteRecipient(r.id)}>Yes</button>
                      <button className="btn btn-xs btn-ghost" onClick={() => setConfirmAction(null)}>No</button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm btn-square text-error/50 hover:text-error"
                      onClick={() => setConfirmAction({ type: 'delete', id: r.id })}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div>
          {sentEmails.length === 0 ? (
            <div className="text-center py-10 text-base-content/50">
              <Clock size={40} className="mx-auto mb-2 opacity-30" />
              <p>No emails sent yet. The daily summary runs at 5pm, Tuesday to Saturday.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sentEmails.map(e => (
                <div key={e.id} className="border border-base-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge badge-sm ${e.status === 'sent' ? 'badge-success' : 'badge-error'}`}>
                      {e.status}
                    </span>
                    <span className="font-semibold text-sm flex-1">{e.subject}</span>
                    <span className="text-xs text-base-content/50">
                      {e.sent_at ? new Date(e.sent_at + 'Z').toLocaleString('en-GB') : ''}
                    </span>
                  </div>
                  <div className="text-xs text-base-content/60 mb-1">
                    To: {e.recipients}
                  </div>
                  {e.sections_used && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {e.sections_used.split(',').map(s => (
                        <span key={s} className="badge badge-xs badge-ghost">{s.trim()}</span>
                      ))}
                    </div>
                  )}
                  {viewingEmail?.id === e.id ? (
                    <div className="mt-2">
                      <div className="bg-base-200 rounded-lg p-3 text-sm max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                        {e.body_preview}
                      </div>
                      <button className="btn btn-xs btn-ghost mt-1" onClick={() => setViewingEmail(null)}>
                        Hide preview
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-xs btn-ghost gap-1" onClick={() => setViewingEmail(e)}>
                      <Eye size={12} /> View content
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PREVIEW MODAL ── */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">📧 Email Preview</h3>
              <button className="btn btn-sm btn-ghost btn-circle" onClick={() => setPreviewOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}
