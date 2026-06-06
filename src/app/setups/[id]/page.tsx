'use client';
/** ORACLE v2 — Setup detail. DESIGN_SYSTEM.md §4.4
 *  Full confluence thesis + immutable Event timeline (the audit trail that also drives Telegram). */
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, fmt, fmtTs, fmtAgo } from '@/lib/api';
import {
  Card, ConfBar, Badge, DirChip, StatusPill, EmptyState, ErrorState, Skeleton, cx,
} from '@/components/ui';
import TradingViewChart from '@/components/TradingViewChart';
import SetupChart from '@/components/SetupChart';
import { useState } from 'react';

type Ev = { kind: string; price: number | null; ts: string | null; payload: any };
type SetupDetail = {
  id: number; symbol: string; mode: string; direction: string; status: string; setup_type?: string;
  confluence: number; entry_low: number; entry_high: number; stop_loss: number;
  take_profits: any[]; thesis: any; realized_r?: number | null; fill_price?: number | null;
  current_price?: number | null; dist_from_entry_pct?: number | null; dist_from_stop_pct?: number | null;
  events?: Ev[]; error?: string;
};

const TYPE_LABEL: Record<string, string> = {
  smc_reversal: 'SMC reversal', coil_breakout: 'Coil breakout', stealth_accumulation: 'Stealth accumulation',
};
const coinOf = (s: string) => (s || '').replace('/USDT:USDT', '').replace('/USDT', '');

const EV_TONE: Record<string, string> = {
  detected: 'bg-accent', confirmed: 'bg-brand', armed: 'bg-brand', filled: 'bg-up',
  tp1: 'bg-up', tp2: 'bg-up', breakeven: 'bg-warn', sl: 'bg-down', stopped: 'bg-down',
  expired: 'bg-fg-faint', cancelled: 'bg-fg-faint',
};

export default function SetupDetailPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading, mutate } = useSWR<SetupDetail>(`/api/v2/setups/${params.id}`, fetcher, { refreshInterval: 15000 });

  if (isLoading) return (
    <div className="max-w-content mx-auto space-y-4">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full rounded-md" />
    </div>
  );
  if (error) return <Card><ErrorState onRetry={() => mutate()} /></Card>;
  if (!data || data.error) return <Card><EmptyState title="Setup not found" description="It may have been pruned or never existed." /></Card>;

  const th = data.thesis || {};
  const tps = data.take_profits || [];
  const deriv = th.deriv || th.derivatives;

  return (
    <div>
      <Link href="/setups" className="text-sm text-accent hover:text-accent/80 inline-flex items-center gap-1 mb-4">← Setups</Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-h1 text-fg">{coinOf(data.symbol)}</h1>
            <DirChip direction={data.direction} />
            {data.setup_type && <Badge tone="brand">{TYPE_LABEL[data.setup_type] || data.setup_type}</Badge>}
          </div>
          <div className="text-sm text-fg-faint mt-1">{data.mode} · setup #{data.id}</div>
        </div>
        <div className="flex items-start gap-5">
          {/* Live current price */}
          <div className="text-right">
            <div className="eyebrow mb-0.5">Current price</div>
            <div className="font-mono tnum text-h2 text-fg leading-none">
              {data.current_price != null ? fmt(data.current_price) : '—'}
            </div>
            {data.dist_from_entry_pct != null && (
              <div className={cx('text-xs font-mono tnum mt-1',
                Math.abs(data.dist_from_entry_pct) <= 1 ? 'text-brand' : 'text-fg-faint')}>
                {data.dist_from_entry_pct > 0 ? '+' : ''}{data.dist_from_entry_pct}% from entry
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={data.status} />
            {data.realized_r != null && (
              <span className={cx('font-mono tnum text-h3', data.realized_r > 0 ? 'text-up' : 'text-down')}>
                {data.realized_r > 0 ? '+' : ''}{data.realized_r}R
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: thesis + levels */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow">Confluence</div>
              <span className="font-mono tnum text-h3 text-brand">{Math.round(data.confluence)}</span>
            </div>
            <ConfBar value={data.confluence} showValue={false} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <Factor title="SMC" ok={!!th?.zone}
                value={th?.zone ? `${String(th.zone.kind || '').toUpperCase()} ${th.zone.tf || ''}` : '—'}
                sub={th?.zone ? `${th.zone.premium_discount || ''} · q${Math.round(th.zone.quality ?? 0)}` : undefined} />
              <Factor title="VWAP" ok={!!th?.vwap?.ok}
                value={th?.vwap?.ok ? 'aligned' : 'against'}
                sub={th?.vwap ? `vwap ${fmt(th.vwap.vwap)}` : undefined} />
              <Factor title="Volume Profile" ok={!!th?.avp?.at}
                value={th?.avp?.at ? `at ${String(th.avp.at).toUpperCase()}` : 'no node'}
                sub={th?.avp ? `POC ${fmt(th.avp.poc)}` : undefined} />
              <Factor title="Regime" ok={!!th?.regime?.ok}
                value={th?.regime?.ok ? 'aligned' : 'against'}
                sub={th?.regime ? `BTC20 ${((th.regime.btc_ret20 ?? 0) * 100).toFixed(1)}%` : undefined} />
            </div>
            {deriv && (
              <div className="mt-4 pt-4 border-t border-border text-xs text-fg-muted font-mono tnum flex flex-wrap gap-x-4 gap-y-1">
                {deriv.oi_washout != null && <span>OI {deriv.oi_washout}%</span>}
                {deriv.funding_neg != null && <span>funding {deriv.funding_neg}%</span>}
                {deriv.crowd_short_lsr != null && <span>LSR {deriv.crowd_short_lsr}</span>}
                {deriv.augur != null && <span>augur {deriv.augur}</span>}
              </div>
            )}
          </Card>

          <Card>
            <div className="eyebrow mb-4">Trade plan</div>
            <div className="space-y-2.5 font-mono tnum text-sm">
              <LevelRow label="Entry zone" value={`${fmt(data.entry_low)} – ${fmt(data.entry_high)}`} tone="brand" />
              <LevelRow label="Stop loss" value={fmt(data.stop_loss)} tone="down" />
              {data.fill_price != null && <LevelRow label="Fill price" value={fmt(data.fill_price)} tone="fg" />}
              {tps.map((t: any, i: number) => (
                <LevelRow key={i} label={t.label || `TP${i + 1}`} value={fmt(t.price)} tone="up"
                  meta={t.rr ? `${t.rr}R` : undefined} />
              ))}
            </div>
          </Card>
        </div>

        {/* Right: lifecycle timeline */}
        <div>
          <Card padding="p-5">
            <div className="eyebrow mb-4">Lifecycle · event log</div>
            {(data.events?.length ?? 0) === 0 ? (
              <p className="text-sm text-fg-faint">No events yet.</p>
            ) : (
              <ol className="relative border-l border-border ml-1.5 space-y-5">
                {data.events!.map((e, i) => (
                  <li key={i} className="relative pl-5">
                    <span className={cx('absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-surface', EV_TONE[e.kind] || 'bg-fg-faint')} />
                    <div className="text-sm text-fg capitalize">{e.kind.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-fg-faint font-mono tnum mt-0.5">
                      {e.price != null && <span className="text-fg-muted">@ {fmt(e.price)} · </span>}
                      {fmtTs(e.ts)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {/* Live chart */}
      <SetupChartCard data={data} tf={th?.zone?.tf || (data.mode === 'swing' ? '4h' : '1h')} />
    </div>
  );
}

function SetupChartCard({ data, tf }: { data: SetupDetail; tf: string }) {
  const [tab, setTab] = useState<'position' | 'tv'>('position');
  return (
    <Card className="mt-6" padding="p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-surface-2 border border-border rounded-md">
          {(['position', 'tv'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cx('px-3 h-7 rounded text-xs transition-colors',
                tab === t ? 'bg-bg text-fg' : 'text-fg-muted hover:text-fg')}>
              {t === 'position' ? 'Position' : 'TradingView'}
            </button>
          ))}
        </div>
        <div className="text-xs text-fg-faint font-mono tnum">
          entry {fmt(data.entry_low)}–{fmt(data.entry_high)} · stop {fmt(data.stop_loss)} · {tf}
        </div>
      </div>
      {tab === 'position' ? (
        <SetupChart
          symbol={data.symbol} timeframe={tf} direction={data.direction}
          entryLow={data.entry_low} entryHigh={data.entry_high} stopLoss={data.stop_loss}
          takeProfits={data.take_profits} fillPrice={data.fill_price} height={460}
        />
      ) : (
        <TradingViewChart symbol={data.symbol} timeframe={tf} height={460} />
      )}
    </Card>
  );
}

function Factor({ title, ok, value, sub }: { title: string; ok: boolean; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-surface-2 border border-border p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="eyebrow">{title}</span>
        <span className={cx('w-1.5 h-1.5 rounded-full', ok ? 'bg-up' : 'bg-fg-faint')} />
      </div>
      <div className={cx('text-sm font-medium', ok ? 'text-fg' : 'text-fg-muted')}>{value}</div>
      {sub && <div className="text-xs text-fg-faint font-mono tnum mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function LevelRow({ label, value, tone, meta }: { label: string; value: string; tone: string; meta?: string }) {
  const tc = { brand: 'text-brand', down: 'text-down', up: 'text-up', fg: 'text-fg' }[tone] || 'text-fg';
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted font-sans text-sm">{label}</span>
      <span className={cx(tc)}>{value}{meta && <span className="text-fg-faint ml-1.5">({meta})</span>}</span>
    </div>
  );
}
