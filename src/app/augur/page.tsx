'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, post, fmt } from '@/lib/api';

type AugurRow = {
  symbol: string;
  score: number;
  price: number;
  atr_pts: number;
  vol_pts: number;
  price_pts: number;
  vwap_pts: number;
  atr_ratio: number;
  vol_ratio: number;
  pct_from_ath: number;
  summary: string;
};

type SurgeRow = {
  symbol: string;
  score: number;
  price: number;
  regime: string;
  btc_ret20_pct: number;
  btc_ret60_pct: number;
  e20_slope_pct: number;
  ret60_pct: number;
  px_vs_e100_pct?: number;
  dist_hi90_pct?: number;
  vol_trend?: number;
  components?: {
    regime_pts: number;
    emerge_pts: number;
    anti_ext_pts: number;
    base_pts: number;
    vol_pts: number;
  };
  summary: string;
};

type Radar = {
  generated_at: string | null;
  augur: AugurRow[];
  surge: SurgeRow[];
};

function coinOf(symbol: string): string {
  return symbol.replace('/USDT:USDT', '').replace('/USDT', '').replace('/', '');
}

function scoreColor(score: number): string {
  if (score >= 50) return 'text-gold-400';
  if (score >= 30) return 'text-long';
  return 'text-text-secondary';
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="h-1.5 w-full bg-rule-faint rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          score >= 50 ? 'bg-gold' : score >= 30 ? 'bg-long' : 'bg-rule-strong'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PtChip({ label, value, on }: { label: string; value: number; on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] tracking-wide ${
        on ? 'bg-gold/10 text-gold-400' : 'bg-rule-faint/40 text-text-tertiary'
      }`}
    >
      {label}<span className="font-mono">{value}</span>
    </span>
  );
}

export default function AugurPage() {
  const [tab, setTab] = useState<'augur' | 'surge'>('augur');
  const [scanning, setScanning] = useState(false);
  const { data, mutate, isLoading } = useSWR<Radar>('/api/augur/radar', fetcher, {
    refreshInterval: 120000,
  });

  async function rescan() {
    setScanning(true);
    try {
      await post('/api/augur/scan?limit=80');
      await mutate();
    } finally {
      setScanning(false);
    }
  }

  const augur = data?.augur || [];
  const surge = data?.surge || [];
  const gen = data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—';

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="mb-6 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Signals · Radar</div>
        <h1 className="font-display text-5xl text-text-primary">
          AUG<span className="font-display-italic text-gold">UR</span>
          <span className="text-text-tertiary mx-3 font-display text-3xl">·</span>
          <span className="text-long">SURGE</span>
        </h1>
        <p className="text-text-secondary mt-2 max-w-2xl">
          Dua radar berbeda untuk dua jenis pump.{' '}
          <span className="text-gold-400">AUGUR</span> — deteksi koin yang bandar lagi ngumpulin:
          volume kering, ATR compressed, jauh dari ATH. Meledak dari dalam.{' '}
          <span className="text-long">SURGE</span> — ciri-ciri coin sebelum terbang (data-derived,
          OOS-validated): regime BTC mendukung, tren baru bangkit, BELUM extended, keluar dari base.
          Edge ada di bull; stand-down saat BTC lemah.
        </p>
      </header>

      {/* Tab + rescan bar */}
      <div className="flex items-center justify-between mb-4 rise rise-2">
        <div className="flex items-center gap-1 bg-canvas-inset/40 border border-rule rounded-sm p-1">
          <button
            onClick={() => setTab('augur')}
            className={`px-4 py-1.5 text-[12px] tracking-wide rounded-sm transition-all ${
              tab === 'augur'
                ? 'bg-gold/12 text-gold-400'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            ◈ AUGUR <span className="opacity-60 ml-1">coil ({augur.length})</span>
          </button>
          <button
            onClick={() => setTab('surge')}
            className={`px-4 py-1.5 text-[12px] tracking-wide rounded-sm transition-all ${
              tab === 'surge'
                ? 'bg-long/12 text-long'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            ⇡ SURGE <span className="opacity-60 ml-1">breakout ({surge.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-text-tertiary tracking-wide">Updated {gen}</span>
          <button
            onClick={rescan}
            disabled={scanning}
            className="px-3 py-1.5 text-[11px] tracking-wide rounded-sm border border-rule
                       text-text-secondary hover:text-text-primary hover:border-rule-strong
                       disabled:opacity-50 transition-colors"
          >
            {scanning ? 'Scanning…' : '↻ Rescan'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-canvas-raised border border-rule rounded-sm px-5 py-16 text-center rise rise-3">
          <div className="font-display-italic text-text-secondary text-lg">Sweeping the field…</div>
        </div>
      ) : tab === 'augur' ? (
        <AugurTable rows={augur} />
      ) : (
        <SurgeTable rows={surge} />
      )}
    </main>
  );
}

function AugurTable({ rows }: { rows: AugurRow[] }) {
  if (!rows.length)
    return <Empty msg="No coiled coins right now. The field is loose." />;
  return (
    <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden rise rise-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-text-tertiary border-b border-rule">
            <th className="text-left  px-4 py-3">Coin</th>
            <th className="text-left  px-4 py-3 w-48">AUGUR Score</th>
            <th className="text-left  px-4 py-3">Components</th>
            <th className="text-right px-4 py-3">vs ATH</th>
            <th className="text-right px-4 py-3">Price</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-rule-faint last:border-0 hover:bg-canvas-deep/40 transition-colors">
              <td className="px-4 py-3 font-medium text-text-primary">{coinOf(r.symbol)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-base tabular-nums w-8 ${scoreColor(r.score)}`}>{r.score}</span>
                  <div className="flex-1"><ScoreBar score={r.score} max={76} /></div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <PtChip label="ATR" value={r.atr_pts} on={r.atr_pts > 0} />
                  <PtChip label="Vol" value={r.vol_pts} on={r.vol_pts > 0} />
                  <PtChip label="ATH" value={r.price_pts} on={r.price_pts > 0} />
                  <PtChip label="VWAP" value={r.vwap_pts} on={r.vwap_pts > 0} />
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-short">{r.pct_from_ath}%</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-text-secondary">{fmt(r.price)}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/coin/${coinOf(r.symbol)}`} className="text-[11px] text-gold/70 hover:text-gold">View →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SurgeTable({ rows }: { rows: SurgeRow[] }) {
  if (!rows.length)
    return <Empty msg="No breakouts firing. Nothing has the volume yet." />;
  return (
    <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden rise rise-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-text-tertiary border-b border-rule">
            <th className="text-left  px-4 py-3">Coin</th>
            <th className="text-left  px-4 py-3 w-48">SURGE Score</th>
            <th className="text-left  px-4 py-3">Characteristics</th>
            <th className="text-right px-4 py-3">vs EMA100</th>
            <th className="text-right px-4 py-3">Price</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-rule-faint last:border-0 hover:bg-canvas-deep/40 transition-colors">
              <td className="px-4 py-3 font-medium text-text-primary">{coinOf(r.symbol)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-base tabular-nums w-8 ${scoreColor(r.score)}`}>{r.score}</span>
                  <div className="flex-1"><ScoreBar score={r.score} max={100} /></div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <PtChip label="Regime" value={r.components?.regime_pts ?? 0} on={(r.components?.regime_pts ?? 0) > 0} />
                  <PtChip label="Emerge" value={r.components?.emerge_pts ?? 0} on={(r.components?.emerge_pts ?? 0) > 0} />
                  <PtChip label="NotExt" value={r.components?.anti_ext_pts ?? 0} on={(r.components?.anti_ext_pts ?? 0) > 0} />
                  <PtChip label="Base" value={r.components?.base_pts ?? 0} on={(r.components?.base_pts ?? 0) > 0} />
                  <PtChip label="Vol" value={r.components?.vol_pts ?? 0} on={(r.components?.vol_pts ?? 0) > 0} />
                </div>
              </td>
              <td className={`px-4 py-3 text-right font-mono tabular-nums ${(r.px_vs_e100_pct ?? 0) > 30 ? 'text-short' : 'text-text-secondary'}`}>
                {(r.px_vs_e100_pct ?? 0) > 0 ? '+' : ''}{r.px_vs_e100_pct ?? '—'}%
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-text-secondary">{fmt(r.price)}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/coin/${coinOf(r.symbol)}`} className="text-[11px] text-gold/70 hover:text-gold">View →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="bg-canvas-raised border border-rule rounded-sm px-5 py-16 text-center rise rise-3">
      <div className="font-display-italic text-text-secondary text-lg">{msg}</div>
    </div>
  );
}
