'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, post, fmtPct, signColor , fmtDate} from '@/lib/api';

const MODES = ['intraday', 'swing'];
const DIRS = ['long', 'short'];
const RESULTS = ['open', 'win', 'loss', 'breakeven'];

export default function LedgerPage() {
  const { data: entries, mutate } = useSWR<any[]>('/api/journal', fetcher);
  const { data: review, mutate: mutateReview } = useSWR('/api/journal/review', fetcher);
  const [form, setForm] = useState<any>({
    symbol: '', mode: 'intraday', direction: 'long',
    entry_price: '', exit_price: '', pnl_pct: '',
    result: 'open', reason: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: any) {
    setForm({ ...form, [k]: v });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        symbol: form.symbol.includes('/') ? form.symbol.toUpperCase() : `${form.symbol.toUpperCase()}/USDT`,
        entry_price: form.entry_price ? parseFloat(form.entry_price) : null,
        exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
        pnl_pct: form.pnl_pct ? parseFloat(form.pnl_pct) : null,
      };
      await post('/api/journal', payload);
      setForm({ ...form, entry_price: '', exit_price: '', pnl_pct: '', reason: '', notes: '' });
      await mutate();
      await mutateReview();
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-10">
      <header className="mb-8 rise rise-1">
        <div className="text-xs uppercase tracking-widest text-gold mb-3">Journal</div>
        <h1 className="font-display text-5xl text-text-primary">
          Trade <span className="font-display-italic text-gold">log</span>
        </h1>
        <p className="text-text-secondary mt-2 max-w-2xl">
          Write your entry reason, exit notes, and reflections. AI can review patterns from your entries (not buy/sell advice).
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-4 space-y-6 rise rise-2">
          <form onSubmit={save} className="bg-canvas-raised border border-rule rounded-sm p-6 space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-text-tertiary mb-2">New Entry</h3>

            <Field label="Symbol">
              <input
                required
                value={form.symbol}
                onChange={(e) => set('symbol', e.target.value)}
                placeholder="ETH or BTC/USDT"
                className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Mode">
                <Select value={form.mode} onChange={(v) => set('mode', v)} options={MODES} />
              </Field>
              <Field label="Direction">
                <Select value={form.direction} onChange={(v) => set('direction', v)} options={DIRS} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Entry Price">
                <NumInput value={form.entry_price} onChange={(v) => set('entry_price', v)} />
              </Field>
              <Field label="Exit Price">
                <NumInput value={form.exit_price} onChange={(v) => set('exit_price', v)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="PnL %">
                <NumInput value={form.pnl_pct} onChange={(v) => set('pnl_pct', v)} />
              </Field>
              <Field label="Result">
                <Select value={form.result} onChange={(v) => set('result', v)} options={RESULTS} />
              </Field>
            </div>

            <Field label="Reason for entry">
              <textarea
                rows={2}
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                placeholder="HTF aligned, FVG fill on 1H, strong volume on breakout…"
                className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none resize-none"
              />
            </Field>

            <Field label="Post-trade notes">
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="What went well / what to improve…"
                className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none resize-none"
              />
            </Field>

            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 text-sm font-medium bg-gold/10 border border-gold/40 text-gold-400 hover:bg-gold/20 hover:border-gold rounded-sm disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : '+ Record entry'}
            </button>
          </form>

          {review && (review.patterns_id?.length || review.improvements_id?.length) && (
            <div className="bg-canvas-raised border-l-2 border-l-gold border-r border-y border-rule rounded-sm p-6">
              <h3 className="text-xs uppercase tracking-widest text-gold mb-4">AI Summary</h3>
              {review.patterns_id?.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-widest text-text-tertiary mb-2">Patterns</div>
                  <ul className="space-y-1.5 text-sm text-text-primary">
                    {review.patterns_id.map((p: string, i: number) => (
                      <li key={i} className="flex gap-2"><span className="text-accent font-bold">·</span>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.improvements_id?.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-text-tertiary mb-2">Suggestions</div>
                  <ul className="space-y-1.5 text-sm text-text-primary">
                    {review.improvements_id.map((p: string, i: number) => (
                      <li key={i} className="flex gap-2"><span className="text-gold font-bold">→</span>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="col-span-12 lg:col-span-8 rise rise-3">
          <div className="bg-canvas-raised border border-rule rounded-sm">
            <div className="grid grid-cols-[1.2fr_1.5fr_0.8fr_0.8fr_1fr_0.8fr_2fr] gap-3 px-5 py-3 border-b border-rule-faint bg-canvas-inset/40 text-[10px] uppercase tracking-widest text-text-tertiary">
              <span>Date</span>
              <span>Symbol</span>
              <span>Mode</span>
              <span>Dir</span>
              <span className="text-right">PnL %</span>
              <span>Result</span>
              <span>Reason</span>
            </div>
            <div className="divide-y divide-rule-faint max-h-[75vh] overflow-y-auto thin-scrollbar">
              {entries?.length ? entries.map((r: any) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.2fr_1.5fr_0.8fr_0.8fr_1fr_0.8fr_2fr] gap-3 px-5 py-3 hover:bg-canvas-inset/40 items-center"
                >
                  <div className="text-xs text-text-tertiary tabular">
                    {r.created_at && fmtDate(r.created_at)}
                  </div>
                  <div className="text-sm font-medium text-text-primary">{r.symbol}</div>
                  <div className="text-sm capitalize text-text-secondary">{r.mode}</div>
                  <div className={`text-sm capitalize ${
                    r.direction === 'long' ? 'text-long' : 'text-short'
                  }`}>{r.direction}</div>
                  <div className={`text-right font-mono tabular text-sm ${signColor(r.pnl_pct)}`}>
                    {r.pnl_pct != null ? fmtPct(r.pnl_pct) : '—'}
                  </div>
                  <div className={`text-xs uppercase tracking-wider ${
                    r.result === 'win' ? 'text-long' :
                    r.result === 'loss' ? 'text-short' :
                    r.result === 'open' ? 'text-accent' : 'text-text-tertiary'
                  }`}>{r.result || '—'}</div>
                  <div className="text-xs text-text-secondary truncate" title={r.reason || ''}>
                    {r.reason || '—'}
                  </div>
                </div>
              )) : (
                <div className="px-5 py-16 text-center">
                  <div className="font-display-italic text-text-secondary text-lg">The ledger is empty</div>
                  <p className="text-text-tertiary text-sm mt-2">Record your first trade to begin.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-text-tertiary mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function NumInput({ value, onChange }: { value: any; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm font-mono tabular text-text-primary rounded-sm focus:border-gold focus:outline-none"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary capitalize rounded-sm focus:border-gold focus:outline-none"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
