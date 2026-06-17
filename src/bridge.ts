// Bridge shim: replaces window.tasklet.* calls with server API calls
// This allows ALL existing db.ts and component code to work unchanged

let sessionExpiredShown = false;

function showSessionExpired() {
  if (sessionExpiredShown) return;
  sessionExpiredShown = true;
  
  // Create a visible banner that the user can't miss
  const banner = document.createElement('div');
  banner.id = 'session-expired-banner';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #dc2626; color: white; padding: 16px; text-align: center;
    font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  banner.innerHTML = `
    ⚠️ Your session has expired. Please log in again.
    <button onclick="window.location.reload()" style="
      margin-left: 16px; padding: 8px 20px; background: white; color: #dc2626;
      border: none; border-radius: 6px; font-weight: bold; cursor: pointer;
      font-size: 14px;
    ">Log In Again</button>
  `;
  document.body.prepend(banner);
}

async function apiFetch(url: string, body: any): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const bridge = {
  // SQL operations — used by db.ts (162 query + 99 exec calls)
  async sqlQuery(sql: string): Promise<any[]> {
    try {
      return await apiFetch('/api/sql/query', { sql });
    } catch (e: any) {
      if (e?.message?.includes('Not authenticated') || e?.message?.includes('401')) {
        showSessionExpired();
        return [];
      }
      throw e;
    }
  },

  async sqlExec(sql: string): Promise<{ rowsAffected: number; lastInsertRowid?: number }> {
    try {
      return await apiFetch('/api/sql/exec', { sql });
    } catch (e: any) {
      if (e?.message?.includes('Not authenticated') || e?.message?.includes('401')) {
        showSessionExpired();
        return { rowsAffected: 0 };
      }
      throw e;
    }
  },

  // Batch SQL — for init with multiple CREATE TABLE statements
  async sqlBatch(statements: string[]): Promise<any> {
    try {
      return await apiFetch('/api/sql/batch', { statements });
    } catch (e: any) {
      if (e?.message?.includes('Not authenticated') || e?.message?.includes('401')) {
        showSessionExpired();
        return { ok: false };
      }
      throw e;
    }
  },

  // Shell commands — used by PDF generation in components
  async runCommand(command: string, timeout?: number): Promise<{ log: string; exitCode: number }> {
    try {
      return await apiFetch('/api/command', { command, timeout });
    } catch (e: any) {
      if (e?.message?.includes('Not authenticated') || e?.message?.includes('401')) {
        showSessionExpired();
        return { log: '', exitCode: 1 };
      }
      throw e;
    }
  },

  // File operations — used by PDF generation pipeline
  async writeFileToDisk(path: string, content: string): Promise<void> {
    await apiFetch('/api/files/write', { path, content });
  },

  async readFileFromDisk(path: string): Promise<string> {
    const r = await apiFetch('/api/files/read', { path });
    return r.content;
  },

  async readBinaryFileFromDisk(path: string): Promise<Uint8Array> {
    const r = await apiFetch('/api/files/read-binary', { path });
    const binary = atob(r.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  },

  // AI scan — stub (not available standalone; would need separate AI integration)
  async sendMessageToAgent(message: string): Promise<void> {
    console.warn('sendMessageToAgent not available in standalone mode');
    alert('AI scanning is not available in standalone mode. Please enter items manually.');
  }
};

// Install on window.tasklet
(window as any).tasklet = bridge;

export default bridge;
