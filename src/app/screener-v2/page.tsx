'use client';
/** ORACLE v2 — Screener. DESIGN_SYSTEM.md §4.3 */
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, fmt } from '@/lib/api';
import {
  Card, PageHeader, ConfBar, Badge, DirChip, Button,
  EmptyState, ErrorState, SkeletonRows, cx,
} from '@/components/ui';

type Setup = {
  id: number; symbol: string; mode: string; direction: string; setup_type?: string;
  status: string; confluence: number; entry_low: number; entry_high: number;
  stop_loss: number; take_profits: any[]; thesis: any;
  current_price?: number | null; dist_from_entry_pct?: number | null;
};

const TYPE_LABEL: Record<string, string> = {
  smc_reversal: 'SMC', coil_breakout: 'COIL', stealth_accumulation: 'ACCUM',
};
const coinOf = (s: string) => s.replace('/USDT:USDT', '').replace('/USDT', '');

export default function ScreenerV2Page() {
  const { data, error, isLoading, mutate } = useSWR<Setup[]>('/api/v2/screener', fetcher, { refreshInterval: 30000 });
  const { data: stats } = useSWR<any>('/api/v2/stats', fetcher, { refreshInterval: 30000 });
  const rows = data || [];

  return (
    <div>
      <PageHeader
        title="Screener"
        subtitle="Every candidate ranked by confluence — SMC · VWAP · Anchored Volume Profile"
        right={<Button variant="secondary" size="sm" onClick={() => mutate()}>Refresh</Button>}
      />

      {stats && (
        <div className="flex flex-wrap gap-2 mb-5 text-xs text-fg-faint font-mono tnum">
          <Badge>{stats.total_setups} total</Badge>
          <Badge tone="accent">{stats.setups_by_status?.detected || 0} detected</Badge>
          <Badge tone="brand">{stats.setups_by_status?.confirmed || 0} confirmed</Badge>
          {stats.win_rate?.total > 0 && <Badge tone="up">{stats.win_rate.win_rate_pct}% WR</Badge>}
        </div>
      )}

      <Card padding="p-0">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[40px_1.2fr_1.4fr_1fr_1.2fr] gap-4 px-4 py-2.5 border-b border-border text-micro uppercase text-fg-faint sticky top-[var(--topbar-h)] bg-surface z-10">
          <span>#</span><span>Symbol</span><span>Confluence</span><span>Price · Dist</span><span className="text-right">Entry / Stop</span>
        </div>

        {isLoading ? (
          <div className="p-4"><SkeletonRows rows={8} /></div>
        ) : error ? (
          <ErrorState onRetry={() => mutate()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No candidates"
            description="Setups appear when confluence ≥ 62. In a bear regime the engine is selective by design — fewer, higher-quality signals." />
        ) : (
          rows.map((r, i) => <ScreenerRow key={r.id} r={r} rank={i + 1} />)
        )}
      </Card>
    </div>
  );
}

function ScreenerRow({ r, rank }: { r: Setup; rank: number }) {
  const th = r.thesis || {};
  const dist = r.dist_from_entry_pct;
  const distTone = dist == null ? 'text-fg-faint'
    : Math.abs(dist) <= 1 ? 'text-brand' : Math.abs(dist) <= 4 ? 'text-fg-muted' : 'text-fg-faint';
  return (
    <Link href={`/setups/${r.id}`}
      className="grid grid-cols-1 md:grid-cols-[40px_1.2fr_1.4fr_1fr_1.2fr] gap-2 md:gap-4 md:items-center px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors group">
      <span className="hidden md:block text-fg-faint font-mono tnum text-sm">{rank}</span>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-fg group-hover:text-brand transition-colors">{coinOf(r.symbol)}</span>
          {r.setup_type && <Badge>{TYPE_LABEL[r.setup_type] || r.setup_type}</Badge>}
        </div>
        <div className="mt-1"><DirChip direction={r.direction} /><span className="text-xs text-fg-faint ml-1.5">{r.mode}</span></div>
      </div>

      <div className="min-w-0">
        <ConfBar value={r.confluence} />
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {th.zone?.kind && <Badge>{th.zone.kind}{th.zone.tf ? `·${th.zone.tf}` : ''}</Badge>}
          {th.vwap?.ok && <Badge tone="accent">VWAP</Badge>}
          {th.avp?.at && <Badge tone="brand">AVP·{th.avp.at}</Badge>}
          {th.regime?.ok && <Badge tone="up">REGIME</Badge>}
        </div>
      </div>

      <div className="font-mono tnum text-sm">
        <div className="text-fg">{r.current_price != null ? fmt(r.current_price) : '—'}</div>
        <div className={cx('text-xs mt-0.5', distTone)}>
          {dist != null ? `${dist > 0 ? '+' : ''}${dist}% from entry` : 'no live price'}
        </div>
      </div>

      <div className="text-left md:text-right font-mono tnum text-xs">
        <div className="text-fg-muted">entry <span className="text-fg">{fmt(r.entry_low)}–{fmt(r.entry_high)}</span></div>
        <div className="text-down mt-0.5">stop {fmt(r.stop_loss)}</div>
      </div>
    </Link>
  );
}
