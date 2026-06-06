'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, authHeaders } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface AccumResult {
  symbol: string;
  score: number;
  verdict: 'high' | 'watch';
  breakdown: { oi: number; funding: number; lsr: number; zone: number };
  oi_change_24h_pct: number | null;
  funding_rate_pct: number;
  long_short_ratio: number | null;
  crowded_flag: string;
}

interface Zone {
  id: number;
  symbol: string;
  zone_type: string;
  direction: 'long' | 'short';
  source_tf: string;
  zone_high: number;
  zone_low: number;
  quality_score: number;
  displacement_strength: number;
  volume_ratio: number;
  is_fresh: boolean;
  touch_count: number;
  has_fvg_inside: boolean;
  is_at_htf_poi: boolean;
  htf_range_pct: number;
  premium_discount: string;
  status: string;
  proximity_pct: number | null;
  proximity_alerted: boolean;
  confirmation_status: string;
  created_at: string;
  expires_at: string;
  // Scanner signal context
  scanner_score: number | null;
  scanner_action: string | null;
  content_ready: boolean;
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return '—';
  return v < 0.001 ? v.toFixed(8) : v < 1 ? v.toFixed(6) : v < 100 ? v.toFixed(4) : v.toFixed(2);
}

function QualityBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-long' : score >= 50 ? 'bg-gold' : 'bg-neutral';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-rule rounded-sm overflow-hidden max-w-[80px]">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-sm tabular text-text-primary">{Math.round(score)}</span>
    </div>
  );
}

function StatusBadge({ status, confirmStatus }: { status: string; confirmStatus: string }) {
  const styles: Record<string, string> = {
    active:      'text-text-tertiary border-rule',
    approaching: 'text-gold border-gold/40 bg-gold/5',
    touched:     'text-neutral border-neutral/40 bg-neutral/5',
    invalidated: 'text-short/60 border-short/20',
  };
  const labels: Record<string, string> = {
    active:      'Active',
    approaching: '⚡ Approaching',
    touched:     '◎ Touched',
    invalidated: '✗ Invalid',
  };
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-sm border ${styles[status] || styles.active}`}>
        {labels[status] || status}
      </span>
      {confirmStatus === 'ltf_choch' && (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-sm border text-long border-long/40 bg-long/5">
          ✓ CHoCH
        </span>
      )}
    </div>
  );
}

function ZoneTypeBadge({ type, direction }: { type: string; direction: string }) {
  const isLong  = direction === 'long';
  const baseColor = isLong ? 'text-long border-long/30 bg-long/8' : 'text-short border-short/30 bg-short/8';
  const labels: Record<string, string> = {
    ob:        'OB',
    fvg:       'FVG',
    eq_highs:  'Eq. Highs',
    eq_lows:   'Eq. Lows',
    supply:    'Supply',
    demand:    'Demand',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-sm border ${baseColor}`}>
      {labels[type] || type.toUpperCase()}
    </span>
  );
}

function PremiumDiscountPip({ label }: { label: string }) {
  const c = label === 'discount' ? 'text-long' : label === 'premium' ? 'text-short' : 'text-text-tertiary';
  const e = label === 'discount' ? '🔵' : label === 'premium' ? '🟠' : '⚪';
  return <span className={`text-[11px] ${c}`}>{e} {label || '—'}</span>;
}

function AccumBadge({ result }: { result: AccumResult }) {
  const isHigh = result.verdict === 'high';
  return (
    <div
      className={`flex flex-col gap-0.5 px-2 py-1 rounded-sm border text-[10px] ${
        isHigh
          ? 'border-gold/50 bg-gold/8 text-gold'
          : 'border-rule text-text-tertiary'
      }`}
      title={`Accum score ${result.score}/100 · OI ${result.oi_change_24h_pct != null ? result.oi_change_24h_pct.toFixed(1)+'%' : 'n/a'} · Funding ${result.funding_rate_pct.toFixed(3)}%`}
    >
      <span className="font-medium tracking-wide">
        {isHigh ? '🐋 Accum' : '👁 Watch'}
      </span>
      <span className="text-[9px] opacity-70">{result.score}/100</span>
    </div>
  );
}

export default function ZonesPage() {
  const [direction, setDirection] = useState('');
  const [sourceTf,  setSourceTf]  = useState('');
  const [status,    setStatus]    = useState('');
  const [scanning,  setScanning]  = useState(false);

  const params = new URLSearchParams();
  if (direction) params.set('direction', direction);
  if (sourceTf)  params.set('source_tf', sourceTf);
  if (status)    params.set('status', status);
  params.set('min_quality', '30');
  params.set('limit', '300');

  const { data, mutate, isLoading } = useSWR<Zone[]>(
    `/api/zones?${params}`,
    fetcher,
    { refreshInterval: 30000 },
  );

  const { data: accumData } = useSWR<{ results: AccumResult[] }>(
    '/api/accumulation',
    fetcher,
    { refreshInterval: 60000 },
  );

  // Map symbol → accumulation result for quick lookup
  const accumMap = new Map<string, AccumResult>(
    (accumData?.results ?? []).map(r => [r.symbol, r])
  );

  async function runScan() {
    setScanning(true);
    try {
      await fetch(`${API}/api/zones/scan`, { method: 'POST', headers: authHeaders() });
      await mutate();
    } finally {
      setScanning(false);
    }
  }

  async function dismiss(id: number) {
    await fetch(`${API}/api/zones/${id}`, { method: 'DELETE', headers: authHeaders() });
    await mutate();
  }

  const zones = data || [];
  const approaching = zones.filter(z => z.status === 'approaching').length;
  const confirmed   = zones.filter(z => z.confirmation_status === 'ltf_choch').length;
  const highAccum   = (accumData?.results ?? []).filter(r => r.verdict === 'high').length;

  async function runAccumScan() {
    try {
      await fetch(`${API}/api/accumulation/scan`, { method: 'POST', headers: authHeaders() });
    } catch { /* silent */ }
  }

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      {/* Header */}
      <header className="mb-6 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Zone Engine</div>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-5xl text-text-primary">
              Watched <span className="font-display-italic text-gold">Zones</span>
            </h1>
            <p className="text-text-secondary mt-2 max-w-2xl">
              HTF order blocks, fair value gaps, and liquidity pools — monitored in real-time.
              Alert fires when price approaches. CHoCH on 1H confirms entry readiness.
            </p>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-5 py-2.5 text-sm border border-gold/40 text-gold bg-gold/5 hover:bg-gold/10 rounded-sm transition-colors disabled:opacity-40"
          >
            {scanning ? 'Scanning…' : '◈ Scan Zones'}
          </button>
        </div>
      </header>

      {/* Summary strip */}
      <div className="rise rise-2 grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Zones',    value: zones.length,  color: 'text-text-primary' },
          { label: 'Approaching',     value: approaching,   color: 'text-gold' },
          { label: 'CHoCH Confirmed', value: confirmed,     color: 'text-long' },
          { label: '🐋 Accumulation', value: highAccum,    color: 'text-gold' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-canvas-raised border border-rule rounded-sm px-5 py-4">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">{label}</div>
            <div className={`font-display text-3xl tabular ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rise rise-3 flex items-center gap-3 mb-4 flex-wrap">
        {[
          { label: 'All',   val: '',      key: 'direction' },
          { label: 'Long',  val: 'long',  key: 'direction' },
          { label: 'Short', val: 'short', key: 'direction' },
        ].map(({ label, val }) => (
          <button
            key={val}
            onClick={() => setDirection(val)}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              direction === val
                ? 'border-gold text-gold bg-gold/8'
                : 'border-rule text-text-secondary hover:text-text-primary'
            }`}
          >{label}</button>
        ))}
        <span className="w-px h-4 bg-rule-strong" />
        {['', '4h', '1d'].map((tf) => (
          <button
            key={tf}
            onClick={() => setSourceTf(tf)}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              sourceTf === tf
                ? 'border-gold text-gold bg-gold/8'
                : 'border-rule text-text-secondary hover:text-text-primary'
            }`}
          >{tf || 'All TF'}</button>
        ))}
        <span className="w-px h-4 bg-rule-strong" />
        {[
          { label: 'All',         val: '' },
          { label: 'Approaching', val: 'approaching' },
          { label: 'Active',      val: 'active' },
          { label: 'Touched',     val: 'touched' },
        ].map(({ label, val }) => (
          <button
            key={val}
            onClick={() => setStatus(val)}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              status === val
                ? 'border-gold text-gold bg-gold/8'
                : 'border-rule text-text-secondary hover:text-text-primary'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="rise rise-4 bg-canvas-raised border border-rule rounded-sm overflow-hidden">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.6fr_1.1fr_0.9fr_0.75fr_0.9fr_0.8fr_0.8fr_0.65fr_80px] gap-3 px-5 py-3 border-b border-rule-faint bg-canvas-inset/40">
          {['Symbol', 'Type', 'TF', 'Zone Range', 'Quality', 'Signal', 'Status', 'Distance', 'P/D', 'Accum', ''].map((h) => (
            <div key={h} className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">{h}</div>
          ))}
        </div>

        <div className="divide-y divide-rule-faint max-h-[70vh] overflow-y-auto thin-scrollbar">
          {isLoading ? (
            <div className="px-5 py-16 text-center font-display-italic text-text-secondary">
              Reading the zones…
            </div>
          ) : zones.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="font-display-italic text-text-secondary text-lg mb-2">No zones yet</div>
              <p className="text-text-tertiary text-xs mb-4">
                Run a scan to identify HTF order blocks and fair value gaps.
              </p>
              <button
                onClick={runScan}
                disabled={scanning}
                className="px-4 py-2 text-sm border border-gold/40 text-gold hover:bg-gold/5 rounded-sm transition-colors"
              >
                {scanning ? 'Scanning…' : '◈ Scan Now'}
              </button>
            </div>
          ) : zones.map((z) => {
            const isLong = z.direction === 'long';
            const rowOpacity = z.status === 'invalidated' ? 'opacity-40' : '';
            const prox = z.proximity_pct;
            const accum = accumMap.get(z.symbol);

            return (
              <div
                key={z.id}
                className={`grid grid-cols-[1.4fr_0.7fr_0.6fr_1.1fr_0.9fr_0.75fr_0.9fr_0.8fr_0.8fr_0.65fr_80px] gap-3 px-5 py-3.5 items-center hover:bg-canvas-inset/25 transition-colors ${rowOpacity}`}
              >
                {/* Symbol */}
                <div>
                  <Link
                    href={`/symbol/${encodeURIComponent(z.symbol)}`}
                    className="text-base font-medium text-text-primary hover:text-gold-400 transition-colors"
                  >
                    {z.symbol.replace('/USDT', '')}
                  </Link>
                  <div className={`text-xs font-medium mt-0.5 capitalize ${isLong ? 'text-long' : 'text-short'}`}>
                    {z.direction}
                  </div>
                </div>

                {/* Type */}
                <ZoneTypeBadge type={z.zone_type} direction={z.direction} />

                {/* TF */}
                <div className="font-mono text-sm text-text-secondary">{z.source_tf}</div>

                {/* Zone range */}
                <div className="font-mono text-xs text-text-primary space-y-0.5">
                  <div className="text-short-dim">{fmtPrice(z.zone_high)}</div>
                  <div className="text-long-dim">{fmtPrice(z.zone_low)}</div>
                </div>

                {/* Quality */}
                <div className="space-y-1">
                  <QualityBar score={z.quality_score} />
                  <div className="flex items-center gap-1.5">
                    {z.has_fvg_inside && (
                      <span className="text-[10px] text-gold">⭐FVG</span>
                    )}
                    {z.is_at_htf_poi && (
                      <span className="text-[10px] text-gold">📌HTF</span>
                    )}
                    {z.is_fresh && (
                      <span className="text-[10px] text-long">✦Fresh</span>
                    )}
                  </div>
                </div>

                {/* Scanner Score */}
                <div className="flex flex-col gap-0.5">
                  {z.scanner_score != null ? (
                    <>
                      <span className={`font-mono font-bold text-sm tabular ${
                        z.scanner_score >= 80 ? 'text-long' :
                        z.scanner_score >= 70 ? 'text-gold' :
                        z.scanner_score >= 50 ? 'text-text-secondary' :
                        'text-text-tertiary'
                      }`}>
                        {Math.round(z.scanner_score)}/100
                      </span>
                      {z.content_ready && (
                        <span className="text-[10px] text-long bg-long/8 border border-long/20 rounded px-1 py-px inline-flex items-center gap-0.5 w-fit">
                          📸 Entry
                        </span>
                      )}
                      {z.scanner_action && !z.content_ready && (
                        <span className="text-[9px] text-text-tertiary">{z.scanner_action}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-text-tertiary text-xs">—</span>
                  )}
                </div>

                {/* Status */}
                <StatusBadge status={z.status} confirmStatus={z.confirmation_status} />

                {/* Distance */}
                <div className="font-mono text-sm tabular">
                  {prox == null ? (
                    <span className="text-text-tertiary">—</span>
                  ) : prox <= 0 ? (
                    <span className="text-gold font-medium">Inside zone</span>
                  ) : (
                    <span className={prox < 0.5 ? 'text-gold' : prox < 1.5 ? 'text-neutral' : 'text-text-secondary'}>
                      {prox.toFixed(2)}%
                    </span>
                  )}
                </div>

                {/* Premium/Discount */}
                <PremiumDiscountPip label={z.premium_discount} />

                {/* Accumulation badge */}
                <div>
                  {accum ? (
                    <AccumBadge result={accum} />
                  ) : (
                    <span className="text-text-tertiary text-[10px]">—</span>
                  )}
                </div>

                {/* Dismiss */}
                <div className="flex justify-end">
                  <button
                    onClick={() => dismiss(z.id)}
                    className="text-[11px] px-2 py-1 border border-rule rounded-sm text-text-tertiary hover:text-short hover:border-short/40 transition-colors"
                    title="Dismiss zone"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {zones.length > 0 && (
        <div className="mt-3 text-xs text-text-tertiary text-right">
          {zones.length} zone{zones.length !== 1 ? 's' : ''} · auto-refreshes every 30s
        </div>
      )}
    </main>
  );
}
