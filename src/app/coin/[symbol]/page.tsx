'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, authHeaders } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────

interface PriceData {
  symbol: string;
  last: number;
  change_pct: number | null;
  quote_volume: number;
}

interface NewsItem {
  id: number;
  symbol: string | null;
  source: string;
  title: string;
  url: string;
  published_at: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface SignalData {
  id: number;
  symbol: string;
  mode: string;
  direction: string;
  score: number;
  quality: string;
  action: string;
  bias_tf: string;
  exec_tf: string;
  last_price: number;
  created_at: string;
}

interface ZoneData {
  id: number;
  zone_type: string;
  direction: string;
  source_tf: string;
  zone_high: number;
  zone_low: number;
  quality_score: number;
  status: string;
  proximity_pct: number | null;
  premium_discount: string;
}

interface Brief {
  symbol: string;
  base: string;
  price: PriceData | null;
  news: NewsItem[];
  news_type: 'coin' | 'market';
  signal: SignalData | null;
  zones: ZoneData[];
}

interface Narrative {
  narrative: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  structure: string;
  catalyst: string;
  watch_level: string;
  opportunity: string;
  risk: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return '—';
  return v < 0.001 ? v.toFixed(8) : v < 1 ? v.toFixed(6) : v < 100 ? v.toFixed(4) : v.toFixed(2);
}

function fmtVolume(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PriceHero({ symbol, price }: { symbol: string; price: PriceData | null }) {
  const base = symbol.replace('/USDT', '');
  const change = price?.change_pct;
  const isUp = (change ?? 0) >= 0;

  return (
    <div className="flex items-start gap-6 flex-wrap">
      <div>
        <div className="font-display text-5xl text-text-primary tracking-tight">{base}</div>
        <div className="text-text-tertiary text-xs mt-1 uppercase tracking-widest">/USDT · Spot</div>
      </div>
      {price ? (
        <div className="flex items-end gap-8 mt-1">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Last Price</div>
            <div className="font-display text-3xl text-text-primary tabular">${fmtPrice(price.last)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">24h Change</div>
            <div className={`font-display text-2xl tabular ${isUp ? 'text-long' : 'text-short'}`}>
              {change != null ? `${isUp ? '+' : ''}${change.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">24h Volume</div>
            <div className="font-display text-2xl text-text-secondary tabular">{fmtVolume(price.quote_volume)}</div>
          </div>
        </div>
      ) : (
        <div className="text-text-tertiary text-sm italic mt-3">
          Not in top-pair list — coin may be low volume or not on primary exchange.
        </div>
      )}
    </div>
  );
}

function BiasChip({ bias }: { bias: string }) {
  const styles: Record<string, string> = {
    bullish: 'text-long border-long/40 bg-long/8',
    bearish: 'text-short border-short/40 bg-short/8',
    neutral: 'text-text-secondary border-rule',
  };
  const icons: Record<string, string> = {
    bullish: '▲', bearish: '▼', neutral: '◈',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-sm border ${styles[bias] || styles.neutral}`}>
      {icons[bias] || '◈'} {bias}
    </span>
  );
}

function StructureChip({ structure }: { structure: string }) {
  const styles: Record<string, string> = {
    rally:        'text-long border-long/30 bg-long/5',
    correction:   'text-gold border-gold/40 bg-gold/5',
    accumulation: 'text-gold border-gold/30 bg-gold/5',
    ranging:      'text-text-secondary border-rule',
    breakdown:    'text-short border-short/30 bg-short/5',
    unknown:      'text-text-tertiary border-rule-faint',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-medium rounded-sm border ${styles[structure] || styles.unknown}`}>
      {structure}
    </span>
  );
}

function NarrativeCard({
  narrative,
  loading,
  onRegenerate,
}: {
  narrative: Narrative | null;
  loading: boolean;
  onRegenerate: () => void;
}) {
  if (loading) {
    return (
      <div className="bg-canvas-raised border border-rule rounded-sm px-6 py-5">
        <div className="flex items-center gap-2 text-text-tertiary text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          Generating AI narrative…
        </div>
      </div>
    );
  }

  if (!narrative) return null;

  return (
    <div className="bg-canvas-raised border border-gold/20 rounded-sm px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-gold font-medium">AI Brief</span>
          <BiasChip bias={narrative.bias} />
          <StructureChip structure={narrative.structure} />
        </div>
        <button
          onClick={onRegenerate}
          className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
          title="Regenerate narrative"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Main narrative */}
      <p className="text-text-primary text-sm leading-relaxed mb-4">{narrative.narrative}</p>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-4 pt-4 border-t border-rule-faint">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-1">Catalyst</div>
          <div className="text-xs text-text-secondary">{narrative.catalyst || '—'}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-1">Watch Level</div>
          <div className="text-xs font-mono text-text-primary">{narrative.watch_level || '—'}</div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-1">Opportunity</div>
          <div className="text-xs text-long">{narrative.opportunity || '—'}</div>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <div className="text-[9px] uppercase tracking-widest text-text-tertiary mb-1">Risk</div>
          <div className="text-xs text-short/80">{narrative.risk || '—'}</div>
        </div>
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: SignalData }) {
  const isLong = signal.direction === 'long';
  const qualityColor = signal.quality === 'high' ? 'text-long' : signal.quality === 'medium' ? 'text-gold' : 'text-text-tertiary';
  return (
    <div className="bg-canvas-raised border border-rule rounded-sm px-5 py-4">
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-3">Active Signal</div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${isLong ? 'text-long' : 'text-short'}`}>
            {isLong ? '▲' : '▼'} {signal.direction.toUpperCase()}
          </span>
          <span className="text-xs text-text-tertiary">{signal.mode} · {signal.bias_tf}→{signal.exec_tf}</span>
          <span className={`text-xs font-medium ${qualityColor}`}>{signal.quality}</span>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] text-text-tertiary mr-1.5">Score</span>
            <span className="font-display text-xl text-text-primary tabular">{Math.round(signal.score)}</span>
            <span className="text-xs text-text-tertiary">/100</span>
          </div>
          <Link
            href={`/symbol/${encodeURIComponent(signal.symbol)}`}
            className="px-3 py-1.5 text-xs border border-gold/40 text-gold hover:bg-gold/5 rounded-sm transition-colors"
          >
            Full Analysis →
          </Link>
        </div>
      </div>
      {signal.action && (
        <div className="mt-2 text-xs text-text-tertiary">{signal.action}</div>
      )}
    </div>
  );
}

function ZonesPanel({ zones }: { zones: ZoneData[] }) {
  return (
    <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-rule-faint">
        <span className="text-[10px] uppercase tracking-widest text-text-tertiary">Key Zones</span>
      </div>
      <div className="divide-y divide-rule-faint">
        {zones.map((z) => {
          const isLong = z.direction === 'long';
          const isApproaching = z.status === 'approaching';
          return (
            <div key={z.id} className="px-5 py-3 flex items-center gap-4 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-sm border font-medium ${
                isLong ? 'text-long border-long/30 bg-long/5' : 'text-short border-short/30 bg-short/5'
              }`}>
                {z.zone_type.toUpperCase()}
              </span>
              <span className="text-xs text-text-secondary">{z.source_tf}</span>
              <div className="font-mono text-xs text-text-primary">
                <span className="text-short-dim">{fmtPrice(z.zone_high)}</span>
                <span className="text-text-tertiary mx-1">–</span>
                <span className="text-long-dim">{fmtPrice(z.zone_low)}</span>
              </div>
              {isApproaching && (
                <span className="text-[10px] text-gold font-medium">⚡ Approaching{z.proximity_pct != null ? ` (${z.proximity_pct.toFixed(1)}%)` : ''}</span>
              )}
              <span className="text-[10px] text-text-tertiary ml-auto">Q: {Math.round(z.quality_score)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SentimentDot({ sentiment }: { sentiment: string }) {
  const c = sentiment === 'bullish' ? 'bg-long' : sentiment === 'bearish' ? 'bg-short' : 'bg-neutral';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${c}`} />;
}

function NewsFeed({ news, newsType, symbol }: { news: NewsItem[]; newsType?: 'coin' | 'market'; symbol: string }) {
  const base = symbol.replace('/USDT', '');
  const isCoinNews = newsType === 'coin';

  if (!news.length) {
    return (
      <div className="bg-canvas-raised border border-rule rounded-sm px-5 py-8 text-center">
        <div className="text-text-tertiary text-sm">Tidak ada berita untuk {base}</div>
        <p className="text-text-tertiary text-xs mt-1 opacity-60">
          {base} mungkin belum terlalu besar untuk diliput media crypto mainstream.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-text-tertiary">
          {isCoinNews ? `Berita ${base}` : 'Market News'}
        </span>
        {!isCoinNews && (
          <span className="text-[10px] text-amber-400/70 flex items-center gap-1">
            <span>⚠</span>
            <span>Tidak ada berita spesifik untuk {base} — menampilkan market news</span>
          </span>
        )}
        {isCoinNews && (
          <span className="text-[10px] text-gold/60">{news.length} artikel</span>
        )}
      </div>
      <div className="divide-y divide-rule-faint max-h-[600px] overflow-y-auto thin-scrollbar">
        {news.map((item) => {
          const isDirectHit = item.symbol === base || ((item.title + ' ' + (item.summary || '')).toLowerCase().includes(base.toLowerCase()));
          return (
            <a
              key={item.id}
              href={item.url.startsWith('listing://') ? undefined : item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex gap-3 px-5 py-3.5 hover:bg-canvas-inset/30 transition-colors group ${!isDirectHit && isCoinNews ? 'opacity-60' : ''}`}
            >
              <SentimentDot sentiment={item.sentiment} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary group-hover:text-gold-400 transition-colors leading-snug line-clamp-2">
                  {item.title}
                </p>
                {item.summary && (
                  <p className="text-xs text-text-tertiary mt-1 leading-snug line-clamp-2">
                    {item.summary}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-text-tertiary">{item.source}</span>
                  <span className="text-[10px] text-text-tertiary/50">·</span>
                  <span className="text-[10px] text-text-tertiary">{timeAgo(item.published_at)}</span>
                  {!isDirectHit && (
                    <>
                      <span className="text-[10px] text-text-tertiary/50">·</span>
                      <span className="text-[10px] text-text-tertiary/50">market</span>
                    </>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CoinPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  const displaySym = symbol.includes('/') ? symbol : `${symbol}/USDT`;

  const { data: brief, isLoading: briefLoading } = useSWR<Brief>(
    `/api/coins/${symbol}/brief`,
    fetcher,
    { refreshInterval: 60000 },
  );

  const [narrative, setNarrative]       = useState<Narrative | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const fetchNarrative = async (force = false) => {
    if (narrativeLoading) return;
    setNarrativeLoading(true);
    try {
      const res = await fetch(`${API}/api/coins/${symbol}/narrative`, { method: 'POST', headers: authHeaders() });
      if (res.ok) setNarrative(await res.json());
    } finally {
      setNarrativeLoading(false);
    }
  };

  // Auto-fetch narrative once brief loads
  useEffect(() => {
    if (brief && !narrative && !narrativeLoading) {
      fetchNarrative();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief]);

  const base = displaySym.replace('/USDT', '');

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      {/* Header */}
      <header className="mb-6 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Coin Brief</div>
        {briefLoading ? (
          <div className="font-display text-5xl text-text-tertiary">{base}</div>
        ) : (
          <PriceHero symbol={displaySym} price={brief?.price ?? null} />
        )}
      </header>

      {/* Narrative */}
      <div className="rise rise-2 mb-6">
        <NarrativeCard
          narrative={narrative}
          loading={narrativeLoading}
          onRegenerate={() => fetchNarrative(true)}
        />
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-6">
        {/* Left: signal + zones */}
        <div className="space-y-4 rise rise-3">
          {brief?.signal && <SignalCard signal={brief.signal} />}

          {(brief?.zones?.length ?? 0) > 0 && (
            <ZonesPanel zones={brief!.zones} />
          )}

          {!brief?.signal && !briefLoading && (
            <div className="bg-canvas-raised border border-rule rounded-sm px-5 py-6 text-center">
              <div className="text-text-tertiary text-sm">No active signal for {base}</div>
              <p className="text-text-tertiary text-xs mt-1">
                Run a scan to check for setups.
              </p>
              <Link href="/screener" className="inline-block mt-3 text-xs text-gold hover:underline">
                Go to Screener →
              </Link>
            </div>
          )}
        </div>

        {/* Right: news */}
        <div className="rise rise-4">
          <NewsFeed news={brief?.news ?? []} newsType={brief?.news_type} symbol={displaySym} />
        </div>
      </div>
    </main>
  );
}
