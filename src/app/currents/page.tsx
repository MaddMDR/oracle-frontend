'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, post, fmt, Sector , fmtTs} from '@/lib/api';
import { useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCap(v: number | null): string {
  if (!v) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

function ZBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
  const isPos = value >= 0;
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-24 h-1.5 bg-rule rounded-full overflow-hidden flex">
        {isPos ? (
          <>
            <div className="w-1/2" />
            <div
              className="h-full rounded-full"
              style={{ width: `${pct * 50}%`, background: 'rgba(34,197,94,0.8)' }}
            />
          </>
        ) : (
          <>
            <div className="flex-1 flex justify-end">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct * 50}%`, background: 'rgba(239,68,68,0.7)' }}
              />
            </div>
            <div className="w-1/2" />
          </>
        )}
      </div>
      <span className={`tabular text-sm font-medium w-12 text-right ${isPos ? 'text-long' : 'text-short'}`}>
        {value > 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

// ── CoinGecko → curated sector ID mapping ─────────────────────────────────────

const CG_KEYWORDS: Array<{ keys: string[]; id: string }> = [
  { keys: ['layer-1', 'layer 1', ' l1', 'smart-contract-platform'],      id: 'layer1'        },
  { keys: ['layer-2', 'layer 2', ' l2', 'rollup', 'scaling', 'zk-'],    id: 'layer2'        },
  { keys: ['perpetual', 'perp', 'decentralized-exchange', ' dex'],       id: 'dex_perp'      },
  { keys: ['defi', 'decentralized-finance', 'lending', 'yield'],         id: 'defi'          },
  { keys: ['artificial-intelligence', ' ai ', 'ai-big', 'agent', 'machine-learn', 'large-language'], id: 'ai_agents' },
  { keys: ['meme', 'dog-themed', 'cat-themed', 'frog'],                  id: 'meme'          },
  { keys: ['gaming', 'gamefi', 'play-to-earn', 'metaverse', 'nft-game'], id: 'gamefi'        },
  { keys: ['real-world-asset', 'rwa', 'tokenized'],                      id: 'rwa'           },
  { keys: ['oracle', 'data-feed', 'data feed'],                          id: 'oracle'        },
  { keys: ['liquid-staking', 'liquid staking', 'lst', 'restaking'],      id: 'liquid_staking'},
  { keys: ['bitcoin-ecosystem', 'ordinal', 'btc-l2', 'rune', 'bitcoin ecosystem'], id: 'btc_ecosystem' },
  { keys: ['cosmos', 'ibc'],                                              id: 'cosmos'        },
  { keys: ['solana-ecosystem', 'solana ecosystem'],                       id: 'solana_eco'    },
  { keys: ['storage', 'decentralized-storage'],                          id: 'storage'       },
  { keys: ['infrastructure', 'depin', 'physical-infrastructure', 'iot'], id: 'depin'         },
  { keys: ['privacy', 'private', 'anonymity', 'zero-knowledge-privacy'], id: 'privacy'       },
  { keys: ['proof-of-work', 'proof of work', 'mining', ' pow'],          id: 'pow'           },
];

function findCuratedId(cg_id: string, cg_name: string): string | null {
  const hay = `${cg_id} ${cg_name}`.toLowerCase();
  for (const { keys, id } of CG_KEYWORDS) {
    if (keys.some((k) => hay.includes(k))) return id;
  }
  return null;
}

// ── Coin drill-down types ─────────────────────────────────────────────────────

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

type SectorDetailData = {
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
    std_change_pct: number;
    threshold_band: number;
    coins_tracked: number;
    coins_pumped: number;
    coins_lagging: number;
    coins_neutral: number;
  };
};

const STATUS_CFG: Record<CoinStatus, { label: string; color: string; bg: string; dot: string }> = {
  lagging: { label: 'Belum Terbang',  color: 'text-amber-400',    bg: 'border-amber-400/25 bg-amber-400/5',   dot: 'bg-amber-400'         },
  neutral: { label: 'Neutral',        color: 'text-text-secondary', bg: 'border-rule-faint bg-canvas-raised/50', dot: 'bg-text-tertiary'  },
  pumped:  { label: 'Sudah Terbang',  color: 'text-emerald-400',  bg: 'border-emerald-400/25 bg-emerald-400/5', dot: 'bg-emerald-400'   },
  unknown: { label: 'No Data',        color: 'text-text-tertiary', bg: 'border-rule-faint/50 bg-canvas-raised/30', dot: 'bg-text-tertiary/40' },
};

function chgColor(v: number | null): string {
  if (v === null) return 'text-text-tertiary';
  return v > 0 ? 'text-long' : v < 0 ? 'text-short' : 'text-text-secondary';
}

// ── Coin row ──────────────────────────────────────────────────────────────────

function CoinRow({ c }: { c: CoinEntry }) {
  const cfg = STATUS_CFG[c.status];
  return (
    <Link
      href={`/coin/${c.ticker}`}
      className={`group grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-x-3
                  rounded-sm border px-3 py-2.5 hover:border-gold/30 transition-all duration-150 ${cfg.bg}`}
    >
      {/* Status dot */}
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />

      {/* Ticker */}
      <div className="min-w-0">
        <div className="font-mono font-semibold text-sm text-text-primary group-hover:text-gold-400 transition-colors">
          {c.ticker}
        </div>
      </div>

      {/* Price */}
      <div className="text-right w-24">
        <div className="text-xs text-text-secondary font-mono">
          {c.last_price !== null ? fmt(c.last_price) : '—'}
        </div>
      </div>

      {/* 24h change */}
      <div className={`text-right w-16 font-mono text-sm font-semibold ${chgColor(c.change_pct)}`}>
        {c.change_pct !== null ? `${c.change_pct > 0 ? '+' : ''}${c.change_pct.toFixed(2)}%` : '—'}
      </div>

      {/* vs sector avg */}
      <div className={`text-right w-20 text-xs font-mono ${chgColor(c.vs_sector_avg)}`}>
        {c.vs_sector_avg !== null
          ? `${c.vs_sector_avg > 0 ? '+' : ''}${c.vs_sector_avg.toFixed(2)}% vs avg`
          : '—'}
      </div>

      {/* Volume */}
      <div className="text-right w-20 text-xs text-text-tertiary">
        {c.volume_usd_m !== null ? `$${c.volume_usd_m}M` : '—'}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-sm border ${cfg.bg} ${cfg.color} whitespace-nowrap`}>
          {cfg.label}
        </span>
        {c.signal && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border whitespace-nowrap
            ${c.signal.direction === 'long'
              ? 'bg-long/10 border-long/25 text-long'
              : 'bg-short/10 border-short/25 text-short'}`}>
            {c.signal.direction.toUpperCase()} {Math.round(c.signal.score)}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Sector detail slide-in panel ──────────────────────────────────────────────

function SectorPanel({ sectorId, onClose }: { sectorId: string; onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | CoinStatus>('all');

  const { data, isLoading } = useSWR<SectorDetailData>(
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
      <div className="relative z-10 h-full w-full max-w-2xl bg-canvas-deep border-l border-rule
                      flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-rule-faint shrink-0">
          <span className="text-2xl">{data?.icon ?? '⏳'}</span>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl text-text-primary truncate">
              {data?.name ?? 'Loading…'}
            </h2>
            {data?.desc && (
              <p className="text-xs text-text-tertiary truncate mt-0.5">{data.desc}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-text-tertiary text-sm animate-pulse">Fetching live data…</div>
          </div>
        ) : data ? (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-4 divide-x divide-rule-faint border-b border-rule-faint shrink-0">
              {[
                {
                  label: 'Avg 24h',
                  value: `${data.stats.avg_change_pct > 0 ? '+' : ''}${data.stats.avg_change_pct.toFixed(1)}%`,
                  color: chgColor(data.stats.avg_change_pct),
                },
                { label: 'Pumped 🚀',      value: data.stats.coins_pumped,  color: 'text-long'          },
                { label: 'Belum Terbang',  value: data.stats.coins_lagging, color: 'text-amber-400'     },
                {
                  label: 'Threshold',
                  value: `±${data.stats.threshold_band?.toFixed(1) ?? '—'}%`,
                  color: 'text-text-tertiary',
                },
              ].map((s) => (
                <div key={s.label} className="bg-canvas-raised/60 px-4 py-3 text-center">
                  <div className={`text-xl font-bold font-display ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Leader note */}
            {data.reference.length > 0 && (
              <div className="px-5 py-2 border-b border-rule-faint shrink-0 text-xs text-text-tertiary bg-gold/[0.03]">
                <span className="text-gold/70 mr-1">◈</span>
                Leader sektor:{' '}
                {data.reference.map((r) => (
                  <span key={r} className="font-mono text-gold/90 mx-1 font-medium">{r}</span>
                ))}
                — kalau ini sudah terbang, cek yang belum
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-1 px-4 py-2 border-b border-rule-faint shrink-0">
              {(['all', 'lagging', 'neutral', 'pumped'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-sm text-xs font-medium transition-all ${
                    filter === f
                      ? 'bg-gold/15 text-gold-400 border border-gold/20'
                      : 'text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {f === 'all'     ? `Semua (${coins.length})`
                  : f === 'lagging' ? `Belum Terbang (${data.stats.coins_lagging})`
                  : f === 'neutral' ? `Neutral (${data.stats.coins_neutral})`
                  : `Pumped (${data.stats.coins_pumped})`}
                </button>
              ))}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-x-3
                            px-3 pb-1.5 pt-2 text-[10px] text-text-tertiary uppercase tracking-wider shrink-0 px-4">
              <div className="w-1.5" />
              <div>Coin</div>
              <div className="text-right w-24">Price</div>
              <div className="text-right w-16">24h</div>
              <div className="text-right w-20">vs Avg</div>
              <div className="text-right w-20">Volume</div>
              <div>Status</div>
            </div>

            {/* Coin list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-1">
              {shown.length === 0 ? (
                <div className="text-center py-10 text-text-tertiary text-sm">
                  Tidak ada coin dengan filter ini
                </div>
              ) : (
                shown.map((c) => <CoinRow key={c.ticker} c={c} />)
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="text-text-tertiary text-sm">
              Sektor ini belum ada di curated list.
            </div>
            <p className="text-text-tertiary/60 text-xs max-w-xs">
              Coba gunakan halaman <span className="text-gold/70">/sectors</span> untuk melihat
              semua sektor yang sudah terkurasi.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SoSoValue sector name → CoinGecko-style mapping ──────────────────────────
const SOSO_TO_CG: Record<string, string[]> = {
  'Layer1':      ['layer 1', 'layer-1', 'smart-contract'],
  'Layer2':      ['layer 2', 'layer-2', 'rollup', 'scaling'],
  'DeFi':        ['defi', 'decentralized-finance', 'lending', 'yield'],
  'Meme':        ['meme', 'dog-themed', 'cat-themed'],
  'AI':          ['artificial-intelligence', 'ai agent', 'machine-learn'],
  'GameFi':      ['gaming', 'gamefi', 'play-to-earn'],
  'RWA':         ['real-world-asset', 'rwa', 'tokenized'],
  'DePIN':       ['depin', 'physical-infrastructure', 'iot'],
  'NFT':         ['nft', 'non-fungible'],
  'SocialFi':    ['social', 'socialfi'],
  'PayFi':       ['payment', 'payfi'],
};

function matchSosoSector(cgName: string): string | null {
  const hay = cgName.toLowerCase();
  for (const [sosoName, keys] of Object.entries(SOSO_TO_CG)) {
    if (keys.some((k) => hay.includes(k))) return sosoName;
  }
  return null;
}

function fmtFlow(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${(abs / 1e3).toFixed(0)}K`;
}

// ── ETF Flow widget ───────────────────────────────────────────────────────────
function EtfFlowWidget({ symbol }: { symbol: 'BTC' | 'ETH' }) {
  const { data } = useSWR<{ items: any[] }>(
    `/api/sosovalue/etf-flow?symbol=${symbol}&days=7`,
    fetcher,
    { refreshInterval: 3_600_000 },
  );

  const items = data?.items ?? [];
  // Deduplicate by date, keep latest
  const byDate: Record<string, any> = {};
  for (const it of items) { byDate[it.date] = it; }
  const days = Object.values(byDate).sort((a, b) => a.date > b.date ? 1 : -1).slice(-7);

  const latest = days[days.length - 1];
  const todayFlow = latest?.total_net_inflow ?? null;
  const totalAum  = latest?.total_net_assets ?? null;
  const maxAbs    = days.length ? Math.max(...days.map((d) => Math.abs(d.total_net_inflow ?? 0)), 1) : 1;

  return (
    <div className="bg-canvas-raised border border-rule rounded-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-widest text-text-tertiary">{symbol} ETF Flow</div>
        {totalAum && (
          <div className="text-[10px] text-text-tertiary">AUM {fmtFlow(totalAum).replace('+','')}</div>
        )}
      </div>
      {todayFlow !== null ? (
        <>
          <div className={`font-display text-2xl font-medium ${todayFlow >= 0 ? 'text-long' : 'text-short'}`}>
            {fmtFlow(todayFlow)}
          </div>
          <div className="text-[10px] text-text-tertiary mt-0.5">
            {latest?.date} · {todayFlow >= 0 ? 'net inflow' : 'net outflow'}
          </div>
          {/* 7-day bar chart */}
          <div className="flex items-end gap-0.5 mt-3 h-8">
            {days.map((d, i) => {
              const pct = Math.abs(d.total_net_inflow ?? 0) / maxAbs;
              const isPos = (d.total_net_inflow ?? 0) >= 0;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${d.date}: ${fmtFlow(d.total_net_inflow)}`}>
                  <div
                    className={`rounded-sm ${isPos ? 'bg-long/60' : 'bg-short/60'}`}
                    style={{ height: `${Math.max(pct * 100, 8)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="text-[9px] text-text-tertiary/50 mt-1">7 hari terakhir</div>
        </>
      ) : (
        <div className="text-text-tertiary text-sm">—</div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Currents() {
  const { data, mutate } = useSWR<{ sectors: Sector[]; computed_at: string; period: string }>(
    '/api/sector', fetcher, { refreshInterval: 300_000, shouldRetryOnError: false },
  );
  const { data: sosoSectors } = useSWR<{ items: any[] }>(
    '/api/sosovalue/sector-spotlight', fetcher, { refreshInterval: 900_000 },
  );
  const { data: sosoRoi } = useSWR<{ items: any[] }>(
    '/api/sosovalue/sector-roi', fetcher, { refreshInterval: 3_600_000 },
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [activeSector, setActiveSector] = useState<string | null>(null);

  // Build SoSoValue lookup: sosoName → {change_pct_24h, marketcap_dom}
  const sosoMap: Record<string, { chg: number; dom: number }> = {};
  for (const s of sosoSectors?.items ?? []) {
    sosoMap[s.name] = { chg: s.change_pct_24h * 100, dom: s.marketcap_dom * 100 };
  }

  // Build ROI lookup: sosoName → {roi_7d, roi_30d, snapshots_available}
  const roiMap: Record<string, { roi_7d: number | null; roi_30d: number | null; snaps: number }> = {};
  for (const r of sosoRoi?.items ?? []) {
    roiMap[r.name] = { roi_7d: r.roi_7d, roi_30d: r.roi_30d, snaps: r.snapshots_available ?? 0 };
  }

  async function refresh() {
    setRefreshing(true);
    setError('');
    try {
      const r = await post('/api/sector/refresh');
      await mutate();
      if (r?.updated === 0) {
        setError('CoinGecko returned 0 sectors — may be rate-limited (429). Try again in ~60s.');
      }
    } catch (e: any) {
      setError(`Refresh failed: ${e.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  const sectors = data?.sectors ?? [];
  const maxAbs  = sectors.length
    ? Math.max(...sectors.map((s) => Math.abs(s.rs_z_24h)), 0.01)
    : 1;

  const leading = sectors.filter((s) => s.rs_z_24h >= 0);
  const lagging = sectors.filter((s) => s.rs_z_24h < 0);

  function openSector(s: Sector) {
    const curatedId = findCuratedId(s.id ?? '', s.name);
    if (curatedId) setActiveSector(curatedId);
    // No curated match → silently ignore; row shows no arrow indicator
  }

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-10 rise rise-1">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold mb-3">Sectors</div>
          <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
            Sector <span className="font-display-italic text-gold">rotation</span>
          </h1>
          <p className="text-text-secondary max-w-2xl">
            Relative strength of crypto sectors vs the market median — 24h move, z-scored.
            {data?.computed_at && (
              <span className="text-text-tertiary ml-2 text-xs">
                · snapshot {fmtTs(data.computed_at)}
              </span>
            )}
          </p>
          <p className="text-text-tertiary text-xs mt-2">
            Klik sektor untuk melihat koin-koin di dalamnya — identifikasi yang belum terbang.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="px-5 py-2.5 text-sm font-medium bg-canvas-raised border border-rule text-text-secondary hover:text-text-primary hover:border-rule-strong rounded-sm disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh feed'}
          </button>
          {error && (
            <p className="text-[11px] text-short max-w-xs text-right">{error}</p>
          )}
        </div>
      </header>

      {!data ? (
        <div className="bg-canvas-raised border border-rule rounded-sm px-6 py-16 text-center rise rise-2">
          <div className="font-display-italic text-text-secondary text-lg">No sector data yet</div>
          <p className="text-text-tertiary text-sm mt-2">
            Click <span className="text-gold">↻ Refresh feed</span> to pull latest sector data from CoinGecko.
          </p>
        </div>
      ) : sectors.length === 0 ? (
        <div className="bg-canvas-raised border border-rule rounded-sm px-6 py-16 text-center rise rise-2">
          <div className="font-display-italic text-text-secondary text-lg">Sectors empty</div>
          <p className="text-text-tertiary text-sm mt-2">Data may have loaded but returned 0 sectors. Try refreshing.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Summary strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 rise rise-2">
            <div className="bg-canvas-raised border border-rule rounded-sm px-5 py-4">
              <div className="text-xs uppercase tracking-widest text-text-tertiary mb-1">Total sectors</div>
              <div className="font-display text-3xl text-text-primary">{sectors.length}</div>
            </div>
            <div className="bg-canvas-raised border-l-2 border-l-long border-r border-y border-rule rounded-sm px-5 py-4">
              <div className="text-xs uppercase tracking-widest text-text-tertiary mb-1">Leading sectors</div>
              <div className="font-display text-3xl text-long">{leading.length}</div>
              <div className="text-xs text-text-tertiary mt-1 truncate">
                {leading[0]?.name ?? '—'}
                {leading[1] ? `, ${leading[1].name}` : ''}
              </div>
            </div>
            <div className="bg-canvas-raised border-l-2 border-l-short border-r border-y border-rule rounded-sm px-5 py-4">
              <div className="text-xs uppercase tracking-widest text-text-tertiary mb-1">Lagging sectors</div>
              <div className="font-display text-3xl text-short">{lagging.length}</div>
              <div className="text-xs text-text-tertiary mt-1 truncate">
                {lagging[lagging.length - 1]?.name ?? '—'}
                {lagging[lagging.length - 2] ? `, ${lagging[lagging.length - 2].name}` : ''}
              </div>
            </div>
            {/* ETF Institutional Flow */}
            <EtfFlowWidget symbol="BTC" />
            <EtfFlowWidget symbol="ETH" />
          </div>

          {/* Main table */}
          <section className="bg-canvas-raised border border-rule rounded-sm overflow-hidden rise rise-3">
            <header className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-widest text-text-tertiary">
                All sectors · ranked by RS z-score (24h)
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-text-tertiary">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-long/70 inline-block" />Leading
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-short/70 inline-block" />Lagging
                  </span>
                </div>
                <span className="text-[10px] text-text-tertiary/60 border border-rule-faint px-2 py-0.5 rounded-sm">
                  klik untuk drill-down →
                </span>
              </div>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-text-tertiary bg-canvas-deep/40">
                    <th className="text-left px-4 py-2.5 w-10">#</th>
                    <th className="text-left px-2 py-2.5">Sector</th>
                    <th className="text-left px-2 py-2.5">Top coins</th>
                    <th className="text-right px-4 py-2.5">Market cap</th>
                    <th className="text-right px-4 py-2.5">24h Vol</th>
                    <th className="text-right px-4 py-2.5 w-12">24h Δ</th>
                    <th className="text-right px-3 py-2.5 w-16" title="Marketcap dominance dari SoSoValue">Dom%</th>
                    <th className="text-right px-3 py-2.5 w-16" title="7-day sector index ROI (synthetic, from hourly snapshots)">7d ROI</th>
                    <th className="text-right px-3 py-2.5 w-16" title="30-day sector index ROI (synthetic, from hourly snapshots)">1m ROI</th>
                    <th className="text-right px-4 py-2.5 w-48">RS z-score</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((s, idx) => {
                    const isLeading  = s.rs_z_24h >= 0;
                    const isTop3     = idx < 3;
                    const isBot3     = idx >= sectors.length - 3;
                    const hasCurated = !!findCuratedId(s.id ?? '', s.name);
                    const sosoName   = matchSosoSector(s.name);
                    const sosoData   = sosoName ? sosoMap[sosoName] : null;
                    const roiData    = sosoName ? roiMap[sosoName] : null;
                    return (
                      <tr
                        key={s.id ?? s.name}
                        onClick={() => hasCurated && openSector(s)}
                        className={`border-t border-rule-faint transition-colors group
                          ${hasCurated ? 'cursor-pointer hover:bg-gold/[0.04]' : 'cursor-default opacity-80'}
                          ${isTop3 ? 'bg-long/[0.03]' : isBot3 ? 'bg-short/[0.03]' : ''}`}
                      >
                        {/* Rank */}
                        <td className="px-4 py-3 text-text-tertiary tabular text-xs">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-sm text-[10px] font-medium ${
                            isTop3 ? 'bg-long/20 text-long' :
                            isBot3 ? 'bg-short/20 text-short' :
                            'text-text-tertiary'
                          }`}>
                            {s.rank}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-1 h-4 rounded-full flex-shrink-0 ${isLeading ? 'bg-long/60' : 'bg-short/60'}`} />
                            <span className={`font-medium text-sm leading-snug transition-colors ${hasCurated ? 'text-text-primary group-hover:text-gold-400' : 'text-text-secondary'}`}>
                              {s.name}
                            </span>
                            {hasCurated
                              ? <span className="text-[9px] text-text-tertiary/50 group-hover:text-gold/50 transition-colors">→</span>
                              : <span className="text-[9px] text-text-tertiary/30" title="Sektor ini belum ada di curated list">·</span>
                            }
                          </div>
                        </td>

                        {/* Top coins */}
                        <td className="px-2 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {(s.top_3_coins ?? []).length > 0 ? (
                              s.top_3_coins.map((coin) => (
                                <span
                                  key={coin}
                                  className="px-1.5 py-0.5 text-[10px] font-medium bg-canvas-inset border border-rule rounded-sm text-text-secondary tabular"
                                >
                                  {coin}
                                </span>
                              ))
                            ) : (
                              <span className="text-text-tertiary text-xs">—</span>
                            )}
                          </div>
                        </td>

                        {/* Market cap */}
                        <td className="px-4 py-3 text-right text-text-secondary tabular text-xs">
                          {fmtCap(s.market_cap_usd)}
                        </td>

                        {/* Volume */}
                        <td className="px-4 py-3 text-right text-text-tertiary tabular text-xs">
                          {fmtCap(s.volume_24h_usd)}
                        </td>

                        {/* 24h change */}
                        <td className={`px-4 py-3 text-right tabular text-sm font-medium ${s.price_change_24h_pct >= 0 ? 'text-long' : 'text-short'}`}>
                          {s.price_change_24h_pct >= 0 ? '+' : ''}{s.price_change_24h_pct.toFixed(2)}%
                        </td>

                        {/* SoSoValue dominance */}
                        <td className="px-3 py-3 text-right tabular text-xs" title={sosoData ? `SoSoValue: ${sosoData.chg >= 0 ? '+' : ''}${sosoData.chg.toFixed(2)}% 24h` : 'No SoSoValue match'}>
                          {sosoData ? (
                            <span className="text-text-tertiary">{sosoData.dom.toFixed(2)}%</span>
                          ) : (
                            <span className="text-text-tertiary/30">—</span>
                          )}
                        </td>

                        {/* 7d ROI */}
                        <td className="px-3 py-3 text-right tabular text-xs"
                            title={roiData?.snaps ? `Based on ${roiData.snaps} hourly snapshots` : 'Not enough history yet — accumulates hourly'}>
                          {roiData?.roi_7d != null ? (
                            <span className={`font-medium ${roiData.roi_7d >= 0 ? 'text-long' : 'text-short'}`}>
                              {roiData.roi_7d > 0 ? '+' : ''}{roiData.roi_7d.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-text-tertiary/30" title="Accumulating… check back in 7 days">~</span>
                          )}
                        </td>

                        {/* 30d ROI */}
                        <td className="px-3 py-3 text-right tabular text-xs"
                            title={roiData?.snaps ? `Based on ${roiData.snaps} hourly snapshots` : 'Not enough history yet'}>
                          {roiData?.roi_30d != null ? (
                            <span className={`font-medium ${roiData.roi_30d >= 0 ? 'text-long' : 'text-short'}`}>
                              {roiData.roi_30d > 0 ? '+' : ''}{roiData.roi_30d.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-text-tertiary/30" title="Accumulating… check back in 30 days">~</span>
                          )}
                        </td>

                        {/* RS z-score bar */}
                        <td className="px-4 py-3">
                          <ZBar value={s.rs_z_24h} maxAbs={maxAbs} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Reading guide */}
          <div className="bg-canvas-raised border-l-2 border-l-gold border-r border-y border-rule rounded-sm px-5 py-4 rise rise-4">
            <div className="text-xs uppercase tracking-widest text-gold mb-3">Reading sector rotation</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-text-secondary">
              <div>
                <span className="text-long font-bold block mb-1">Positive z-score</span>
                Sector is outperforming the crypto market median on a 24h basis. Capital may be rotating in.
              </div>
              <div>
                <span className="text-short font-bold block mb-1">Negative z-score</span>
                Sector is underperforming the median. Capital may be rotating out or sentiment is weak.
              </div>
              <div>
                <span className="text-gold font-bold block mb-1">Catch-up rotation</span>
                Klik sektor yang leading → lihat koin mana yang <em>Belum Terbang</em>.
                Laggard dalam sektor bullish = potensi catch-up trade.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Sector drill-down panel */}
      {activeSector && (
        <SectorPanel
          sectorId={activeSector}
          onClose={() => setActiveSector(null)}
        />
      )}
    </main>
  );
}
