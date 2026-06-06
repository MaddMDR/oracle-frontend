'use client';

import useSWR from 'swr';
import { fetcher, MarketState, fmt, fmtPct, signColor, sessionLabel, regimeLabel } from '@/lib/api';

const REGIME_TONE: Record<string, string> = {
  trending_up: 'text-long',
  trending_down: 'text-short',
  choppy: 'text-neutral',
  compression: 'text-accent',
  expansion: 'text-gold',
};

export default function MarketStatePanel() {
  const { data } = useSWR<MarketState>('/api/market-state', fetcher, { refreshInterval: 30000 });
  const btc = data?.btc;
  const regime = btc?.regime || '';

  return (
    <section className="bg-canvas-raised border border-rule rounded-sm">
      <header className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-text-tertiary">Market State</span>
        <span className="text-[10px] text-text-tertiary tabular">
          {data?.updated_at ? new Date(data.updated_at).toLocaleTimeString('en-GB') : '—'}
        </span>
      </header>

      <div className="px-5 py-4">
        <div className="mb-5">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">BTC / USDT</div>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl text-text-primary tabular">
              {btc?.price ? `$${fmt(btc.price, 2)}` : '—'}
            </span>
            <span className={`text-base font-medium tabular ${signColor(btc?.change_24h_pct)}`}>
              {fmtPct(btc?.change_24h_pct)}
            </span>
          </div>
        </div>

        <dl className="space-y-3">
          <Row label="Trend" value={btc?.trend || '—'} valueClass={
            btc?.trend === 'bullish' ? 'text-long' :
            btc?.trend === 'bearish' ? 'text-short' : 'text-neutral'
          } />
          <Row label="Regime" value={regimeLabel(regime)} valueClass={REGIME_TONE[regime] || 'text-text-primary'} />
          <Row label="Session" value={sessionLabel(data?.session)} valueClass="text-accent" />
        </dl>
      </div>
    </section>
  );
}

function Row({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className={`text-sm font-medium capitalize ${valueClass}`}>{value}</dd>
    </div>
  );
}
