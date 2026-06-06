'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, fmt, fmtPct } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type SectorMeta = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  coin_count: number;
  reference: string[];
};

type CoinStatus = 'pumped' | 'neutral' | 'lagging' | 'unknown';

type CoinEntry = {
  ticker: string;
  symbol: string;
  last_price: number | null;
  change_pct: number | null;
  volume_usd_m: number | null;
  in_market: boolean;
  vs_sector_avg: number | null;
  status: CoinStatus;
  signal: {
    score: number;
    direction: 'long' | 'short' | 'none';
    quality: string;
    action: string;
    mode: string;
  } | null;
};

type SectorDetail = {
  sector_id: string;
  name: string;
  icon: string;
  desc: string;
  reference: string[];
  coins: CoinEntry[];
  stats: {
    avg_change_pct: number;
    max_change_pct: number;
    min_change_pct: number;
    median_change_pct: number;
    coins_tracked: number;
    coins_pumped: number;
    coins_lagging: number;
    coins_neutral: number;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CoinStatus, { label: string; color: string; bg: string; dot: string }> = {
  lagging: { label: 'Belum Terbang',  color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/30',  dot: 'bg-amber-400' },
  neutral: { label: 'Neutral',        color: 'text-text-secondary', bg: 'bg-surface-2/60 border-border/30', dot: 'bg-text-tertiary' },
  pumped:  { label: 'Sudah Terbang',  color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', dot: 'bg-emerald-400' },
  unknown: { label: 'No Data',        color: 'text-text-tertiary', bg: 'bg-surface-2/40 border-border/20', dot: 'bg-text-tertiary/40' },
};

function chgColor(v: number | null): string {
  if (v === null) return 'text-text-tertiary';
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-text-secondary';
}

function chgBg(v: number | null): string {
  if (v === null) return '';
  if (v > 5) return 'bg-emerald-400/15';
  if (v > 0) return 'bg-emerald-400/8';
  if (v < -5) return 'bg-rose-400/15';
  if (v < 0) return 'bg-rose-400/8';
  return '';
}

// ── Sector card (grid) ────────────────────────────────────────────────────────

function SectorCard({ s, onClick }: { s: SectorMeta; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-xl border border-border/50 bg-surface-1/60
                 hover:border-accent/40 hover:bg-surface-2/80 transition-all duration-200
                 p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{s.icon}</span>
        <span className="text-xs text-text-tertiary border border-border/40 rounded px-1.5 py-0.5">
          {s.coin_count} coins
        </span>
      </div>
      <div>
        <div className="font-semibold text-text-primary group-hover:text-accent transition-colors">
          {s.name}
        </div>
        <div className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{s.desc}</div>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {s.reference.map((r) => (
          <span key={r} className="text-[10px] font-mono bg-accent/10 text-accent rounded px-1.5 py-0.5">
            {r}
          </span>
        ))}
        <span className="text-[10px] text-text-tertiary px-1 py-0.5">+more</span>
      </div>
    </button>
  );
}

// ── Coin row ──────────────────────────────────────────────────────────────────

function CoinRow({ c }: { c: CoinEntry }) {
  const cfg = STATUS_CONFIG[c.status];

  return (
    <Link
      href={`/symbol/${encodeURIComponent(c.symbol)}`}
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5
                  hover:border-accent/40 transition-all duration-150 ${cfg.bg}`}
    >
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

      {/* Ticker */}
      <div className="w-16 shrink-0">
        <div className="font-mono font-semibold text-sm text-text-primary group-hover:text-accent transition-colors">
          {c.ticker}
        </div>
      </div>

      {/* Price */}
      <div className="w-24 shrink-0 text-right">
        <div className="text-sm text-text-secondary font-mono">
          {c.last_price !== null ? fmt(c.last_price) : '—'}
        </div>
      </div>

      {/* 24h change */}
      <div className={`w-16 shrink-0 text-right font-mono text-sm font-semibold ${chgColor(c.change_pct)}`}>
        {c.change_pct !== null ? `${c.change_pct > 0 ? '+' : ''}${c.change_pct.toFixed(2)}%` : '—'}
      </div>

      {/* vs sector avg */}
      <div className={`w-20 shrink-0 text-right text-xs font-mono ${chgColor(c.vs_sector_avg)}`}>
        {c.vs_sector_avg !== null
          ? `${c.vs_sector_avg > 0 ? '+' : ''}${c.vs_sector_avg.toFixed(2)}% vs avg`
          : '—'}
      </div>

      {/* Volume */}
      <div className="w-20 shrink-0 text-right text-xs text-text-tertiary">
        {c.volume_usd_m !== null ? `$${c.volume_usd_m}M` : '—'}
      </div>

      {/* Status badge */}
      <div className="flex-1 flex items-center gap-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        {/* ORACLE signal badge */}
        {c.signal && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border
            ${c.signal.direction === 'long'
              ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
              : 'bg-rose-400/10 border-rose-400/30 text-rose-400'}`}>
            {c.signal.direction.toUpperCase()} {Math.round(c.signal.score)}
          </span>
        )}
      </div>

      {/* Arrow */}
      <span className="text-text-tertiary group-hover:text-accent transition-colors text-xs">→</span>
    </Link>
  );
}

// ── Sector detail panel ───────────────────────────────────────────────────────

function SectorDetail({ sectorId, onClose }: { sectorId: string; onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | CoinStatus>('all');
  const { data, isLoading } = useSWR<SectorDetail>(
    `/api/sector/${sectorId}/coins`,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const coins = data?.coins ?? [];
  const shown = filter === 'all' ? coins : coins.filter((c) => c.status === filter);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 h-full w-full max-w-2xl bg-bg border-l border-border/60
                      flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40 shrink-0">
          <span className="text-2xl">{data?.icon ?? '⏳'}</span>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl text-text-primary truncate">
              {data?.name ?? 'Loading…'}
            </h2>
            <p className="text-xs text-text-tertiary truncate">{data?.desc}</p>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors text-lg">✕</button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-text-tertiary text-sm animate-pulse">Fetching live data…</div>
          </div>
        ) : data ? (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-px bg-border/30 shrink-0">
              {[
                { label: 'Avg 24h', value: `${data.stats.avg_change_pct > 0 ? '+' : ''}${data.stats.avg_change_pct.toFixed(1)}%`, color: chgColor(data.stats.avg_change_pct) },
                { label: 'Pumped 🚀', value: data.stats.coins_pumped, color: 'text-emerald-400' },
                { label: 'Belum Terbang', value: data.stats.coins_lagging, color: 'text-amber-400' },
                { label: 'Tracked', value: data.stats.coins_tracked, color: 'text-text-secondary' },
              ].map((s) => (
                <div key={s.label} className="bg-surface-1/80 px-4 py-3 text-center">
                  <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Reference coins note */}
            {data.reference.length > 0 && (
              <div className="px-6 py-2 border-b border-border/30 shrink-0 text-xs text-text-tertiary">
                Leader sektor: {data.reference.map((r) => (
                  <span key={r} className="font-mono text-accent mx-1">{r}</span>
                ))} — kalau ini sudah terbang, cek coin lain yang belum
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-1 px-4 py-2.5 border-b border-border/30 shrink-0">
              {(['all', 'lagging', 'neutral', 'pumped'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all
                    ${filter === f
                      ? 'bg-accent text-bg'
                      : 'text-text-tertiary hover:text-text-primary'}`}
                >
                  {f === 'all' ? `Semua (${coins.length})`
                    : f === 'lagging' ? `Belum Terbang (${data.stats.coins_lagging})`
                    : f === 'neutral' ? `Neutral (${data.stats.coins_neutral})`
                    : `Pumped (${data.stats.coins_pumped})`}
                </button>
              ))}
            </div>

            {/* Coin list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1.5">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-3 pb-1 text-[10px] text-text-tertiary uppercase tracking-wider">
                <div className="w-2 shrink-0" />
                <div className="w-16 shrink-0">Coin</div>
                <div className="w-24 shrink-0 text-right">Price</div>
                <div className="w-16 shrink-0 text-right">24h</div>
                <div className="w-20 shrink-0 text-right">vs Avg</div>
                <div className="w-20 shrink-0 text-right">Volume</div>
                <div className="flex-1">Status</div>
              </div>

              {shown.length === 0 ? (
                <div className="text-center py-8 text-text-tertiary text-sm">
                  Tidak ada coin dengan filter ini
                </div>
              ) : (
                shown.map((c) => <CoinRow key={c.ticker} c={c} />)
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SectorsPage() {
  const [activeSector, setActiveSector] = useState<string | null>(null);

  const { data: sectors, isLoading } = useSWR<SectorMeta[]>(
    '/api/sector/list',
    fetcher,
    { refreshInterval: 0 },   // static, no need to refresh
  );

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-10">
      {/* Header */}
      <header className="mb-10 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Sector Rotation</div>
        <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
          Coin <span className="font-display-italic text-gold">belum terbang</span>
        </h1>
        <p className="text-text-secondary max-w-2xl text-sm">
          Pilih sektor → lihat semua koin yang se-tema. Bandingkan mana yang sudah pump
          vs yang belum bergerak. Identifikasi laggard untuk catch-up trade.
        </p>
      </header>

      {/* Tip */}
      <div className="mb-6 flex items-start gap-2 bg-amber-400/5 border border-amber-400/20
                      rounded-lg px-4 py-3 text-xs text-amber-300/80">
        <span className="text-base shrink-0">💡</span>
        <span>
          <strong>Cara baca:</strong> Kalau HYPE (DEX/Perps) sudah terbang, buka sektornya
          dan lihat GMX, DYDX, SNX — mana yang belum gerak. Coin <em>Belum Terbang</em>
          punya potensi catch-up kalau sektornya sedang dalam narasi bullish.
        </span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-surface-1/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(sectors ?? []).map((s) => (
            <SectorCard
              key={s.id}
              s={s}
              onClick={() => setActiveSector(s.id)}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {activeSector && (
        <SectorDetail
          sectorId={activeSector}
          onClose={() => setActiveSector(null)}
        />
      )}
    </main>
  );
}
