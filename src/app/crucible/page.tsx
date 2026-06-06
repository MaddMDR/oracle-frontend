'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, post, fmt, fmtPct, BacktestRunSummary , fmtTs} from '@/lib/api';

export default function BacktestPage() {
  const { data: runs, mutate } = useSWR<BacktestRunSummary[]>('/api/backtest/runs', fetcher, {
    refreshInterval: 30000,
  });
  const { data: calibration } = useSWR<any[]>('/api/backtest/calibration', fetcher, {
    refreshInterval: 30000,
  });

  const [symbolsText, setSymbolsText] = useState('BTC/USDT:USDT,ETH/USDT:USDT,SOL/USDT:USDT');
  const [lookback, setLookback] = useState(1000);
  const [minScore, setMinScore] = useState(50);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runBacktest() {
    setRunning(true);
    setError(null);
    try {
      const symbols = symbolsText.split(',').map((s) => s.trim()).filter(Boolean);
      await post('/api/backtest/run', {
        symbols,
        modes: ['intraday', 'swing'],
        lookback_bars: lookback,
        min_score: minScore,
      });
      mutate();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="mb-10 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Backtest</div>
        <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
          Historical <span className="font-display-italic text-gold">strategy test</span>
        </h1>
        <p className="text-text-secondary max-w-2xl">
          Replay historical candles: each signal becomes a mechanical plan, tracked to stop, TP, or timeout.
          Result: win rate per score band so you can calibrate your threshold with real data.
        </p>
      </header>

      <section className="grid grid-cols-12 gap-6 mb-10 rise rise-2">
        <div className="col-span-12 lg:col-span-5 bg-canvas-raised border border-rule rounded-sm p-5">
          <h3 className="font-display text-xl mb-3">New backtest</h3>
          <label className="text-xs text-text-tertiary uppercase tracking-widest">Symbols (comma-separated)</label>
          <textarea
            value={symbolsText}
            onChange={(e) => setSymbolsText(e.target.value)}
            rows={3}
            className="w-full bg-canvas-deep border border-rule rounded-sm px-3 py-2 mt-1 text-sm tabular text-text-primary"
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs text-text-tertiary uppercase tracking-widest">Lookback bars</label>
              <input type="number" value={lookback} onChange={(e) => setLookback(parseInt(e.target.value || '0'))}
                className="w-full bg-canvas-deep border border-rule px-3 py-2 text-sm tabular" />
            </div>
            <div>
              <label className="text-xs text-text-tertiary uppercase tracking-widest">Min score</label>
              <input type="number" value={minScore} onChange={(e) => setMinScore(parseFloat(e.target.value || '0'))}
                className="w-full bg-canvas-deep border border-rule px-3 py-2 text-sm tabular" />
            </div>
          </div>
          <button
            onClick={runBacktest}
            disabled={running}
            className="mt-4 w-full bg-gold/15 border border-gold/40 text-gold py-2 hover:bg-gold/25 disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run backtest'}
          </button>
          {error && <div className="text-short text-xs mt-2">{error}</div>}
          <p className="text-[11px] text-text-tertiary mt-3 leading-relaxed">
            Backtests run over Bitget perpetual data via CCXT. Per-trade friction of 0.05 R is deducted
            to approximate fees + slippage.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <h3 className="font-display text-xl mb-3">Active calibration</h3>
          {!calibration || calibration.length === 0 ? (
            <div className="bg-canvas-raised border border-rule rounded-sm p-5 text-text-tertiary text-xs">
              No calibration yet. Run a backtest to populate score→winrate buckets.
            </div>
          ) : (
            <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-text-tertiary text-[10px] uppercase tracking-widest bg-canvas-deep/60">
                  <tr>
                    <th className="text-left px-4 py-2">Mode</th>
                    <th className="text-left">Score range</th>
                    <th className="text-right">N</th>
                    <th className="text-right">Win rate</th>
                    <th className="text-right">Avg R</th>
                    <th className="text-right">Expectancy</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration.map((b, i) => (
                    <tr key={i} className="border-t border-rule-faint">
                      <td className="px-4 py-2 text-text-secondary">{b.mode}</td>
                      <td className="text-text-primary tabular">{b.score_low} – {b.score_high}</td>
                      <td className="text-right text-text-tertiary tabular">{b.sample_size}</td>
                      <td className={`text-right tabular ${b.win_rate >= 0.5 ? 'text-long' : 'text-short'}`}>
                        {(b.win_rate * 100).toFixed(1)}%
                      </td>
                      <td className={`text-right tabular ${b.avg_r >= 0 ? 'text-long' : 'text-short'}`}>
                        {b.avg_r.toFixed(2)}
                      </td>
                      <td className={`text-right tabular ${b.expectancy >= 0 ? 'text-long' : 'text-short'}`}>
                        {b.expectancy.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rise rise-3">
        <h2 className="font-display text-3xl text-text-primary mb-4">History</h2>
        {!runs || runs.length === 0 ? (
          <div className="bg-canvas-raised border border-rule rounded-sm p-5 text-text-tertiary text-xs">
            No runs yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {runs.map((r) => (
              <article key={r.id} className="bg-canvas-raised border border-rule rounded-sm p-5">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-display text-lg text-text-primary truncate">{r.name}</div>
                  <span className="text-[10px] uppercase tracking-widest text-text-tertiary">{r.status}</span>
                </div>
                <div className="text-xs text-text-tertiary mb-3">
                  {fmtTs(r.started_at)}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm tabular">
                  <Cell label="Trades" value={r.total_trades} />
                  <Cell label="Win rate" value={`${((r.win_rate || 0) * 100).toFixed(1)}%`}
                        tone={(r.win_rate || 0) >= 0.5 ? 'long' : 'short'} />
                  <Cell label="Avg R" value={(r.avg_r || 0).toFixed(2)} tone={(r.avg_r || 0) >= 0 ? 'long' : 'short'} />
                  <Cell label="Max DD" value={fmtPct(r.max_dd_pct)} tone="short" />
                  <Cell label="Expectancy" value={(r.expectancy || 0).toFixed(2)} />
                  <Cell label="Sharpe-like" value={(r.sharpe_like || 0).toFixed(2)} />
                </div>
                <div className="text-[11px] text-text-tertiary mt-3 truncate">
                  {r.symbols?.length || 0} symbols · modes {r.modes?.join(', ')}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Cell({ label, value, tone }: { label: string; value: any; tone?: 'long' | 'short' }) {
  const toneClass = tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-text-primary';
  return (
    <div>
      <div className="text-[10px] text-text-tertiary uppercase tracking-widest">{label}</div>
      <div className={toneClass}>{value}</div>
    </div>
  );
}
