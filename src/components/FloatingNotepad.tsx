import React, { useState, useEffect, useRef } from 'react';
import { getSetting, setSetting } from '../utils/db';

export function FloatingNotepad() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  // Load notepad content on mount
  useEffect(() => {
    (async () => {
      try {
        const val = await getSetting('notepad_content');
        setContent(val || '');
        loaded.current = true;
      } catch { loaded.current = true; }
    })();
  }, []);

  // Auto-save after 1s of inactivity
  const handleChange = (val: string) => {
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await setSetting('notepad_content', val);
        setLastSaved(new Date().toLocaleTimeString());
      } catch (e) { console.error('Notepad save error:', e); }
      setSaving(false);
    }, 1000);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        title="Notepad"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: open ? '#6b7280' : '#2563eb',
          color: '#fff',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
      >
        {open ? '✕' : '📝'}
      </button>

      {/* Notepad panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '86px',
          right: '20px',
          width: '340px',
          maxWidth: 'calc(100vw - 40px)',
          height: '400px',
          maxHeight: 'calc(100vh - 120px)',
          background: '#fffde7',
          border: '2px solid #f9a825',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: '#f9a825',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#4a3600' }}>📝 Notepad</span>
            <span style={{ fontSize: '12px', color: '#6d4c00' }}>
              {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved}` : ''}
            </span>
          </div>

          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Type your notes here... stock codes, reminders, anything you need to remember."
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: 'inherit',
              background: '#fffde7',
              color: '#333',
            }}
          />

          {/* Footer */}
          <div style={{
            padding: '6px 12px',
            borderTop: '1px solid #f0e68c',
            fontSize: '11px',
            color: '#999',
            textAlign: 'right',
          }}>
            {content.length} characters
          </div>
        </div>
      )}
    </>
  );
}
