'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { fetcher, post, fmt, fmtUSD, dirColor, TradePlan, Checklist , fmtTs} from '@/lib/api';

// Live data shape (same as what the monitor endpoint returns)
type LiveInfo = {
  cur_price:        number | null;
  progress:         number | null;
  dist_sl_pct:      number | null;
  dist_tp1_pct:     number | null;
  dist_tp2_pct:     number | null;
  entry_filled:     boolean;
  entry_fill_price: number | null;
  tp1_hit:          boolean;
  tp2_hit:          boolean;
};
type LivePlan = TradePlan & { live?: LiveInfo };

export default function TradePlanDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data: plan, mutate } = useSWR<LivePlan>(id ? `/api/trade-plans/${id}` : null, fetcher, { refreshInterval: 15000 });

  // Only fetch checklist when trade is NOT yet active (pre-entry evaluation)
  const isActive = plan?.status === 'active';
  const { data: checklist } = useSWR<Checklist>(
    plan && !isActive ? `/api/checklist/${encodeURIComponent(plan.symbol)}?mode=${plan.mode}` : null,
    fetcher,
  );
  const [narrating, setNarrating] = useState(false);

  if (!plan) return <main className="px-8 py-10 text-text-tertiary">Loading plan…</main>;

  const dirClass = dirColor(plan.direction);
  const verdictClass =
    checklist?.verdict === 'go'
      ? 'text-long'
      : checklist?.verdict === 'no_go'
      ? 'text-short'
      : 'text-gold';

  async function generateNarrative() {
    if (!plan) return;
    setNarrating(true);
    try {
      await post(`/api/trade-plans/${plan.id}/narrate`);
      await mutate();
    } finally {
      setNarrating(false);
    }
  }

  const narrative = plan.features?.llm_narrative;

  return (
    <main className="max-w-[1280px] mx-auto px-8 py-10">
      <Link href="/stratagem" className="text-xs uppercase tracking-widest text-text-tertiary hover:text-gold">
        ← semua rencana
      </Link>

      <header className="mt-6 mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className={`text-xs uppercase tracking-widest ${dirClass}`}>
            {plan.direction} · {plan.mode}
          </div>
          <h1 className="font-display text-5xl text-text-primary leading-tight">
            {plan.symbol.replace('/USDT:USDT', '').replace('/USDT', '')}
            <span className="font-display-italic text-gold ml-2 text-3xl">detail rencana</span>
          </h1>
          <div className="text-text-tertiary text-sm mt-2">
            Created {fmtTs(plan.created_at)} · Status:{' '}
            <span className="text-text-primary">{plan.status}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-6xl text-gold tabular leading-none">
            {plan.rr_avg.toFixed(2)}
            <span className="text-2xl text-text-tertiary">×</span>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-text-tertiary mt-1">
            blended R:R · min {plan.rr_min.toFixed(2)}×
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Plan core */}
        <section className="col-span-12 lg:col-span-8 space-y-6 rise rise-1">
          <Panel title="Entry ladder">
            <table className="w-full text-sm tabular">
              <thead className="text-text-tertiary text-[10px] uppercase tracking-widest">
                <tr><th className="text-left py-1">Leg</th><th className="text-right">Price</th><th className="text-right">Weight</th></tr>
              </thead>
              <tbody>
                {plan.entries.map((e, i) => (
                  <tr key={i} className="border-t border-rule-faint">
                    <td className="py-2 text-text-primary">{e.label}</td>
                    <td className="py-2 text-right text-text-primary">{fmt(e.price)}</td>
                    <td className="py-2 text-right text-text-tertiary">{(e.weight * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-text-tertiary">
              Entry zone: <span className="text-text-primary">{fmt(plan.entry_zone_low)} – {fmt(plan.entry_zone_high)}</span>
              {' '}· Source: {plan.features?.entry_source || '—'}
            </div>
          </Panel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Panel title="Stop loss" tone="short">
              <div className="font-display text-3xl text-short tabular">{fmt(plan.stop_loss)}</div>
              <div className="text-xs text-text-tertiary mt-2">{plan.invalidation_note}</div>
            </Panel>
            <Panel title="Take profits" tone="long">
              <ul className="space-y-2 text-sm tabular">
                {plan.take_profits.map((tp, i) => (
                  <li key={i} className="flex items-baseline justify-between">
                    <span className="text-text-secondary">
                      <span className="text-long">{fmt(tp.price)}</span>
                      <span className="text-text-tertiary text-[11px] ml-2">{tp.label}</span>
                    </span>
                    <span className="text-text-tertiary text-xs">
                      {tp.rr.toFixed(2)}× · {(tp.weight * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Position sizing">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm tabular">
              <Stat label="Risk" value={fmtUSD(plan.risk_usd)} sub={`${plan.risk_pct}% account`} />
              <Stat label="Position" value={fmtUSD(plan.position_size_usd)} sub={`${plan.position_size_qty} units`} />
              <Stat label="Leverage" value={`${plan.leverage_hint?.toFixed(1)}×`} sub="suggested cap" />
              <Stat label="Min R:R" value={`${plan.rr_min.toFixed(2)}×`} sub={plan.rr_avg >= 1.8 ? 'OK' : 'borderline'} />
            </div>
          </Panel>

          <Panel title="Narrative">
            {!narrative ? (
              <button
                onClick={generateNarrative}
                disabled={narrating}
                className="text-xs px-3 py-1.5 border border-gold/40 text-gold hover:bg-gold/10 rounded-sm"
              >
                {narrating ? 'Menyusun…' : 'Buat ringkasan AI'}
              </button>
            ) : (
              <div className="space-y-3 text-sm text-text-secondary">
                <div className="text-text-primary font-display italic">{narrative.headline_id}</div>
                <p>{narrative.thesis_id}</p>
                {narrative.execution_steps_id && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Execution</div>
                    <ol className="list-decimal ml-5 space-y-1">
                      {narrative.execution_steps_id.filter(Boolean).map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {narrative.risk_id && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Risks</div>
                    <ul className="list-disc ml-5 space-y-1 text-short/80">
                      {narrative.risk_id.map((r: string, i: number) => (<li key={i}>{r}</li>))}
                    </ul>
                  </div>
                )}
                {narrative.what_invalidates_id && (
                  <div className="text-xs text-text-tertiary border-t border-rule-faint pt-2">
                    Invalidation: {narrative.what_invalidates_id}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </section>

        {/* Checklist & metadata sidebar */}
        <aside className="col-span-12 lg:col-span-4 space-y-6 rise rise-2">

          {/* When trade is active: show live trade status instead of pre-trade checklist */}
          {isActive ? (
            <TradeActivePanel plan={plan!} />
          ) : (
            <Panel title="Pre-trade checklist">
              {!checklist ? (
                <div className="text-text-tertiary text-xs">Computing…</div>
              ) : (
                <>
                  <div className={`font-display text-3xl ${verdictClass} mb-2`}>
                    {checklist.verdict.toUpperCase().replace('_', ' ')}
                  </div>
                  <div className="text-xs text-text-tertiary mb-3">
                    Score {checklist.score.toFixed(0)} · {checklist.fail_count} fails · {checklist.warn_count} warnings
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {checklist.items.map((it) => (
                      <li key={it.key} className="flex items-baseline gap-2">
                        <span
                          className={
                            it.status === 'pass'
                              ? 'text-long'
                              : it.status === 'fail'
                              ? 'text-short'
                              : it.status === 'warn'
                              ? 'text-gold'
                              : 'text-text-tertiary'
                          }
                        >
                          {it.status === 'pass' ? '✓' : it.status === 'fail' ? '✕' : it.status === 'warn' ? '!' : '·'}
                        </span>
                        <div>
                          <div className="text-text-primary">{it.label}</div>
                          {it.detail && <div className="text-text-tertiary text-[11px]">{it.detail}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          )}

          <Panel title="Metadata">
            <dl className="text-xs space-y-1">
              {/* Scanner score — the primary conviction metric */}
              <dt className="text-text-tertiary uppercase tracking-wider flex items-center justify-between py-0.5 border-b border-rule-faint">
                <span>Scanner Score</span>
                {plan.scanner_score != null ? (
                  <span className={`font-mono font-bold text-sm ${
                    plan.scanner_score >= 80 ? 'text-long' :
                    plan.scanner_score >= 70 ? 'text-gold' :
                    'text-text-secondary'
                  }`}>
                    {Math.round(plan.scanner_score)}/100
                    {plan.scanner_score >= 80 && (
                      <span className="ml-1.5 text-[10px] bg-long/10 text-long border border-long/30 rounded px-1 py-px">
                        📸 Content
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-text-quaternary">—</span>
                )}
              </dt>
              {/* Zone quality (for zone-engine plans) */}
              {plan.zone_quality != null && (
                <dt className="text-text-tertiary uppercase tracking-wider flex items-center justify-between py-0.5 border-b border-rule-faint">
                  <span>Zone Quality</span>
                  <span className={`font-mono text-sm ${plan.zone_quality >= 75 ? 'text-gold' : 'text-text-secondary'}`}>
                    {Math.round(plan.zone_quality)}/100
                  </span>
                </dt>
              )}
              <Row label="Signal ID" value={plan.signal_id} />
              <Row label="Status" value={plan.status} />
              <Row label="Expires" value={fmtTs(plan.expires_at)} />
              <Row label="Anchor" value={plan.features?.anchor} />
              <Row label="ATR" value={fmt(plan.features?.atr)} />
              <Row label="Risk per unit" value={fmt(plan.features?.risk_per_unit)} />
            </dl>
          </Panel>

          <Link
            href={`/symbol/${encodeURIComponent(plan.symbol)}?mode=${plan.mode}`}
            className="block text-center text-xs uppercase tracking-widest border border-rule hover:border-gold text-text-secondary hover:text-gold py-2"
          >
            view symbol detail →
          </Link>
        </aside>
      </div>
    </main>
  );
}

// ── Trade Active Panel (replaces checklist when status = active) ───────────────

function TradeActivePanel({ plan }: { plan: LivePlan }) {
  const live = plan.live;
  const cur  = live?.cur_price;
  const filled = live?.entry_filled;
  const fillPrice = live?.entry_fill_price;

  // Rough unrealised P&L from fill price
  const pnl = (filled && fillPrice && cur)
    ? ((plan.direction === 'long' ? cur - fillPrice : fillPrice - cur) / fillPrice) * 100
    : null;

  const pnlColor = pnl === null ? 'text-text-tertiary' : pnl >= 0 ? 'text-long' : 'text-short';

  return (
    <Panel title="Trade active">
      {/* Status badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-long pulse-long" />
        <span className="font-display text-2xl text-long">IN TRADE</span>
      </div>

      {/* Fill price */}
      {filled && fillPrice ? (
        <div className="text-xs bg-long/8 border border-long/20 rounded-sm px-3 py-2 mb-4 text-long">
          ✓ Filled @ {fmt(fillPrice, 6)}
        </div>
      ) : (
        <div className="text-xs text-text-tertiary mb-4">Entry price not confirmed yet</div>
      )}

      {/* Unrealised P&L */}
      {pnl !== null && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Unrealised P&L</div>
          <div className={`font-mono text-2xl tabular ${pnlColor}`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
          </div>
        </div>
      )}

      {/* Distance readout */}
      {live && cur && (
        <div className="grid grid-cols-3 gap-2 text-[11px] border-t border-rule-faint pt-3 mt-2">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-0.5">→ SL</div>
            <div className={live.dist_sl_pct !== null && live.dist_sl_pct > 0 ? 'text-long font-mono' : 'text-short font-mono'}>
              {live.dist_sl_pct !== null ? `${live.dist_sl_pct > 0 ? '+' : ''}${live.dist_sl_pct.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-0.5">→ TP1</div>
            <div className={`font-mono ${live.tp1_hit ? 'text-long line-through' : 'text-text-primary'}`}>
              {live.tp1_hit ? '✓ Hit' : live.dist_tp1_pct !== null ? `${live.dist_tp1_pct.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-0.5">→ TP2</div>
            <div className={`font-mono ${live.tp2_hit ? 'text-long line-through' : 'text-text-primary'}`}>
              {live.tp2_hit ? '✓ Hit' : live.dist_tp2_pct !== null ? `${live.dist_tp2_pct.toFixed(2)}%` : '—'}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-[10px] text-text-tertiary/60 border-t border-rule-faint pt-3">
        Pre-entry checklist tidak relevan ketika sudah dalam posisi.
        Manage trade berdasarkan SL & TP di atas.
      </div>
    </Panel>
  );
}

function Panel({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'long' | 'short' }) {
  const ring = tone === 'long' ? 'border-long/30' : tone === 'short' ? 'border-short/30' : 'border-rule';
  return (
    <section className={`bg-canvas-raised border ${ring} rounded-sm`}>
      <header className="px-5 py-3 border-b border-rule-faint">
        <span className="text-[11px] uppercase tracking-widest text-text-tertiary">{title}</span>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">{label}</div>
      <div className="text-text-primary text-lg">{value}</div>
      {sub && <div className="text-[10px] text-text-tertiary">{sub}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-baseline justify-between border-b border-rule-faint last:border-b-0 py-1">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="text-text-primary tabular">{value ?? '—'}</dd>
    </div>
  );
}
