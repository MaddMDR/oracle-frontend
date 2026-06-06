'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Trade {
  plan_id:   number;
  symbol:    string;
  sym_short: string;
  direction: 'long' | 'short';
  outcome:   string;
  score:     number | null;
  created_at: string;
  fill_time:  string | null;
  fill_price: number | null;
  entry_low:  number;
  entry_high: number;
  stop_loss:  number;
  tp1:        number | null;
  tp2:        number | null;
  realized_r: number | null;
  pnl_pct:    number;
  risk_pct:   number | null;
}

interface Summary {
  period_days:   number;
  risk_pct:      number;
  total_plans:   number;
  closed:        number;
  not_filled:    number;
  open:          number;
  wins:          number;
  small_wins:    number;
  losses:        number;
  win_rate:      number;
  total_roi_pct: number;
  avg_r:         number;
  avg_win_pct:   number;
  avg_loss_pct:  number;
  profit_factor: number;
  expectancy_r:  number;
}

interface EquityPoint {
  time:   string;
  equity: number;
  pnl:    number;
  label:  string;
}

interface BacktestData {
  period_days:  number;
  summary:      Summary;
  trades:       Trade[];
  equity_curve: EquityPoint[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const OUTCOME_META: Record<string, { label: string; color: string; bg: string }> = {
  win:           { label: 'TP2 Full',   color: '#7fa885', bg: 'rgba(127,168,133,0.12)' },
  small_win:     { label: 'TP1 Partial',color: '#a8c98a', bg: 'rgba(168,201,138,0.10)' },
  breakeven:     { label: 'BE',         color: '#a8a294', bg: 'rgba(168,162,148,0.08)' },
  loss:          { label: 'SL',         color: '#c87060', bg: 'rgba(200,112,96,0.12)'  },
  not_filled:    { label: 'No Fill',    color: '#6b7280', bg: 'rgba(107,114,128,0.06)' },
  open:          { label: 'Open',       color: '#bf8e3a', bg: 'rgba(191,142,58,0.08)'  },
  expired:       { label: 'Expired',    color: '#6b7280', bg: 'rgba(107,114,128,0.06)' },
  invalid_sl:    { label: 'Bad SL',     color: '#6b7280', bg: 'rgba(107,114,128,0.06)' },
  missing_params:{ label: 'Incomplete', color: '#6b7280', bg: 'rgba(107,114,128,0.06)' },
};

function fmt(n: number | null | undefined, dec = 4): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function rLabel(r: number | null): string {
  if (r == null) return '—';
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`;
}

// ── Equity Curve SVG ──────────────────────────────────────────────────────────

function EquityCurve({ data }: { data: EquityPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return (
    <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
      No closed trades to plot
    </div>
  );

  const W = 800, H = 160, PX = 24, PY = 16;
  const pw = W - PX * 2;
  const ph = H - PY * 2;

  const all = [0, ...data.map(d => d.equity)];
  const minE = Math.min(...all);
  const maxE = Math.max(...all);
  const range = maxE - minE || 1;

  const toX = (i: number) => PX + (i / Math.max(data.length, 1)) * pw;
  const toY = (v: number) => PY + ph - ((v - minE) / range) * ph;
  const zeroY = toY(0);

  const pts = data.map((d, i) => `${toX(i + 1)},${toY(d.equity)}`);
  const polyPts = [`${PX},${zeroY}`, ...pts, `${toX(data.length)},${zeroY}`].join(' ');

  const isPos = data[data.length - 1]?.equity >= 0;
  const lineColor = isPos ? '#7fa885' : '#c87060';
  const fillColor = isPos ? 'rgba(127,168,133,0.10)' : 'rgba(200,112,96,0.10)';

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 160 }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Zero line */}
        <line x1={PX} y1={zeroY} x2={W - PX} y2={zeroY}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="4 4" />

        {/* Fill area */}
        <polygon points={polyPts} fill={fillColor} />

        {/* Equity line */}
        <polyline
          points={[`${PX},${zeroY}`, ...pts].join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Dots + hover */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={toX(i + 1)} cy={toY(d.equity)} r={hover === i ? 4 : 2.5}
            fill={d.pnl >= 0 ? '#7fa885' : '#c87060'}
            stroke="#0a0e1a" strokeWidth="1"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {/* Y labels */}
        <text x={PX - 4} y={PY + 6} textAnchor="end" fontSize="9" fill="#6b7280">
          {maxE.toFixed(1)}%
        </text>
        <text x={PX - 4} y={H - PY + 4} textAnchor="end" fontSize="9" fill="#6b7280">
          {minE.toFixed(1)}%
        </text>
      </svg>

      {/* Tooltip */}
      {hover !== null && data[hover] && (
        <div className="absolute top-2 left-4 bg-canvas-raised border border-rule rounded-sm px-3 py-2 text-xs pointer-events-none">
          <div className="text-text-tertiary text-[9px] uppercase tracking-widest mb-1">{data[hover].label}</div>
          <div className={data[hover].pnl >= 0 ? 'text-long' : 'text-short'}>
            {data[hover].pnl >= 0 ? '+' : ''}{data[hover].pnl.toFixed(2)}%
          </div>
          <div className="text-text-tertiary mt-0.5">
            Kumulatif: {data[hover].equity >= 0 ? '+' : ''}{data[hover].equity.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-canvas-raised border border-rule rounded-sm px-4 py-3">
      <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-1">{label}</div>
      <div className={`text-xl font-display tabular ${color ?? 'text-text-primary'}`}>{value}</div>
      {sub && <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Trade row ─────────────────────────────────────────────────────────────────

function TradeRow({ t }: { t: Trade }) {
  const meta = OUTCOME_META[t.outcome] ?? { label: t.outcome, color: '#a8a294', bg: 'transparent' };
  const isLong = t.direction === 'long';
  const active = t.outcome !== 'not_filled' && t.outcome !== 'missing_params' && t.outcome !== 'invalid_sl';

  return (
    <tr className="border-b border-rule-faint hover:bg-canvas-raised/50 transition-colors">
      <td className="py-2.5 px-3">
        <Link href={`/symbol/${encodeURIComponent(t.symbol)}`}
              className="text-text-primary hover:text-gold transition-colors font-medium text-sm">
          {t.sym_short}
        </Link>
        {t.score != null && (
          <span className="ml-2 text-[9px] text-text-tertiary">s={t.score.toFixed(0)}</span>
        )}
      </td>
      <td className="py-2.5 px-3">
        <span className={`text-xs font-medium ${isLong ? 'text-long' : 'text-short'}`}>
          {isLong ? '🟢 LONG' : '🔴 SHORT'}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium border"
              style={{ color: meta.color, background: meta.bg, borderColor: meta.color + '40' }}>
          {meta.label}
        </span>
      </td>
      <td className="py-2.5 px-3 text-xs text-text-secondary tabular">
        {t.fill_price != null ? fmt(t.fill_price, t.fill_price > 100 ? 2 : 6) : '—'}
      </td>
      <td className="py-2.5 px-3 text-xs text-text-tertiary tabular">
        {fmt(t.stop_loss, t.stop_loss > 100 ? 2 : 6)}
      </td>
      <td className="py-2.5 px-3 text-xs text-text-tertiary tabular">
        {fmt(t.tp1, t.tp1 && t.tp1 > 100 ? 2 : 6)}
      </td>
      <td className="py-2.5 px-3 text-xs tabular font-medium">
        {active && t.realized_r != null ? (
          <span className={t.realized_r >= 0 ? 'text-long' : 'text-short'}>
            {rLabel(t.realized_r)}
          </span>
        ) : '—'}
      </td>
      <td className="py-2.5 px-3 text-xs tabular font-semibold">
        {active && t.pnl_pct != null ? (
          <span className={t.pnl_pct >= 0 ? 'text-long' : 'text-short'}>
            {pct(t.pnl_pct)}
          </span>
        ) : '—'}
      </td>
      <td className="py-2.5 px-3 text-[10px] text-text-tertiary">
        {t.created_at ? new Date(t.created_at).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short',
          hour: '2-digit', minute: '2-digit',
        }) : '—'}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7 hari',  days: 7  },
  { label: '14 hari', days: 14 },
  { label: '30 hari', days: 30 },
];

const RISK_OPTS = [
  { label: '1% / trade', value: 1 },
  { label: '2% / trade', value: 2 },
  { label: '5% / trade', value: 5 },
];

export default function BacktestPage() {
  const [days, setDays]       = useState(7);
  const [riskPct, setRiskPct] = useState(2);
  const [sort, setSort]       = useState<'time' | 'pnl' | 'r'>('time');

  const { data, isLoading, error } = useSWR<BacktestData>(
    `/api/backtest/plans?days=${days}&risk_pct=${riskPct}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  const s = data?.summary;
  const trades = data?.trades ?? [];
  const equity = data?.equity_curve ?? [];

  const sorted = [...trades].sort((a, b) => {
    if (sort === 'pnl') return (b.pnl_pct ?? 0) - (a.pnl_pct ?? 0);
    if (sort === 'r')   return (b.realized_r ?? -99) - (a.realized_r ?? -99);
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const roiColor = !s ? '' : s.total_roi_pct >= 0 ? 'text-long' : 'text-short';
  const wrColor  = !s ? '' : s.win_rate >= 50 ? 'text-long' : s.win_rate >= 40 ? 'text-gold' : 'text-short';

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-8">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="text-xs uppercase tracking-widest text-text-tertiary hover:text-gold link-underline">
              ← chamber
            </Link>
            <span className="text-rule/40">|</span>
            <span className="text-xs uppercase tracking-widest text-text-tertiary">backtest</span>
          </div>
          <h1 className="font-display text-4xl text-text-primary">Plan Simulator</h1>
          <p className="text-text-tertiary text-sm mt-1">
            Simulasi TradePlan nyata dari DB terhadap candle 1h aktual — bukan replay sinyal.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period */}
          <div className="flex items-center gap-1 bg-canvas-raised border border-rule rounded-sm p-1">
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                  days === p.days
                    ? 'bg-gold/20 text-gold border border-gold/30'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Risk per trade */}
          <div className="flex items-center gap-1 bg-canvas-raised border border-rule rounded-sm p-1">
            {RISK_OPTS.map(r => (
              <button
                key={r.value}
                onClick={() => setRiskPct(r.value)}
                className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                  riskPct === r.value
                    ? 'bg-canvas border border-rule text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center gap-3 text-text-tertiary animate-pulse py-16 justify-center">
          <span className="text-gold text-lg">◈</span>
          <span className="text-sm">Simulasi sedang berjalan — mengambil candle & mereplay plan…</span>
        </div>
      )}
      {error && !isLoading && (
        <div className="text-short text-sm py-8 text-center">
          ✗ Gagal memuat — pastikan backend berjalan.
        </div>
      )}

      {data && s && (
        <>
          {/* ── Summary cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Stat
              label="Total ROI"
              value={pct(s.total_roi_pct)}
              sub={`${s.risk_pct}% risk/trade`}
              color={roiColor}
            />
            <Stat
              label="Win Rate"
              value={`${s.win_rate.toFixed(1)}%`}
              sub={`${s.wins}W ${s.small_wins}sw ${s.losses}L`}
              color={wrColor}
            />
            <Stat
              label="Avg R"
              value={rLabel(s.avg_r)}
              sub={`PF ${s.profit_factor.toFixed(2)}`}
              color={s.avg_r >= 0 ? 'text-long' : 'text-short'}
            />
            <Stat
              label="Closed Trades"
              value={String(s.closed)}
              sub={`${s.not_filled} not filled · ${s.open} open`}
            />
            <Stat
              label="Avg Win"
              value={pct(s.avg_win_pct)}
              color="text-long"
            />
            <Stat
              label="Avg Loss"
              value={pct(s.avg_loss_pct)}
              color="text-short"
            />
          </div>

          {/* Insight banner */}
          <div className={`border rounded-sm px-5 py-3 mb-6 text-sm ${
            s.total_roi_pct >= 0
              ? 'bg-long/5 border-long/20 text-long/90'
              : 'bg-short/5 border-short/20 text-short/90'
          }`}>
            <span className="font-semibold">
              {s.total_roi_pct >= 0 ? '📈' : '📉'} Hasil {s.period_days} hari:
            </span>{' '}
            {s.closed} trade ditutup dari {s.total_plans} plan.{' '}
            Win rate <strong>{s.win_rate.toFixed(1)}%</strong>, total ROI{' '}
            <strong>{pct(s.total_roi_pct)}</strong> dengan asumsi {s.risk_pct}% capital per trade (1× leverage / spot).{' '}
            {s.not_filled > 0 && `${s.not_filled} plan tidak terisi (harga tidak menyentuh entry zone).`}
          </div>

          {/* ── Equity Curve ────────────────────────────────────────────── */}
          <div className="bg-canvas-raised border border-rule rounded-sm p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-widest text-text-tertiary">Equity Curve</h2>
              <span className="text-[10px] text-text-tertiary/60">kumulatif ROI · {s.risk_pct}% risk/trade</span>
            </div>
            <EquityCurve data={equity} />
          </div>

          {/* ── Trade table ─────────────────────────────────────────────── */}
          <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-rule-faint">
              <h2 className="text-xs uppercase tracking-widest text-text-tertiary">
                Trade List — {sorted.length} plan
              </h2>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-text-tertiary uppercase tracking-widest mr-1">Sort:</span>
                {(['time', 'pnl', 'r'] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    className={`px-2 py-0.5 border rounded-sm transition-colors ${
                      sort === k
                        ? 'border-gold/50 text-gold bg-gold/10'
                        : 'border-rule text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    {k === 'time' ? 'Waktu' : k === 'pnl' ? 'P&L %' : 'R'}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto thin-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-rule-faint text-[9px] uppercase tracking-widest text-text-tertiary">
                    <th className="py-2 px-3 font-normal">Simbol</th>
                    <th className="py-2 px-3 font-normal">Arah</th>
                    <th className="py-2 px-3 font-normal">Outcome</th>
                    <th className="py-2 px-3 font-normal">Entry Fill</th>
                    <th className="py-2 px-3 font-normal">SL</th>
                    <th className="py-2 px-3 font-normal">TP1</th>
                    <th className="py-2 px-3 font-normal">Realized R</th>
                    <th className="py-2 px-3 font-normal">P&amp;L %</th>
                    <th className="py-2 px-3 font-normal">Dibuat (WIB)</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(t => <TradeRow key={t.plan_id} t={t} />)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-text-tertiary/50 mt-4 text-center max-w-2xl mx-auto leading-relaxed">
            Simulasi menggunakan candle 1h — entry diisi pada midpoint zona saat harga menyentuh zona.
            Tidak memperhitungkan fee, slippage, atau partial fill. Hasil masa lalu bukan jaminan masa depan.
            Gunakan hanya sebagai referensi, bukan dasar keputusan investasi.
          </p>
        </>
      )}
    </div>
  );
}
