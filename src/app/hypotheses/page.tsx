'use client';
/** ORACLE v2 — Hypothesis Registry. DESIGN_SYSTEM.md §4.5 */
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, post } from '@/lib/api';
import {
  Card, PageHeader, StatusPill, Button, EmptyState, ErrorState, Skeleton, cx,
} from '@/components/ui';

type Hyp = {
  id: number; claim: string; status: string; trades: number;
  wr: number; avg_r: number; target_wr?: number; target_r?: number;
  acceptance_criteria?: string; notes?: string; created_at?: string;
};

const TABS = ['testing', 'validated', 'rejected', 'all'];

export default function HypothesesPage() {
  const [filter, setFilter] = useState('testing');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ claim: '', criteria: '', targetWr: '65', minTrades: '20' });
  const [saving, setSaving] = useState(false);

  const url = filter === 'all' ? '/api/v2/hypotheses' : `/api/v2/hypotheses?status=${filter}`;
  const { data: hyps, error, isLoading, mutate } = useSWR<Hyp[]>(url, fetcher, { refreshInterval: 30000 });

  async function handleCreate() {
    if (!form.claim.trim()) return;
    setSaving(true);
    try {
      await post('/api/v2/hypotheses', {
        claim: form.claim, acceptance_criteria: form.criteria,
        target_wr: parseFloat(form.targetWr), min_trades: parseInt(form.minTrades),
      });
      setForm({ claim: '', criteria: '', targetWr: '65', minTrades: '20' });
      setShowForm(false);
      mutate();
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader
        title="Hypotheses"
        subtitle="Evidence-based edge tracking — outcomes attach automatically as setups close"
        right={<Button variant={showForm ? 'ghost' : 'primary'} size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New hypothesis'}
        </Button>}
      />

      {showForm && (
        <Card className="mb-6 animate-fade-up">
          <h2 className="text-h3 text-fg mb-4">New hypothesis</h2>
          <div className="space-y-4">
            <Field label="Claim *">
              <Input value={form.claim} onChange={(v) => setForm({ ...form, claim: v })}
                placeholder="FVG at discount + VWAP reclaim + HVN → WR ≥ 65%" />
            </Field>
            <Field label="Acceptance criteria">
              <Input value={form.criteria} onChange={(v) => setForm({ ...form, criteria: v })}
                placeholder="30+ trades, WR ≥ 65%, avg R ≥ 1.5" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Target WR (%)">
                <Input type="number" value={form.targetWr} onChange={(v) => setForm({ ...form, targetWr: v })} />
              </Field>
              <Field label="Min trades">
                <Input type="number" value={form.minTrades} onChange={(v) => setForm({ ...form, minTrades: v })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={saving || !form.claim.trim()}>
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-surface border border-border rounded-md w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={cx('px-3 h-8 rounded text-sm capitalize transition-colors',
              filter === t ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg')}>
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-md" />)}
        </div>
      ) : error ? (
        <Card><ErrorState onRetry={() => mutate()} /></Card>
      ) : !hyps?.length ? (
        <Card><EmptyState title={`No ${filter} hypotheses`}
          description="Form a claim about what makes a setup win, then let live outcomes judge it." /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hyps.map((h) => <HypCard key={h.id} h={h} />)}
        </div>
      )}
    </div>
  );
}

function HypCard({ h }: { h: Hyp }) {
  const targetWr = h.target_wr ?? 65;
  const wrPass = h.trades > 0 && h.wr >= targetWr;
  const progress = Math.min(100, (h.trades / 20) * 100);
  return (
    <Card padding="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm text-fg leading-snug">{h.claim}</p>
        <StatusPill status={h.status} />
      </div>
      {h.acceptance_criteria && <p className="text-xs text-fg-faint mb-3">{h.acceptance_criteria}</p>}

      <div className="h-1 rounded-full bg-surface-2 overflow-hidden mb-3">
        <div className="h-full bg-accent rounded-full" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-mono tnum pt-3 border-t border-border">
        <Metric label="Trades" value={h.trades} />
        <Metric label="Win rate" value={h.trades > 0 ? `${h.wr}%` : '—'}
          tone={h.trades > 0 ? (wrPass ? 'up' : 'down') : undefined} sub={`/ ${targetWr}%`} />
        <Metric label="Avg R" value={h.trades > 0 ? `${h.avg_r > 0 ? '+' : ''}${h.avg_r}` : '—'}
          tone={h.trades > 0 ? (h.avg_r > 0 ? 'up' : 'down') : undefined} />
      </div>
    </Card>
  );
}

function Metric({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone?: 'up' | 'down'; sub?: string }) {
  return (
    <div>
      <div className="eyebrow mb-0.5">{label}</div>
      <div className={cx('text-fg', tone === 'up' && 'text-up', tone === 'down' && 'text-down')}>
        {value}{sub && <span className="text-fg-faint ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="eyebrow block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-bg-sunken border border-border text-fg text-sm px-3 h-9 rounded-md outline-none focus:border-border-2 placeholder:text-fg-faint" />
  );
}
