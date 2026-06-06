'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Signal, Derivatives, fmt, fmtPct, dirColor, authHeaders } from '@/lib/api';
import LogTradeModal from '@/components/LogTradeModal';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function Tag({ label, tone = 'neutral', strong = false }: { label: string; tone?: 'long' | 'short' | 'neutral' | 'gold'; strong?: boolean }) {
  const tones: Record<string, string> = {
    long: strong ? 'bg-long/15 text-long-strong border-long/30' : 'bg-long/10 text-long border-long/25',
    short: strong ? 'bg-short/15 text-short-strong border-short/30' : 'bg-short/10 text-short border-short/25',
    neutral: 'bg-neutral/10 text-neutral border-neutral/25',
    gold: 'bg-gold/10 text-gold-400 border-gold/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-[3px] text-[11px] font-medium tracking-wide rounded-sm border ${tones[tone]}`}>
      {label}
    </span>
  );
}

function Quality({ q }: { q?: string }) {
  if (q === 'high') return <Tag label="HIGH" tone="gold" />;
  if (q === 'medium') return <Tag label="MID" tone="neutral" />;
  return <Tag label="LOW" tone="neutral" />;
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 max-w-[120px] h-1 bg-rule rounded-sm overflow-hidden">
        <div
          className="score-track h-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(3, value)}%` }}
        />
      </div>
      <span className="font-mono text-sm tabular text-text-primary w-8 text-right">
        {Math.round(value)}
      </span>
    </div>
  );
}

function AddPlanButton({ signal }: { signal: Signal }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function addPlan(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (state !== 'idle') return;
    setState('loading');
    try {
      const r = await fetch(`${API}/api/signals/${signal.id}/plan`, { method: 'POST', headers: authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      setState('done');
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  }

  if (state === 'done') {
    return (
      <Link
        href="/stratagem"
        onClick={(e) => e.stopPropagation()}
        className="text-[11px] text-long flex items-center gap-1 justify-end hover:underline"
      >
        ✓ Added
      </Link>
    );
  }

  return (
    <button
      onClick={addPlan}
      disabled={state === 'loading'}
      className={`text-[11px] px-2.5 py-1 border rounded-sm transition-colors w-full justify-end flex items-center gap-1 ${
        state === 'error'
          ? 'text-short border-short/40 bg-short/10'
          : 'text-text-tertiary border-rule hover:text-gold hover:border-gold/40 hover:bg-gold/5 disabled:opacity-40'
      }`}
    >
      {state === 'loading' ? '…' : state === 'error' ? 'Error' : '→ Plan'}
    </button>
  );
}

export default function SignalTable({ signals }: { signals: Signal[] }) {
  const [logSignalId, setLogSignalId] = useState<number | null>(null);

  // Sort by entry validity: active first, pending next, expired last
  const sorted = [...signals].sort((a, b) => {
    const va = (a.features as any)?.entry_plan?.validity || 'none';
    const vb = (b.features as any)?.entry_plan?.validity || 'none';
    const order: Record<string, number> = { active: 0, pending_retest: 1, none: 2, expired_too_far: 3, invalidated: 4 };
    const diff = (order[va] ?? 5) - (order[vb] ?? 5);
    if (diff !== 0) return diff;
    return b.score - a.score;
  });

  return (
    <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1.2fr_0.55fr_0.55fr_0.95fr_1.05fr_1.05fr_0.9fr_1.4fr_150px] gap-3 px-5 py-3 border-b border-rule-faint bg-canvas-inset/40">
        <ColHead>Symbol</ColHead>
        <ColHead>Mode</ColHead>
        <ColHead>Bias</ColHead>
        <ColHead className="text-right">Last Price</ColHead>
        <ColHead>Score</ColHead>
        <ColHead>Entry</ColHead>
        <ColHead>Derivatives</ColHead>
        <ColHead>Components</ColHead>
        <ColHead className="text-right">Actions</ColHead>
      </div>

      <div className="divide-y divide-rule-faint max-h-[68vh] overflow-y-auto thin-scrollbar">
        {sorted.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="font-display-italic text-text-secondary text-lg mb-1">No signals yet</div>
            <p className="text-text-tertiary text-xs">Run a scan from the Screener page.</p>
          </div>
        ) : sorted.map((s) => {
          const feats = s.features || {};
          const smc = feats.smc || {};
          const vol = feats.volume || {};
          const candle = feats.candle || {};
          const entryPlan = (feats as any).entry_plan || {};
          const validity = entryPlan.validity || 'none';
          const isExpired = validity === 'expired_too_far' || validity === 'invalidated';
          const dirTone: 'long' | 'short' | 'neutral' = s.direction === 'long' ? 'long' : s.direction === 'short' ? 'short' : 'neutral';
          const canPlan = s.direction !== 'none' && !isExpired;

          return (
            <div
              key={s.id}
              className={`grid grid-cols-[1.2fr_0.55fr_0.55fr_0.95fr_1.05fr_1.05fr_0.9fr_1.4fr_150px] gap-3 px-5 items-center transition-colors hover:bg-canvas-inset/30 ${
                isExpired ? 'opacity-50' : ''
              }`}
            >
              {/* Clickable region — all columns except last */}
              <Link
                href={`/symbol/${encodeURIComponent(s.symbol)}?mode=${s.mode}`}
                className="col-span-8 grid grid-cols-subgrid py-3.5 gap-3 items-center group"
              >
                {/* Symbol */}
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-medium text-text-primary group-hover:text-gold-400 transition-colors">
                      {s.symbol.replace('/USDT', '')}
                    </span>
                    <span className="text-xs text-text-tertiary">USDT</span>
                  </div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">
                    {s.bias_tf} → {s.exec_tf}
                  </div>
                </div>

                {/* Mode */}
                <div className="text-sm capitalize text-text-secondary">{s.mode}</div>

                {/* Bias */}
                <div className={`text-sm font-medium capitalize ${dirColor(s.direction)}`}>
                  {s.direction === 'none' ? '—' : s.direction}
                </div>

                {/* Price */}
                <div className="text-right">
                  <div className="font-mono text-sm tabular text-text-primary">{fmt(s.last_price, 6)}</div>
                  {feats.rs_vs_btc_pct !== undefined && (
                    <div className={`text-[10px] tabular ${
                      (feats.rs_vs_btc_pct || 0) > 0 ? 'text-long-dim' : 'text-short-dim'
                    }`}>
                      RS {fmtPct(feats.rs_vs_btc_pct, 1)}
                    </div>
                  )}
                </div>

                {/* Score */}
                <div className="space-y-1">
                  <ScoreBar value={s.score} />
                  <div className="flex items-center gap-2">
                    <Quality q={s.quality} />
                    <span className="text-[11px] text-text-secondary">{s.action}</span>
                  </div>
                </div>

                {/* Entry style + validity */}
                <div className="space-y-1">
                  <EntryBadge plan={entryPlan} />
                  {entryPlan.distance_from_zone_pct !== undefined && entryPlan.distance_from_zone_pct !== null && (
                    <div className={`text-[10px] tabular ${
                      Math.abs(entryPlan.distance_from_zone_pct) < 1 ? 'text-long' :
                      Math.abs(entryPlan.distance_from_zone_pct) < 3 ? 'text-neutral' : 'text-short'
                    }`}>
                      {entryPlan.distance_from_zone_pct > 0 ? '+' : ''}{entryPlan.distance_from_zone_pct?.toFixed(2)}% from zone
                    </div>
                  )}
                </div>

                {/* Derivatives */}
                <DerivativesCell d={s.derivatives} />

                {/* Components */}
                <div className="flex flex-wrap gap-1.5">
                  {(feats as any).dc_breakout?.confirmed && (
                    <Tag label="DC↑" tone="gold" strong />
                  )}
                  {(feats as any).dc_breakout?.active && !(feats as any).dc_breakout?.confirmed && (
                    <Tag label="DC break" tone="gold" />
                  )}
                  {smc.last_structure && <Tag label={smc.last_structure} tone={dirTone} />}
                  {smc.unmitigated_fvg && <Tag label="FVG" tone={dirTone} />}
                  {smc.has_order_block && <Tag label="OB" tone={dirTone} />}
                  {smc.liquidity_sweep && <Tag label="Sweep" tone={dirTone} strong />}
                  {(candle.bullish_engulfing || candle.bearish_engulfing) && <Tag label="Engulf" tone={dirTone} />}
                  {candle.displacement && <Tag label="Displ" tone={dirTone} />}
                  {candle.pin_rejection && <Tag label="Pin" tone={dirTone} />}
                  {vol.spike && <Tag label="Vol↑" tone="long" strong />}
                  {vol.dry_up && <Tag label="Vol↓" tone="short" />}
                  {vol.compression && <Tag label="Squeeze" tone="neutral" />}
                  {vol.expansion && <Tag label="Expand" tone="gold" strong />}
                  {vol.breakout_participation === 'strong' && <Tag label="Breakout" tone="long" strong />}
                  {vol.breakout_participation === 'weak' && <Tag label="Weak BO" tone="short" />}
                </div>
              </Link>

              {/* Actions — outside the Link so they don't trigger navigation */}
              <div className="flex items-center justify-end gap-2 py-3.5">
                {canPlan ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLogSignalId(s.id); }}
                      className="text-[11px] px-2 py-1 border border-rule rounded-sm text-text-tertiary hover:text-gold hover:border-gold/40 hover:bg-gold/5 transition-colors"
                      title="Log trade"
                    >
                      📝
                    </button>
                    <AddPlanButton signal={s} />
                  </>
                ) : (
                  <span className="text-[11px] text-text-tertiary/40">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Trade Modal */}
      {logSignalId !== null && (
        <LogTradeModal
          signalId={logSignalId}
          onClose={() => setLogSignalId(null)}
        />
      )}
    </div>
  );
}

function EntryBadge({ plan }: { plan: any }) {
  const style = plan?.style;
  const validity = plan?.validity;

  const labels: Record<string, string> = {
    cmp_momentum: 'CMP',
    retest_fvg: 'Retest FVG',
    retest_ob: 'Retest OB',
    breakout_retest: 'BO Retest',
    expired_too_far: 'Expired',
    invalidated: 'Invalid',
    none: '—',
  };

  const tones: Record<string, string> = {
    active: 'bg-long/15 text-long-strong border-long/40',
    pending_retest: 'bg-neutral/15 text-neutral border-neutral/40',
    expired_too_far: 'bg-short/10 text-short border-short/30',
    invalidated: 'bg-short/15 text-short-strong border-short/40',
    none: 'bg-rule/30 text-text-tertiary border-rule',
  };

  const dotTones: Record<string, string> = {
    active: 'bg-long',
    pending_retest: 'bg-neutral',
    expired_too_far: 'bg-short',
    invalidated: 'bg-short',
    none: 'bg-text-tertiary',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] text-[11px] font-medium rounded-sm border ${tones[validity] || tones.none}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotTones[validity] || dotTones.none}`} />
      {labels[style] || '—'}
    </span>
  );
}

function DerivativesCell({ d }: { d?: Derivatives | null }) {
  if (!d) {
    return <div className="text-[10px] text-text-tertiary/40">—</div>;
  }

  const vpTone: Record<string, string> = {
    STRONG:   'bg-long/15 text-long-strong border-long/40',
    MODERATE: 'bg-gold/10 text-gold-400 border-gold/30',
    NEUTRAL:  'bg-neutral/10 text-neutral border-neutral/25',
    AGAINST:  'bg-short/15 text-short-strong border-short/40',
  };

  const oi = d.oi_change_24h_pct;
  const f  = d.funding_rate_pct;
  const lsr = d.long_short_ratio;

  return (
    <div className="flex flex-col gap-1">
      {/* VP badge — most important first */}
      <span
        className={`inline-flex items-center justify-center px-2 py-[3px] text-[10px] font-mono rounded-sm border ${vpTone[d.vp_label]}`}
        title={`Vol×Position confluence: ${d.vp_label} (${d.vp_score >= 0 ? '+' : ''}${d.vp_score} pts)`}
      >
        VP {d.vp_score >= 0 ? '+' : ''}{d.vp_score}
      </span>

      {/* Mini derivatives summary */}
      <div className="flex flex-wrap gap-1 text-[9.5px] font-mono tabular text-text-tertiary leading-none">
        {oi !== null && (
          <span className={oi < -3 ? 'text-long' : oi > 5 ? 'text-short' : ''} title="OI 24h">
            OI {oi > 0 ? '+' : ''}{oi.toFixed(1)}%
          </span>
        )}
        <span className={f < -0.02 ? 'text-long' : f > 0.05 ? 'text-short' : ''} title="Funding rate">
          F{f > 0 ? '+' : ''}{f.toFixed(3)}%
        </span>
        {lsr !== null && (
          <span className={lsr < 0.9 ? 'text-long' : lsr > 1.2 ? 'text-short' : ''} title="Long/Short ratio">
            L/S {lsr.toFixed(2)}
          </span>
        )}
      </div>

      {/* Squeeze / crowded flags */}
      {(d.squeeze_flag && d.squeeze_flag !== 'none') && (
        <span className="text-[9px] text-gold-400 italic">🌀 {d.squeeze_flag.replace(/_/g, ' ')}</span>
      )}
    </div>
  );
}

function ColHead({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[10px] uppercase tracking-widest text-text-tertiary font-medium ${className}`}>
      {children}
    </div>
  );
}
