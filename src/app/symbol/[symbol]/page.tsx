'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import PriceChart from '@/components/PriceChart';
import TradingViewChart, { toTVUrl } from '@/components/TradingViewChart';
import LogTradeModal from '@/components/LogTradeModal';
import { fetcher, fmt, fmtPct, dirColor, signColor, authHeaders } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const ALL_TFS = ['1d', '4h', '1h', '15m', '5m'];

function SymbolInner({ symbol }: { symbol: string }) {
  const sp = useSearchParams();
  const initialMode = sp.get('mode') || 'swing';
  const [chartTf, setChartTf] = useState('1h');
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [chartSource, setChartSource] = useState<'tv' | 'oracle'>('tv');

  const { data } = useSWR(`/api/signals/${encodeURIComponent(symbol)}`, fetcher);

  // Phase 1: candles only — paints the chart instantly
  const { data: ohlcv, error: ohlcvError } = useSWR(
    `/api/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${chartTf}&limit=300`,
    fetcher,
    { shouldRetryOnError: true, errorRetryInterval: 15000, errorRetryCount: 4 },
  );

  // Phase 2: SMC overlays — backend-cached per closed candle, pops in after candles render
  const { data: smcData, error: smcError } = useSWR(
    ohlcv ? `/api/chart/smc/${encodeURIComponent(symbol)}?timeframe=${chartTf}&limit=300` : null,
    fetcher,
    { dedupingInterval: 30000, shouldRetryOnError: false },
  );

  const { data: newsData } = useSWR(`/api/news/${encodeURIComponent(symbol)}`, fetcher);

  // CVD — fetched lazily after OHLCV (same TF)
  const { data: cvdData } = useSWR(
    ohlcv ? `/api/chart/cvd/${encodeURIComponent(symbol)}?timeframe=${chartTf}&limit=300` : null,
    fetcher,
    { dedupingInterval: 60000, shouldRetryOnError: false },
  );

  // Liquidation levels — fetched once, same TF
  const { data: liqData } = useSWR(
    ohlcv ? `/api/chart/liq-levels/${encodeURIComponent(symbol)}?timeframe=${chartTf}&limit=300` : null,
    fetcher,
    { dedupingInterval: 120000, shouldRetryOnError: false },
  );

  const modes = data?.modes || {};
  const [activeMode, setActiveMode] = useState<string>(initialMode);
  const active = modes[activeMode] || modes[Object.keys(modes)[0]];

  // Fibonacci — direction from signal, refreshes when TF or direction changes
  const fibDirection = active?.direction === 'short' ? 'bearish' : 'bullish';
  const { data: fibData, isLoading: fibLoading } = useSWR(
    ohlcv
      ? `/api/chart/fibonacci/${encodeURIComponent(symbol)}?timeframe=${chartTf}&limit=200&direction=${fibDirection}`
      : null,
    fetcher,
    { dedupingInterval: 60000, shouldRetryOnError: false },
  );

  const supports = useMemo(() => {
    const lv = active?.context?.levels;
    return lv?.nearest_support ? [lv.nearest_support] : [];
  }, [active]);
  const resistances = useMemo(() => {
    const lv = active?.context?.levels;
    return lv?.nearest_resistance ? [lv.nearest_resistance] : [];
  }, [active]);

  const llm = active?.features?.llm_analysis;
  const noTrade: string[] = active?.context?.no_trade_flags || [];
  const featsTf = active?.context?.features_by_tf || {};

  return (
    <main className="max-w-[1440px] mx-auto px-6 py-6">

      {/* ── Row 1: Header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 rise rise-1">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-text-tertiary hover:text-gold link-underline"
          >
            ← chamber
          </Link>
          <h1 className="font-display text-4xl text-text-primary leading-none">
            {symbol.replace('/USDT', '')}
            <span className="text-text-tertiary text-2xl">/USDT</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {Object.keys(modes).map((m) => (
            <button
              key={m}
              onClick={() => setActiveMode(m)}
              className={`px-3 py-1.5 text-xs capitalize rounded-sm border transition-colors ${
                activeMode === m
                  ? 'border-gold text-gold-400 bg-gold/5'
                  : 'border-rule text-text-secondary hover:text-text-primary hover:border-rule-strong'
              }`}
            >
              {m}
            </button>
          ))}
          {active?.id && active.direction !== 'none' && (
            <button
              onClick={() => setLogModalOpen(true)}
              className="px-3 py-1.5 text-xs border border-rule text-text-tertiary hover:text-gold hover:border-gold/50 rounded-sm transition-colors flex items-center gap-1"
            >
              📝 Log trade
            </button>
          )}
        </div>
      </div>

      {/* ── Row 2: Metric strip ───────────────────────────────────────────── */}
      {active && (
        <div className="mb-4 grid grid-cols-4 gap-0 bg-canvas-raised border border-rule rounded-sm rise rise-2 divide-x divide-rule-faint">
          <div className="px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Score</div>
            <span className="font-display text-2xl text-text-primary tabular">
              {Math.round(active.score)}
              <span className="text-text-tertiary text-sm">/100</span>
            </span>
            <div className="text-[11px] text-text-tertiary mt-0.5">{active.quality?.toUpperCase()}</div>
          </div>
          <div className="px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Direction</div>
            <span className={`font-display text-2xl capitalize ${dirColor(active.direction)}`}>
              {active.direction === 'none' ? '—' : active.direction}
            </span>
            <div className="text-[11px] text-text-tertiary mt-0.5">{active.bias_tf} → {active.exec_tf}</div>
          </div>
          <div className="px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Action</div>
            <span className="font-display text-2xl text-text-primary">{active.action}</span>
            <div className="text-[11px] text-text-tertiary mt-0.5">score + flags</div>
          </div>
          <div className="px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Last Price</div>
            <span className="font-display text-2xl text-text-primary tabular">{fmt(active.last_price, 6)}</span>
            {active.context?.rs_vs_btc_pct !== undefined && (
              <div className={`text-[11px] mt-0.5 ${signColor(active.context.rs_vs_btc_pct)}`}>
                RS vs BTC: {fmtPct(active.context.rs_vs_btc_pct, 2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row 3: Full-width chart ───────────────────────────────────────── */}
      <section className="mb-4 bg-canvas-raised border border-rule rounded-sm rise rise-3">
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-rule-faint gap-3">
          {/* Chart source toggle + ORACLE TF picker */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-sm border border-rule overflow-hidden text-[11px]">
              <button
                onClick={() => setChartSource('tv')}
                className={`px-2.5 py-1 font-medium transition-colors flex items-center gap-1.5 ${
                  chartSource === 'tv' ? 'bg-gold/15 text-gold-400' : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 36 28" fill="currentColor" className="flex-shrink-0">
                  <path d="M14 0H0v14h14V0zm8 0v28l7-14-7-14z"/>
                </svg>
                TradingView
              </button>
              <div className="w-px h-4 bg-rule-faint" />
              <button
                onClick={() => setChartSource('oracle')}
                className={`px-2.5 py-1 font-medium transition-colors ${
                  chartSource === 'oracle' ? 'bg-gold/15 text-gold-400' : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                ◈ SMC
              </button>
            </div>

            {/* TF picker — only for ORACLE chart */}
            {chartSource === 'oracle' && (
              <div className="flex items-center gap-0.5">
                {ALL_TFS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartTf(t)}
                    className={`px-2 py-1 text-xs font-medium rounded-sm transition-colors ${
                      chartTf === t ? 'bg-gold/15 text-gold-400' : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right side: bias + open link */}
          <div className="flex items-center gap-3">
            {active && (
              <span className="text-[10px] text-text-tertiary uppercase tracking-widest hidden sm:block">
                bias {active.bias_tf} · exec {active.exec_tf}
              </span>
            )}
            <a
              href={toTVUrl(symbol, chartTf)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-text-tertiary hover:text-gold transition-colors flex items-center gap-1"
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 9L9 1M9 1H4M9 1v5"/>
              </svg>
              Open ↗
            </a>
          </div>
        </header>

        {/* Chart body */}
        {chartSource === 'tv' ? (
          <TradingViewChart symbol={symbol} timeframe={chartTf} height={560} />
        ) : (
          <div className="p-4">
            {ohlcv ? (
              <PriceChart
                data={ohlcv}
                supports={supports}
                resistances={resistances}
                smc={smcData ? {
                  structure_events: smcData.structure_events,
                  order_blocks:     smcData.order_blocks,
                  fvgs:             smcData.fvgs,
                  sweeps:           smcData.sweeps,
                  swings:           smcData.swings,
                } : undefined}
                smcLoading={!smcData && !smcError && !!ohlcv}
                smcError={!!smcError || smcData?.error === 'smc_compute_failed'}
                fib={fibData ?? null}
                fibLoading={fibLoading}
              />
            ) : ohlcvError ? (
              <div className="h-[560px] flex flex-col items-center justify-center gap-3 text-center px-6">
                <span className="text-2xl opacity-40">⚡</span>
                <p className="font-display-italic text-text-secondary">Exchange temporarily unavailable</p>
                <p className="text-xs text-text-tertiary max-w-xs">Akan dicoba ulang otomatis setiap 15 detik.</p>
              </div>
            ) : (
              <div className="h-[560px] flex items-center justify-center font-display-italic text-text-secondary animate-pulse">
                Reading the chart…
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Row 4: Analysis cards (3 columns) ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rise rise-4">

        {/* Col 1 — AI verdict + Entry Plan */}
        <div className="space-y-4">
          <OracleVerdict llm={llm} fallback={active?.summary} noTrade={noTrade} />
          {active && active.features?.entry_plan && (
            <EntryPlanCard plan={active.features.entry_plan} lastPrice={active.last_price} direction={active.direction} />
          )}
          {active?.id && (
            <RuleInsight signalId={active.id} direction={active.direction} />
          )}
        </div>

        {/* Col 2 — Key Levels + Liq Clusters + CVD */}
        <div className="space-y-4">
          {active && (
            <section className="bg-canvas-raised border border-rule rounded-sm">
              <header className="px-5 py-3 border-b border-rule-faint">
                <h3 className="text-xs uppercase tracking-widest text-text-tertiary">Key Levels · {active.exec_tf}</h3>
              </header>
              <dl className="px-5 py-4 space-y-3">
                <LevelRow label="Resistance" value={fmt(active.context?.levels?.nearest_resistance, 6)} tone="text-short" />
                <LevelRow label="Last Price"  value={fmt(active.last_price, 6)}                          tone="text-text-primary" />
                <LevelRow label="Support"     value={fmt(active.context?.levels?.nearest_support, 6)}    tone="text-long" />
              </dl>
            </section>
          )}
          {liqData?.levels?.length > 0 && (
            <LiqLevelsCard levels={liqData.levels} curPrice={liqData.cur_price} />
          )}
          {cvdData && <CvdPanel cvdData={cvdData} />}
          {fibData && !fibData?.detail && <OteFibCard fibData={fibData} />}
        </div>

        {/* Col 3 — Multi-TF Confluence + News */}
        <div className="space-y-4">
          {active && Object.keys(featsTf).length > 0 && (
            <MultiTfConfluence
              featsTf={featsTf}
              biasTf={active.bias_tf}
              execTf={active.exec_tf}
              direction={active.direction}
            />
          )}
          {newsData?.items?.length > 0 && (
            <section className="bg-canvas-raised border border-rule rounded-sm">
              <header className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest text-text-tertiary">Related News</h3>
                {newsData.summary?.sentiment && (
                  <span className={`text-[10px] uppercase tracking-widest font-medium ${
                    newsData.summary.sentiment === 'bullish' ? 'text-long' :
                    newsData.summary.sentiment === 'bearish' ? 'text-short' : 'text-text-tertiary'
                  }`}>
                    {newsData.summary.sentiment}
                  </span>
                )}
              </header>
              {newsData.summary?.summary_id && (
                <div className="px-5 py-3 border-b border-rule-faint">
                  <p className="font-display-italic text-sm text-text-primary leading-snug">
                    "{newsData.summary.summary_id}"
                  </p>
                </div>
              )}
              <ul className="px-5 py-3 space-y-3">
                {newsData.items.slice(0, 4).map((n: any) => (
                  <li key={n.id} className="border-b border-rule-faint last:border-b-0 pb-3 last:pb-0">
                    <a href={n.url} target="_blank" rel="noreferrer" className="block group">
                      <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">{n.source}</div>
                      <div className="text-sm text-text-secondary group-hover:text-text-primary leading-snug">{n.title}</div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

      </div>

      {/* Log Trade Modal */}
      {logModalOpen && active?.id && (
        <LogTradeModal
          signalId={active.id}
          onClose={() => setLogModalOpen(false)}
        />
      )}
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1.5">{label}</div>
      <div className="leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-text-tertiary mt-1">{sub}</div>}
    </div>
  );
}

function LevelRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-mono tabular font-medium ${tone}`}>{value}</span>
    </div>
  );
}

function OracleVerdict({ llm, fallback, noTrade }: { llm: any; fallback?: string; noTrade: string[] }) {
  const hasLLM = llm && (llm.narrative_id || llm.main_reasons?.length);

  return (
    <section className="bg-canvas-raised border-l-2 border-l-gold border-r border-y border-rule rounded-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-gold/4 blur-3xl pointer-events-none" />
      <header className="px-5 py-3 border-b border-rule-faint">
        <h3 className="text-xs uppercase tracking-widest text-gold">AI Summary</h3>
      </header>
      <div className="px-5 py-4">
        {hasLLM ? (
          <>
            <div className="flex items-center gap-3 mb-4 text-xs">
              <span className="text-text-tertiary uppercase tracking-widest">Quality</span>
              <span className={`text-sm font-medium uppercase ${
                llm.setup_quality === 'High' ? 'text-long' :
                llm.setup_quality === 'Medium' ? 'text-neutral' : 'text-short'
              }`}>{llm.setup_quality}</span>
              <span className="text-text-tertiary">·</span>
              <span className="text-sm font-medium text-text-primary">{llm.recommended_action}</span>
            </div>

            <blockquote className="font-display-italic text-lg text-text-primary leading-snug mb-5 border-l border-gold/40 pl-4">
              {llm.narrative_id || fallback}
            </blockquote>

            {llm.main_reasons?.length > 0 && (
              <BulletList title="Reasons" items={llm.main_reasons} bullet="+" tone="text-long" />
            )}
            {llm.key_risks?.length > 0 && (
              <BulletList title="Risks" items={llm.key_risks} bullet="!" tone="text-short" />
            )}
            {llm.invalidation_conditions?.length > 0 && (
              <BulletList title="Invalidation" items={llm.invalidation_conditions} bullet="×" tone="text-gold" />
            )}
          </>
        ) : (
          <p className="font-display-italic text-base text-text-secondary leading-snug">
            {fallback || 'AI analysis is only run for top-ranked candidates each scan; other setups have not been reviewed.'}
          </p>
        )}

        {noTrade.length > 0 && (
          <div className="mt-5 pt-5 border-t border-rule-faint">
            <div className="text-xs uppercase tracking-widest text-short mb-2">Warning — avoid trade</div>
            <ul className="space-y-1.5 text-sm text-text-primary">
              {noTrade.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-short">⚠</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function BulletList({ title, items, bullet, tone }: { title: string; items: string[]; bullet: string; tone: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-xs uppercase tracking-widest text-text-tertiary mb-2">{title}</div>
      <ul className="space-y-1.5 text-sm text-text-primary">
        {items.map((r, i) => (
          <li key={i} className="flex gap-2.5 leading-snug">
            <span className={`${tone} flex-shrink-0 font-bold`}>{bullet}</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntryPlanCard({ plan, lastPrice, direction }: { plan: any; lastPrice: number; direction?: string }) {
  const validity = plan?.validity || 'none';
  const style = plan?.style || 'none';
  const isShort = direction === 'short';

  const styleLabels: Record<string, string> = {
    cmp_momentum: 'CMP Momentum',
    retest_fvg: 'Retest FVG',
    retest_ob: 'Retest Order Block',
    breakout_retest: 'Breakout Retest',
    expired_too_far: 'Expired',
    invalidated: 'Invalidated',
    none: 'No Entry Plan',
  };

  // For short setups, "active" border/bg should use short color, not long
  const validityConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
    active: {
      label: 'ACTIVE',
      color: isShort ? 'text-short' : 'text-long',
      bg: isShort ? 'bg-short/10' : 'bg-long/10',
      border: isShort ? 'border-l-short' : 'border-l-long',
      icon: '✓',
    },
    pending_retest: { label: 'PENDING RETEST', color: 'text-neutral', bg: 'bg-neutral/10', border: 'border-l-neutral', icon: '◷' },
    expired_too_far: { label: 'EXPIRED', color: 'text-short', bg: 'bg-short/10', border: 'border-l-short', icon: '✗' },
    invalidated: { label: 'INVALIDATED', color: 'text-short', bg: 'bg-short/15', border: 'border-l-short', icon: '⊘' },
    none: { label: 'N/A', color: 'text-text-tertiary', bg: 'bg-rule/30', border: 'border-l-rule', icon: '—' },
  };

  const cfg = validityConfig[validity] || validityConfig.none;
  const dist = plan?.distance_from_zone_pct;
  const freshness = plan?.freshness_score ?? 0;

  // For short: price above zone (+dist) = approaching entry = good (gold)
  // For long:  price below zone (-dist) = approaching entry = good (gold)
  // High absolute distance = bad (short color) regardless of direction
  const distColor = dist == null ? '' :
    Math.abs(dist) < 0.05 ? 'text-gold' :
    Math.abs(dist) < 1 ? (isShort ? (dist > 0 ? 'text-gold' : 'text-short') : (dist < 0 ? 'text-gold' : 'text-neutral')) :
    Math.abs(dist) < 3 ? 'text-neutral' : 'text-short';

  // Freshness bar: high freshness = entry is close/ready (use direction color), low = not ready
  const freshnessBarColor = freshness >= 70
    ? (isShort ? 'bg-short' : 'bg-long')
    : freshness >= 40 ? 'bg-neutral' : 'bg-rule-strong';
  const freshnessTextColor = freshness >= 70
    ? (isShort ? 'text-short' : 'text-long')
    : freshness >= 40 ? 'text-neutral' : 'text-text-tertiary';

  return (
    <section className={`border-l-2 border-r border-y border-rule rounded-sm overflow-hidden ${cfg.border} ${cfg.bg}`}>
      <header className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary flex items-center gap-2">
          <span className={cfg.color}>{cfg.icon}</span>
          Entry Plan
        </h3>
        <span className={`text-[10px] uppercase tracking-widest font-medium ${cfg.color}`}>
          {cfg.label}
        </span>
      </header>

      <div className="px-5 py-4 space-y-3">
        {/* Style */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Entry Style</div>
          <div className="font-display text-2xl text-text-primary">
            {styleLabels[style]}
          </div>
          {plan?.entry_source && (
            <div className="text-xs text-text-tertiary mt-0.5">{plan.entry_source}</div>
          )}
        </div>

        {/* Entry zone */}
        {plan?.entry_zone_top != null && plan?.entry_zone_bottom != null && (
          <div className="border-t border-rule-faint pt-3">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Entry Zone</div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-base tabular text-text-primary">
                {plan.entry_zone_bottom?.toFixed(6)} – {plan.entry_zone_top?.toFixed(6)}
              </span>
              {dist !== null && dist !== undefined && (
                <span className={`text-sm font-medium tabular ${distColor}`}>
                  {dist > 0 ? '+' : ''}{dist?.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="text-[11px] text-text-tertiary mt-1">
              Current price: <span className="text-text-secondary font-mono">{lastPrice?.toFixed(6)}</span>
            </div>
          </div>
        )}

        {/* Freshness */}
        <div className="border-t border-rule-faint pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest text-text-tertiary">Freshness</span>
            <span className={`text-xs font-medium tabular ${freshnessTextColor}`}>
              {freshness}/100
            </span>
          </div>
          <div className="h-1 bg-rule rounded-sm overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${freshnessBarColor}`}
              style={{ width: `${freshness}%` }}
            />
          </div>
        </div>

        {/* Reason */}
        {plan?.reason && (
          <div className="border-t border-rule-faint pt-3">
            <p className={`text-sm leading-relaxed ${
              validity === 'expired_too_far' || validity === 'invalidated'
                ? 'text-text-secondary italic'
                : 'text-text-primary'
            }`}>
              {plan.reason}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Rule Insight ────────────────────────────────────────────────────────────

type InsightState = 'idle' | 'loading' | 'done' | 'error';

interface RuleInsightData {
  verdict: 'Proceed' | 'Monitor' | 'Skip';
  confidence: 'high' | 'medium' | 'low';
  edge_score: number;
  thesis: string;
  rule_breakdown: { rule: string; fired: boolean; meaning: string }[];
  entry_note: string;
  invalidation: string;
  risk_factors: string[];
}

function RuleInsight({ signalId, direction }: { signalId: number; direction?: string }) {
  const [state, setState] = useState<InsightState>('idle');
  const [data, setData] = useState<RuleInsightData | null>(null);
  const [open, setOpen] = useState(false);

  async function generate() {
    if (state === 'loading') return;
    setState('loading');
    setOpen(true);
    try {
      const r = await fetch(`${API}/api/signals/${signalId}/insight`, { method: 'POST', headers: authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      const json = await r.json();
      setData(json);
      setState('done');
    } catch {
      setState('error');
    }
  }

  const verdictStyle: Record<string, string> = {
    Proceed: 'text-long bg-long/10 border-long/30',
    Monitor: 'text-neutral bg-neutral/10 border-neutral/30',
    Skip:    'text-short bg-short/10 border-short/30',
  };
  const confidenceColor: Record<string, string> = {
    high: 'text-long', medium: 'text-neutral', low: 'text-short',
  };

  return (
    <section className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
      <header
        className="px-5 py-3 border-b border-rule-faint flex items-center justify-between cursor-pointer"
        onClick={() => state === 'done' && setOpen((o) => !o)}
      >
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary flex items-center gap-2">
          <span className="text-gold">◈</span>
          Rule Insight
          {state === 'done' && data && (
            <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded-sm border ${verdictStyle[data.verdict]}`}>
              {data.verdict}
            </span>
          )}
        </h3>
        {state === 'idle' || state === 'error' ? (
          <button
            onClick={(e) => { e.stopPropagation(); generate(); }}
            className="text-[11px] px-3 py-1 border border-rule rounded-sm text-text-tertiary
                       hover:text-gold hover:border-gold/40 hover:bg-gold/5 transition-colors"
          >
            {state === 'error' ? '↺ Retry' : '✦ Generate'}
          </button>
        ) : state === 'loading' ? (
          <span className="text-[11px] text-text-tertiary animate-pulse">Analyzing…</span>
        ) : (
          <span className="text-[11px] text-text-tertiary">{open ? '▲' : '▼'}</span>
        )}
      </header>

      {state === 'loading' && (
        <div className="px-5 py-6 space-y-2">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className={`h-2 bg-rule rounded-sm animate-pulse`} style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {state === 'done' && data && open && (
        <div className="px-5 py-4 space-y-5">

          {/* Header metrics */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="font-display text-3xl text-text-primary tabular">{data.edge_score}</div>
              <div className="text-[10px] uppercase tracking-widest text-text-tertiary mt-0.5">Edge / 10</div>
            </div>
            <div className="w-px h-10 bg-rule-faint" />
            <div>
              <div className={`text-sm font-medium uppercase ${confidenceColor[data.confidence]}`}>
                {data.confidence} confidence
              </div>
              <div className="text-[11px] text-text-tertiary mt-0.5">
                {direction && direction !== 'none' ? direction.toUpperCase() : '—'} setup
              </div>
            </div>
          </div>

          {/* Thesis */}
          <div className="border-t border-rule-faint pt-4">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-2">Thesis</div>
            <p className="font-display-italic text-base text-text-primary leading-snug">
              {data.thesis}
            </p>
          </div>

          {/* Rule breakdown */}
          <div className="border-t border-rule-faint pt-4">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-3">Rule Breakdown</div>
            <ul className="space-y-2.5">
              {data.rule_breakdown.map((rb, i) => (
                <li key={i} className="flex gap-2.5 items-start text-sm">
                  <span className={`flex-shrink-0 mt-0.5 text-xs font-bold ${rb.fired ? 'text-long' : 'text-text-tertiary/50'}`}>
                    {rb.fired ? '✓' : '○'}
                  </span>
                  <div>
                    <span className={`font-medium ${rb.fired ? 'text-text-primary' : 'text-text-tertiary'}`}>
                      {rb.rule}
                    </span>
                    <p className={`text-[12px] mt-0.5 leading-snug ${rb.fired ? 'text-text-secondary' : 'text-text-tertiary/60'}`}>
                      {rb.meaning}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Entry note + invalidation */}
          <div className="border-t border-rule-faint pt-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold mb-1">What to watch</div>
              <p className="text-sm text-text-primary leading-snug">{data.entry_note}</p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-short mb-1">Invalidation</div>
              <p className="text-sm text-text-primary leading-snug">{data.invalidation}</p>
            </div>
          </div>

          {/* Risk factors */}
          {data.risk_factors?.length > 0 && (
            <div className="border-t border-rule-faint pt-4">
              <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-2">Risks</div>
              <ul className="space-y-1.5">
                {data.risk_factors.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-text-secondary">
                    <span className="text-short flex-shrink-0">!</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Regenerate */}
          <div className="border-t border-rule-faint pt-3 flex justify-end">
            <button
              onClick={generate}
              className="text-[11px] text-text-tertiary hover:text-gold transition-colors"
            >
              ↺ Regenerate
            </button>
          </div>
        </div>
      )}

      {state === 'idle' && (
        <div className="px-5 py-4 text-sm text-text-tertiary leading-relaxed">
          Click <span className="text-gold">✦ Generate</span> to get a deep AI breakdown of every rule
          that fired for this setup — thesis, entry note, and invalidation conditions.
        </div>
      )}
    </section>
  );
}


// ─── CVD Panel ───────────────────────────────────────────────────────────────

type CvdData = {
  times: number[];
  delta: number[];
  cvd: number[];
  close: number[];
  divergence: { bearish: boolean; bullish: boolean };
};

function CvdPanel({ cvdData }: { cvdData: CvdData }) {
  const { cvd, delta, divergence } = cvdData;
  if (!cvd?.length) return null;

  // Mini sparkline — just show last 60 bars
  const tail    = 60;
  const cvdSlice = cvd.slice(-tail);
  const dltSlice = delta.slice(-tail);
  const minCvd  = Math.min(...cvdSlice);
  const maxCvd  = Math.max(...cvdSlice);
  const rangeCvd = maxCvd - minCvd || 1;

  const W = 300, H = 52;
  const xs = cvdSlice.map((_, i) => (i / (cvdSlice.length - 1)) * W);
  const ys = cvdSlice.map((v) => H - ((v - minCvd) / rangeCvd) * H);

  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const curCvd    = cvd[cvd.length - 1] || 0;
  const prevCvd   = cvd[cvd.length - 2] || 0;
  const cvdTrend  = curCvd > prevCvd ? 'rising' : curCvd < prevCvd ? 'falling' : 'flat';
  const cvdColor  = cvdTrend === 'rising' ? '#3ecf8e' : cvdTrend === 'falling' ? '#f87171' : '#888';

  // Latest delta bar
  const lastDelta  = dltSlice[dltSlice.length - 1] || 0;
  const maxAbsDelta = Math.max(...dltSlice.map(Math.abs), 1);

  function fmtLarge(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(0);
  }

  return (
    <section className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary flex items-center gap-2">
          <span>Δ</span> CVD · Cumulative Volume Delta
        </h3>
        <div className="flex items-center gap-2">
          {divergence.bullish && (
            <span className="text-[10px] px-1.5 py-0.5 bg-long/10 text-long border border-long/25 rounded-sm">
              🟢 Bull Div
            </span>
          )}
          {divergence.bearish && (
            <span className="text-[10px] px-1.5 py-0.5 bg-short/10 text-short border border-short/25 rounded-sm">
              🔴 Bear Div
            </span>
          )}
          <span className={`text-xs font-mono font-medium ${cvdTrend === 'rising' ? 'text-long' : cvdTrend === 'falling' ? 'text-short' : 'text-text-tertiary'}`}>
            {fmtLarge(curCvd)}
          </span>
        </div>
      </header>

      <div className="px-5 py-4 space-y-3">
        {/* CVD sparkline */}
        <div className="relative" style={{ height: `${H}px` }}>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {/* Zero line */}
            <line
              x1="0" y1={H - ((0 - minCvd) / rangeCvd) * H}
              x2={W}  y2={H - ((0 - minCvd) / rangeCvd) * H}
              stroke="#333" strokeWidth="0.5" strokeDasharray="3,3"
            />
            {/* CVD line */}
            <path d={pathD} fill="none" stroke={cvdColor} strokeWidth="1.5" />
            {/* Last point dot */}
            <circle
              cx={xs[xs.length - 1].toFixed(1)}
              cy={ys[ys.length - 1].toFixed(1)}
              r="2.5"
              fill={cvdColor}
            />
          </svg>
        </div>

        {/* Latest delta bar */}
        <div>
          <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-1">
            Latest Δ candle
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-rule rounded-sm overflow-hidden relative">
              <div
                className={`absolute h-full rounded-sm transition-all duration-500 ${
                  lastDelta >= 0 ? 'bg-long right-1/2' : 'bg-short left-1/2'
                }`}
                style={{ width: `${Math.abs(lastDelta) / maxAbsDelta * 50}%` }}
              />
            </div>
            <span className={`text-[11px] font-mono tabular w-16 text-right ${
              lastDelta >= 0 ? 'text-long' : 'text-short'
            }`}>
              {lastDelta >= 0 ? '+' : ''}{fmtLarge(lastDelta)}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-text-tertiary/60 leading-snug">
          Rising CVD = buyers dominating close levels · Divergence = hidden pressure
        </p>
      </div>
    </section>
  );
}


// ─── Liquidation Levels Card ──────────────────────────────────────────────────

type LiqLevel = {
  price: number;
  type: 'long_liq' | 'short_liq';
  touches: number;
  dist_pct: number;
  conviction: number;
};

function LiqLevelsCard({ levels, curPrice }: { levels: LiqLevel[]; curPrice: number }) {
  const [show, setShow] = useState(true);

  return (
    <section className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
      <header
        className="px-5 py-3 border-b border-rule-faint flex items-center justify-between cursor-pointer"
        onClick={() => setShow((s) => !s)}
      >
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary flex items-center gap-2">
          <span className="text-gold">⚡</span> Liquidation Clusters
        </h3>
        <span className="text-text-tertiary text-[11px]">{show ? '▲' : '▼'}</span>
      </header>

      {show && (
        <div className="divide-y divide-rule-faint">
          {levels.slice(0, 6).map((lv, i) => {
            const isAbove = lv.dist_pct > 0;
            const typeLabel = lv.type === 'long_liq' ? 'Short stops' : 'Long stops';
            const typeColor = lv.type === 'long_liq' ? 'text-short' : 'text-long';
            const convPct   = lv.conviction;

            return (
              <div key={i} className="px-5 py-2.5 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                {/* Level info */}
                <div>
                  <div className="font-mono text-sm tabular text-text-primary">
                    {fmt(lv.price, 6)}
                  </div>
                  <div className={`text-[10px] ${typeColor}`}>{typeLabel}</div>
                </div>

                {/* Distance */}
                <div className="text-right">
                  <div className={`text-xs font-mono tabular ${isAbove ? 'text-short' : 'text-long'}`}>
                    {lv.dist_pct > 0 ? '+' : ''}{lv.dist_pct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-text-tertiary">{lv.touches}× touched</div>
                </div>

                {/* Conviction bar */}
                <div className="w-14">
                  <div className="h-1 bg-rule rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${lv.type === 'long_liq' ? 'bg-short' : 'bg-long'}`}
                      style={{ width: `${convPct}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-text-tertiary/60 mt-0.5 text-right">{convPct}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}


// ─── Multi-TF Confluence ─────────────────────────────────────────────────────

const TF_ORDER = ['1d', '4h', '1h', '15m', '5m'];

function MultiTfConfluence({
  featsTf,
  biasTf,
  execTf,
  direction,
}: {
  featsTf: Record<string, any>;
  biasTf?: string;
  execTf?: string;
  direction?: string;
}) {
  // Sort TFs by canonical order
  const tfs = TF_ORDER.filter((tf) => featsTf[tf]);

  function trendEmoji(dir: string | undefined): string {
    if (dir === 'long')  return '🟢';
    if (dir === 'short') return '🔴';
    return '⚪';
  }

  function structureLabel(smc: any): string | null {
    if (!smc) return null;
    if (smc.last_structure) return smc.last_structure;
    if (smc.has_order_block) return 'OB';
    if (smc.unmitigated_fvg) return 'FVG';
    return null;
  }

  function alignColor(tfDir: string | undefined, bias: string | undefined): string {
    if (!tfDir || tfDir === 'none' || !bias || bias === 'none') return 'text-text-tertiary';
    return tfDir === bias ? 'text-long' : 'text-short';
  }

  const biasDir = direction === 'none' ? undefined : direction;

  // Count how many TFs align with the bias direction
  const alignCount = tfs.filter((tf) => {
    const d = featsTf[tf]?.trend?.direction;
    return d && d !== 'none' && d === biasDir;
  }).length;

  const confluenceScore = tfs.length > 0 ? Math.round((alignCount / tfs.length) * 100) : 0;
  const confluenceColor =
    confluenceScore >= 75 ? 'text-long' :
    confluenceScore >= 50 ? 'text-neutral' : 'text-short';

  return (
    <section className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary">Multi-TF Confluence</h3>
        {biasDir && (
          <span className={`text-xs font-medium tabular ${confluenceColor}`}>
            {alignCount}/{tfs.length} aligned
          </span>
        )}
      </header>

      <div className="px-5 py-3 space-y-1">
        {/* Legend row */}
        <div className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 text-[9px] uppercase tracking-widest text-text-tertiary/60 pb-1 border-b border-rule-faint mb-2">
          <span>TF</span>
          <span>Trend</span>
          <span>Structure</span>
          <span>Volume</span>
        </div>

        {tfs.map((tf) => {
          const f     = featsTf[tf];
          const trend = f?.trend || {};
          const smc   = f?.smc   || {};
          const vol   = f?.volume || {};
          const isBias = tf === biasTf;
          const isExec = tf === execTf;
          const tfDir  = trend.direction;
          const struct = structureLabel(smc);

          return (
            <div
              key={tf}
              className={`grid grid-cols-[40px_1fr_1fr_1fr] gap-2 py-1.5 items-center rounded-sm transition-colors ${
                isBias ? 'bg-gold/5 -mx-2 px-2' :
                isExec ? 'bg-canvas-inset/40 -mx-2 px-2' : ''
              }`}
            >
              {/* TF label */}
              <div className="flex items-center gap-1">
                <span className={`font-mono text-xs font-medium ${
                  isBias ? 'text-gold' : isExec ? 'text-text-primary' : 'text-text-secondary'
                }`}>
                  {tf}
                </span>
                {isBias && (
                  <span className="text-[8px] text-gold/60 uppercase">bias</span>
                )}
                {isExec && !isBias && (
                  <span className="text-[8px] text-text-tertiary/60 uppercase">exec</span>
                )}
              </div>

              {/* Trend direction */}
              <div className="flex items-center gap-1.5">
                <span>{trendEmoji(tfDir)}</span>
                <span className={`text-[11px] font-medium capitalize ${alignColor(tfDir, biasDir)}`}>
                  {tfDir === 'none' ? '—' : tfDir || '—'}
                </span>
              </div>

              {/* Structure */}
              <div>
                {struct ? (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border font-medium ${
                    tfDir === 'long'  ? 'bg-long/10 text-long border-long/25' :
                    tfDir === 'short' ? 'bg-short/10 text-short border-short/25' :
                    'bg-rule/30 text-text-tertiary border-rule'
                  }`}>
                    {struct}
                  </span>
                ) : (
                  <span className="text-[10px] text-text-tertiary/40">—</span>
                )}
              </div>

              {/* Volume */}
              <div className="text-[10px] text-text-tertiary">
                {vol.spike     && <span className="text-long font-medium">↑ spike</span>}
                {vol.expansion && !vol.spike && <span className="text-gold">expand</span>}
                {vol.dry_up    && <span className="text-short">↓ dry</span>}
                {vol.compression && !vol.dry_up && <span className="text-neutral">squeeze</span>}
                {!vol.spike && !vol.expansion && !vol.dry_up && !vol.compression && (
                  <span className="text-text-tertiary/40">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confluence bar */}
      {biasDir && tfs.length > 0 && (
        <div className="px-5 pb-4 pt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-widest text-text-tertiary">
              Trend alignment ({biasDir})
            </span>
            <span className={`text-[10px] font-medium ${confluenceColor}`}>
              {confluenceScore}%
            </span>
          </div>
          <div className="h-1 bg-rule rounded-sm overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                confluenceScore >= 75 ? 'bg-long' :
                confluenceScore >= 50 ? 'bg-neutral' : 'bg-short'
              }`}
              style={{ width: `${confluenceScore}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}


// ─── Fibonacci / OTE Card ─────────────────────────────────────────────────────

type FibLv = { ratio: number; price: number; label: string; is_ote: boolean };
type FibCardData = {
  direction: string;
  swing_high: number;
  swing_low: number;
  levels: FibLv[];
  ote_zone: { low: number; high: number };
  ote_mid: number;
  in_ote: boolean;
  cur_ratio: number | null;
  cur_price: number;
};

function OteFibCard({ fibData }: { fibData: FibCardData }) {
  const [open, setOpen] = useState(true);
  if (!fibData?.levels?.length) return null;

  const { direction, swing_high, swing_low, levels, ote_zone, in_ote, cur_ratio, cur_price } = fibData;
  const isBull = direction === 'bullish';
  const rng    = swing_high - swing_low;

  // Key levels to display (skip extensions for main table)
  const mainLevels = levels.filter((lv) => lv.ratio <= 1.0);
  const extLevels  = levels.filter((lv) => lv.ratio > 1.0);

  // Visualize where cur_price sits between swing_low and swing_high
  const barPct = rng > 0
    ? Math.max(0, Math.min(100, ((cur_price - swing_low) / rng) * 100))
    : 50;

  return (
    <section className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
      <header
        className="px-5 py-3 border-b border-rule-faint flex items-center justify-between cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary flex items-center gap-2">
          <span className="text-gold">Φ</span> Fibonacci Retracement
          {in_ote && (
            <span className="px-1.5 py-0.5 text-[10px] bg-gold/15 text-gold border border-gold/30 rounded-sm animate-pulse">
              ⚡ In OTE
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {cur_ratio !== null && (
            <span className="text-[11px] font-mono text-text-tertiary">
              {(cur_ratio * 100).toFixed(1)}% retrace
            </span>
          )}
          <span className="text-text-tertiary text-[11px]">{open ? '▲' : '▼'}</span>
        </div>
      </header>

      {open && (
        <div className="px-5 py-4 space-y-4">

          {/* Swing range visualizer */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-text-tertiary font-mono">
              <span>Low {fmt(swing_low, 6)}</span>
              <span>High {fmt(swing_high, 6)}</span>
            </div>
            {/* Bar from low to high */}
            <div className="relative h-5 bg-rule rounded-sm overflow-hidden">
              {/* OTE zone band */}
              {(() => {
                const oteL = Math.max(0, Math.min(100, ((ote_zone.low  - swing_low) / rng) * 100));
                const oteH = Math.max(0, Math.min(100, ((ote_zone.high - swing_low) / rng) * 100));
                return (
                  <div
                    className="absolute inset-y-0 bg-gold/25 border-l border-r border-gold/60"
                    style={{ left: `${oteL}%`, right: `${100 - oteH}%` }}
                  />
                );
              })()}
              {/* Current price marker */}
              <div
                className="absolute inset-y-0 w-0.5 bg-white/80"
                style={{ left: `${barPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gold/70">
              <span style={{ marginLeft: `${Math.max(0, Math.min(80, ((ote_zone.low - swing_low) / rng) * 100 - 2))}%` }}>
                OTE 61.8%
              </span>
              <span>78.6%</span>
            </div>
          </div>

          {/* OTE zone summary */}
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border ${
            in_ote
              ? 'bg-gold/10 border-gold/40'
              : 'bg-canvas border-rule-faint'
          }`}>
            <div className="text-xl">{in_ote ? '⚡' : isBull ? '📉' : '📈'}</div>
            <div>
              <div className="text-xs font-medium text-text-primary">
                {in_ote
                  ? 'Price is inside the OTE Zone — prime entry area'
                  : `OTE zone: ${fmt(ote_zone.low, 6)} – ${fmt(ote_zone.high, 6)}`
                }
              </div>
              <div className="text-[10px] text-text-tertiary mt-0.5">
                {isBull ? '↗ Bullish setup' : '↘ Bearish setup'} ·{' '}
                {cur_ratio !== null
                  ? `${(cur_ratio * 100).toFixed(1)}% retracement from ${isBull ? 'high' : 'low'}`
                  : 'Awaiting retracement'}
              </div>
            </div>
          </div>

          {/* Level table */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-2">Key Levels</div>
            <div className="space-y-0.5">
              {mainLevels.map((lv) => {
                const isCurrent = cur_ratio !== null && Math.abs(cur_ratio - lv.ratio) < 0.04;
                const distPct   = cur_price > 0 ? ((lv.price - cur_price) / cur_price) * 100 : 0;
                return (
                  <div
                    key={lv.ratio}
                    className={`flex items-center gap-3 px-2 py-1 rounded-sm text-xs ${
                      lv.is_ote
                        ? 'bg-gold/8 border border-gold/20'
                        : isCurrent
                        ? 'bg-rule/50'
                        : ''
                    }`}
                  >
                    <span className={`w-12 font-mono text-[11px] ${lv.is_ote ? 'text-gold font-medium' : 'text-text-tertiary'}`}>
                      {lv.label}
                    </span>
                    <span className="flex-1 font-mono tabular text-text-primary">
                      {fmt(lv.price, 6)}
                    </span>
                    <span className={`text-[10px] font-mono ${distPct > 0 ? 'text-short' : distPct < 0 ? 'text-long' : 'text-text-tertiary'}`}>
                      {distPct > 0 ? '+' : ''}{distPct.toFixed(2)}%
                    </span>
                    {lv.is_ote && (
                      <span className="text-[9px] text-gold/70">OTE</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Extensions */}
            {extLevels.length > 0 && (
              <div className="mt-3 pt-3 border-t border-rule-faint">
                <div className="text-[10px] uppercase tracking-widest text-text-tertiary/60 mb-2">TP Extensions</div>
                <div className="space-y-0.5">
                  {extLevels.map((lv) => {
                    const distPct = cur_price > 0 ? ((lv.price - cur_price) / cur_price) * 100 : 0;
                    return (
                      <div key={lv.ratio} className="flex items-center gap-3 px-2 py-1 text-xs">
                        <span className="w-12 font-mono text-[11px] text-text-tertiary/60">{lv.label}</span>
                        <span className="flex-1 font-mono tabular text-text-tertiary">{fmt(lv.price, 6)}</span>
                        <span className={`text-[10px] font-mono ${distPct > 0 ? 'text-short/70' : 'text-long/70'}`}>
                          {distPct > 0 ? '+' : ''}{distPct.toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}


export default function SymbolPage({ params }: { params: { symbol: string } }) {
  const symbol = decodeURIComponent(params.symbol);
  return (
    <Suspense fallback={<div className="px-8 py-10 text-text-tertiary">Loading…</div>}>
      <SymbolInner symbol={symbol} />
    </Suspense>
  );
}
