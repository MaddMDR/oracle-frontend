'use client';

/**
 * TradingViewChart — embeds TradingView chart via direct iframe URL.
 *
 * No external script loading needed. Container height is 100% CSS-controlled.
 *
 * Exchange fallback logic:
 *   Default → BINANCE  (most liquid, best data)
 *   BYBIT_FALLBACK set → BYBIT  (e.g. XMR, ZEC, DASH — delisted on Binance)
 *   BITGET_DEFAULT set → BITGET perpetual  (small-caps native to Bitget)
 *
 * Users can also toggle the exchange manually via the picker buttons below
 * the chart — useful when the default exchange doesn't carry the symbol.
 * TradingView's own symbol-change input is also enabled (allow_symbol_change=1).
 */

import { useState } from 'react';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const TF_MAP: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240',
  '1d': 'D', '1w': 'W', '1M': 'M',
};

export function toTVInterval(tf: string): string {
  return TF_MAP[tf] ?? '60';
}

// Pairs delisted / unavailable on Binance spot → fall back to BYBIT
const BYBIT_FALLBACK = new Set(['XMR', 'ZEC', 'DASH']);

// Pairs native to Bitget (small-cap, seed tokens) → default to BITGET perpetual
// Add symbols here when Binance/Bybit don't carry them.
// Format used: BITGET:<BASE>USDT  (TradingView resolves perp automatically)
const BITGET_DEFAULT = new Set([
  'VVV', 'VVAIUSDT', // add more as discovered
]);

type Exchange = 'BINANCE' | 'BYBIT' | 'BITGET';

export function toTVSymbol(oracleSymbol: string, exchangeOverride?: Exchange): string {
  const base = oracleSymbol
    .replace('/USDT:USDT', '')
    .replace('/USDT', '')
    .replace('/BUSD', '')
    .replace('/', '')
    .toUpperCase();

  let exchange: Exchange;
  if (exchangeOverride) {
    exchange = exchangeOverride;
  } else if (BITGET_DEFAULT.has(base)) {
    exchange = 'BITGET';
  } else if (BYBIT_FALLBACK.has(base)) {
    exchange = 'BYBIT';
  } else {
    exchange = 'BINANCE';
  }

  return `${exchange}:${base}USDT.P`;
}

export function defaultExchange(oracleSymbol: string): Exchange {
  const base = oracleSymbol
    .replace('/USDT:USDT', '')
    .replace('/USDT', '')
    .replace('/BUSD', '')
    .replace('/', '')
    .toUpperCase();
  if (BITGET_DEFAULT.has(base)) return 'BITGET';
  if (BYBIT_FALLBACK.has(base)) return 'BYBIT';
  return 'BINANCE';
}

// "Open in TradingView" button URL
export function toTVUrl(oracleSymbol: string, tf = '1h'): string {
  const sym = toTVSymbol(oracleSymbol);
  const interval = toTVInterval(tf);
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}&interval=${interval}`;
}

/* ── Component ────────────────────────────────────────────────────────────── */

interface TVChartProps {
  symbol: string;      // Oracle format: "ICP/USDT" or "ICP/USDT:USDT"
  timeframe?: string;  // Oracle format: "1h"
  height?: number;
}

const EXCHANGES: Exchange[] = ['BINANCE', 'BYBIT', 'BITGET'];

const EXCHANGE_LABELS: Record<Exchange, string> = {
  BINANCE: 'Binance',
  BYBIT:   'Bybit',
  BITGET:  'Bitget',
};

export default function TradingViewChart({
  symbol,
  timeframe = '1h',
  height = 560,
}: TVChartProps) {
  const [exchange, setExchange] = useState<Exchange>(() => defaultExchange(symbol));

  const tvSym      = toTVSymbol(symbol, exchange);
  const tvInterval = toTVInterval(timeframe);

  // TradingView widgetembed URL — works without any JS, purely via iframe
  const src = [
    'https://s.tradingview.com/widgetembed/',
    '?frameElementId=tv_oracle',
    `&symbol=${encodeURIComponent(tvSym)}`,
    `&interval=${tvInterval}`,
    '&hidesidetoolbar=0',
    '&saveimage=0',
    '&toolbarbg=0d0d0f',
    '&theme=dark',
    '&style=1',
    '&timezone=Asia%2FJakarta',
    '&locale=en',
    '&allow_symbol_change=1',   // user can change directly in TV too
    '&studies=[]',
    '&hide_top_toolbar=0',
    '&show_popup_button=0',
  ].join('');

  return (
    <div className="flex flex-col gap-1">
      {/* Exchange picker */}
      <div className="flex items-center gap-1 px-1">
        <span className="text-xs text-text-secondary mr-1">Chart:</span>
        {EXCHANGES.map((ex) => (
          <button
            key={ex}
            onClick={() => setExchange(ex)}
            className={[
              'px-2 py-0.5 rounded text-xs font-medium transition-colors',
              exchange === ex
                ? 'bg-accent text-white'
                : 'bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-3',
            ].join(' ')}
          >
            {EXCHANGE_LABELS[ex]}
          </button>
        ))}
        {exchange !== defaultExchange(symbol) && (
          <button
            onClick={() => setExchange(defaultExchange(symbol))}
            className="ml-1 px-1.5 py-0.5 rounded text-xs text-text-muted hover:text-text-secondary"
            title="Reset to default exchange"
          >
            ↩
          </button>
        )}
        <span className="ml-auto text-xs text-text-muted font-mono">{tvSym}</span>
      </div>

      {/* Chart iframe */}
      <iframe
        key={`${tvSym}-${tvInterval}`}  // remount on symbol/TF/exchange change
        src={src}
        style={{ width: '100%', height: `${height}px`, border: 'none', display: 'block' }}
        allowFullScreen
        loading="lazy"
        title={`${symbol} chart`}
      />
    </div>
  );
}
