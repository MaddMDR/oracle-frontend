'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, Signal } from '@/lib/api';
import FilterBar from '@/components/FilterBar';
import SignalTable from '@/components/SignalTable';

function AuguryInner() {
  const sp = useSearchParams();
  const [mode, setMode] = useState(sp.get('mode') || '');
  const [direction, setDirection] = useState('');
  const [quality, setQuality] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setMode(sp.get('mode') || '');
  }, [sp]);

  const params = new URLSearchParams();
  if (mode) params.set('mode', mode);
  if (direction) params.set('direction', direction);
  if (quality) params.set('quality', quality);
  params.set('min_score', String(minScore));
  params.set('limit', '500');

  const { data, mutate, isLoading } = useSWR<Signal[]>(`/api/signals?${params}`, fetcher, {
    refreshInterval: 30000,
  });

  const query = search.trim().toUpperCase().replace('/', '');
  const filtered = (data || []).filter((s) =>
    !query || s.symbol.replace('/USDT', '').includes(query) || s.symbol.includes(query)
  );

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="mb-6 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Screener</div>
        <h1 className="font-display text-5xl text-text-primary">
          Signal <span className="font-display-italic text-gold">list</span>
        </h1>
        <p className="text-text-secondary mt-2 max-w-2xl">
          All candidates ranked by composite score. Filter by mode, direction, and quality.
        </p>
      </header>

      <div className="rise rise-2">
        <FilterBar
          mode={mode} direction={direction} quality={quality} minScore={minScore}
          onChange={(s) => {
            if (s.mode !== undefined) setMode(s.mode);
            if (s.direction !== undefined) setDirection(s.direction);
            if (s.quality !== undefined) setQuality(s.quality);
            if (s.minScore !== undefined) setMinScore(s.minScore);
          }}
          onScanned={() => mutate()}
        />
      </div>

      {/* Coin search */}
      <div className="rise rise-3 mb-3">
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm pointer-events-none">
            ⌕
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coin… BTC, ETH, SOL"
            className="w-full pl-8 pr-3 py-2 text-sm bg-canvas-raised border border-rule rounded-sm
                       text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-gold/50 focus:bg-canvas-deep/60
                       transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="rise rise-4">
        {isLoading ? (
          <div className="bg-canvas-raised border border-rule rounded-sm px-5 py-16 text-center">
            <div className="font-display-italic text-text-secondary text-lg">Consulting the chamber…</div>
          </div>
        ) : (
          <SignalTable signals={filtered} />
        )}
      </div>

      {data && data.length > 0 && (
        <div className="mt-3 text-xs text-text-tertiary text-right">
          {query
            ? `${filtered.length} of ${data.length} candidates matching "${search.toUpperCase()}"`
            : `${data.length} candidate${data.length !== 1 ? 's' : ''} shown`}
        </div>
      )}
    </main>
  );
}

export default function AuguryPage() {
  return (
    <Suspense fallback={<div className="px-8 py-10 text-text-tertiary">Loading…</div>}>
      <AuguryInner />
    </Suspense>
  );
}
