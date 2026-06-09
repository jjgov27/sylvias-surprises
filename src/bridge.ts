// Bridge shim: replaces window.tasklet.* calls with server API calls
// This allows ALL existing db.ts and component code to work unchanged

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
    return apiFetch('/api/sql/query', { sql });
  },

  async sqlExec(sql: string): Promise<{ rowsAffected: number; lastInsertRowid?: number }> {
    return apiFetch('/api/sql/exec', { sql });
  },

  // Batch SQL — for init with multiple CREATE TABLE statements
  async sqlBatch(statements: string[]): Promise<any> {
    return apiFetch('/api/sql/batch', { statements });
  },

  // Shell commands — used by PDF generation in components
  async runCommand(command: string, timeout?: number): Promise<{ log: string }> {
    return apiFetch('/api/command', { command, timeout });
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
