'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState } from 'react';
import { fetcher, fmt, fmtUSD, dirColor, TradePlan, authHeaders , fmtDate} from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Extended plan type with live data ────────────────────────────────────────

type LiveInfo = {
  cur_price:       number | null;
  progress:        number | null;   // 0–100: distance from SL toward TP2
  dist_sl_pct:     number | null;   // % from current to SL (positive = safe)
  dist_tp1_pct:    number | null;   // % from current to TP1 (positive = not yet hit)
  dist_tp2_pct:    number | null;
  entry_filled:    boolean;
  entry_fill_price: number | null;
  tp1_hit:         boolean;
  tp2_hit:         boolean;
};

type LivePlan = TradePlan & { live?: LiveInfo };

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; border: string; bg: string }> = {
  pending:       { label: 'Awaiting fill',  dot: 'bg-gold',    border: 'border-gold/30',  bg: 'bg-gold/5'  },
  active:        { label: 'In trade',       dot: 'bg-long',    border: 'border-long/35',  bg: 'bg-long/5'  },
  closed_win:    { label: 'Win',            dot: 'bg-long',    border: 'border-long/25',  bg: ''           },
  closed_partial:{ label: 'Partial win',    dot: 'bg-neutral', border: 'border-neutral/30',bg: ''          },
  closed_loss:   { label: 'Loss',           dot: 'bg-short',   border: 'border-short/25', bg: ''           },
  expired:       { label: 'Expired',        dot: 'bg-rule',    border: 'border-rule',     bg: ''           },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Stratagem() {
  const [tab, setTab] = useState<'monitor' | 'history'>('monitor');

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="mb-8 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Stratagem</div>
        <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
          Trade <span className="font-display-italic text-gold">Monitor</span>
        </h1>
        <p className="text-text-secondary max-w-2xl text-sm leading-relaxed">
          ORACLE watches every plan automatically — entry fill, SL, and both TPs tracked in real time.
          Results are auto-journaled for win-rate calculation.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-canvas-raised border border-rule rounded-sm p-1 w-fit">
        {([['monitor', '🔴 Live Monitor'], ['history', '📋 History']] as const).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 text-sm rounded-sm transition-colors ${
              tab === t
                ? 'bg-gold/15 text-gold-400'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'monitor' ? <MonitorTab /> : <HistoryTab />}
    </main>
  );
}

// ── Monitor tab — live tracking ───────────────────────────────────────────────

function MonitorTab() {
  const { data: plans, mutate } = useSWR<LivePlan[]>(
    '/api/trade-plans/monitor/live',
    fetcher,
    { refreshInterval: 15000 },   // refresh every 15s
  );

  if (!plans) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 bg-canvas-raised border border-rule rounded-sm animate-pulse" />
        ))}
      </div>
    );
  }

  const active  = plans.filter(p => p.status === 'active');
  const pending = plans.filter(p => p.status === 'pending');

  if (plans.length === 0) {
    return (
      <div className="border border-rule-faint bg-canvas-raised rounded-sm px-6 py-16 text-center text-text-tertiary">
        <div className="font-display-italic text-text-secondary text-xl mb-2">Nothing being monitored</div>
        <p className="text-sm">
          Zone-confirmed plans are added automatically. Or go to the{' '}
          <Link href="/screener" className="text-gold hover:underline">Screener</Link>{' '}
          and click <span className="text-gold">→ Plan</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 rise rise-2">
      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-long pulse-long" />
            <h2 className="text-xs uppercase tracking-widest text-long">In Trade · {active.length}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {active.map(p => <LivePlanCard key={p.id} plan={p} onDismiss={mutate} />)}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-gold pulse-gold" />
            <h2 className="text-xs uppercase tracking-widest text-gold">Awaiting Entry · {pending.length}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pending.map(p => <LivePlanCard key={p.id} plan={p} onDismiss={mutate} />)}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Live plan card ─────────────────────────────────────────────────────────────

function LivePlanCard({ plan, onDismiss }: { plan: LivePlan; onDismiss: () => void }) {
  const [dismissing, setDismissing] = useState(false);
  const live    = plan.live;
  const isLong  = plan.direction === 'long';
  const cfg     = STATUS_CONFIG[plan.status] || STATUS_CONFIG.pending;

  const tps    = plan.take_profits || [];
  const tp1    = tps[0];
  const tp2    = tps[1];
  const sl     = plan.stop_loss;
  const ep     = plan.entries?.[0]?.price;
  const cur    = live?.cur_price;

  // Progress bar: 0% = at SL, 50% ≈ at entry, 100% = at TP2
  const progress = live?.progress ?? null;

  // Color of progress bar
  const barColor =
    progress === null ? 'bg-rule' :
    progress >= 80    ? 'bg-long' :
    progress >= 50    ? 'bg-neutral' : 'bg-short';

  async function handleDismiss(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setDismissing(true);
    await fetch(`${API}/api/trade-plans/${plan.id}`, { method: 'DELETE', headers: authHeaders() });
    onDismiss();
  }

  const sym = plan.symbol.replace('/USDT:USDT','').replace('/USDT','');
  const rrColor = plan.rr_avg >= 2 ? 'text-long' : plan.rr_avg >= 1.5 ? 'text-gold' : 'text-short';

  return (
    <div className={`relative group bg-canvas-raised border rounded-sm overflow-hidden transition-all hover:border-gold/40 ${cfg.border} ${cfg.bg}`}>
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="absolute top-2.5 right-2.5 z-10 w-6 h-6 flex items-center justify-center rounded-sm
          bg-canvas-inset border border-rule text-text-tertiary
          opacity-0 group-hover:opacity-100
          hover:bg-short/20 hover:border-short/40 hover:text-short
          transition-all disabled:opacity-50 text-xs"
      >
        {dismissing ? '…' : '×'}
      </button>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${plan.status === 'active' ? 'pulse-long' : ''}`} />
              <span className="text-[10px] uppercase tracking-widest text-text-tertiary">{cfg.label}</span>
            </div>
            <Link
              href={`/stratagem/${plan.id}`}
              className="font-display text-2xl text-text-primary hover:text-gold-400 transition-colors"
            >
              {sym}
            </Link>
            <div className={`text-xs uppercase tracking-widest ${dirColor(plan.direction)}`}>
              {plan.direction} · {plan.mode}
            </div>
          </div>
          <div className={`text-right ${rrColor}`}>
            <div className="font-display text-2xl tabular">{plan.rr_avg.toFixed(2)}<span className="text-sm text-text-tertiary">R</span></div>
            <div className="text-[10px] text-text-tertiary">target R:R</div>
          </div>
        </div>

        {/* Live price */}
        {cur && (
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-1">Live price</div>
            <div className="font-mono text-xl tabular text-text-primary">{fmt(cur, 6)}</div>
          </div>
        )}

        {/* SL → Entry → TP1 → TP2 visual bar */}
        <div className="mb-4">
          <div className="relative h-6">
            {/* Track */}
            <div className="absolute inset-y-[10px] left-0 right-0 h-1.5 bg-rule rounded-sm" />

            {/* Filled portion (from SL toward TP2) */}
            {progress !== null && (
              <div
                className={`absolute inset-y-[10px] left-0 h-1.5 rounded-sm transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            )}

            {/* Markers */}
            {/* SL - left edge */}
            <MarkerPin pos={0} color="bg-short" label="SL" value={fmt(sl, 5)} labelPos="above" />

            {/* Entry */}
            {ep && sl && tp2 && (
              <MarkerPin
                pos={Math.abs(ep - sl) / Math.abs(tp2.price - sl) * 100}
                color={live?.entry_filled ? 'bg-gold' : 'bg-gold/50'}
                label={live?.entry_filled ? '✓ Entry' : 'Entry'}
                value={fmt(ep, 5)}
                labelPos="below"
              />
            )}

            {/* TP1 */}
            {tp1 && sl && (
              <MarkerPin
                pos={Math.min(95, Math.abs(tp1.price - sl) / Math.abs((tp2?.price ?? tp1.price) - sl) * 100)}
                color={live?.tp1_hit ? 'bg-long' : 'bg-long/50'}
                label={live?.tp1_hit ? '✓ TP1' : 'TP1'}
                value={fmt(tp1.price, 5)}
                labelPos="above"
              />
            )}

            {/* TP2 - right edge */}
            {tp2 && (
              <MarkerPin
                pos={100}
                color={live?.tp2_hit ? 'bg-long' : 'bg-long/40'}
                label={live?.tp2_hit ? '✓ TP2' : 'TP2'}
                value={fmt(tp2.price, 5)}
                labelPos="below"
              />
            )}

            {/* Current price cursor */}
            {progress !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-text-primary opacity-60 transition-all duration-500"
                style={{ left: `${Math.min(progress, 100)}%` }}
              />
            )}
          </div>
        </div>

        {/* Distance readout */}
        {live && cur && (
          <div className="grid grid-cols-3 gap-2 text-[11px] mb-4">
            <DistCell
              label="→ SL"
              value={live.dist_sl_pct}
              format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`}
              goodWhen="positive"
            />
            <DistCell
              label="→ TP1"
              value={live.dist_tp1_pct}
              format={(v) => `${v > 0 ? '' : ''}${v.toFixed(2)}%`}
              goodWhen="positive"
              hit={live.tp1_hit}
            />
            <DistCell
              label="→ TP2"
              value={live.dist_tp2_pct}
              format={(v) => `${v.toFixed(2)}%`}
              goodWhen="positive"
              hit={live.tp2_hit}
            />
          </div>
        )}

        {/* Fill info */}
        {live?.entry_filled && live.entry_fill_price && (
          <div className="text-[10px] text-long bg-long/8 border border-long/20 rounded-sm px-2 py-1 mb-3">
            ✓ Filled @ {fmt(live.entry_fill_price, 6)}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-text-tertiary pt-3 border-t border-rule-faint">
          <span>#{plan.id} · {fmtDate(plan.created_at)}</span>
          <div className="flex items-center gap-2">
            {plan.scanner_score != null && (
              <span className={`font-mono font-semibold ${
                plan.scanner_score >= 80 ? 'text-long' :
                plan.scanner_score >= 70 ? 'text-gold' :
                'text-text-tertiary'
              }`}>
                {plan.content_ready && '📸 '}
                {Math.round(plan.scanner_score)}/100
              </span>
            )}
            <span>{fmtUSD(plan.risk_usd)} risk · {plan.leverage_hint?.toFixed(1)}×</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const [mode, setMode] = useState<string>('all');
  const { data: plans, mutate } = useSWR<TradePlan[]>(
    `/api/trade-plans?status=closed_win,closed_partial,closed_loss,expired&mode=${mode}&limit=50`,
    fetcher,
    { refreshInterval: 60000 },
  );

  async function dismiss(id: number) {
    await fetch(`${API}/api/trade-plans/${id}`, { method: 'DELETE', headers: authHeaders() });
    mutate();
  }

  const wins     = (plans || []).filter(p => p.status === 'closed_win' || p.status === 'closed_partial').length;
  const losses   = (plans || []).filter(p => p.status === 'closed_loss').length;
  const wr       = wins + losses > 0 ? Math.round(wins / (wins + losses) * 100) : null;

  return (
    <div className="rise rise-2">
      {/* Filter + stats strip */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-canvas-raised border border-rule rounded-sm p-1">
          {(['all', 'intraday', 'swing'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs rounded-sm transition-colors capitalize ${
                mode === m ? 'bg-gold/15 text-gold-400' : 'text-text-tertiary hover:text-text-primary'
              }`}
            >{m === 'all' ? 'All modes' : m}</button>
          ))}
        </div>

        {wr !== null && (
          <div className="flex items-center gap-4 ml-auto text-sm">
            <span className="text-text-tertiary">{wins}W / {losses}L</span>
            <span className={`font-display text-2xl tabular ${wr >= 55 ? 'text-long' : wr >= 45 ? 'text-neutral' : 'text-short'}`}>
              {wr}%
            </span>
            <span className="text-xs text-text-tertiary uppercase tracking-widest">WR</span>
          </div>
        )}
      </div>

      {!plans ? (
        <div className="text-text-tertiary">Loading…</div>
      ) : plans.length === 0 ? (
        <div className="border border-rule-faint bg-canvas-raised rounded-sm px-6 py-12 text-center text-text-tertiary">
          <div className="font-display-italic text-text-secondary text-lg mb-1">No closed plans yet</div>
          <p className="text-xs">Results will appear here as ORACLE tracks SL/TP hits.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map(p => <HistoryRow key={p.id} plan={p} onDismiss={() => dismiss(p.id)} />)}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ plan, onDismiss }: { plan: TradePlan; onDismiss: () => void }) {
  const cfg   = STATUS_CONFIG[plan.status] || STATUS_CONFIG.expired;
  const sym   = plan.symbol.replace('/USDT:USDT','').replace('/USDT','');
  const mon   = (plan.features as any)?.monitor || {};
  const realizedR: number | null = mon.realized_r ?? null;
  const exitPrice: number | null = mon.exit_price ?? null;
  const fillPrice: number | null = mon.entry_fill_price ?? null;

  return (
    <div className={`group flex items-center gap-4 px-5 py-3 bg-canvas-raised border rounded-sm hover:border-gold/30 transition-colors ${cfg.border}`}>
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />

      {/* Symbol + direction */}
      <div className="w-24 flex-shrink-0">
        <div className="font-display text-base text-text-primary">{sym}</div>
        <div className={`text-[10px] uppercase ${dirColor(plan.direction)}`}>{plan.direction}</div>
      </div>

      {/* Outcome */}
      <div className="w-28 flex-shrink-0">
        <div className="text-xs font-medium text-text-primary">{cfg.label}</div>
        <div className="text-[10px] text-text-tertiary">{plan.mode}</div>
      </div>

      {/* Fill → Exit */}
      <div className="flex-1 flex items-center gap-1 text-[11px] text-text-tertiary font-mono">
        {fillPrice ? <span>{fmt(fillPrice, 5)}</span> : <span>—</span>}
        {fillPrice && exitPrice && <span className="text-text-tertiary/40 mx-1">→</span>}
        {exitPrice ? <span className={realizedR !== null && realizedR >= 0 ? 'text-long' : 'text-short'}>{fmt(exitPrice, 5)}</span> : <span>—</span>}
      </div>

      {/* Realized R */}
      <div className="w-16 text-right">
        {realizedR !== null ? (
          <span className={`font-display text-lg tabular ${realizedR >= 0 ? 'text-long' : 'text-short'}`}>
            {realizedR >= 0 ? '+' : ''}{realizedR.toFixed(2)}<span className="text-sm">R</span>
          </span>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </div>

      {/* Date */}
      <div className="text-[10px] text-text-tertiary w-16 text-right flex-shrink-0">
        {fmtDate(plan.created_at)}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-short transition-all text-xs w-5 h-5 flex items-center justify-center"
      >×</button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MarkerPin({
  pos, color, label, value, labelPos,
}: {
  pos: number; color: string; label: string; value: string; labelPos: 'above' | 'below';
}) {
  const clampedPos = Math.max(0, Math.min(100, pos));
  return (
    <div
      className="absolute top-0 bottom-0 flex flex-col items-center"
      style={{ left: `${clampedPos}%`, transform: 'translateX(-50%)' }}
    >
      {labelPos === 'above' && (
        <div className="text-[8px] text-text-tertiary whitespace-nowrap mb-0.5 leading-none">{label}</div>
      )}
      <div className={`w-1.5 h-1.5 rounded-full mt-[9px] flex-shrink-0 ${color}`} />
      {labelPos === 'below' && (
        <div className="text-[8px] text-text-tertiary whitespace-nowrap mt-0.5 leading-none">{label}</div>
      )}
    </div>
  );
}

function DistCell({
  label, value, format, goodWhen, hit,
}: {
  label: string;
  value: number | null;
  format: (v: number) => string;
  goodWhen: 'positive' | 'negative';
  hit?: boolean;
}) {
  const color =
    hit                ? 'text-long' :
    value === null      ? 'text-text-tertiary' :
    goodWhen === 'positive'
      ? (value > 2 ? 'text-long' : value > 0 ? 'text-neutral' : 'text-short')
      : (value < -2 ? 'text-long' : value < 0 ? 'text-neutral' : 'text-short');

  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-0.5">{label}</div>
      <div className={`font-mono tabular text-xs ${color}`}>
        {hit ? '✓ Hit' : value !== null ? format(value) : '—'}
      </div>
    </div>
  );
}
