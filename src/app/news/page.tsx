'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, post , fmtTs, fmtDate} from '@/lib/api';

function SentimentBadge({ value }: { value?: string }) {
  if (!value || value === 'neutral') return null;
  const isBull = value === 'bullish';
  return (
    <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-medium uppercase tracking-wide border ${
      isBull
        ? 'text-long bg-long/10 border-long/20'
        : 'text-short bg-short/10 border-short/20'
    }`}>
      {isBull ? '▲ bullish' : '▼ bearish'}
    </span>
  );
}

export default function DispatchesPage() {
  const [symbol, setSymbol]       = useState('');
  const [submitted, setSubmitted] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [notice, setNotice]       = useState('');

  const { data: market, mutate: mutateMarket } = useSWR<{ items: any[] }>('/api/news?limit=50', fetcher);
  const { data: symData } = useSWR(
    submitted ? `/api/news/${encodeURIComponent(submitted)}` : null,
    fetcher,
  );

  async function refresh() {
    setRefreshing(true);
    setNotice('');
    try {
      const r = await post('/api/news/refresh');
      await mutateMarket();
      setNotice(`✓ ${r.inserted} artikel baru diambil & di-tag sentiment.`);
    } catch (e: any) {
      setNotice(`✗ Gagal: ${e.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function backfillSentiment() {
    setBackfilling(true);
    setNotice('');
    try {
      const r = await post('/api/news/backfill-sentiment');
      setNotice(`✓ ${r.updated} artikel di-tag ulang dengan FinBERT/VADER.`);
    } catch (e: any) {
      setNotice(`✗ Gagal: ${e.message}`);
    } finally {
      setBackfilling(false);
    }
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setSubmitted(s.includes('/') ? s : `${s}/USDT`);
  }

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-8 rise rise-1">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold mb-3">News</div>
          <h1 className="font-display text-5xl text-text-primary">
            News <span className="font-display-italic text-gold">feed</span>
          </h1>
          <p className="text-text-secondary mt-2 max-w-2xl">
            Headlines aggregated from multiple crypto sources. 7-day rolling window · stored locally.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={refresh}
              disabled={refreshing || backfilling}
              className="px-5 py-2.5 text-sm font-medium bg-canvas-raised border border-rule text-text-secondary hover:text-text-primary hover:border-rule-strong rounded-sm disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh feeds'}
            </button>
            <button
              onClick={backfillSentiment}
              disabled={refreshing || backfilling}
              title="Tag sentiment pada artikel lama yang belum memiliki label (FinBERT / VADER)"
              className="px-4 py-2.5 text-sm font-medium bg-canvas-raised border border-rule text-text-secondary hover:text-text-primary hover:border-rule-strong rounded-sm disabled:opacity-50"
            >
              {backfilling ? 'Tagging…' : '◈ Tag Sentiment'}
            </button>
          </div>
          {notice && (
            <p className={`text-[11px] ${notice.startsWith('✓') ? 'text-long' : 'text-short'}`}>
              {notice}
            </p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-4 rise rise-2">
          <form onSubmit={search} className="flex gap-2 mb-4">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Search ETH or BTC/USDT…"
              className="flex-1 bg-canvas-raised border border-rule px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary rounded-sm focus:border-gold focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 text-sm bg-gold/10 border border-gold/40 text-gold-400 hover:bg-gold/20 rounded-sm"
            >
              Search
            </button>
          </form>

          {submitted && (
            <article className="bg-canvas-raised border border-rule rounded-sm">
              <header className="px-5 py-3 border-b border-rule-faint">
                <h3 className="text-xs uppercase tracking-widest text-text-tertiary">
                  {submitted}
                </h3>
              </header>

              {symData?.summary?.summary_id && (
                <div className="px-5 py-4 border-b border-rule-faint">
                  <blockquote className="font-display-italic text-lg text-text-primary leading-snug border-l border-gold/40 pl-4">
                    "{symData.summary.summary_id}"
                  </blockquote>

                  {/* Overall sentiment pill */}
                  <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-widest">
                    <span className="text-text-tertiary">Overall sentiment:</span>
                    <span className={`px-2 py-0.5 rounded-sm font-medium border ${
                      symData.summary.sentiment === 'bullish'
                        ? 'text-long bg-long/10 border-long/30'
                        : symData.summary.sentiment === 'bearish'
                        ? 'text-short bg-short/10 border-short/30'
                        : 'text-neutral bg-neutral/10 border-neutral/30'
                    }`}>
                      {symData.summary.sentiment}
                    </span>
                  </div>

                  {symData.summary.catalysts?.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs uppercase tracking-widest text-text-tertiary mb-2">Catalysts</div>
                      <ul className="space-y-1 text-sm text-text-primary">
                        {symData.summary.catalysts.map((c: string, i: number) => (
                          <li key={i} className="flex gap-2"><span className="text-long font-bold">+</span>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {symData.summary.risks?.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs uppercase tracking-widest text-text-tertiary mb-2">Risks</div>
                      <ul className="space-y-1 text-sm text-text-primary">
                        {symData.summary.risks.map((c: string, i: number) => (
                          <li key={i} className="flex gap-2"><span className="text-short font-bold">!</span>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {symData?.items?.length > 0 ? (
                <ul className="px-5 py-3 space-y-3">
                  {symData.items.slice(0, 8).map((n: any) => {
                    // Match this article to a sentiment_breakdown entry by title prefix
                    const breakdown = symData.summary?.sentiment_breakdown?.find(
                      (b: any) => n.title?.toLowerCase().includes((b.title || '').toLowerCase().slice(0, 30))
                    );
                    return (
                      <li key={n.id} className="border-b border-rule-faint last:border-b-0 pb-3 last:pb-0">
                        <a href={n.url} target="_blank" rel="noreferrer" className="block group">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-text-tertiary mb-1">
                            <span>{n.source}</span>
                            <div className="flex items-center gap-2">
                              {/* FinBERT/VADER per-article sentiment */}
                              <SentimentBadge value={n.sentiment} />
                              {/* AI breakdown sentiment (overrides if available) */}
                              {breakdown && breakdown.sentiment !== 'neutral' && (
                                <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-medium border ${
                                  breakdown.sentiment === 'bullish'
                                    ? 'text-long bg-long/10 border-long/20'
                                    : breakdown.sentiment === 'bearish'
                                    ? 'text-short bg-short/10 border-short/20'
                                    : 'text-neutral bg-neutral/10 border-neutral/20'
                                }`} title={`AI: ${breakdown.reason}`}>
                                  AI: {breakdown.sentiment}
                                </span>
                              )}
                              <span className="tabular">{n.published_at && fmtDate(n.published_at)}</span>
                            </div>
                          </div>
                          <div className="text-sm text-text-secondary group-hover:text-text-primary leading-snug">
                            {n.title}
                          </div>
                          {breakdown?.reason && (
                            <div className="text-[10px] text-text-tertiary mt-0.5 italic">{breakdown.reason}</div>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-5 py-6 text-sm text-text-tertiary">No matching dispatches found.</div>
              )}
            </article>
          )}
        </section>

        <section className="col-span-12 lg:col-span-8 rise rise-3">
          <div className="bg-canvas-raised border border-rule rounded-sm">
            <header className="px-5 py-3 border-b border-rule-faint flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest text-text-tertiary">Market Feed</h3>
              <div className="flex items-center gap-3 text-[10px]">
                {market?.items?.length ? (() => {
                  const bull  = market.items.filter((n: any) => n.sentiment === 'bullish').length;
                  const bear  = market.items.filter((n: any) => n.sentiment === 'bearish').length;
                  return (
                    <>
                      {bull > 0 && <span className="text-long tabular">▲ {bull}</span>}
                      {bear > 0 && <span className="text-short tabular">▼ {bear}</span>}
                      <span className="text-text-tertiary tabular">{market.items.length} articles</span>
                    </>
                  );
                })() : <span className="text-text-tertiary tabular">0 articles</span>}
              </div>
            </header>
            <ul className="divide-y divide-rule-faint max-h-[75vh] overflow-y-auto thin-scrollbar">
              {market?.items?.length ? (
                market.items.map((n: any) => (
                  <li key={n.id}>
                    <a href={n.url} target="_blank" rel="noreferrer" className="block px-5 py-4 hover:bg-canvas-inset/40 group">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-text-tertiary mb-1.5">
                        <span>{n.source}</span>
                        <div className="flex items-center gap-2">
                          <SentimentBadge value={n.sentiment} />
                          <span className="tabular">{n.published_at && fmtTs(n.published_at)}</span>
                        </div>
                      </div>
                      <div className="text-base text-text-secondary group-hover:text-text-primary leading-snug">
                        {n.title}
                      </div>
                    </a>
                  </li>
                ))
              ) : (
                <li className="px-5 py-16 text-center">
                  <div className="font-display-italic text-text-secondary text-lg">No dispatches yet</div>
                  <p className="text-text-tertiary text-sm mt-2">
                    Hit <span className="text-gold-400">↻ Refresh feeds</span> to populate.
                  </p>
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
