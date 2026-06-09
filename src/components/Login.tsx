import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, Users } from 'lucide-react';
import { StaffUser } from '../types';
// Staff data now fetched via public API endpoints (no auth needed)

interface LoginProps {
  onLogin: (user: StaffUser) => void;
  onBack: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onBack }) => {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [mode, setMode] = useState<'select' | 'register'>('select');
  const [initials, setInitials] = useState('');
  const [newName, setNewName] = useState('');
  const [newInitials, setNewInitials] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    try {
      // Use public staff-list endpoint (no auth needed)
      const res = await fetch('/api/auth/staff-list', { credentials: 'include' });
      const users = res.ok ? await res.json() : [];
      setStaffList(users);
      if (users.length === 0) setMode('register');
    } catch {
      // If fetch fails, show register mode
      setStaffList([]);
      setMode('register');
    }
    setLoading(false);
  }

  async function handleQuickLogin(user: StaffUser) {
    onLogin(user);
  }

  async function handleInitialsLogin() {
    setError('');
    if (!initials.trim()) {
      setError('Please enter your initials');
      return;
    }
    try {
      const res = await fetch('/api/auth/staff-list', { credentials: 'include' });
      const users = res.ok ? await res.json() : [];
      const user = users.find((u: any) => u.initials?.toUpperCase() === initials.trim().toUpperCase());
      if (!user) {
        setError('Initials not recognised. Please register first.');
        return;
      }
      onLogin(user);
    } catch {
      setError('Unable to verify initials. Please try again.');
    }
  }

  async function handleRegister() {
    setError('');
    if (!newName.trim() || !newInitials.trim()) {
      setError('Please enter both name and initials');
      return;
    }
    if (newInitials.trim().length > 4) {
      setError('Initials should be 1-4 characters');
      return;
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), initials: newInitials.trim().toUpperCase() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      onLogin(data.user);
    } catch {
      setError('Registration failed. Please try again.');
    }
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
            <div className="alert alert-error text-sm">
              <span>{error}</span>
            </div>
          )}

          {mode === 'select' ? (
            <>
              {/* Quick login - click your name */}
              {staffList.length > 0 && (
                <div className="mb-4">
                  <label className="label"><span className="label-text font-semibold">Select your name:</span></label>
                  <div className="flex flex-col gap-2">
                    {staffList.map(user => (
                      <button
                        key={user.id}
                        className="btn btn-outline btn-primary justify-start gap-3"
                        onClick={() => handleQuickLogin(user)}
                      >
                        <div className="badge badge-primary badge-sm font-mono">{user.initials}</div>
                        {user.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Or sign in with initials */}
              <div className="divider text-base-content/40 text-xs">or enter initials</div>
              <div className="flex gap-2">
                <label className="input input-bordered flex items-center gap-2 flex-1">
                  <LogIn className="h-[1em] opacity-50" />
                  <input
                    type="text"
                    className="grow uppercase"
                    placeholder="Initials e.g. GS"
                    value={initials}
                    onChange={e => setInitials(e.target.value.toUpperCase())}
                    maxLength={4}
                    onKeyDown={e => e.key === 'Enter' && handleInitialsLogin()}
                  />
                </label>
                <button className="btn btn-primary" onClick={handleInitialsLogin}>
                  <LogIn size={18} /> Sign In
                </button>
              </div>

              <div className="divider text-base-content/40 text-xs" />
              <button className="btn btn-ghost btn-sm" onClick={() => setMode('register')}>
                <UserPlus size={16} /> Register New Staff Member
              </button>
            </>
          ) : (
            <>
              <label className="label"><span className="label-text font-semibold">Register New Staff</span></label>
              <label className="input input-bordered flex items-center gap-2">
                <Users className="h-[1em] opacity-50" />
                <input
                  type="text"
                  className="grow"
                  placeholder="Full name e.g. Gavin Smith"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </label>
              <label className="input input-bordered flex items-center gap-2 mt-2">
                <LogIn className="h-[1em] opacity-50" />
                <input
                  type="text"
                  className="grow uppercase"
                  placeholder="Initials e.g. GS"
                  value={newInitials}
                  onChange={e => setNewInitials(e.target.value.toUpperCase())}
                  maxLength={4}
                />
              </label>
              <button className="btn btn-primary mt-3" onClick={handleRegister}>
                <UserPlus size={18} /> Register & Sign In
              </button>
              {staffList.length > 0 && (
                <button className="btn btn-ghost btn-sm mt-2" onClick={() => setMode('select')}>
                  ← Back to Staff List
                </button>
              )}
            </>
          )}

          <div className="mt-4 pt-4 border-t border-base-300">
            <button className="btn btn-ghost btn-sm w-full" onClick={onBack}>
              ← Back to Website
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
