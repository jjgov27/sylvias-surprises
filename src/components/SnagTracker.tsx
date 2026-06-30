import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser } from '../types';
import { esc } from '../utils/db';

interface Snag {
  id: number;
  title: string;
  description: string;
  reported_by: string;
  priority: string;
  status: string;
  resolution: string;
  user_response: string;
  created_at: string;
  updated_at: string;
}

interface Props { currentUser: StaffUser; }

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: '#fef2f2', text: '#dc2626', label: '🔴 High' },
  medium: { bg: '#fffbeb', text: '#d97706', label: '🟡 Medium' },
  low:    { bg: '#f0fdf4', text: '#16a34a', label: '🟢 Low' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  open:        { bg: '#fef2f2', text: '#dc2626', label: '🔓 Open' },
  in_progress: { bg: '#eff6ff', text: '#2563eb', label: '🔧 In Progress' },
  fixed:       { bg: '#f0fdf4', text: '#16a34a', label: '✅ Fixed' },
  verified:    { bg: '#faf5ff', text: '#7c3aed', label: '☑️ Verified' },
  wont_fix:    { bg: '#f9fafb', text: '#6b7280', label: '⏭️ Won\'t Fix' },
};

export function SnagTracker({ currentUser }: Props) {
  const [snags, setSnags] = useState<Snag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('active'); // active, all, open, fixed
  const [showForm, setShowForm] = useState(false);
  const [editSnag, setEditSnag] = useState<Snag | null>(null);
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('open');
  const [resolution, setResolution] = useState('');
  const [userResponse, setUserResponse] = useState('');

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadSnags = useCallback(async () => {
    try {
      let where = '1=1';
      if (filter === 'active') where = "status IN ('open','in_progress')";
      else if (filter === 'open') where = "status = 'open'";
      else if (filter === 'fixed') where = "status IN ('fixed','verified')";
      else if (filter === 'wont_fix') where = "status = 'wont_fix'";

      const rows = await window.tasklet.sqlQuery(
        `SELECT * FROM sylvias_snags WHERE ${where} ORDER BY
          CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
          created_at DESC`
      );
      setSnags(rows as Snag[]);
    } catch (e: unknown) {
      console.error('Failed to load snags:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadSnags(); }, [loadSnags]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setPriority('medium'); setStatus('open');
    setResolution(''); setUserResponse('');
    setEditSnag(null); setShowForm(false);
  };

  const openEditForm = (s: Snag) => {
    setTitle(s.title); setDescription(s.description); setPriority(s.priority);
    setStatus(s.status); setResolution(s.resolution); setUserResponse(s.user_response);
    setEditSnag(s); setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { setErr('Title is required'); return; }
    setErr('');
    try {
      if (editSnag) {
        await window.tasklet.sqlExec(
          `UPDATE sylvias_snags SET title='${esc(title.trim())}', description='${esc(description.trim())}',
           priority='${esc(priority)}', status='${esc(status)}', resolution='${esc(resolution.trim())}',
           user_response='${esc(userResponse.trim())}', updated_at=datetime('now')
           WHERE id=${editSnag.id}`
        );
        setSaved('Snag updated ✅');
      } else {
        await window.tasklet.sqlExec(
          `INSERT INTO sylvias_snags (title, description, reported_by, priority, status)
           VALUES ('${esc(title.trim())}', '${esc(description.trim())}', '${esc(currentUser.initials)}', '${esc(priority)}', 'open')`
        );
        setSaved('Snag logged ✅');
      }
      resetForm();
      loadSnags();
      setTimeout(() => setSaved(''), 3000);
    } catch (e: unknown) {
      setErr('Failed to save: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await window.tasklet.sqlExec(`DELETE FROM sylvias_snags WHERE id=${id}`);
      setConfirmDeleteId(null);
      setSaved('Snag deleted');
      loadSnags();
      setTimeout(() => setSaved(''), 3000);
    } catch (e: unknown) {
      setErr('Delete failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const quickStatus = async (id: number, newStatus: string) => {
    try {
      await window.tasklet.sqlExec(
        `UPDATE sylvias_snags SET status='${esc(newStatus)}', updated_at=datetime('now') WHERE id=${id}`
      );
      loadSnags();
    } catch (e: unknown) {
      setErr('Update failed');
    }
  };

  const counts = {
    active: snags.length,
    open: snags.filter(s => s.status === 'open').length,
    inProgress: snags.filter(s => s.status === 'in_progress').length,
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Loading snags...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#1e293b' }}>🐛 Snag Tracker</h3>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Log issues, track fixes, record responses</div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          ➕ Log Snag
        </button>
      </div>

      {/* Feedback messages */}
      {saved && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{saved}</div>}
      {err && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'active', label: '🔓 Active', count: undefined },
          { id: 'open', label: '🆕 Open', count: undefined },
          { id: 'fixed', label: '✅ Fixed', count: undefined },
          { id: 'wont_fix', label: '⏭️ Won\'t Fix', count: undefined },
          { id: 'all', label: '📋 All', count: undefined },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: filter === f.id ? 700 : 500, cursor: 'pointer',
              background: filter === f.id ? '#7c3aed' : '#f3f4f6', color: filter === f.id ? '#fff' : '#4b5563',
              border: filter === f.id ? '1px solid #7c3aed' : '1px solid #d1d5db',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* New / Edit form */}
      {showForm && (
        <div style={{ background: '#faf5ff', border: '2px solid #c4b5fd', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px', color: '#7c3aed' }}>{editSnag ? `✏️ Edit Snag #${editSnag.id}` : '➕ Log New Snag'}</h4>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description of the issue"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4, boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Details</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Steps to reproduce, what you expected, what happened..."
              rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4 }}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            {editSnag && (
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4 }}>
                  <option value="open">🔓 Open</option>
                  <option value="in_progress">🔧 In Progress</option>
                  <option value="fixed">✅ Fixed</option>
                  <option value="verified">☑️ Verified</option>
                  <option value="wont_fix">⏭️ Won't Fix</option>
                </select>
              </div>
            )}
          </div>

          {editSnag && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>🔧 Resolution (what was done to fix it)</label>
                <textarea value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Describe the fix applied..."
                  rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>💬 Response to End User (what to tell them)</label>
                <textarea value={userResponse} onChange={e => setUserResponse(e.target.value)} placeholder="What to tell the person who reported the snag..."
                  rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={handleSave}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              {editSnag ? '💾 Update Snag' : '📝 Log Snag'}
            </button>
            <button onClick={resetForm}
              style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Snag list */}
      {snags.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {filter === 'active' ? 'No active snags — everything is looking good!' : 'No snags match this filter'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {snags.map(s => {
            const p = PRIORITY_COLORS[s.priority] || PRIORITY_COLORS.medium;
            const st = STATUS_COLORS[s.status] || STATUS_COLORS.open;
            return (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, borderLeft: `4px solid ${p.text}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>#{s.id}</span>
                      <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>{s.title}</span>
                      <span style={{ background: p.bg, color: p.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{p.label}</span>
                      <span style={{ background: st.bg, color: st.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{st.label}</span>
                    </div>
                    {s.description && (
                      <div style={{ fontSize: 13, color: '#4b5563', marginTop: 6, whiteSpace: 'pre-wrap' }}>{s.description}</div>
                    )}
                    {s.resolution && (
                      <div style={{ marginTop: 8, background: '#f0fdf4', borderRadius: 6, padding: '8px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 2 }}>🔧 Resolution</div>
                        <div style={{ fontSize: 13, color: '#166534', whiteSpace: 'pre-wrap' }}>{s.resolution}</div>
                      </div>
                    )}
                    {s.user_response && (
                      <div style={{ marginTop: 6, background: '#eff6ff', borderRadius: 6, padding: '8px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginBottom: 2 }}>💬 Response to End User</div>
                        <div style={{ fontSize: 13, color: '#1e40af', whiteSpace: 'pre-wrap' }}>{s.user_response}</div>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                      Reported by {s.reported_by} · {s.created_at?.replace('T', ' ').slice(0, 16)}
                      {s.updated_at !== s.created_at && ` · Updated ${s.updated_at?.replace('T', ' ').slice(0, 16)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    {s.status === 'open' && (
                      <button onClick={() => quickStatus(s.id, 'in_progress')} title="Mark In Progress"
                        style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#2563eb' }}>
                        🔧
                      </button>
                    )}
                    {(s.status === 'open' || s.status === 'in_progress') && (
                      <button onClick={() => quickStatus(s.id, 'fixed')} title="Mark Fixed"
                        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#16a34a' }}>
                        ✅
                      </button>
                    )}
                    {s.status === 'fixed' && (
                      <button onClick={() => quickStatus(s.id, 'verified')} title="Mark Verified"
                        style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#7c3aed' }}>
                        ☑️
                      </button>
                    )}
                    <button onClick={() => openEditForm(s)} title="Edit"
                      style={{ background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                      ✏️
                    </button>
                    {confirmDeleteId === s.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleDelete(s.id)}
                          style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                          Yes
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(s.id)} title="Delete"
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#dc2626' }}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      <div style={{ marginTop: 16, padding: '10px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
        Showing {snags.length} snag{snags.length !== 1 ? 's' : ''} · Filter: {filter}
      </div>
    </div>
  );
}
