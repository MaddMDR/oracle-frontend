'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, post } from '@/lib/api';

const DEFAULT_SYMBOLS = 'BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT,XRP/USDT,DOGE/USDT,AVAX/USDT';

function shortName(s: string) {
  return s.replace('/USDT:USDT', '').replace('/USDT', '');
}

export default function Constellation() {
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
  const [computing, setComputing] = useState(false);
  const { data, mutate } = useSWR<any>('/api/correlation/latest', fetcher, {
    refreshInterval: 60_000,
    shouldRetryOnError: false,
  });

  async function compute() {
    setComputing(true);
    try {
      await post('/api/correlation/compute', {
        symbols: symbols.split(',').map((s) => s.trim()).filter(Boolean),
        window_days: 30, timeframe: '1d', threshold: 0.85,
      });
      mutate();
    } finally {
      setComputing(false);
    }
  }

  const matrix = data?.matrix || {};
  const lagAnalysis = data?.lag_analysis || {};
  const cols = Object.keys(matrix);

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="mb-10 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Correlation</div>
        <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
          Co-movement <span className="font-display-italic text-gold">between coins</span>
        </h1>
        <p className="text-text-secondary max-w-2xl">
          If many positions move almost in lockstep with BTC, portfolio risk can be concentrated without you realising it.
        </p>
      </header>

      {/* Input */}
      <section className="mb-8 rise rise-2 bg-canvas-raised border border-rule rounded-sm p-5">
        <div className="text-xs uppercase tracking-widest text-text-tertiary mb-2">Symbols — comma separated</div>
        <textarea
          value={symbols}
          onChange={(e) => setSymbols(e.target.value)}
          rows={2}
          className="w-full bg-canvas-inset border border-rule px-3 py-2.5 text-sm font-mono text-text-primary rounded-sm focus:border-gold focus:outline-none resize-none"
          placeholder="BTC/USDT, ETH/USDT, SOL/USDT…"
        />
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={compute}
            disabled={computing}
            className="px-5 py-2.5 text-sm font-medium bg-gold/10 border border-gold/40 text-gold-400 hover:bg-gold/20 hover:border-gold rounded-sm disabled:opacity-50 transition-colors"
          >
            {computing ? 'Computing…' : 'Compute correlations'}
          </button>
          {data?.timeframe && (
            <span className="text-xs text-text-tertiary">
              Last computed · {data.timeframe} · {data.window_days}d window
            </span>
          )}
        </div>
      </section>

      {!data || cols.length === 0 ? (
        <div className="bg-canvas-raised border border-rule rounded-sm px-6 py-16 text-center">
          <div className="font-display-italic text-text-secondary text-lg">No correlation snapshot yet</div>
          <p className="text-text-tertiary text-sm mt-2">Add symbols above and click Compute correlations.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Matrix + high-pairs */}
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 xl:col-span-8 rise rise-3">
              <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
                <header className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-widest text-text-tertiary">
                    Correlation matrix · {data.timeframe} · {data.window_days}d
                  </h2>
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-text-tertiary">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(239,68,68,0.5)' }} />
                      Inverse
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(212,175,55,0.22)' }} />
                      Mid
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(212,175,55,0.85)' }} />
                      High
                    </span>
                  </div>
                </header>
                <div className="overflow-x-auto p-4">
                  <table className="w-full border-separate" style={{ borderSpacing: '3px' }}>
                    <thead>
                      <tr>
                        <th className="w-12" />
                        {cols.map((c) => (
                          <th key={c} className="text-[11px] font-medium text-text-secondary pb-2 text-center min-w-[52px]">
                            {shortName(c)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cols.map((row) => (
                        <tr key={row}>
                          <td className="text-[11px] font-medium text-text-secondary pr-2 text-right whitespace-nowrap">
                            {shortName(row)}
                          </td>
                          {cols.map((col) => {
                            const v = (matrix[row] && matrix[row][col]) ?? 0;
                            const isDiag = row === col;
                            return (
                              <td
                                key={col}
                                title={`${shortName(row)} ↔ ${shortName(col)}: ${v.toFixed(4)}`}
                                className="text-center rounded-sm"
                                style={{
                                  backgroundColor: isDiag ? 'rgba(212,175,55,0.25)' : cellBg(v),
                                  color: isDiag ? '#d4af37' : cellTextColor(v),
                                  padding: '8px 6px',
                                  fontSize: '12px',
                                  fontWeight: isDiag ? 700 : 400,
                                  fontVariantNumeric: 'tabular-nums',
                                  minWidth: '52px',
                                }}
                              >
                                {v.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <aside className="col-span-12 xl:col-span-4 space-y-5 rise rise-4">
              {/* High-corr pairs */}
              <div className="bg-canvas-raised border border-rule rounded-sm">
                <header className="px-5 py-3 border-b border-rule-faint">
                  <h3 className="text-xs uppercase tracking-widest text-text-tertiary">
                    High-correlation pairs (≥ {data.threshold ?? 0.85})
                  </h3>
                </header>
                {!data.flags || data.flags.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-text-tertiary">No pair above threshold.</div>
                ) : (
                  <ul className="divide-y divide-rule-faint">
                    {data.flags.map((f: any, i: number) => (
                      <li key={i} className="px-5 py-3 flex items-center justify-between">
                        <div className="text-sm text-text-primary font-medium">
                          {shortName(f.a)}<span className="text-text-tertiary mx-2">↔</span>{shortName(f.b)}
                        </div>
                        <div className="flex items-center gap-2">
                          <CorrBar value={f.corr} />
                          <span className="text-gold font-medium tabular text-sm w-12 text-right">
                            {f.corr.toFixed(3)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Reading guide */}
              <div className="bg-canvas-raised border-l-2 border-l-gold border-r border-y border-rule rounded-sm px-5 py-4">
                <div className="text-xs uppercase tracking-widest text-gold mb-3">Reading the matrix</div>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex gap-2"><span className="text-gold font-bold flex-shrink-0">0.85+</span><span>Near-lockstep — holding both doubles concentration risk</span></li>
                  <li className="flex gap-2"><span className="text-neutral font-bold flex-shrink-0">0.5–0.85</span><span>Moderate — some diversification benefit</span></li>
                  <li className="flex gap-2"><span className="text-text-tertiary font-bold flex-shrink-0">&lt;0.5</span><span>Low — meaningful diversification</span></li>
                  <li className="flex gap-2"><span className="text-short font-bold flex-shrink-0">Negative</span><span>Counter-trend — potential hedge</span></li>
                </ul>
              </div>
            </aside>
          </div>

          {/* Lead / Lag analysis */}
          {Object.keys(lagAnalysis).length > 0 && (
            <section className="rise rise-5">
              <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
                <header className="px-5 py-4 border-b border-rule-faint">
                  <h2 className="font-display text-2xl text-text-primary">
                    Lead/Lag <span className="font-display-italic text-gold">vs BTC</span>
                  </h2>
                  <p className="text-xs text-text-tertiary mt-1">
                    Positive lag = BTC moves first, coin follows. Negative lag = coin moves before BTC.
                    Based on daily returns, ±5 bar window.
                  </p>
                </header>

                <div className="divide-y divide-rule-faint">
                  {Object.entries(lagAnalysis).map(([sym, analysis]: [string, any]) => {
                    const lags = analysis.lags as Record<string, number>;
                    const peakLag: number = analysis.peak_lag;
                    const lagKeys = Object.keys(lags).map(Number).sort((a, b) => a - b);
                    const maxAbs = Math.max(...Object.values(lags).map(Math.abs), 0.01);

                    return (
                      <div key={sym} className="px-5 py-4 grid grid-cols-[120px_1fr_220px] gap-6 items-center">
                        {/* Symbol + label */}
                        <div>
                          <div className="text-sm font-medium text-text-primary">{shortName(sym)}</div>
                          <div className={`text-[10px] mt-0.5 uppercase tracking-wider ${
                            peakLag > 0 ? 'text-text-tertiary' :
                            peakLag < 0 ? 'text-accent' : 'text-gold'
                          }`}>
                            {analysis.label}
                          </div>
                        </div>

                        {/* Lag sparkline */}
                        <div className="flex items-end gap-0.5 h-10">
                          {lagKeys.map((lag) => {
                            const val = lags[String(lag)];
                            const isPeak = lag === peakLag;
                            const heightPct = Math.abs(val) / maxAbs;
                            const isPos = val >= 0;
                            return (
                              <div
                                key={lag}
                                className="flex-1 flex flex-col items-center justify-end gap-0.5"
                                title={`Lag ${lag > 0 ? '+' : ''}${lag}: ${val.toFixed(3)}`}
                              >
                                <div
                                  className="w-full rounded-sm transition-all"
                                  style={{
                                    height: `${Math.max(heightPct * 100, 4)}%`,
                                    background: isPeak
                                      ? 'rgba(212,175,55,0.9)'
                                      : isPos
                                      ? 'rgba(212,175,55,0.35)'
                                      : 'rgba(239,68,68,0.35)',
                                    border: isPeak ? '1px solid rgba(212,175,55,0.6)' : 'none',
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Lag labels + peak annotation */}
                        <div className="text-right space-y-1">
                          <div className="text-xs text-text-tertiary flex justify-between px-0.5">
                            <span>-5</span><span>-3</span><span>0</span><span>+3</span><span>+5</span>
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-1">
                            <span className="text-[10px] text-text-tertiary">Peak lag</span>
                            <span className={`text-sm font-medium tabular ${
                              peakLag > 0 ? 'text-text-secondary' :
                              peakLag < 0 ? 'text-accent' : 'text-gold'
                            }`}>
                              {peakLag > 0 ? '+' : ''}{peakLag}
                            </span>
                            <span className="text-[10px] text-text-tertiary">r =</span>
                            <span className="text-sm tabular text-gold font-medium">
                              {analysis.peak_corr.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <footer className="px-5 py-3 border-t border-rule-faint bg-canvas-inset/30">
                  <p className="text-[10px] text-text-tertiary leading-relaxed">
                    <span className="text-gold">Gold bar</span> = peak correlation lag.
                    <span className="text-accent ml-2">Accent</span> = coin leads BTC (negative lag) — rare, watch for early movers.
                    Lag is measured in daily candles; 1d timeframe recommended for meaningful results.
                  </p>
                </footer>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function cellBg(v: number): string {
  if (v >= 0.85) return 'rgba(212, 175, 55, 0.75)';
  if (v >= 0.7)  return 'rgba(212, 175, 55, 0.45)';
  if (v >= 0.5)  return 'rgba(212, 175, 55, 0.22)';
  if (v >= 0.3)  return 'rgba(212, 175, 55, 0.09)';
  if (v <= -0.5) return 'rgba(239, 68, 68, 0.55)';
  if (v <= -0.3) return 'rgba(239, 68, 68, 0.28)';
  return 'rgba(255,255,255,0.03)';
}

function cellTextColor(v: number): string {
  if (Math.abs(v) >= 0.7) return '#e5e5e5';
  if (Math.abs(v) >= 0.5) return '#b0b0b0';
  return '#666';
}

function CorrBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(value, 1) * 100);
  return (
    <div className="w-16 h-1.5 bg-rule rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: value >= 0.85 ? 'rgba(212,175,55,0.9)' : value >= 0.7 ? 'rgba(212,175,55,0.6)' : 'rgba(212,175,55,0.35)',
        }}
      />
    </div>
  );
}
