'use client';
/**
 * SetupChart — renders OUR setup as a long/short POSITION overlay on a candle
 * chart (lightweight-charts). Draws shaded risk (entry→SL, red) and reward
 * (entry→TP, green) bands plus labelled price lines — the TradingView
 * "Long/Short Position" tool equivalent, which the read-only TV iframe can't do.
 */
import { useEffect, useRef, useState } from 'react';
import {
  createChart, IChartApi, ISeriesApi, LineStyle, ColorType, UTCTimestamp,
} from 'lightweight-charts';
import { API, authHeaders, fmt } from '@/lib/api';

type Candle = { time: number; open: number; high: number; low: number; close: number };

export interface SetupChartProps {
  symbol: string;
  timeframe?: string;
  direction: 'long' | 'short' | string;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  takeProfits?: { price: number; label?: string }[];
  fillPrice?: number | null;
  height?: number;
}

const C = {
  up: '#3fb27f', down: '#e0635e', brand: '#d4a857',
  grid: 'rgba(28,34,48,0.45)', text: '#5d6678',
  rewardFill: 'rgba(63,178,127,0.13)', riskFill: 'rgba(224,99,94,0.13)',
};
const PRICE_AXIS_W = 64; // leave room for the right price scale

export default function SetupChart({
  symbol, timeframe = '1h', direction, entryLow, entryHigh, stopLoss,
  takeProfits = [], fillPrice, height = 460,
}: SetupChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rewardRef = useRef<HTMLDivElement>(null);
  const riskRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  const isLong = direction === 'long';
  const entryRef = fillPrice || (entryLow + entryHigh) / 2;
  const finalTp = takeProfits.length ? takeProfits[takeProfits.length - 1].price : null;
  const risk = Math.abs(entryRef - stopLoss);
  const reward = finalTp ? Math.abs(finalTp - entryRef) : 0;
  const rr = risk > 0 && reward ? reward / risk : 0;

  // Create chart once
  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: C.text, fontFamily: 'JetBrains Mono, monospace' },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: 'rgba(42,49,66,0.6)' },
      timeScale: { borderColor: 'rgba(42,49,66,0.6)', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    const series = chart.addCandlestickSeries({
      upColor: C.up, downColor: C.down, wickUpColor: C.up, wickDownColor: C.down,
      borderUpColor: C.up, borderDownColor: C.down,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    // Reposition the shaded bands every frame so they stay glued to price
    // through zoom / pan / autoscale (lightweight-charts has no redraw event).
    let raf = 0;
    const reposition = () => {
      const s = seriesRef.current;
      const rw = rewardRef.current, rk = riskRef.current;
      if (s && rw && rk) {
        const yE = s.priceToCoordinate(entryRef);
        const yS = s.priceToCoordinate(stopLoss);
        const yT = finalTp ? s.priceToCoordinate(finalTp) : null;
        const band = (el: HTMLDivElement, ya: number | null, yb: number | null) => {
          if (ya == null || yb == null) { el.style.display = 'none'; return; }
          el.style.display = 'block';
          el.style.top = `${Math.min(ya, yb)}px`;
          el.style.height = `${Math.abs(ya - yb)}px`;
        };
        band(rk, yE, yS);
        band(rw, yE, yT);
      }
      raf = requestAnimationFrame(reposition);
    };
    raf = requestAnimationFrame(reposition);

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(wrapRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, entryRef, stopLoss, finalTp]);

  // Load candles + draw position lines
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    fetch(`${API}/api/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=300`, { headers: authHeaders() })
      .then((r) => {
        if (r.status === 503) throw new Error('exchange unreachable');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows: Candle[]) => {
        if (cancelled || !seriesRef.current || !chartRef.current) return;
        const s = seriesRef.current;
        s.setData(rows.map((c) => ({
          time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close,
        })));

        const line = (price: number, color: string, title: string, style = LineStyle.Dashed, width: 1 | 2 = 1) =>
          s.createPriceLine({ price, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title });
        line(entryHigh, C.brand, 'Entry ▲', LineStyle.Dotted);
        line(entryLow, C.brand, 'Entry ▼', LineStyle.Dotted);
        if (fillPrice) line(fillPrice, C.brand, 'Fill', LineStyle.Solid, 2);
        if (stopLoss) line(stopLoss, C.down, 'SL', LineStyle.Solid, 2);
        takeProfits.forEach((tp, i) => tp?.price && line(tp.price, C.up, tp.label || `TP${i + 1}`, LineStyle.Dashed));

        chartRef.current.timeScale().fitContent();
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setErr(e.message); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, direction, entryLow, entryHigh, stopLoss, fillPrice, JSON.stringify(takeProfits), retry]);

  return (
    <div className="relative">
      <div ref={wrapRef} style={{ width: '100%', height }} className="relative" />

      {/* Shaded position bands (positioned each frame by priceToCoordinate) */}
      <div ref={rewardRef} className="absolute left-0 pointer-events-none hidden"
        style={{ right: PRICE_AXIS_W, background: C.rewardFill, borderTop: `1px solid ${C.up}55`, borderBottom: `1px solid ${C.up}55` }} />
      <div ref={riskRef} className="absolute left-0 pointer-events-none hidden"
        style={{ right: PRICE_AXIS_W, background: C.riskFill, borderTop: `1px solid ${C.down}55`, borderBottom: `1px solid ${C.down}55` }} />

      {/* Position summary chip */}
      <div className="absolute top-2 left-2 flex items-center gap-2 text-xs font-mono tnum bg-bg/80 border border-border rounded-md px-2.5 py-1 pointer-events-none">
        <span className={isLong ? 'text-up' : 'text-down'}>{isLong ? '↑ LONG' : '↓ SHORT'}</span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg-muted">entry <span className="text-brand">{fmt(entryRef)}</span></span>
        <span className="text-down">SL {fmt(stopLoss)}</span>
        {finalTp && <span className="text-up">TP {fmt(finalTp)}</span>}
        {rr > 0 && <span className="text-fg">{rr.toFixed(1)}R</span>}
      </div>

      {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-fg-faint">Loading chart…</div>}
      {err && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
          <div className="text-sm text-fg-muted">
            {err === 'exchange unreachable'
              ? 'Exchange unreachable — network is blocking the data feed.'
              : `Chart unavailable — ${err}`}
          </div>
          {err === 'exchange unreachable' && (
            <div className="text-xs text-fg-faint max-w-xs">Position levels above are still valid. Set <code className="text-brand">HTTP_PROXY</code> in the backend, or retry when the connection recovers.</div>
          )}
          <button onClick={() => setRetry((n) => n + 1)}
            className="mt-1 text-xs text-accent hover:text-accent/80 border border-border rounded-md px-3 h-7">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
