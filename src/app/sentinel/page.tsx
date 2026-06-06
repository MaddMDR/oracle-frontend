'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { API, fetcher, fmt, fmtPct, authHeaders , fmtTs} from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchSignal {
  id: number;
  symbol: string;
  mode: string;
  direction: string;
  score: number;
  quality: string;
  action: string;
  status: string;
  last_price: number;
  summary: string;
}

interface WatchZone {
  id: number;
  zone_type: string;
  direction: string;
  source_tf: string;
  zone_high: number;
  zone_low: number;
  status: string;
  proximity_pct: number | null;
  confirmation_status: string | null;
  quality_score: number;
  is_at_htf_poi: boolean;
}

interface SentinelItem {
  id: number;
  symbol: string;
  note: string;
  added_at: string;
  signal: WatchSignal | null;
  zone: WatchZone | null;
}

interface AccumResult {
  score: number;
  verdict: string;   // "high" | "watch"
  symbol: string;
  breakdown: {
    oi: number;
    funding: number;
    lsr: number;
    zone: number;
  };
}

interface AccumCache {
  last_scan: string | null;
  results: AccumResult[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanSym(s: string) {
  return s.replace('/USDT:USDT', '').replace('/USDT', '');
}

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(`${API}${url}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts?.headers as Record<string, string> | undefined) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DirectionPip({ dir }: { dir: string }) {
  if (dir === 'long') return <span className="text-long font-mono text-xs">▲ LONG</span>;
  if (dir === 'short') return <span className="text-short font-mono text-xs">▼ SHORT</span>;
  return <span className="text-text-tertiary text-xs">—</span>;
}

function QualityBadge({ q }: { q: string }) {
  const cls =
    q === 'high' ? 'bg-long/15 text-long border-long/30' :
    q === 'medium' ? 'bg-gold/15 text-gold border-gold/30' :
    'bg-text-tertiary/10 text-text-tertiary border-rule';
  return (
    <span className={`text-[9px] px-1.5 py-0.5 border rounded-sm uppercase tracking-widest ${cls}`}>
      {q}
    </span>
  );
}

function ZoneTypePill({ type, tf }: { type: string; tf: string }) {
  const color =
    type === 'OB' ? 'text-gold/90' :
    type === 'FVG' ? 'text-sky-400/90' :
    'text-text-secondary';
  return (
    <span className={`font-mono text-xs ${color}`}>
      {type}·{tf}
    </span>
  );
}

function ZoneStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'approaching'
      ? 'bg-gold/15 text-gold border-gold/30'
      : status === 'active'
      ? 'bg-canvas-deep text-text-secondary border-rule'
      : 'bg-text-tertiary/10 text-text-tertiary border-rule';
  return (
    <span className={`text-[9px] px-1.5 py-0.5 border rounded-sm uppercase tracking-widest ${cls}`}>
      {status}
    </span>
  );
}

function AccumBadge({ result }: { result: AccumResult }) {
  const isHigh = result.verdict === 'high';
  const b = result.breakdown;
  return (
    <span
      title={`Score ${result.score} · OI ${b.oi} · Fund ${b.funding} · LSR ${b.lsr} · Zone ${b.zone}`}
      className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 border rounded-sm uppercase tracking-widest cursor-help ${
        isHigh
          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
          : 'bg-canvas-deep text-text-secondary border-rule'
      }`}
    >
      🐋 {isHigh ? 'ACCUM' : 'WATCH'} {result.score}
    </span>
  );
}

function NoteEditor({
  symbol, note, onSaved,
}: { symbol: string; note: string; onSaved: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(note);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  async function save() {
    await apiFetch(`/api/sentinel/${encodeURIComponent(symbol)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: val }),
    });
    onSaved(val);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-[11px] text-text-tertiary hover:text-gold italic truncate max-w-[200px] text-left"
        title={note || 'Add note…'}
      >
        {note || <span className="opacity-40">add note…</span>}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(); }}
      className="flex items-center gap-1"
    >
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        className="bg-canvas-deep border border-gold/40 text-xs text-text-primary px-2 py-0.5 w-40 outline-none focus:border-gold"
      />
    </form>
  );
}

// ── Add Coin Form ─────────────────────────────────────────────────────────────

function AddCoinForm({ onAdded }: { onAdded: () => void }) {
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sym = val.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setErr('');
    try {
      const res = await apiFetch('/api/sentinel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, note }),
      });
      if (res.status === 'already_exists') {
        setErr(`${res.symbol} is already in watchlist`);
      } else {
        setVal('');
        setNote('');
        onAdded();
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 flex-wrap">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="NEAR, ENA, MUBARAK…"
        className="bg-canvas-deep border border-rule text-sm text-text-primary px-3 py-1.5 w-44 outline-none focus:border-gold/60 placeholder:text-text-tertiary"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="note (optional)"
        className="bg-canvas-deep border border-rule text-sm text-text-primary px-3 py-1.5 w-52 outline-none focus:border-gold/60 placeholder:text-text-tertiary"
      />
      <button
        type="submit"
        disabled={loading || !val.trim()}
        className="text-xs px-4 py-1.5 bg-gold/15 border border-gold/40 text-gold hover:bg-gold/25 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-widest"
      >
        {loading ? 'Adding…' : '+ Add'}
      </button>
      {err && <span className="text-short text-xs">{err}</span>}
    </form>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function SentinelRow({
  item,
  accumMap,
  onRemove,
  onNoteChange,
}: {
  item: SentinelItem;
  accumMap: Record<string, AccumResult>;
  onRemove: (sym: string) => void;
  onNoteChange: (sym: string, note: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const clean = cleanSym(item.symbol);
  const accum = accumMap[item.symbol] || accumMap[clean + '/USDT'];

  async function remove() {
    setRemoving(true);
    await apiFetch(`/api/sentinel/${encodeURIComponent(item.symbol)}`, { method: 'DELETE' });
    onRemove(item.symbol);
  }

  return (
    <tr className="border-t border-rule-faint hover:bg-canvas-raised/40 group">
      {/* Symbol */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/coin/${clean}`}
            className="font-mono text-sm text-text-primary hover:text-gold font-semibold tracking-wide"
          >
            {clean}
          </Link>
          {accum && <AccumBadge result={accum} />}
        </div>
        <div className="mt-0.5">
          <NoteEditor
            symbol={item.symbol}
            note={item.note}
            onSaved={(n) => onNoteChange(item.symbol, n)}
          />
        </div>
      </td>

      {/* Price */}
      <td className="px-2 py-3 text-right tabular text-sm text-text-primary">
        {item.signal?.last_price ? `$${fmt(item.signal.last_price)}` : '—'}
      </td>

      {/* Signal */}
      <td className="px-3 py-3">
        {item.signal ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <DirectionPip dir={item.signal.direction} />
              <QualityBadge q={item.signal.quality} />
            </div>
            <div className="text-[11px] text-text-tertiary">
              Score {item.signal.score} · {item.signal.mode} · {item.signal.action}
            </div>
          </div>
        ) : (
          <span className="text-text-tertiary text-xs">no signal</span>
        )}
      </td>

      {/* Zone */}
      <td className="px-3 py-3">
        {item.zone ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <ZoneTypePill type={item.zone.zone_type} tf={item.zone.source_tf} />
              <ZoneStatusBadge status={item.zone.status} />
            </div>
            <div className="text-[11px] text-text-tertiary tabular">
              {fmt(item.zone.zone_low)}–{fmt(item.zone.zone_high)}
              {item.zone.proximity_pct != null && (
                <span className={`ml-1.5 ${Math.abs(item.zone.proximity_pct) < 2 ? 'text-gold' : ''}`}>
                  ({fmtPct(item.zone.proximity_pct)} away)
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-text-tertiary text-xs">no zone</span>
        )}
      </td>

      {/* Added */}
      <td className="px-3 py-3 text-right text-xs text-text-tertiary">
        {fmtTs(item.added_at)}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/coin/${clean}`}
            className="text-[10px] text-gold hover:underline"
          >
            brief →
          </Link>
          <button
            onClick={remove}
            disabled={removing}
            className="text-[10px] text-text-tertiary hover:text-short disabled:opacity-40"
          >
            {removing ? '…' : 'remove'}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SentinelPage() {
  const { data: rawItems, mutate } = useSWR<SentinelItem[]>('/api/sentinel', fetcher, {
    refreshInterval: 30000,
  });
  const { data: accumData } = useSWR<AccumCache>('/api/accumulation', fetcher, {
    refreshInterval: 60000,
  });
  const [items, setItems] = useState<SentinelItem[]>([]);

  useEffect(() => {
    if (rawItems) setItems(rawItems);
  }, [rawItems]);

  // Build accumulation lookup by symbol
  const accumMap: Record<string, AccumResult> = {};
  if (accumData) {
    for (const r of accumData.results || []) {
      accumMap[r.symbol] = r;
    }
  }

  function handleRemove(sym: string) {
    setItems((prev) => prev.filter((i) => i.symbol !== sym));
    mutate();
  }

  function handleNoteChange(sym: string, note: string) {
    setItems((prev) => prev.map((i) => i.symbol === sym ? { ...i, note } : i));
  }

  const highCount = (accumData?.results || []).filter(
    (r) => r.verdict === 'high' && items.some((i) => i.symbol === r.symbol)
  ).length;

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      {/* Header */}
      <header className="mb-8 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Sentinel</div>
        <h1 className="font-display text-5xl text-text-primary leading-none mb-3">
          Your <span className="font-display-italic text-gold">watchlist</span>
        </h1>
        <p className="text-text-secondary max-w-2xl">
          Coins tracked regardless of volume. Every scan run includes these symbols, so stealth
          accumulation plays like NEAR, ENA, and MUBARAK always show up in the screener.
        </p>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-4 mb-8 rise rise-2">
        <StatCard label="Watching" value={items.length} />
        <StatCard label="Has Signal" value={items.filter((i) => i.signal).length} />
        <StatCard label="Has Zone" value={items.filter((i) => i.zone).length} />
        <StatCard label="🐋 Accumulating" value={highCount} highlight={highCount > 0} />
      </div>

      {/* Add form */}
      <div className="mb-6 rise rise-2">
        <div className="text-xs uppercase tracking-widest text-text-tertiary mb-3">Add coin</div>
        <AddCoinForm onAdded={() => mutate()} />
      </div>

      {/* Table */}
      <section className="bg-canvas-raised border border-rule rounded-sm overflow-hidden rise rise-3">
        {!items || items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-4xl mb-4">🔭</div>
            <div className="text-text-secondary text-sm mb-1">Watchlist is empty</div>
            <div className="text-text-tertiary text-xs">
              Add coins above — they'll be scanned even when volume is low.
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-text-tertiary text-[10px] uppercase tracking-widest bg-canvas-deep/60">
              <tr>
                <th className="text-left px-4 py-3">Symbol / Note</th>
                <th className="text-right px-2">Price</th>
                <th className="text-left px-3">Signal</th>
                <th className="text-left px-3">Zone</th>
                <th className="text-right px-3">Added</th>
                <th className="px-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <SentinelRow
                  key={item.id}
                  item={item}
                  accumMap={accumMap}
                  onRemove={handleRemove}
                  onNoteChange={handleNoteChange}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Accumulation insight panel */}
      {accumData && (accumData.results || []).length > 0 && (
        <section className="mt-8 rise rise-4">
          <h2 className="font-display text-2xl text-text-primary mb-4">
            🐋 Accumulation <span className="font-display-italic text-gold">signals</span>
          </h2>
          <p className="text-text-tertiary text-xs mb-4">
            Detected via OI decline + negative funding + L/S ratio + HTF zone confluence.
            {accumData.last_scan && (
              <span className="ml-2">
                Last scan: {fmtTs(accumData.last_scan)}
              </span>
            )}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(accumData.results || []).map((r) => (
              <AccumCard key={r.symbol} result={r} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, highlight = false,
}: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`bg-canvas-raised border rounded-sm px-5 py-4 ${highlight ? 'border-purple-500/40' : 'border-rule'}`}>
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">{label}</div>
      <div className={`font-display text-3xl ${highlight ? 'text-purple-300' : 'text-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

// ── Accumulation card ─────────────────────────────────────────────────────────

function AccumCard({ result }: { result: AccumResult }) {
  const isHigh = result.verdict === 'high';
  const clean = result.symbol.replace('/USDT:USDT', '').replace('/USDT', '');
  const b = result.breakdown;

  return (
    <div className={`bg-canvas-raised border rounded-sm p-4 ${isHigh ? 'border-purple-500/30' : 'border-rule'}`}>
      <div className="flex items-center justify-between mb-3">
        <Link href={`/coin/${clean}`} className="font-mono font-semibold text-text-primary hover:text-gold">
          {clean}
        </Link>
        <span className={`text-[9px] px-2 py-0.5 border rounded-sm uppercase tracking-widest ${
          isHigh ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-canvas-deep text-text-secondary border-rule'
        }`}>
          {isHigh ? '🐋 HIGH' : '👀 WATCH'}
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-text-tertiary mb-1">
          <span>Composite score</span>
          <span className="text-text-primary font-mono">{result.score}/100</span>
        </div>
        <div className="h-1.5 bg-canvas-deep rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isHigh ? 'bg-purple-500' : 'bg-gold/60'}`}
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <ScorePill label="OI" value={b.oi} max={25} />
        <ScorePill label="Funding" value={b.funding} max={25} />
        <ScorePill label="L/S ratio" value={b.lsr} max={10} />
        <ScorePill label="Zone" value={b.zone} max={40} />
      </div>
    </div>
  );
}

function ScorePill({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const high = pct >= 70;
  return (
    <div className="flex items-center justify-between bg-canvas-deep px-2 py-1 rounded-sm">
      <span className="text-text-tertiary">{label}</span>
      <span className={`font-mono ${high ? 'text-long' : 'text-text-secondary'}`}>
        {value}/{max}
      </span>
    </div>
  );
}
