'use client';

import { useEffect, useState } from 'react';
import { post } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Props {
  signalId: number;
  onClose: () => void;
}

export default function LogTradeModal({ signalId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<any>(null);

  // Load pre-filled data from backend
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/journal/from-signal/${signalId}`)
      .then((r) => r.json())
      .then((d) => {
        setForm({
          symbol: d.symbol || '',
          mode: d.mode || 'intraday',
          direction: d.direction || 'long',
          entry_price: d.entry_price ?? '',
          exit_price: '',
          stop_loss: d.stop_loss ?? '',
          tp1: d.tp1 ?? '',
          pnl_pct: '',
          result: 'open',
          reason: d.reason || '',
          notes: d.notes || '',
        });
      })
      .catch(() => {
        setForm({
          symbol: '', mode: 'intraday', direction: 'long',
          entry_price: '', exit_price: '', stop_loss: '', tp1: '',
          pnl_pct: '', result: 'open', reason: '', notes: '',
        });
      })
      .finally(() => setLoading(false));
  }, [signalId]);

  function set(k: string, v: any) {
    setForm((prev: any) => ({ ...prev, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const sym = form.symbol.includes('/')
        ? form.symbol.toUpperCase()
        : `${form.symbol.toUpperCase()}/USDT`;
      await post('/api/journal', {
        symbol: sym,
        mode: form.mode,
        direction: form.direction,
        entry_price: form.entry_price !== '' ? parseFloat(form.entry_price) : null,
        exit_price: form.exit_price !== '' ? parseFloat(form.exit_price) : null,
        pnl_pct: form.pnl_pct !== '' ? parseFloat(form.pnl_pct) : null,
        result: form.result,
        reason: form.reason,
        notes: form.notes,
      });
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Close on backdrop click
  function onBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/80 backdrop-blur-sm"
      onClick={onBackdrop}
    >
      <div className="bg-canvas-raised border border-rule rounded-sm w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule-faint">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold mb-0.5">Journal</div>
            <h2 className="font-display text-xl text-text-primary">Log Trade</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary text-lg w-8 h-8 flex items-center justify-center rounded-sm hover:bg-canvas-inset transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="px-6 py-12 text-center font-display-italic text-text-secondary">
            Loading signal data…
          </div>
        ) : saved ? (
          <div className="px-6 py-12 text-center">
            <div className="text-long text-2xl mb-2">✓</div>
            <div className="font-display-italic text-text-secondary">Trade logged</div>
          </div>
        ) : form && (
          <form onSubmit={save} className="px-6 py-5 space-y-4">
            {/* Symbol + direction row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">Symbol</label>
                <input
                  value={form.symbol}
                  onChange={(e) => set('symbol', e.target.value)}
                  className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">Direction</label>
                <select
                  value={form.direction}
                  onChange={(e) => set('direction', e.target.value)}
                  className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
            </div>

            {/* Entry / SL / TP row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">Entry price</label>
                <input
                  type="number" step="any"
                  value={form.entry_price}
                  onChange={(e) => set('entry_price', e.target.value)}
                  className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">
                  <span className="text-short">Stop loss</span>
                </label>
                <input
                  type="number" step="any"
                  value={form.stop_loss}
                  onChange={(e) => set('stop_loss', e.target.value)}
                  className="w-full bg-canvas-inset border border-rule/80 px-3 py-2 text-sm text-short rounded-sm focus:border-short/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">
                  <span className="text-long">TP1</span>
                </label>
                <input
                  type="number" step="any"
                  value={form.tp1}
                  onChange={(e) => set('tp1', e.target.value)}
                  className="w-full bg-canvas-inset border border-rule/80 px-3 py-2 text-sm text-long rounded-sm focus:border-long/60 focus:outline-none"
                />
              </div>
            </div>

            {/* Mode + Result row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">Mode</label>
                <select
                  value={form.mode}
                  onChange={(e) => set('mode', e.target.value)}
                  className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none"
                >
                  <option value="intraday">Intraday</option>
                  <option value="swing">Swing</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">Result</label>
                <select
                  value={form.result}
                  onChange={(e) => set('result', e.target.value)}
                  className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none"
                >
                  <option value="open">Open (entering now)</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="breakeven">Breakeven</option>
                </select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">Reason / setup</label>
              <input
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-tertiary block mb-1">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className="w-full bg-canvas-inset border border-rule px-3 py-2 text-sm text-text-primary rounded-sm focus:border-gold focus:outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium bg-gold/10 border border-gold/40 text-gold-400 hover:bg-gold/20 hover:border-gold rounded-sm disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : '📝 Log trade'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm border border-rule text-text-tertiary hover:text-text-primary rounded-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
