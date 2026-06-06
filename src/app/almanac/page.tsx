'use client';

import useSWR from 'swr';
import { fetcher, post, EconomicEvent , fmtTs} from '@/lib/api';
import { useState } from 'react';

export default function CalendarPage() {
  const { data: events, mutate } = useSWR<EconomicEvent[]>(
    '/api/calendar/upcoming?hours_ahead=168&high_impact_only=true',
    fetcher,
    { refreshInterval: 60_000 },
  );
  const { data: blackout } = useSWR<{ blackout: boolean; event: any }>(
    '/api/calendar/blackout',
    fetcher,
    { refreshInterval: 30_000 },
  );
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await post('/api/calendar/refresh');
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="max-w-[1280px] mx-auto px-8 py-10">
      <header className="mb-10 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Economic Calendar</div>
        <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
          Macro <span className="font-display-italic text-gold">schedule</span>
        </h1>
        <p className="text-text-secondary max-w-2xl">
          Key data releases (e.g. CPI, interest rates, employment) often spike crypto volatility.
          During blackout windows, the scanner may hold new signals to avoid news-driven whipsaws.
        </p>
      </header>

      <section className={`mb-8 p-5 rounded-sm border rise rise-2 ${
        blackout?.blackout
          ? 'border-short/50 bg-short/10'
          : 'border-rule bg-canvas-raised'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary">Now</div>
            <div className={`font-display text-2xl ${blackout?.blackout ? 'text-short' : 'text-long'}`}>
              {blackout?.blackout ? 'BLACKOUT ACTIVE' : 'Clear'}
            </div>
            {blackout?.event && (
              <div className="text-sm text-text-secondary mt-1">
                {blackout.event.title} · {blackout.event.country} ·{' '}
                {fmtTs(blackout.event.event_time)}
              </div>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="text-xs px-3 py-1.5 border border-gold/40 text-gold hover:bg-gold/10 rounded-sm"
          >
            {refreshing ? 'Pulling…' : 'Refresh feed'}
          </button>
        </div>
      </section>

      <section className="rise rise-3">
        <h2 className="font-display text-3xl text-text-primary mb-4">Upcoming · 7d</h2>
        {!events ? (
          <div className="text-text-tertiary">Loading…</div>
        ) : events.length === 0 ? (
          <div className="bg-canvas-raised border border-rule rounded-sm p-5 text-text-tertiary text-xs">
            No high-impact events in the window. (You may want to refresh the feed.)
          </div>
        ) : (
          <div className="bg-canvas-raised border border-rule rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-text-tertiary text-[10px] uppercase tracking-widest bg-canvas-deep/60">
                <tr>
                  <th className="text-left px-4 py-3">When (local)</th>
                  <th className="text-left">Country</th>
                  <th className="text-left">Event</th>
                  <th className="text-right">Forecast</th>
                  <th className="text-right">Previous</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} className="border-t border-rule-faint">
                    <td className="px-4 py-2 text-text-primary tabular">
                      {fmtTs(e.event_time)}
                    </td>
                    <td className="text-text-secondary">{e.country}</td>
                    <td className="text-text-primary">{e.title}</td>
                    <td className="text-right text-text-tertiary tabular">{e.forecast || '—'}</td>
                    <td className="text-right text-text-tertiary tabular">{e.previous || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
