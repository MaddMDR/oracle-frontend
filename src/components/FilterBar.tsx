'use client';

import { useState } from 'react';
import { post } from '@/lib/api';

const MODES = [
  { v: '', l: 'All' },
  { v: 'intraday', l: 'Intraday' },
  { v: 'swing', l: 'Swing' },
];

const DIRS = [
  { v: '', l: 'All' },
  { v: 'long', l: 'Long' },
  { v: 'short', l: 'Short' },
];

const QUALITIES = [
  { v: '', l: 'All' },
  { v: 'high', l: 'High' },
  { v: 'medium', l: 'Mid' },
  { v: 'low', l: 'Low' },
];

export default function FilterBar({
  mode, direction, quality, minScore,
  onChange, onScanned,
}: {
  mode: string; direction: string; quality: string; minScore: number;
  onChange: (s: { mode?: string; direction?: string; quality?: string; minScore?: number }) => void;
  onScanned: () => void;
}) {
  const [scanning, setScanning] = useState(false);

  async function run() {
    setScanning(true);
    try {
      await post('/api/scan/run');
      onScanned();
    } catch (e: any) {
      alert(`Scan failed: ${e.message}`);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-6 py-5 px-1">
      <Group label="Mode" options={MODES} value={mode} onChange={(v) => onChange({ mode: v })} />
      <Group label="Direction" options={DIRS} value={direction} onChange={(v) => onChange({ direction: v })} />
      <Group label="Quality" options={QUALITIES} value={quality} onChange={(v) => onChange({ quality: v })} />

      <div className="flex items-center gap-3 min-w-[200px]">
        <span className="text-xs uppercase tracking-widest text-text-tertiary">Min Score</span>
        <input
          type="range" min={0} max={100} value={minScore}
          onChange={(e) => onChange({ minScore: parseInt(e.target.value, 10) })}
          className="flex-1 accent-gold"
        />
        <span className="font-mono text-sm tabular w-8 text-text-primary">{minScore}</span>
      </div>

      <div className="ml-auto">
        <button
          onClick={run}
          disabled={scanning}
          className="px-5 py-2.5 text-sm font-medium tracking-wide bg-gold/10 border border-gold/40 text-gold-400 hover:bg-gold/20 hover:border-gold transition-all disabled:opacity-50 disabled:cursor-wait rounded-sm"
        >
          {scanning ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-gold rounded-full pulse-gold" />
              Scanning…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden>↻</span>
              Run scan
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function Group({ label, options, value, onChange }: {
  label: string; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-widest text-text-tertiary">{label}</span>
      <div className="flex items-center bg-canvas-inset border border-rule rounded-sm overflow-hidden">
        {options.map((o, i) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              i > 0 ? 'border-l border-rule' : ''
            } ${
              value === o.v
                ? 'bg-gold/15 text-gold-400'
                : 'text-text-secondary hover:text-text-primary hover:bg-rule-faint'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
