'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  ColorType,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  SeriesMarker,
  Time,
} from 'lightweight-charts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Candle = { time: number; open: number; high: number; low: number; close: number };

export type StructureEvent = {
  kind: 'BoS' | 'CHoCH';
  direction: 'bullish' | 'bearish';
  level: number;
  time: number;
};

export type OrderBlock = {
  direction: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  time: number;
  mitigated: boolean;
};

export type FVG = {
  direction: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  time: number;
  mitigated: boolean;
};

export type IFVG = {
  direction: 'bullish' | 'bearish';   // new role after flip
  top: number;
  bottom: number;
  time: number;
  original_direction: 'bullish' | 'bearish';
  confirmed: boolean;                  // true = rejection candle seen → higher prob
};

export type Sweep = {
  direction: 'bullish' | 'bearish';
  level: number;
  time: number;
};

export type Swing = { kind: 'high' | 'low'; time: number; level: number };

export interface SMCOverlay {
  structure_events?: StructureEvent[];
  order_blocks?: OrderBlock[];
  fvgs?: FVG[];
  ifvgs?: IFVG[];
  sweeps?: Sweep[];
  swings?: Swing[];
}

export type FibLevel = {
  ratio:  number;    // 0.0 – 1.618
  price:  number;
  label:  string;    // "61.8%"
  is_ote: boolean;
};

export interface FibData {
  direction:       'bullish' | 'bearish';
  swing_high:      number;
  swing_low:       number;
  levels:          FibLevel[];
  ote_zone:        { low: number; high: number };
  ote_mid:         number;
  in_ote:          boolean;
  cur_ratio:       number | null;
}

export interface PriceChartProps {
  data: Candle[];
  supports?: number[];
  resistances?: number[];
  smc?: SMCOverlay;
  smcLoading?: boolean;
  smcError?: boolean;
  fib?: FibData | null;
  fibLoading?: boolean;
}

// ── Layer toggle state ────────────────────────────────────────────────────────

type LayerKey = 'structure' | 'ob' | 'fvg' | 'ifvg' | 'sweep' | 'swing' | 'fib';

const LAYER_LABELS: Record<LayerKey, string> = {
  structure: 'BoS · CHoCH',
  ob:        'Order Blocks',
  fvg:       'FVG',
  ifvg:      'iFVG',
  sweep:     'Sweeps',
  swing:     'Swings',
  fib:       'Fibonacci',
};

const COLORS = {
  bullish:    'rgba(127, 168, 133, 0.18)',
  bullishHi:  'rgba(127, 168, 133, 0.65)',
  bearish:    'rgba(200, 112, 96, 0.18)',
  bearishHi:  'rgba(200, 112, 96, 0.65)',
  fvgBull:     'rgba(56, 189, 248, 0.12)',
  fvgBullHi:   'rgba(56, 189, 248, 0.55)',
  fvgBear:     'rgba(244, 114, 182, 0.12)',
  fvgBearHi:   'rgba(244, 114, 182, 0.55)',
  // iFVG — amber/orange palette (distinct from regular FVG)
  ifvgBull:    'rgba(251, 191, 36, 0.14)',   // amber — bullish iFVG = support
  ifvgBullHi:  'rgba(251, 191, 36, 0.60)',
  ifvgBear:    'rgba(249, 115, 22, 0.14)',   // orange — bearish iFVG = resistance
  ifvgBearHi:  'rgba(249, 115, 22, 0.60)',
  gold:        '#bf8e3a',
  mitigated:   'rgba(120, 120, 120, 0.08)',
  // Fibonacci
  fibOte:     'rgba(191, 142, 58, 0.14)',   // OTE zone fill
  fibOteBrd:  'rgba(191, 142, 58, 0.60)',
  fibLine:    'rgba(180, 165, 130, 0.35)',   // regular fib line
  fibOteLine: 'rgba(191, 142, 58, 0.80)',   // OTE level line
  fibExt:     'rgba(150, 150, 200, 0.25)',   // extension lines
};

// ── Main component ────────────────────────────────────────────────────────────

export default function PriceChart({
  data,
  supports = [],
  resistances = [],
  smc,
  smcLoading = false,
  smcError = false,
  fib = null,
  fibLoading = false,
}: PriceChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  // Tracks whether we've fit-content for the current data identity.
  // Reset whenever the parent passes a new `data` reference (new symbol/TF).
  const lastDataRef = useRef<Candle[] | null>(null);

  // ── Resizable chart height ────────────────────────────────────────────────
  const DEFAULT_H = 480;
  const [chartHeight, setChartHeight]     = useState(DEFAULT_H);
  const [priceMargin, setPriceMargin]     = useState(0.08);   // scaleMargins top+bottom

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    structure: true,
    ob:        true,
    fvg:       true,
    ifvg:      true,
    sweep:     true,
    swing:     false,
    fib:       true,
  });

  // ── Init chart ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a8a294',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: {
        borderColor: '#1f2533',
        // Allow user to manually scale by dragging the price axis.
        // When user drags, library auto-disables autoScale until double-click reset.
        autoScale: true,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: '#1f2533',
        timeVisible: true,
        rightOffset: 8,        // breathing room past the last candle
        barSpacing: 6,         // initial spacing; user can zoom freely afterward
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#bf8e3a', width: 1, style: 2 },
        horzLine: { color: '#bf8e3a', width: 1, style: 2 },
      },
      // ── TradingView-style interaction (all enabled, all explicit) ──────────
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },  // drag axis to scale
        axisDoubleClickReset: { time: true, price: true },  // dbl-click axis to reset
        mouseWheel: true,                                   // wheel zoom at cursor
        pinch: true,                                        // touch pinch zoom
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,   // drag chart body to pan
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      kineticScroll: { touch: true, mouse: false },
      autoSize: true,
    });
    const s = chart.addCandlestickSeries({
      upColor: '#7fa885',
      downColor: '#c87060',
      borderUpColor: '#7fa885',
      borderDownColor: '#c87060',
      wickUpColor: '#7fa885',
      wickDownColor: '#c87060',
    });
    chartRef.current = chart;
    seriesRef.current = s;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // ── Candle data — fitContent ONLY on first data or symbol/TF change ────────
  // SWR returns the same reference when data hasn't refreshed, so layer toggles
  // and SMC overlay arrivals don't trigger refits and won't kill user zoom.
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(data as any);

    // Only fit-to-content if this is a NEW data set (different reference).
    // Preserves user zoom/pan across layer toggles and SMC overlay arrivals.
    if (lastDataRef.current !== data) {
      lastDataRef.current = data;
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  // ── Support / Resistance price lines (own effect, no refit) ────────────────
  useEffect(() => {
    if (!seriesRef.current) return;
    const s = seriesRef.current as any;
    (s._lines || []).forEach((pl: any) => seriesRef.current!.removePriceLine(pl));
    s._lines = [];

    supports.forEach((p) =>
      s._lines.push(seriesRef.current!.createPriceLine({
        price: p, color: '#7fa885', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'S',
      })),
    );
    resistances.forEach((p) =>
      s._lines.push(seriesRef.current!.createPriceLine({
        price: p, color: '#c87060', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'R',
      })),
    );
  }, [supports, resistances]);

  // ── Markers (BoS / CHoCH / Sweep / Swing) — own effect, no refit ───────────
  useEffect(() => {
    if (!seriesRef.current) return;
    const markers: SeriesMarker<Time>[] = [];

    if (layers.structure && smc?.structure_events) {
      for (const ev of smc.structure_events) {
        const isBull = ev.direction === 'bullish';
        const isCHoCH = ev.kind === 'CHoCH';
        markers.push({
          time: ev.time as UTCTimestamp,
          position: isBull ? 'belowBar' : 'aboveBar',
          color: isCHoCH ? COLORS.gold : (isBull ? '#7fa885' : '#c87060'),
          shape: isBull ? 'arrowUp' : 'arrowDown',
          text: ev.kind,
        });
      }
    }

    if (layers.sweep && smc?.sweeps) {
      for (const sw of smc.sweeps) {
        const isBull = sw.direction === 'bullish';
        markers.push({
          time: sw.time as UTCTimestamp,
          position: isBull ? 'belowBar' : 'aboveBar',
          color: '#bf8e3a',
          shape: 'circle',
          text: '⚡',
        });
      }
    }

    if (layers.swing && smc?.swings) {
      for (const sp of smc.swings) {
        markers.push({
          time: sp.time as UTCTimestamp,
          position: sp.kind === 'high' ? 'aboveBar' : 'belowBar',
          color: sp.kind === 'high' ? '#c87060aa' : '#7fa885aa',
          shape: 'circle',
          text: '',
        });
      }
    }

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    seriesRef.current.setMarkers(markers);
  }, [smc, layers]);

  // ── Render zone rectangles via DOM overlay ─────────────────────────────────
  // We compute pixel positions on every paint, scroll, zoom event.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = overlayRef.current;
    if (!chart || !series || !overlay) return;

    function paint() {
      if (!overlay || !chart || !series) return;
      overlay.innerHTML = '';

      const w = overlay.clientWidth;
      const ts = chart.timeScale();

      const drawRect = (
        timeFrom: number,
        priceTop: number,
        priceBottom: number,
        bg: string,
        borderColor: string,
        label: string,
        labelColor: string,
        mitigated: boolean,
      ) => {
        const x1 = ts.timeToCoordinate(timeFrom as UTCTimestamp);
        if (x1 === null) return;
        const yTop = series.priceToCoordinate(priceTop);
        const yBot = series.priceToCoordinate(priceBottom);
        if (yTop === null || yBot === null) return;

        const left = Math.max(0, x1);
        const width = Math.max(2, w - left);
        const top = Math.min(yTop, yBot);
        const height = Math.abs(yBot - yTop);

        const div = document.createElement('div');
        div.style.cssText = `
          position:absolute;
          left:${left}px; top:${top}px;
          width:${width}px; height:${height}px;
          background:${mitigated ? COLORS.mitigated : bg};
          border-top:1px solid ${borderColor};
          border-bottom:1px solid ${borderColor};
          pointer-events:none;
          ${mitigated ? 'opacity:0.45;' : ''}
        `;

        // Label badge at top-right
        const lab = document.createElement('div');
        lab.textContent = mitigated ? `${label}·mit` : label;
        lab.style.cssText = `
          position:absolute;
          right:2px; top:1px;
          font-size:9px;
          font-family: ui-monospace, monospace;
          letter-spacing:.04em;
          color:${labelColor};
          background:rgba(15,17,23,0.85);
          padding:1px 4px;
          border-radius:2px;
          pointer-events:none;
        `;
        div.appendChild(lab);
        overlay.appendChild(div);
      };

      // Order Blocks
      if (layers.ob && smc?.order_blocks) {
        for (const ob of smc.order_blocks) {
          if (ob.time == null) continue;
          const isBull = ob.direction === 'bullish';
          drawRect(
            ob.time,
            ob.top,
            ob.bottom,
            isBull ? COLORS.bullish : COLORS.bearish,
            isBull ? COLORS.bullishHi : COLORS.bearishHi,
            'OB',
            isBull ? '#a8d4ae' : '#e8a89a',
            ob.mitigated,
          );
        }
      }

      // FVGs
      if (layers.fvg && smc?.fvgs) {
        for (const f of smc.fvgs) {
          if (f.time == null) continue;
          const isBull = f.direction === 'bullish';
          drawRect(
            f.time,
            f.top,
            f.bottom,
            isBull ? COLORS.fvgBull : COLORS.fvgBear,
            isBull ? COLORS.fvgBullHi : COLORS.fvgBearHi,
            'FVG',
            isBull ? '#7dd3fc' : '#fb7185',
            f.mitigated,
          );
        }
      }

      // iFVGs — inverted FVGs that have flipped S/R role
      if (layers.ifvg && smc?.ifvgs) {
        for (const f of smc.ifvgs) {
          if (f.time == null) continue;
          const isBull = f.direction === 'bullish';   // new role: bullish = support
          // Confirmed iFVGs get a slightly higher opacity label suffix
          const label = f.confirmed ? 'iFVG ✓' : 'iFVG';
          drawRect(
            f.time,
            f.top,
            f.bottom,
            isBull ? COLORS.ifvgBull : COLORS.ifvgBear,
            isBull ? COLORS.ifvgBullHi : COLORS.ifvgBearHi,
            label,
            isBull ? '#fbbf24' : '#f97316',
            false,   // iFVGs are always "active" — never dim them
          );
        }
      }

      // ── Fibonacci Retracement ───────────────────────────────────────────────
      if (layers.fib && fib) {
        // OTE zone band (61.8%–78.6%) — filled rectangle spanning full width
        const oteYTop = series.priceToCoordinate(fib.ote_zone.high);
        const oteYBot = series.priceToCoordinate(fib.ote_zone.low);
        if (oteYTop !== null && oteYBot !== null) {
          const top    = Math.min(oteYTop, oteYBot);
          const height = Math.abs(oteYBot - oteYTop);
          const div = document.createElement('div');
          div.style.cssText = `
            position:absolute;
            left:0; top:${top}px;
            width:100%; height:${Math.max(2, height)}px;
            background:${COLORS.fibOte};
            border-top:1px dashed ${COLORS.fibOteBrd};
            border-bottom:1px dashed ${COLORS.fibOteBrd};
            pointer-events:none;
          `;
          const lab = document.createElement('div');
          lab.textContent = 'OTE 61.8–78.6%';
          lab.style.cssText = `
            position:absolute;
            left:4px; top:2px;
            font-size:9px;
            font-family:ui-monospace,monospace;
            letter-spacing:.04em;
            color:#bf8e3a;
            background:rgba(15,17,23,0.85);
            padding:1px 4px;
            border-radius:2px;
            pointer-events:none;
          `;
          div.appendChild(lab);
          overlay.appendChild(div);
        }

        // Individual Fibonacci horizontal lines
        for (const lv of fib.levels) {
          const y = series.priceToCoordinate(lv.price);
          if (y === null) continue;

          // Skip extensions unless they're on-screen
          const isExt = lv.ratio > 1.0;
          const isOte = lv.ratio === 0.618 || lv.ratio === 0.786 || lv.ratio === 0.705;

          const lineColor = isExt
            ? COLORS.fibExt
            : isOte
            ? COLORS.fibOteLine
            : COLORS.fibLine;
          const lineH = isOte ? 1 : 1;

          const line = document.createElement('div');
          line.style.cssText = `
            position:absolute;
            left:0; top:${y}px;
            width:100%; height:${lineH}px;
            background:${lineColor};
            pointer-events:none;
          `;

          // Label badge (right-aligned)
          const lab = document.createElement('div');
          lab.textContent = `${lv.label}  ${lv.price.toPrecision(6)}`;
          lab.style.cssText = `
            position:absolute;
            right:2px; top:-9px;
            font-size:8px;
            font-family:ui-monospace,monospace;
            color:${isOte ? '#bf8e3a' : '#8a8070'};
            background:rgba(15,17,23,0.80);
            padding:0px 3px;
            border-radius:2px;
            pointer-events:none;
            white-space:nowrap;
          `;
          line.appendChild(lab);
          overlay.appendChild(line);
        }
      }
    }

    // Sync overlay on every chart change
    const ts = chart.timeScale();
    ts.subscribeVisibleTimeRangeChange(paint);
    ts.subscribeVisibleLogicalRangeChange(paint);
    chart.subscribeCrosshairMove(paint);  // also handles re-paint on resize
    const ro = new ResizeObserver(paint);
    if (chartContainerRef.current) ro.observe(chartContainerRef.current);

    // Initial paint after data settles
    requestAnimationFrame(paint);
    setTimeout(paint, 50);
    setTimeout(paint, 200);

    return () => {
      ts.unsubscribeVisibleTimeRangeChange(paint);
      ts.unsubscribeVisibleLogicalRangeChange(paint);
      chart.unsubscribeCrosshairMove(paint);
      ro.disconnect();
    };
  }, [data, smc, fib, layers]);

  // ── Legend / layer toggles ─────────────────────────────────────────────────
  const toggle = (k: LayerKey) =>
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

  const fitContent = () => chartRef.current?.timeScale().fitContent();

  // Y-axis zoom: adjust scaleMargins (smaller = more "lonjong", larger = more "gepeng")
  const zoomY = (dir: 1 | -1) => {
    const next = Math.max(0.01, Math.min(0.40, priceMargin + dir * 0.05));
    setPriceMargin(next);
    chartRef.current?.applyOptions({
      rightPriceScale: { scaleMargins: { top: next, bottom: next } },
    });
  };

  // X-axis zoom: widen or narrow bar spacing
  const barSpacingRef = useRef(6);
  const zoomX = (dir: 1 | -1) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    barSpacingRef.current = Math.max(2, Math.min(40, barSpacingRef.current + dir * 3));
    ts.applyOptions({ barSpacing: barSpacingRef.current });
  };

  // Maximize: toggle between default height and tall (fills visible window below navbar)
  const toggleMaximize = () => {
    if (chartHeight > DEFAULT_H) {
      setChartHeight(DEFAULT_H);
    } else {
      const tall = Math.max(600, (typeof window !== 'undefined' ? window.innerHeight : 900) - 120);
      setChartHeight(tall);
      // Scroll chart into view after expansion
      setTimeout(() => wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  // Escape key collapses expanded chart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && chartHeight > DEFAULT_H) setChartHeight(DEFAULT_H); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chartHeight]);

  // Drag-to-resize handle at the bottom of the chart
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = chartHeight;
    const onMove = (me: MouseEvent) => {
      setChartHeight(Math.max(200, Math.min(1400, startH + me.clientY - startY)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const hasSMC = smc && (
    (smc.structure_events?.length ?? 0) > 0
    || (smc.order_blocks?.length ?? 0) > 0
    || (smc.fvgs?.length ?? 0) > 0
    || (smc.ifvgs?.length ?? 0) > 0
    || (smc.sweeps?.length ?? 0) > 0
    || (smc.swings?.length ?? 0) > 0
  );
  const hasFib = !!fib?.levels?.length;

  const isExpanded = chartHeight > DEFAULT_H;

  return (
    <div ref={wrapRef} className="relative w-full">

      {/* ── Top bar: layer toggles + controls ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px] uppercase tracking-widest">

        {/* Layer toggles */}
        {smcError ? (
          <span className="px-2 py-0.5 text-short">✗ Structure overlay unavailable</span>
        ) : smcLoading && !hasSMC ? (
          <span className="px-2 py-0.5 text-text-tertiary animate-pulse">◌ Reading structure…</span>
        ) : (
          (Object.keys(LAYER_LABELS) as LayerKey[]).map((k) => {
            if (k === 'fib' && !hasFib && !fibLoading) return null;
            return (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={`px-2 py-0.5 border rounded-sm transition-colors ${
                  layers[k]
                    ? 'border-gold/50 text-gold bg-gold/10'
                    : 'border-rule text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {layers[k] ? '●' : '○'} {LAYER_LABELS[k]}
              </button>
            );
          })
        )}

        {smcLoading && hasSMC && (
          <span className="ml-1 text-text-tertiary animate-pulse text-[9px]">◌ refreshing…</span>
        )}
        {fibLoading && !hasFib && (
          <span className="px-2 py-0.5 text-text-tertiary animate-pulse">◌ Loading Fibonacci…</span>
        )}
        {hasFib && fib && (
          <span className="ml-1 text-[9px] text-text-tertiary">
            {fib.in_ote
              ? <span className="text-gold font-medium">⚡ In OTE Zone</span>
              : fib.cur_ratio !== null
              ? <span>{(fib.cur_ratio * 100).toFixed(1)}% retrace</span>
              : null}
          </span>
        )}

        {/* ── Right-side controls ────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-0.5">

          {/* Y-axis zoom (stretch/compress price scale) */}
          <span className="text-text-tertiary/40 text-[9px] mr-1 normal-case tracking-normal">Y</span>
          <button
            onClick={() => zoomY(-1)}
            title="Stretch Y-axis (more lonjong)"
            className="w-6 h-6 flex items-center justify-center border border-rule text-text-tertiary
                       hover:text-text-secondary hover:border-rule-strong rounded-sm transition-colors"
          >
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
              <path d="M5 1v8M2 4l3-3 3 3M2 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => zoomY(1)}
            title="Compress Y-axis (more gepeng)"
            className="w-6 h-6 flex items-center justify-center border border-rule text-text-tertiary
                       hover:text-text-secondary hover:border-rule-strong rounded-sm transition-colors"
          >
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
              <path d="M5 1v8M2 3.5L5 5l3-1.5M2 6.5L5 5l3 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* X-axis zoom (bar spacing) */}
          <span className="text-text-tertiary/40 text-[9px] mx-1 normal-case tracking-normal">X</span>
          <button
            onClick={() => zoomX(1)}
            title="Zoom in (fewer candles)"
            className="w-6 h-6 flex items-center justify-center border border-rule text-text-tertiary
                       hover:text-text-secondary hover:border-rule-strong rounded-sm transition-colors"
          >
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
              <path d="M1 5h8M4 2l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => zoomX(-1)}
            title="Zoom out (more candles)"
            className="w-6 h-6 flex items-center justify-center border border-rule text-text-tertiary
                       hover:text-text-secondary hover:border-rule-strong rounded-sm transition-colors"
          >
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
              <path d="M1 5h8M6 2l-3 3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="w-px h-4 bg-rule mx-1" />

          {/* Fit */}
          <button
            onClick={fitContent}
            title="Fit all candles"
            className="w-6 h-6 flex items-center justify-center border border-rule text-text-tertiary
                       hover:text-text-secondary hover:border-rule-strong rounded-sm transition-colors"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
              <path d="M1 3.5V1h2.5M6.5 1H9v2.5M9 6.5V9H6.5M3.5 9H1V6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Expand / collapse height */}
          <button
            onClick={toggleMaximize}
            title={isExpanded ? 'Collapse chart (Esc)' : 'Expand chart height'}
            className={`w-6 h-6 flex items-center justify-center border rounded-sm transition-colors ${
              isExpanded
                ? 'border-gold/40 text-gold bg-gold/10'
                : 'border-rule text-text-tertiary hover:text-gold hover:border-gold/40'
            }`}
          >
            {isExpanded ? (
              <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                <path d="M3.5 1v2.5H1M6.5 1v2.5H9M1 6.5h2.5V9M9 6.5H6.5V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                <path d="M1 3.5V1h2.5M6.5 1H9v2.5M9 6.5V9H6.5M3.5 9H1V6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M3 7L1 9M7 3l2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Chart canvas + overlay ─────────────────────────────────────────── */}
      <div className="relative w-full" style={{ height: chartHeight }}>
        <div ref={chartContainerRef} className="absolute inset-0" />
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
        />
      </div>

      {/* ── Drag-to-resize handle ─────────────────────────────────────────── */}
      <div
        onMouseDown={startResize}
        title="Drag to resize chart"
        className="group relative w-full h-2.5 cursor-ns-resize flex items-center justify-center mt-0.5"
      >
        <div className="w-12 h-0.5 rounded-full bg-rule group-hover:bg-gold/40 transition-colors" />
      </div>

      {isExpanded && (
        <p className="text-[9px] text-text-tertiary/40 text-right mt-1 normal-case">
          {chartHeight}px · Esc to reset · drag handle to resize
        </p>
      )}
    </div>
  );
}
