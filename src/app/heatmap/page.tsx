'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, fmt, fmtPct, dirColor, type Signal, type Derivatives } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type VPLabel = 'STRONG' | 'MODERATE' | 'NEUTRAL' | 'AGAINST';

type HeatCell = Signal & { derivatives?: Derivatives | null };

// ── Colour maps ───────────────────────────────────────────────────────────────

const VP_BG: Record<VPLabel, string> = {
  STRONG:   'bg-long/20  border-long/40',
  MODERATE: 'bg-gold/10  border-gold/30',
  NEUTRAL:  'bg-rule/30  border-rule',
  AGAINST:  'bg-short/15 border-short/40',
};

const VP_BADGE: Record<VPLabel, string> = {
  STRONG:   'bg-long/20 text-long-strong border-long/40',
  MODERATE: 'bg-gold/10 text-gold-400 border-gold/30',
  NEUTRAL:  'bg-rule/20 text-text-tertiary border-rule',
  AGAINST:  'bg-short/15 text-short-strong border-short/40',
};

const VP_GLOW: Record<VPLabel, string> = {
  STRONG:   'shadow-[0_0_20px_rgba(var(--color-long)/0.15)]',
  MODERATE: 'shadow-[0_0_16px_rgba(var(--color-gold)/0.12)]',
  NEUTRAL:  '',
  AGAINST:  'shadow-[0_0_20px_rgba(var(--color-short)/0.12)]',
};

// ── Filter / sort state ───────────────────────────────────────────────────────

type FilterVP = 'all' | VPLabel;
type FilterDir = 'all' | 'long' | 'short';
type SortKey  = 'vp_score' | 'score' | 'symbol';

// ── Main component ────────────────────────────────────────────────────────────

export default function HeatmapPage() {
  const { data, isLoading } = useSWR('/api/signals', fetcher, {
    refreshInterval: 60_000,
  });

  const [filterVP,  setFilterVP]  = useState<FilterVP>('all');
  const [filterDir, setFilterDir] = useState<FilterDir>('all');
  const [sortKey,   setSortKey]   = useState<SortKey>('vp_score');
  const [modeFilter, setModeFilter] = useState<'all' | 'intraday' | 'swing'>('all');

  const raw: HeatCell[] = Array.isArray(data) ? data : (data?.signals ?? []);

  // Filter
  const filtered = raw.filter((s) => {
    if (s.direction === 'none') return false;
    if (filterDir !== 'all' && s.direction !== filterDir) return false;
    if (modeFilter !== 'all' && s.mode !== modeFilter) return false;
    if (filterVP !== 'all') {
      const label = s.derivatives?.vp_label;
      if (label !== filterVP) return false;
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'vp_score') {
      return (b.derivatives?.vp_score ?? -99) - (a.derivatives?.vp_score ?? -99);
    }
    if (sortKey === 'score') return b.score - a.score;
    return a.symbol.localeCompare(b.symbol);
  });

  // Stats
  const strongCount   = filtered.filter(s => s.derivatives?.vp_label === 'STRONG').length;
  const againstCount  = filtered.filter(s => s.derivatives?.vp_label === 'AGAINST').length;
  const longCount     = filtered.filter(s => s.direction === 'long').length;
  const shortCount    = filtered.filter(s => s.direction === 'short').length;

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-4 mb-6 rise rise-1">
        <div>
          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-text-tertiary hover:text-gold mb-2 inline-block link-underline"
          >
            ← chamber
          </Link>
          <h1 className="font-display text-5xl text-text-primary mt-1 leading-none">
            Heatmap
          </h1>
          <p className="text-text-tertiary text-sm mt-2">
            Vol × Position confluence across all live signals
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 text-center">
          <StatPill label="STRONG" value={strongCount} color="text-long" />
          <StatPill label="AGAINST" value={againstCount} color="text-short" />
          <StatPill label="▲ Long" value={longCount} color="text-long" />
          <StatPill label="▼ Short" value={shortCount} color="text-short" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6 rise rise-2">
        {/* VP filter */}
        <div className="flex items-center gap-1 bg-canvas-raised border border-rule rounded-sm p-1">
          {(['all', 'STRONG', 'MODERATE', 'NEUTRAL', 'AGAINST'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterVP(v)}
              className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-sm transition-colors ${
                filterVP === v
                  ? 'bg-gold/15 text-gold-400'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {v === 'all' ? 'All VP' : v}
            </button>
          ))}
        </div>

        {/* Direction filter */}
        <div className="flex items-center gap-1 bg-canvas-raised border border-rule rounded-sm p-1">
          {(['all', 'long', 'short'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setFilterDir(d)}
              className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-sm transition-colors ${
                filterDir === d
                  ? 'bg-gold/15 text-gold-400'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {d === 'all' ? 'All' : d === 'long' ? '▲ Long' : '▼ Short'}
            </button>
          ))}
        </div>

        {/* Mode filter */}
        <div className="flex items-center gap-1 bg-canvas-raised border border-rule rounded-sm p-1">
          {(['all', 'intraday', 'swing'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModeFilter(m)}
              className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-sm transition-colors ${
                modeFilter === m
                  ? 'bg-gold/15 text-gold-400'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {m === 'all' ? 'All modes' : m}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto bg-canvas-raised border border-rule rounded-sm p-1">
          <span className="px-2 text-[10px] uppercase tracking-widest text-text-tertiary">Sort:</span>
          {([['vp_score', 'VP Score'], ['score', 'Signal Score'], ['symbol', 'Symbol']] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-3 py-1 text-[11px] rounded-sm transition-colors ${
                sortKey === k
                  ? 'bg-gold/15 text-gold-400'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="h-36 bg-canvas-raised border border-rule rounded-sm animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="font-display-italic text-text-secondary text-xl mb-2">No signals match</div>
          <p className="text-text-tertiary text-sm">Adjust filters or run a scan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 rise rise-3">
          {sorted.map((s) => (
            <HeatCard key={`${s.id}-${s.mode}`} signal={s} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 pt-6 border-t border-rule-faint flex flex-wrap items-center gap-6 text-[11px] text-text-tertiary rise rise-4">
        <span className="uppercase tracking-widest">VP Legend:</span>
        {(['STRONG', 'MODERATE', 'NEUTRAL', 'AGAINST'] as const).map((v) => (
          <span key={v} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border ${VP_BADGE[v]}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {v}
          </span>
        ))}
        <span className="ml-4 text-text-tertiary/60">Card size = signal score</span>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`font-display text-3xl tabular ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">{label}</div>
    </div>
  );
}

function HeatCard({ signal: s }: { signal: HeatCell }) {
  const d   = s.derivatives;
  const vp  = (d?.vp_label ?? 'NEUTRAL') as VPLabel;
  const sym = s.symbol.replace('/USDT:USDT', '').replace('/USDT', '');

  // Card size proportional to score (min 120px, max 160px)
  const heightPx = 128 + Math.round((s.score / 100) * 40);

  const ep         = (s.features as any)?.entry_plan || {};
  const validity   = ep.validity || 'none';
  const validColor =
    validity === 'active'         ? 'bg-long'    :
    validity === 'pending_retest' ? 'bg-neutral'  :
    validity === 'expired_too_far' || validity === 'invalidated' ? 'bg-short' : 'bg-text-tertiary';

  const vpScore = d?.vp_score ?? null;

  return (
    <Link
      href={`/symbol/${encodeURIComponent(s.symbol)}?mode=${s.mode}`}
      className={`group relative flex flex-col justify-between p-3.5 rounded-sm border transition-all
        duration-200 hover:scale-[1.02] hover:z-10 overflow-hidden
        ${VP_BG[vp]} ${VP_GLOW[vp]}`}
      style={{ height: `${heightPx}px` }}
    >
      {/* Subtle background score bar (vertical fill) */}
      <div
        className="absolute bottom-0 left-0 right-0 opacity-10 transition-all duration-700"
        style={{
          height: `${s.score}%`,
          background: s.direction === 'long'
            ? 'linear-gradient(to top, rgba(var(--color-long), 0.4), transparent)'
            : 'linear-gradient(to top, rgba(var(--color-short), 0.4), transparent)',
        }}
      />

      {/* Top row: symbol + direction */}
      <div className="flex items-start justify-between relative z-10">
        <div>
          <div className={`text-base font-medium text-text-primary group-hover:text-gold-400 transition-colors leading-tight`}>
            {sym}
          </div>
          <div className="text-[10px] text-text-tertiary mt-0.5">{s.mode}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[10px] font-medium capitalize ${dirColor(s.direction)}`}>
            {s.direction === 'long' ? '▲' : '▼'} {s.direction}
          </span>
          {/* Entry validity dot */}
          <span className={`w-1.5 h-1.5 rounded-full ${validColor}`} title={validity} />
        </div>
      </div>

      {/* Middle: VP score */}
      <div className="relative z-10 my-auto">
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm border text-[10px] font-mono font-medium ${VP_BADGE[vp]}`}>
          VP {vpScore !== null ? (vpScore >= 0 ? `+${vpScore}` : `${vpScore}`) : '—'}
        </div>
      </div>

      {/* Bottom: signal score + OI */}
      <div className="relative z-10 flex items-end justify-between">
        <div>
          <div className="font-mono text-xs tabular text-text-primary">
            {Math.round(s.score)}<span className="text-text-tertiary">/100</span>
          </div>
          {d?.oi_change_24h_pct != null && (
            <div className={`text-[9px] tabular ${
              d.oi_change_24h_pct < -3 ? 'text-long' :
              d.oi_change_24h_pct > 5  ? 'text-short' : 'text-text-tertiary'
            }`}>
              OI {d.oi_change_24h_pct > 0 ? '+' : ''}{d.oi_change_24h_pct.toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] tabular text-text-secondary">
            {fmt(s.last_price, 6)}
          </div>
          {d?.funding_rate_pct != null && (
            <div className={`text-[9px] tabular ${
              d.funding_rate_pct < -0.02 ? 'text-long' :
              d.funding_rate_pct > 0.05  ? 'text-short' : 'text-text-tertiary'
            }`}>
              F{d.funding_rate_pct > 0 ? '+' : ''}{d.funding_rate_pct.toFixed(3)}%
            </div>
          )}
        </div>
      </div>

      {/* Squeeze flag ribbon */}
      {d?.squeeze_flag && d.squeeze_flag !== 'none' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold animate-pulse" />
      )}
    </Link>
  );
}
