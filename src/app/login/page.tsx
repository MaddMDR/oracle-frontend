'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API, setToken, setUser, getToken } from '@/lib/api';

export default function LoginPage() {
  const router   = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // Already logged in → redirect to home
  useEffect(() => {
    if (getToken()) router.replace('/');
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
      const body = new URLSearchParams({ username, password });
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setError(err.detail || 'Login gagal. Cek username dan password.');
        return;
      }

      const data = await r.json();
      setToken(data.access_token);
      setUser({ username: data.username, role: data.role });
      // Also set cookie so Next.js middleware can check auth server-side
      document.cookie = `oracle_token=${data.access_token}; path=/; max-age=${30 * 24 * 3600}; SameSite=Strict`;
      router.replace('/');
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas-deep flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / header */}
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">◈</div>
          <h1 className="font-display text-3xl text-text-primary tracking-tight">
            ORACLE
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Crypto Market Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="bg-canvas-raised border border-rule rounded-sm px-8 py-8">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-widest text-text-tertiary">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="bg-canvas-inset border border-rule rounded-sm px-4 py-2.5
                           text-text-primary text-sm placeholder:text-text-tertiary/50
                           focus:outline-none focus:border-gold/50 transition-colors"
                placeholder="username"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-widest text-text-tertiary">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="bg-canvas-inset border border-rule rounded-sm px-4 py-2.5
                           text-text-primary text-sm placeholder:text-text-tertiary/50
                           focus:outline-none focus:border-gold/50 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-short text-xs text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="mt-1 px-4 py-2.5 bg-gold/10 border border-gold/25 text-gold-400
                         font-medium text-sm rounded-sm hover:bg-gold/20 hover:border-gold/40
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Masuk…' : 'Masuk'}
            </button>

          </form>
        </div>

        <p className="text-center text-text-tertiary/40 text-xs mt-6">
          ORACLE · Private access only
        </p>
      </div>
    </main>
  );
}
