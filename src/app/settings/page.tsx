'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, post } from '@/lib/api';

export default function AtelierPage() {
  const { data, mutate } = useSWR<any>('/api/settings', fetcher);
  const { data: health } = useSWR('/api/health', fetcher);
  const { data: status } = useSWR('/api/status', fetcher, { refreshInterval: 5000 });

  const [watchlist, setWatchlist] = useState('');
  const [minVolumeUsd, setMinVolumeUsd] = useState('');
  const [topNPairs, setTopNPairs] = useState('');
  const [scanIntervalMin, setScanIntervalMin] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>('');

  useEffect(() => {
    if (data) {
      setWatchlist((data.watchlist || []).join(', '));
      setMinVolumeUsd(data.min_volume_usd != null ? String(data.min_volume_usd) : '');
      setTopNPairs(data.top_n_pairs != null ? String(data.top_n_pairs) : '');
      setScanIntervalMin(data.scan_interval_minutes != null ? String(data.scan_interval_minutes) : '');
    }
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      const payload: any = {};
      payload.watchlist = watchlist
        .split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => (s.includes('/') ? s.toUpperCase() : `${s.toUpperCase()}/USDT`));
      if (minVolumeUsd) payload.min_volume_usd = parseFloat(minVolumeUsd);
      if (topNPairs) payload.top_n_pairs = parseInt(topNPairs, 10);
      if (scanIntervalMin) payload.scan_interval_minutes = parseInt(scanIntervalMin, 10);
      await post('/api/settings', payload);
      setSavedAt(new Date().toLocaleTimeString('en-GB'));
      await mutate();
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="mb-8 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Settings</div>
        <h1 className="font-display text-5xl text-text-primary">
          Configure <span className="font-display-italic text-gold">the app</span>
        </h1>
        <p className="text-text-secondary mt-2 max-w-2xl">
          Most core options live in <code className="text-gold-400 font-mono text-sm">backend/.env</code> and require a server restart.
          Values on this page update the database settings while the app is running.
        </p>
      </header>

      <section className="bg-canvas-raised border border-rule rounded-sm p-6 mb-8 rise rise-2">
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary mb-4">System Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatusStat
            label="API Health"
            value={health?.ok ? 'OK' : 'DOWN'}
            tone={health?.ok ? 'text-long' : 'text-short'}
          />
          <StatusStat
            label="Last Scan"
            value={status?.status || '—'}
            tone={
              status?.status === 'ok' ? 'text-long' :
              status?.status === 'error' ? 'text-short' :
              status?.status === 'running' ? 'text-accent' : 'text-neutral'
            }
          />
          <StatusStat
            label="Signals"
            value={status?.signals != null ? String(status.signals) : '—'}
            tone="text-text-primary"
          />
          <StatusStat
            label="Last Elapsed"
            value={status?.elapsed_sec != null ? `${status.elapsed_sec}s` : '—'}
            tone="text-text-primary"
          />
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-7 bg-canvas-raised border border-rule rounded-sm p-6 space-y-5 rise rise-3">
          <h3 className="text-xs uppercase tracking-widest text-text-tertiary">Runtime Overrides</h3>

          <Field label="Watchlist" hint="Comma-separated. Leave blank to use top-N by volume.">
            <textarea
              rows={2}
              value={watchlist}
              onChange={(e) => setWatchlist(e.target.value)}
              placeholder="BTC, ETH, SOL/USDT, ARB"
              className="w-full bg-canvas-inset border border-rule px-3 py-2.5 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Top N Pairs">
              <input
                type="number"
                value={topNPairs}
                onChange={(e) => setTopNPairs(e.target.value)}
                className="w-full bg-canvas-inset border border-rule px-3 py-2.5 text-sm font-mono tabular text-text-primary rounded-sm focus:border-gold focus:outline-none"
              />
            </Field>
            <Field label="Min Volume USD">
              <input
                type="number"
                value={minVolumeUsd}
                onChange={(e) => setMinVolumeUsd(e.target.value)}
                className="w-full bg-canvas-inset border border-rule px-3 py-2.5 text-sm font-mono tabular text-text-primary rounded-sm focus:border-gold focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Scan Interval (minutes)" hint="Changing requires backend restart.">
            <input
              type="number"
              value={scanIntervalMin}
              onChange={(e) => setScanIntervalMin(e.target.value)}
              className="w-full bg-canvas-inset border border-rule px-3 py-2.5 text-sm font-mono tabular text-text-primary rounded-sm focus:border-gold focus:outline-none"
            />
          </Field>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium bg-gold/10 border border-gold/40 text-gold-400 hover:bg-gold/20 hover:border-gold rounded-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : '✓ Save'}
            </button>
            {savedAt && (
              <span className="text-xs text-text-tertiary">Saved at {savedAt}</span>
            )}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5 bg-canvas-raised border border-rule rounded-sm p-6 rise rise-4">
          <h3 className="text-xs uppercase tracking-widest text-text-tertiary mb-4">
            Environment Reference
          </h3>
          <p className="text-xs text-text-tertiary mb-4 leading-relaxed">
            Edit <code className="text-gold-400 font-mono">backend/.env</code> and restart to apply.
          </p>
          <ul className="space-y-3">
            <EnvRow k="EXCHANGE" v="bitget" desc="Any CCXT exchange id" />
            <EnvRow k="QUOTE_CURRENCY" v="USDT" desc="Filter pairs by quote" />
            <EnvRow k="TOP_N_PAIRS" v="80" desc="Pairs scanned per cycle" />
            <EnvRow k="MIN_VOLUME_USD" v="5,000,000" desc="Filter illiquid pairs" />
            <EnvRow k="SCAN_INTERVAL_MINUTES" v="15" desc="Background scan cadence" />
            <EnvRow k="GEMINI_API_KEY" v="—" desc="Empty = template fallback" />
            <EnvRow k="GEMINI_MODEL" v="gemini-2.0-flash" desc="LLM model id" />
            <EnvRow k="LLM_MAX_CALLS_PER_SCAN" v="8" desc="Quota guard" />
            <EnvRow k="NEWS_WINDOW_DAYS" v="7" desc="News cache window" />
            <EnvRow k="NEWS_REFRESH_HOURS" v="2" desc="RSS poll cadence" />
          </ul>
        </section>
      </div>
    </main>
  );
}

function StatusStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-text-tertiary mb-1.5">{label}</div>
      <div className={`font-display text-2xl capitalize ${tone}`}>{value}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-text-tertiary mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-xs text-text-tertiary mt-1.5">{hint}</div>}
    </div>
  );
}

function EnvRow({ k, v, desc }: { k: string; v: string; desc: string }) {
  return (
    <li className="border-b border-rule-faint last:border-b-0 pb-3 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <code className="text-sm font-mono text-text-primary">{k}</code>
        <code className="text-xs font-mono text-text-tertiary tabular">{v}</code>
      </div>
      <div className="text-xs text-text-tertiary mt-1">{desc}</div>
    </li>
  );
}
