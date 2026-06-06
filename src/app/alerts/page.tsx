'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, post, fmt, fmtPct , fmtTime} from '@/lib/api';

export default function AlertsPage() {
  const { data: config, mutate: mutateConfig } = useSWR('/api/alerts/config', fetcher, {
    refreshInterval: 10000,
  });
  const { data: spikes, mutate: mutateSpikes } = useSWR<{ items: any[] }>(
    '/api/spikes',
    fetcher,
    { refreshInterval: 15000 },
  );

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [runningSpike, setRunningSpike] = useState(false);
  const [spikeResult, setSpikeResult] = useState<any>(null);

  async function testTelegram() {
    setTesting(true);
    setTestResult('');
    try {
      const r = await post('/api/alerts/test');
      setTestResult(r.ok ? '✓ Message sent — check your Telegram' : `✗ ${r.message}`);
      mutateConfig();
    } catch (e: any) {
      setTestResult(`✗ Error: ${e.message}`);
    } finally {
      setTesting(false);
    }
  }

  async function runSpikeNow() {
    setRunningSpike(true);
    setSpikeResult(null);
    try {
      const r = await post('/api/spikes/run');
      setSpikeResult(r);
      mutateSpikes();
    } catch (e: any) {
      setSpikeResult({ error: e.message });
    } finally {
      setRunningSpike(false);
    }
  }

  const isConfigured = config?.configured;
  const lastSpikes: any[] = spikes?.items || [];

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="mb-8 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Alerts</div>
        <h1 className="font-display text-5xl text-text-primary">
          Real-time <span className="font-display-italic text-gold">notifications</span>
        </h1>
        <p className="text-text-secondary mt-2 max-w-2xl">
          Telegram alerts for HIGH-score setups, plus a volume spike detector that monitors pairs every 2 minutes — so fast moves aren&apos;t missed after the fact.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Left col — Telegram setup */}
        <section className="col-span-12 lg:col-span-5 space-y-5 rise rise-2">

          {/* Status card */}
          <div className={`rounded-sm border p-5 relative overflow-hidden ${
            isConfigured
              ? 'bg-long/5 border-long/30'
              : 'bg-canvas-raised border-rule'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isConfigured ? 'bg-long pulse-gold' : 'bg-rule-strong'}`} />
              <span className="text-xs uppercase tracking-widest text-text-tertiary">
                Telegram Status
              </span>
            </div>
            <div className={`font-display text-2xl ${isConfigured ? 'text-long' : 'text-text-secondary'}`}>
              {isConfigured ? 'Connected' : 'Not configured'}
            </div>
            {isConfigured && (
              <div className="mt-3 space-y-1.5 text-sm text-text-secondary">
                <div className="flex justify-between">
                  <span>Min score for alert</span>
                  <span className="text-text-primary font-medium">{config?.min_score}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cooldown per pair</span>
                  <span className="text-text-primary font-medium">{config?.cooldown_hours}h</span>
                </div>
              </div>
            )}
          </div>

          {/* Setup guide */}
          <div className="bg-canvas-raised border border-rule rounded-sm">
            <header className="px-5 py-3 border-b border-rule-faint">
              <h3 className="text-xs uppercase tracking-widest text-text-tertiary">Setup Telegram</h3>
            </header>
            <div className="px-5 py-4 space-y-4 text-sm">
              <Step n={1} text="Open Telegram → search @BotFather → type /newbot → follow instructions → get token" />
              <Step n={2} text="Send any message to the bot you just created" />
              <Step n={3}>
                Open in browser:
                <code className="block mt-1 bg-canvas-inset border border-rule px-3 py-2 text-xs text-gold-400 rounded-sm break-all">
                  https://api.telegram.org/bot{'<TOKEN>'}/getUpdates
                </code>
                Find <code className="text-gold-400">chat.id</code> in the JSON response
              </Step>
              <Step n={4}>
                Add to <code className="text-gold-400">backend/.env</code>:
                <pre className="mt-1 bg-canvas-inset border border-rule px-3 py-2 text-xs text-text-primary rounded-sm">{`TELEGRAM_BOT_TOKEN=123456:ABC-xxx
TELEGRAM_CHAT_ID=987654321`}</pre>
              </Step>
              <Step n={5} text="Restart the backend, then click the test button below" />
            </div>
          </div>

          {/* Test button */}
          <div className="bg-canvas-raised border border-rule rounded-sm p-5">
            <div className="flex items-center gap-4">
              <button
                onClick={testTelegram}
                disabled={testing}
                className="px-5 py-2.5 text-sm font-medium bg-gold/10 border border-gold/40 text-gold-400 hover:bg-gold/20 hover:border-gold rounded-sm disabled:opacity-50 transition-colors"
              >
                {testing ? 'Sending…' : 'Test Telegram'}
              </button>
              {testResult && (
                <span className={`text-sm ${testResult.startsWith('✓') ? 'text-long' : 'text-short'}`}>
                  {testResult}
                </span>
              )}
            </div>
            <p className="text-xs text-text-tertiary mt-3">
              Sends a test message to your bot. If nothing arrives, check the token and chat ID in .env.
            </p>
          </div>

          {/* Alert config summary */}
          {config && (
            <div className="bg-canvas-raised border border-rule rounded-sm">
              <header className="px-5 py-3 border-b border-rule-faint">
                <h3 className="text-xs uppercase tracking-widest text-text-tertiary">
                  Active Config
                </h3>
              </header>
              <dl className="px-5 py-4 space-y-2.5 text-sm">
                <ConfigRow label="Min score alert" value={`≥ ${config.min_score}`} />
                <ConfigRow label="Cooldown per pair" value={`${config.cooldown_hours}h`} />
                <ConfigRow label="Spike check interval" value={`${config.spike_interval_minutes} min`} />
                <ConfigRow label="Spike threshold" value={`${config.spike_multiplier}× avg`} />
                <ConfigRow label="Spike timeframe" value={config.spike_timeframe} />
              </dl>
              <p className="px-5 pb-4 text-xs text-text-tertiary">
                Edit values in <code className="text-gold-400">backend/.env</code> + restart to apply.
              </p>
            </div>
          )}
        </section>

        {/* Right col — Volume Spike Monitor */}
        <section className="col-span-12 lg:col-span-7 space-y-5 rise rise-3">
          <div className="bg-canvas-raised border border-rule rounded-sm">
            <header className="px-5 py-4 border-b border-rule-faint flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl text-text-primary">
                  Volume <span className="font-display-italic text-gold">Spike Monitor</span>
                </h2>
                <p className="text-xs text-text-tertiary mt-1 uppercase tracking-widest">
                  Auto-check every {config?.spike_interval_minutes || 2} min · threshold {config?.spike_multiplier || 3}× avg
                </p>
              </div>
              <button
                onClick={runSpikeNow}
                disabled={runningSpike}
                className="px-4 py-2 text-sm font-medium bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 rounded-sm disabled:opacity-50 transition-colors"
              >
                {runningSpike ? 'Scanning…' : '⚡ Check Now'}
              </button>
            </header>

            {/* How it works */}
            <div className="px-5 py-4 border-b border-rule-faint bg-canvas-inset/30">
              <p className="text-sm text-text-secondary leading-relaxed">
                Monitors <code className="text-gold-400">{config?.spike_timeframe || '5m'}</code> candle volume
                for <strong className="text-text-primary">watchlist + top 30 pairs by volume</strong>.
                If current candle volume is <strong className="text-text-primary">{config?.spike_multiplier || 3}× larger</strong> than
                the 20-candle average → Telegram alert fires immediately,
                <strong className="text-text-primary"> before the candle closes</strong> — faster than the main screener.
              </p>
            </div>

            {/* Manual run result */}
            {spikeResult && (
              <div className="px-5 py-4 border-b border-rule-faint">
                {spikeResult.error ? (
                  <div className="text-sm text-short">{spikeResult.error}</div>
                ) : (
                  <div className="text-sm text-text-secondary">
                    Check complete:{' '}
                    <span className={`font-medium ${spikeResult.spikes_found > 0 ? 'text-gold' : 'text-text-primary'}`}>
                      {spikeResult.spikes_found} spike{spikeResult.spikes_found !== 1 ? 's' : ''}
                    </span>{' '}
                    detected
                  </div>
                )}
              </div>
            )}

            {/* Spike list */}
            {lastSpikes.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="font-display-italic text-text-secondary text-lg">
                  No spikes detected
                </div>
                <p className="text-text-tertiary text-sm mt-2">
                  Spikes will appear here and be sent to Telegram automatically.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-b border-rule-faint bg-canvas-inset/40 text-[10px] uppercase tracking-widest text-text-tertiary">
                  <span>Symbol</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Change</span>
                  <span className="text-right">Vol (candle)</span>
                  <span className="text-right">vs Avg</span>
                </div>
                <div className="divide-y divide-rule-faint">
                  {lastSpikes.map((s: any, i: number) => (
                    <div
                      key={i}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3.5 items-center"
                    >
                      <div>
                        <div className="text-sm font-medium text-text-primary">
                          {s.symbol?.replace('/USDT', '')}
                          <span className="text-text-tertiary">/USDT</span>
                        </div>
                        <div className="text-[10px] text-text-tertiary mt-0.5">
                          {s.timeframe} · {s.detected_at ? fmtTime(s.detected_at) : ''}
                        </div>
                      </div>
                      <div className="text-right font-mono text-sm tabular text-text-primary">
                        {fmt(s.price, 6)}
                      </div>
                      <div className={`text-right text-sm tabular ${
                        (s.change_pct || 0) > 0 ? 'text-long' : (s.change_pct || 0) < 0 ? 'text-short' : 'text-text-secondary'
                      }`}>
                        {s.change_pct != null ? fmtPct(s.change_pct) : '—'}
                      </div>
                      <div className="text-right text-sm tabular text-text-primary">
                        {s.current_vol_usd >= 1_000_000
                          ? `$${(s.current_vol_usd / 1_000_000).toFixed(1)}M`
                          : `$${(s.current_vol_usd / 1_000).toFixed(0)}K`}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gold tabular">
                          {s.multiplier}×
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Info box */}
          <div className="bg-canvas-raised border-l-2 border-l-gold border-r border-y border-rule rounded-sm px-5 py-4">
            <div className="text-xs uppercase tracking-widest text-gold mb-3">Unusual volume</div>
            <div className="text-sm text-text-secondary space-y-2 leading-relaxed">
              <p>
                Fast moves are an example of moves that <strong className="text-text-primary">can&apos;t be caught by a candle-based screener</strong> —
                because the signal only appears after price has already moved far.
              </p>
              <p>
                The spike detector works <strong className="text-text-primary">mid-candle</strong>, not waiting for the candle to close.
                Detection happens within <strong className="text-text-primary">2–7 minutes</strong> of volume beginning to rise.
              </p>
              <p className="text-text-tertiary">
                Always verify the chart before entry — spikes can be false positives (bots, wash trading, or first candle of a new listing).
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Step({ n, text, children }: { n: number; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-[10px] text-gold font-bold mt-0.5">
        {n}
      </div>
      <div className="text-text-secondary leading-relaxed">
        {text || children}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium text-text-primary">{value}</dd>
    </div>
  );
}
