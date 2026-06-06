'use client';

import useSWR from 'swr';
import { fetcher, post } from '@/lib/api';
import { useState } from 'react';

export default function Forge() {
  const { data: runs } = useSWR<any[]>('/api/backtest/runs', fetcher);
  const { data: profiles, mutate } = useSWR<any[]>('/api/optimizer/profiles', fetcher);
  const { data: featureImp } = useSWR<any>('/api/journal/feature-importance', fetcher, {
    shouldRetryOnError: false,
  });

  const [mode, setMode] = useState<'intraday' | 'swing'>('intraday');
  const [runId, setRunId] = useState<number | ''>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function optimize() {
    if (!runId) {
      setError('Pick a backtest run first');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const out = await post('/api/optimizer/run', { run_id: runId, mode, step_pct: 0.2 });
      setResult(out);
      mutate();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setRunning(false);
    }
  }

  async function computeFi() {
    await post('/api/journal/feature-importance');
  }

  return (
    <main className="max-w-[1280px] mx-auto px-8 py-10">
      <header className="mb-10 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Score Optimizer</div>
        <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
          Tune score <span className="font-display-italic text-gold">weights</span>
        </h1>
        <p className="text-text-secondary max-w-2xl">
          Try weight combinations based on backtest results, plus a summary of factors that appear most often in your trade journal.
        </p>
      </header>

      <section className="grid grid-cols-12 gap-6 rise rise-2">
        <div className="col-span-12 lg:col-span-6">
          <h2 className="font-display text-2xl mb-3">Walk-forward</h2>
          <div className="bg-canvas-raised border border-rule rounded-sm p-5 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-tertiary">Backtest run</label>
              <select value={runId} onChange={(e) => setRunId(parseInt(e.target.value) || '')}
                className="w-full bg-canvas-deep border border-rule px-3 py-2 text-sm">
                <option value="">— pick a run —</option>
                {(runs || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name} (n={r.total_trades})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-tertiary">Mode</label>
              <div className="flex gap-3 mt-1">
                {(['intraday', 'swing'] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`px-3 py-1 text-xs border rounded-sm ${
                      mode === m ? 'bg-gold/15 border-gold/40 text-gold' : 'border-rule text-text-tertiary'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={optimize}
              disabled={running}
              className="w-full bg-gold/15 border border-gold/40 text-gold py-2 hover:bg-gold/25 disabled:opacity-50"
            >
              {running ? 'Forging…' : 'Optimize weights'}
            </button>
            {error && <div className="text-short text-xs">{error}</div>}
            {result && (
              <div className="mt-3 border-t border-rule-faint pt-3 text-xs space-y-1">
                <div className="text-gold">{result.profile_name}</div>
                <div className="text-text-tertiary">Expectancy {result.best?.expectancy} · n={result.best?.sample_size} · candidates={result.candidates_evaluated}</div>
                <pre className="text-text-secondary bg-canvas-deep p-2 rounded-sm overflow-auto">
                  {JSON.stringify(result.best?.weights, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {profiles && profiles.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-lg mb-2">Saved profiles</h3>
              <ul className="space-y-2">
                {profiles.slice(0, 8).map((p) => (
                  <li key={p.id} className={`bg-canvas-raised border rounded-sm px-4 py-2 text-xs ${
                    p.active ? 'border-gold/40' : 'border-rule'
                  }`}>
                    <div className="flex justify-between">
                      <span className="text-text-primary">{p.name}</span>
                      <span className="text-text-tertiary">{p.mode} · {p.source}</span>
                    </div>
                    {p.performance && (
                      <div className="text-text-tertiary mt-1">
                        Expectancy {p.performance.expectancy} · n={p.performance.sample_size}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl">Feature importance</h2>
            <button onClick={computeFi} className="text-xs px-3 py-1.5 border border-gold/40 text-gold hover:bg-gold/10">
              recompute
            </button>
          </div>
          {!featureImp ? (
            <div className="bg-canvas-raised border border-rule rounded-sm p-5 text-text-tertiary text-xs">
              No feature-importance run yet. Add journal entries first, then click recompute.
            </div>
          ) : (
            <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
              <header className="px-5 py-3 border-b border-rule-faint text-[11px] text-text-tertiary uppercase tracking-widest">
                Sample size: {featureImp.sample_total} · Computed {new Date(featureImp.computed_at).toLocaleString()}
              </header>
              <table className="w-full text-sm">
                <thead className="text-text-tertiary text-[10px] uppercase tracking-widest">
                  <tr><th className="text-left px-4 py-2">Feature</th>
                      <th className="text-right">N</th>
                      <th className="text-right">Win-rate</th>
                      <th className="text-right">Lift</th></tr>
                </thead>
                <tbody>
                  {Object.entries(featureImp.features || {}).map(([k, v]: any) => (
                    <tr key={k} className="border-t border-rule-faint">
                      <td className="px-4 py-1.5 text-text-primary">{k.replace(/_/g, ' ')}</td>
                      <td className="text-right text-text-tertiary tabular">{v.n}</td>
                      <td className="text-right tabular">{(v.win_rate * 100).toFixed(1)}%</td>
                      <td className={`text-right tabular ${v.lift >= 1.1 ? 'text-long' : v.lift <= 0.9 ? 'text-short' : 'text-text-secondary'}`}>
                        {v.lift.toFixed(2)}×
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
