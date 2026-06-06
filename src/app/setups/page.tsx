'use client';
/** ORACLE v2 — Setups board. DESIGN_SYSTEM.md §4.2
 *  Canonical projection of c_setups — always matches Telegram. */
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, fmt } from '@/lib/api';
import {
  Card, PageHeader, ConfBar, Badge, DirChip, StatusPill,
  EmptyState, ErrorState, Skeleton, cx,
} from '@/components/ui';

type TP = { price: number; label: string; rr?: number; weight?: number };
type Setup = {
  id: number; symbol: string; mode: string; direction: string; status: string; setup_type?: string;
  confluence: number; entry_low: number; entry_high: number; stop_loss: number;
  take_profits: TP[]; thesis: any; rr_avg?: number; realized_r?: number | null;
  fill_price?: number | null; current_price?: number | null; unrealized_r?: number | null;
};

const TYPE_LABEL: Record<string, string> = {
  smc_reversal: 'SMC', coil_breakout: 'COIL', stealth_accumulation: 'ACCUM',
};
const coinOf = (s: string) => s.replace('/USDT:USDT', '').replace('/USDT', '');

const FILTERS = [
  // 'Positions' = actively in the trade (filled / TP1-secured) — the v1 Trade Plans view.
  { key: 'positions', label: 'Positions', q: 'filled,partial' },
  // 'Signals' = detected/confirmed but not yet entered.
  { key: 'signals', label: 'Signals', q: 'detected,confirmed,armed' },
  // 'Closed' = finished trades + expired/cancelled (the history bucket).
  { key: 'closed', label: 'Closed', q: 'closed_win,closed_loss,expired,cancelled' },
  { key: 'all', label: 'All', q: 'all' },
];

export default function SetupsPage() {
  const [filter, setFilter] = useState('positions');
  const q = FILTERS.find((f) => f.key === filter)!.q;
  const { data, error, isLoading, mutate } = useSWR<Setup[]>(`/api/v2/setups?status=${q}`, fetcher, { refreshInterval: 15000 });
  const { data: wr } = useSWR<any>('/api/v2/win-rate', fetcher, { refreshInterval: 30000 });
  const rows = data || [];

  return (
    <div>
      <PageHeader
        title="Setups"
        subtitle="Canonical source of truth — every Telegram alert is a projection of these rows"
        right={wr && (
          <div className="text-sm font-mono tnum text-fg-muted">
            <span className="text-up">{wr.wins ?? 0}W</span> · <span className="text-down">{wr.losses ?? 0}L</span> ·{' '}
            <span className="text-fg">{wr.win_rate_pct ?? 0}%</span>
            <span className="text-fg-faint ml-1.5">{wr.season ?? ''}</span>
          </div>
        )}
      />

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-surface border border-border rounded-md w-fit">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cx('px-3 h-8 rounded text-sm transition-colors',
              filter === f.key ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg')}>
            {f.label}
          </button>
        ))}
      </div>

      {filter === 'positions' && rows.length > 0 && <PositionsSummary rows={rows} />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-md" />)}
        </div>
      ) : error ? (
        <Card><ErrorState onRetry={() => mutate()} /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState
          title={filter === 'positions' ? 'No open positions'
            : filter === 'signals' ? 'No pending signals'
            : filter === 'closed' ? 'No closed trades yet' : 'No setups'}
          description={filter === 'positions' ? 'Nothing is filled right now. Setups move here once price enters the entry zone.'
            : filter === 'signals' ? 'No setup is waiting for entry. New candidates appear as the engine scans.'
            : filter === 'closed' ? 'Closed trades (win/loss) and expired setups will collect here.'
            : 'Nothing matches this filter yet.'} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => <SetupCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function PositionsSummary({ rows }: { rows: Setup[] }) {
  const withR = rows.filter((r) => r.unrealized_r != null);
  const aggR = withR.reduce((s, r) => s + (r.unrealized_r || 0), 0);
  const winning = withR.filter((r) => (r.unrealized_r || 0) >= 0).length;
  const longs = rows.filter((r) => r.direction === 'long').length;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <Mini label="Open positions" value={rows.length} />
      <Mini label="Unrealized" value={`${aggR >= 0 ? '+' : ''}${aggR.toFixed(2)}R`}
        tone={aggR >= 0 ? 'up' : 'down'} />
      <Mini label="In profit" value={`${winning}/${withR.length || 0}`}
        tone={withR.length && winning >= withR.length - winning ? 'up' : undefined} />
      <Mini label="Direction" value={`${longs}L · ${rows.length - longs}S`} />
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="card p-3">
      <div className="eyebrow mb-1">{label}</div>
      <div className={cx('text-h3 font-mono tnum', tone === 'up' && 'text-up', tone === 'down' && 'text-down', !tone && 'text-fg')}>{value}</div>
    </div>
  );
}

function SetupCard({ r }: { r: Setup }) {
  const th = r.thesis || {};
  const tps = r.take_profits || [];
  return (
    <Card as="link" href={`/setups/${r.id}`} interactive padding="p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-h3 text-fg group-hover:text-brand transition-colors">{coinOf(r.symbol)}</span>
            {r.setup_type && <Badge>{TYPE_LABEL[r.setup_type] || r.setup_type}</Badge>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <DirChip direction={r.direction} />
            <span className="text-xs text-fg-faint">{r.mode} · #{r.id}</span>
          </div>
        </div>
        <StatusPill status={r.status} />
      </div>

      <ConfBar value={r.confluence} className="mb-3" />

      <div className="flex flex-wrap gap-1 mb-3 min-h-[20px]">
        {th.zone?.kind && <Badge>{th.zone.kind}{th.zone.tf ? `·${th.zone.tf}` : ''}</Badge>}
        {th.zone?.premium_discount && <Badge>{th.zone.premium_discount}</Badge>}
        {th.vwap?.ok && <Badge tone="accent">VWAP</Badge>}
        {th.avp?.at && <Badge tone="brand">AVP·{th.avp.at}</Badge>}
        {th.regime?.ok && <Badge tone="up">REGIME</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-mono tnum pt-3 border-t border-border">
        <div>
          <div className="eyebrow mb-0.5">Entry</div>
          <div className="text-fg">{fmt(r.entry_low)}</div>
        </div>
        <div>
          <div className="eyebrow mb-0.5">Stop</div>
          <div className="text-down">{fmt(r.stop_loss)}</div>
        </div>
        <div>
          <div className="eyebrow mb-0.5">{tps[0] ? 'TP1' : 'R:R'}</div>
          <div className="text-up">{tps[0] ? fmt(tps[0].price) : (r.rr_avg ? `${r.rr_avg}R` : '—')}</div>
        </div>
      </div>

      {(r.status === 'filled' || r.status === 'partial') && r.current_price != null && (
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-border text-sm font-mono tnum">
          <span className="text-fg-muted">CMP <span className="text-fg">{fmt(r.current_price)}</span></span>
          {r.unrealized_r != null && (
            <span className={cx(r.unrealized_r >= 0 ? 'text-up' : 'text-down')}>
              {r.unrealized_r >= 0 ? '+' : ''}{r.unrealized_r}R live
            </span>
          )}
        </div>
      )}

      {r.realized_r != null && (
        <div className={cx('mt-3 text-sm font-mono tnum', r.realized_r > 0 ? 'text-up' : 'text-down')}>
          Realized {r.realized_r > 0 ? '+' : ''}{r.realized_r}R
        </div>
      )}
    </Card>
  );
}
