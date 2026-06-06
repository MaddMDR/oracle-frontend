'use client';
/** ORACLE v2 — Dashboard. DESIGN_SYSTEM.md §4.1 */
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, fmt, fmtPct, regimeLabel } from '@/lib/api';
import {
  Card, Stat, PageHeader, SectionHeader, ConfBar, StatusPill, Badge, DirChip,
  EmptyState, ErrorState, SkeletonRows, cx,
} from '@/components/ui';

type Setup = {
  id: number; symbol: string; mode: string; direction: string; setup_type?: string;
  status: string; confluence: number; entry_low: number; entry_high: number;
  stop_loss: number; take_profits: any[]; thesis: any; rr_avg?: number;
};
type Health = {
  setups_open: number; outcomes: number; btc_price: number | null;
  btc_regime: string | null; market_state_age_min: number | null; market_state_fresh: boolean;
};
type WinRate = { total: number; wins: number; losses: number; win_rate_pct: number; season?: string };

const TYPE_LABEL: Record<string, string> = {
  smc_reversal: 'SMC', coil_breakout: 'COIL', stealth_accumulation: 'ACCUM',
};
const coinOf = (s: string) => s.split('/')[0];

function regimeTone(r?: string | null): 'up' | 'down' | 'warn' | 'neutral' {
  if (!r) return 'neutral';
  if (r.includes('bull')) return 'up';
  if (r.includes('bear')) return 'down';
  return 'warn';
}

export default function Dashboard() {
  const { data: setups, error: sErr, isLoading: sLoad, mutate } =
    useSWR<Setup[]>('/api/v2/setups?status=detected,confirmed,armed,filled,partial', fetcher, { refreshInterval: 30000 });
  const { data: health } = useSWR<Health>('/api/v2/health', fetcher, { refreshInterval: 30000 });
  const { data: wr } = useSWR<WinRate>('/api/v2/win-rate', fetcher, { refreshInterval: 60000 });
  const { data: hyps } = useSWR<any[]>('/api/v2/hypotheses?status=testing', fetcher, { refreshInterval: 60000 });

  const winPct = wr && wr.total > 0 ? wr.win_rate_pct : null;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live confluence engine — SMC · VWAP · Anchored Volume Profile"
        right={<Link href="/screener-v2" className="text-sm text-accent hover:text-accent/80 link-underline">Open screener →</Link>}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Open Setups" value={health?.setups_open ?? '—'} sub="live in funnel" tone="brand" />
        <Stat label={`Win Rate${wr?.season ? ' · ' + wr.season : ''}`}
          value={winPct != null ? `${winPct.toFixed(0)}%` : '—'}
          sub={wr ? `${wr.wins}/${wr.total} trades` : 'no closed trades'}
          tone={winPct == null ? 'neutral' : winPct >= 50 ? 'up' : 'down'} />
        <Stat label="Closed Trades" value={wr?.total ?? '—'}
          sub={wr ? `${wr.wins}W · ${wr.losses}L` : 'this season'}
          tone="neutral" />
        <Stat label="BTC Regime"
          value={<span className="text-h2">{regimeLabel(health?.btc_regime ?? undefined)}</span>}
          sub={health?.btc_price ? `$${fmt(health.btc_price, 0)} · ${health.market_state_age_min ?? '?'}m ago` : 'no data'}
          tone={regimeTone(health?.btc_regime)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live setups */}
        <div className="xl:col-span-2">
          <SectionHeader title="Live Setups" subtitle="Open positions in the funnel — click for the full thesis"
            action={<Link href="/setups" className="text-sm text-accent hover:text-accent/80">View all →</Link>} />
          <Card padding="p-0">
            {sLoad ? (
              <div className="p-4"><SkeletonRows rows={5} /></div>
            ) : sErr ? (
              <ErrorState onRetry={() => mutate()} />
            ) : !setups || setups.length === 0 ? (
              <EmptyState
                icon={<svg className="w-10 h-10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3"/><path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>}
                title="No live setups"
                description="The scanner is idle or no candidate cleared the confluence gate. New setups appear here automatically." />
            ) : (
              <div>
                {setups.map((s) => <SetupRow key={s.id} s={s} />)}
              </div>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <div>
            <SectionHeader title="Research" subtitle="Active hypotheses"
              action={<Link href="/hypotheses" className="text-sm text-accent hover:text-accent/80">All →</Link>} />
            <Card padding="p-0">
              {!hyps ? (
                <div className="p-4"><SkeletonRows rows={3} /></div>
              ) : hyps.length === 0 ? (
                <EmptyState title="No active experiments" description="Track which edges actually work." />
              ) : (
                hyps.slice(0, 4).map((h) => (
                  <Link key={h.id} href="/hypotheses" className="block px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-fg leading-snug line-clamp-2">{h.claim}</p>
                      <StatusPill status={h.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-fg-faint font-mono tnum">
                      <span>{h.trades} trades</span>
                      <span className={cx(h.wr >= 50 ? 'text-up' : 'text-down')}>{h.wr}% WR</span>
                      <span className={cx(h.avg_r > 0 ? 'text-up' : 'text-down')}>{h.avg_r > 0 ? '+' : ''}{h.avg_r}R</span>
                    </div>
                  </Link>
                ))
              )}
            </Card>
          </div>

          <Card>
            <div className="eyebrow mb-3">Engine</div>
            <div className="space-y-2.5 text-sm">
              <Row label="Closed outcomes" value={health?.outcomes ?? '—'} />
              <Row label="Data freshness" value={health?.market_state_age_min != null ? `${health.market_state_age_min}m` : '—'}
                tone={health?.market_state_fresh ? 'up' : 'warn'} />
              <Row label="Detectors" value="SMC · COIL · ACCUM" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'up' | 'warn' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className={cx('font-mono tnum text-fg', tone === 'up' && 'text-up', tone === 'warn' && 'text-warn')}>{value}</span>
    </div>
  );
}

function SetupRow({ s }: { s: Setup }) {
  const th = s.thesis || {};
  return (
    <Link href={`/setups/${s.id}`}
      className="grid grid-cols-[1.1fr_1.4fr_auto] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors group">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-fg group-hover:text-brand transition-colors">{coinOf(s.symbol)}</span>
          {s.setup_type && <Badge>{TYPE_LABEL[s.setup_type] || s.setup_type}</Badge>}
        </div>
        <div className="mt-1"><DirChip direction={s.direction} /><span className="text-xs text-fg-faint ml-1.5">{s.mode}</span></div>
      </div>
      <div className="min-w-0">
        <ConfBar value={s.confluence} />
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {th.zone?.kind && <Badge>{th.zone.kind}</Badge>}
          {th.vwap?.ok && <Badge tone="accent">VWAP</Badge>}
          {th.avp?.at && <Badge tone="brand">AVP·{th.avp.at}</Badge>}
        </div>
      </div>
      <div className="text-right">
        <StatusPill status={s.status} />
        <div className="text-xs text-fg-faint font-mono tnum mt-1.5">
          {fmt(s.entry_low)}–{fmt(s.entry_high)}
        </div>
      </div>
    </Link>
  );
}
