'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, post, fmtUSD , fmtTs} from '@/lib/api';

export default function Etymon() {
  const [symbol, setSymbol] = useState('BTC/USDT:USDT');
  const { data, mutate } = useSWR<any>(
    symbol ? `/api/onchain/${encodeURIComponent(symbol)}` : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await post('/api/onchain/refresh', { symbols: [symbol] });
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="max-w-[960px] mx-auto px-8 py-10">
      <header className="mb-10 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">On-chain</div>
        <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
          Data <span className="font-display-italic text-gold">on-chain</span>
        </h1>
        <p className="text-text-secondary max-w-2xl">
          Exchange inflow/outflow and network activity (source: CoinMetrics Community).
          Large exchange inflows can signal caution; large outflows are often associated with accumulation.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3">
        <input
          value={symbol} onChange={(e) => setSymbol(e.target.value)}
          className="bg-canvas-deep border border-rule px-3 py-2 text-sm tabular flex-1"
        />
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-xs px-3 py-1.5 border border-gold/40 text-gold hover:bg-gold/10"
        >
          {refreshing ? 'Pulling…' : 'Refresh'}
        </button>
      </div>

      {!data ? (
        <div className="text-text-tertiary">No on-chain snapshot. Limited to supported assets (BTC, ETH, SOL, …).</div>
      ) : (
        <section className="bg-canvas-raised border border-rule rounded-sm rise rise-2">
          <header className="px-5 py-3 border-b border-rule-faint flex justify-between">
            <span className="text-[11px] uppercase tracking-widest text-text-tertiary">{data.symbol}</span>
            <span className="text-[11px] text-text-tertiary">
              {data.captured_at ? fmtTs(data.captured_at) : '—'}
            </span>
          </header>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm tabular">
            <Stat label="Inflow (USD)" value={fmtUSD(data.exchange_inflow_usd)} />
            <Stat label="Outflow (USD)" value={fmtUSD(data.exchange_outflow_usd)} />
            <Stat
              label="Net flow"
              value={fmtUSD(data.net_flow_usd)}
              tone={data.net_flow_usd > 0 ? 'long' : data.net_flow_usd < 0 ? 'short' : undefined}
            />
            <Stat label="Active addresses" value={(data.active_addresses ?? 0).toLocaleString()} />
            <Stat label="Bias hint" value={data.bias_hint || '—'} tone={
              data.bias_hint === 'accumulation' ? 'long' : data.bias_hint === 'distribution' ? 'short' : undefined
            } />
            <Stat label="Source" value={data.source} />
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: 'long' | 'short' }) {
  const cls = tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-text-primary';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">{label}</div>
      <div className={`text-lg ${cls}`}>{value}</div>
    </div>
  );
}
