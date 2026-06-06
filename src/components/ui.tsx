'use client';
/**
 * ORACLE v2 — UI primitives.
 * Implements docs/DESIGN_SYSTEM.md §2. Import these instead of hand-rolling
 * cards/badges/etc. so the whole app stays visually consistent.
 */
import { ReactNode } from 'react';
import Link from 'next/link';

type Tone = 'neutral' | 'brand' | 'up' | 'down' | 'accent' | 'warn';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-fg-muted', brand: 'text-brand', up: 'text-up',
  down: 'text-down', accent: 'text-accent', warn: 'text-warn',
};
const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-fg-faint', brand: 'bg-brand', up: 'bg-up',
  down: 'bg-down', accent: 'bg-accent', warn: 'bg-warn',
};

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// ── Card ───────────────────────────────────────────────────────────────
export function Card({ children, className, interactive, as, href, padding = 'p-5' }: {
  children: ReactNode; className?: string; interactive?: boolean;
  as?: 'div' | 'link'; href?: string; padding?: string;
}) {
  const cls = cx(interactive ? 'card-interactive' : 'card', padding, className);
  if (as === 'link' && href) return <Link href={href} className={cx(cls, 'block group')}>{children}</Link>;
  return <div className={cls}>{children}</div>;
}

// ── SectionHeader ──────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }: {
  title: ReactNode; subtitle?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div>
        <h2 className="text-h2 text-fg">{title}</h2>
        {subtitle && <p className="text-sm text-fg-faint mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ── Stat (KPI) ─────────────────────────────────────────────────────────
export function Stat({ label, value, sub, delta, tone = 'neutral' }: {
  label: string; value: ReactNode; sub?: ReactNode;
  delta?: { value: string; dir: 'up' | 'down' | 'flat' }; tone?: Tone;
}) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className={cx('text-h1 font-mono tnum mt-1.5', TONE_TEXT[tone])}>{value}</div>
      <div className="flex items-center gap-2 mt-1 min-h-[18px]">
        {delta && (
          <span className={cx('text-xs font-mono tnum',
            delta.dir === 'up' ? 'text-up' : delta.dir === 'down' ? 'text-down' : 'text-fg-faint')}>
            {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '·'} {delta.value}
          </span>
        )}
        {sub && <span className="text-xs text-fg-faint">{sub}</span>}
      </div>
    </div>
  );
}

// ── Badge / Tag ────────────────────────────────────────────────────────
export function Badge({ children, tone = 'neutral', className }: {
  children: ReactNode; tone?: Tone; className?: string;
}) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-micro font-medium uppercase',
      'bg-surface-2 border border-border', TONE_TEXT[tone], className)}>
      {children}
    </span>
  );
}

// ── Pill (status) ──────────────────────────────────────────────────────
const STATUS_TONE: Record<string, Tone> = {
  detected: 'accent', confirmed: 'brand', armed: 'brand', filled: 'up',
  partial: 'warn', closed_win: 'up', tp1: 'up', closed_loss: 'down',
  stopped: 'down', invalidated: 'neutral', expired: 'neutral', cancelled: 'neutral',
};
export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <span className={cx('inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full',
      'bg-surface-2 border border-border text-xs', TONE_TEXT[tone])}>
      <span className={cx('w-1.5 h-1.5 rounded-full', TONE_DOT[tone])} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Button ─────────────────────────────────────────────────────────────
export function Button({ children, variant = 'secondary', size = 'md', className, ...rest }: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md'; className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = {
    primary: 'bg-brand text-bg font-medium hover:bg-brand/90 focus-visible:shadow-glow',
    secondary: 'bg-surface-2 text-fg border border-border hover:border-border-2',
    ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
    danger: 'bg-down/15 text-down border border-down/30 hover:bg-down/25',
  }[variant];
  const s = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm';
  return (
    <button className={cx('inline-flex items-center justify-center gap-1.5 rounded-md transition-all duration-150 ease-standard disabled:opacity-40 disabled:pointer-events-none', v, s, className)} {...rest}>
      {children}
    </button>
  );
}

// ── ConfBar (confluence meter) ─────────────────────────────────────────
function confTone(v: number): Tone {
  if (v >= 80) return 'up';
  if (v >= 65) return 'brand';
  if (v >= 50) return 'warn';
  return 'neutral';
}
const TONE_BG: Record<Tone, string> = {
  neutral: 'bg-fg-faint', brand: 'bg-brand', up: 'bg-up',
  down: 'bg-down', accent: 'bg-accent', warn: 'bg-warn',
};
export function ConfBar({ value, showValue = true, className }: {
  value: number; showValue?: boolean; className?: string;
}) {
  const v = Math.max(0, Math.min(100, value || 0));
  const tone = confTone(v);
  return (
    <div className={cx('flex items-center gap-2', className)}>
      {showValue && <span className={cx('font-mono tnum text-sm w-7 text-right', TONE_TEXT[tone])}>{Math.round(v)}</span>}
      <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={cx('h-full rounded-full transition-all duration-300 ease-standard', TONE_BG[tone])} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

// ── Direction chip ─────────────────────────────────────────────────────
export function DirChip({ direction }: { direction: string }) {
  const isL = direction === 'long';
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-medium', isL ? 'text-up' : 'text-down')}>
      {isL ? '↑' : '↓'} {direction.toUpperCase()}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="text-fg-faint mb-3 opacity-60">{icon}</div>}
      <h3 className="text-h3 text-fg-muted">{title}</h3>
      {description && <p className="text-sm text-fg-faint mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── ErrorState ─────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-9 h-9 rounded-full bg-down/15 border border-down/30 flex items-center justify-center text-down mb-3">!</div>
      <h3 className="text-h3 text-fg-muted">Couldn&apos;t reach the engine</h3>
      <p className="text-sm text-fg-faint mt-1.5 max-w-sm">{message || 'The request failed. The backend may be restarting.'}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────
export function Sparkline({ data, width = 64, height = 18, tone = 'accent' }: {
  data: number[]; width?: number; height?: number; tone?: Tone;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) =>
    `${(i / (data.length - 1)) * width},${height - ((d - min) / range) * height}`).join(' ');
  const stroke = { neutral: '#5d6678', brand: '#d4a857', up: '#3fb27f', down: '#e0635e', accent: '#5b9dd9', warn: '#e0a23c' }[tone];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── PageHeader ─────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, right }: {
  title: ReactNode; subtitle?: ReactNode; right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-h1 text-fg">{title}</h1>
        {subtitle && <p className="text-sm text-fg-muted mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}
