'use client';
/**
 * ORACLE v2 — App shell (docs/DESIGN_SYSTEM.md §3).
 * Left sidebar (collapsible, persisted) + topbar (search / live / user) + content.
 * On < lg the sidebar becomes an off-canvas drawer.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { API, fetcher, getUser, clearToken } from '@/lib/api';
import { cx } from '@/components/ui';

type Item = { href: string; label: string; icon: ReactIcon };
type Group = { label: string; items: Item[] };
type ReactIcon = (p: { className?: string }) => JSX.Element;

// Minimal inline icon set (stroke, 1.6) — keeps bundle tiny, no icon dep.
const I = {
  grid: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>,
  target: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
  scan: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M2 5V3a1 1 0 011-1h2M11 2h2a1 1 0 011 1v2M14 11v2a1 1 0 01-1 1h-2M5 14H3a1 1 0 01-1-1v-2M2 8h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  flask: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M6 2v4L3 12a1.5 1.5 0 001.3 2.2h7.4A1.5 1.5 0 0013 12l-3-6V2M5 2h6M6 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  bell: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M8 2a4 4 0 00-4 4c0 4-1.5 5-1.5 5h11S12 10 12 6a4 4 0 00-4-4zM6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  eye: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4"/></svg>,
  news: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 6h5M4.5 8.5h5M4.5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  layers: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M8 2l6 3-6 3-6-3 6-3zM2 8l6 3 6-3M2 11l6 3 6-3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  book: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M8 4S6.5 2.5 2.5 2.5v9C6.5 11.5 8 13 8 13s1.5-1.5 5.5-1.5v-9C9.5 2.5 8 4 8 4zM8 4v9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  chat: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 2.5V11H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  gear: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  spark: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M8 1l1.8 4.2L14 7l-4.2 1.8L8 13l-1.8-4.2L2 7l4.2-1.8L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  bars: (p: any) => <svg viewBox="0 0 16 16" className={p.className} fill="none"><path d="M3 13V7M7 13V3M11 13V9M14.5 13h-13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
};

const NAV: Group[] = [
  { label: 'Trading', items: [
    { href: '/', label: 'Dashboard', icon: I.grid },
    { href: '/setups', label: 'Setups', icon: I.target },
    { href: '/screener-v2', label: 'Screener', icon: I.scan },
    { href: '/hypotheses', label: 'Hypotheses', icon: I.flask },
  ]},
  { label: 'Monitor', items: [
    { href: '/alerts', label: 'Alerts', icon: I.bell },
    { href: '/sentinel', label: 'Watchlist', icon: I.eye },
    { href: '/news', label: 'News', icon: I.news },
  ]},
  { label: 'Research', items: [
    { href: '/currents', label: 'Sector Strength', icon: I.bars },
    { href: '/sectors', label: 'Sector Coins', icon: I.layers },
    { href: '/heatmap', label: 'Heatmap', icon: I.grid },
    { href: '/constellation', label: 'Correlation', icon: I.spark },
    { href: '/almanac', label: 'Calendar', icon: I.book },
  ]},
  { label: 'Workspace', items: [
    { href: '/journal', label: 'Journal', icon: I.book },
    { href: '/chat', label: 'AI Chat', icon: I.chat },
    { href: '/settings', label: 'Settings', icon: I.gear },
  ]},
];

function HealthDot() {
  const { data } = useSWR(`/api/v2/health`, fetcher, { refreshInterval: 15000 });
  const fresh = data?.market_state_fresh;
  const age = data?.market_state_age_min;
  const tone = data == null ? 'text-fg-faint'
    : fresh ? 'text-up' : (age != null && age < 60) ? 'text-warn' : 'text-down';
  const label = data == null ? 'connecting' : fresh ? 'live' : 'stale';
  // Realtime websocket feed indicator
  const ws = data?.ws_feed;
  const wsLive = ws?.running && (ws?.symbols_live ?? 0) > 0;
  const wsTone = !ws?.running ? 'text-fg-faint' : wsLive ? 'text-up' : 'text-warn';
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" title={`Market state ${age != null ? age + 'm old' : ''}`}>
        <span className={cx('live-dot', tone)} style={{ color: 'currentColor' }} />
        <span className={cx('uppercase tracking-wider text-micro font-medium', tone)}>{label}</span>
      </div>
      <div className="hidden md:flex items-center gap-1 text-micro font-medium uppercase tracking-wider"
        title={ws?.running ? `Realtime feed: ${ws.symbols_live}/${ws.symbols_watched} symbols on ${ws.exchange}` : 'Realtime feed offline — using REST fallback'}>
        <span className={cx('w-1.5 h-1.5 rounded-full', wsLive ? 'bg-up' : ws?.running ? 'bg-warn' : 'bg-fg-faint')} />
        <span className={wsTone}>{wsLive ? 'RT' : 'REST'}</span>
      </div>
    </div>
  );
}

function CoinSearch() {
  const [q, setQ] = useState('');
  const router = useRouter();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        (document.getElementById('coin-search') as HTMLInputElement)?.focus();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const c = q.trim().toUpperCase().replace('/', '').replace('USDT', ''); if (c) { router.push(`/coin/${c}`); setQ(''); } }}
      className="relative hidden sm:block">
      <svg className="w-3.5 h-3.5 text-fg-faint absolute left-2.5 top-1/2 -translate-y-1/2" viewBox="0 0 14 14" fill="none">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <input id="coin-search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search coin"
        className="w-36 focus:w-48 transition-all bg-surface border border-border rounded-md h-8 pl-8 pr-8 text-sm text-fg placeholder:text-fg-faint outline-none focus:border-border-2"
        autoComplete="off" spellCheck={false} />
      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-micro text-fg-faint font-mono">⌘K</kbd>
    </form>
  );
}

function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 pl-3 ml-1 border-l border-border">
      <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-medium text-brand uppercase">
        {user.username?.[0] ?? '?'}
      </div>
      <button onClick={() => { clearToken(); document.cookie = 'oracle_token=; path=/; max-age=0'; router.push('/login'); }}
        title="Sign out" className="text-fg-faint hover:text-down transition-colors p-1">
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
  );
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-5 py-4">
      {NAV.map((g) => (
        <div key={g.label}>
          {!collapsed && <div className="eyebrow px-3 mb-1.5">{g.label}</div>}
          <div className="space-y-0.5 px-2">
            {g.items.map((it) => {
              const active = it.href === '/' ? path === '/' : path.startsWith(it.href);
              const Icon = it.icon;
              return (
                <Link key={it.href} href={it.href} onClick={onNavigate} title={collapsed ? it.label : undefined}
                  className={cx('flex items-center gap-2.5 rounded-md px-2.5 h-9 text-sm transition-colors relative',
                    active ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg hover:bg-surface-2/60',
                    collapsed && 'justify-center')}>
                  {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand" />}
                  <Icon className={cx('w-4 h-4 flex-shrink-0', active ? 'text-brand' : '')} />
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem('oracle_sidebar_collapsed') === '1');
  }, []);
  function toggleCollapse() {
    setCollapsed((c) => { localStorage.setItem('oracle_sidebar_collapsed', c ? '0' : '1'); return !c; });
  }
  useEffect(() => { setDrawer(false); }, [path]);

  // Login page renders bare (no shell)
  if (path === '/login') return <>{children}</>;

  const sidebarW = collapsed ? 'lg:w-[var(--sidebar-w-collapsed)]' : 'lg:w-[var(--sidebar-w)]';

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="h-[var(--topbar-h)] sticky top-0 z-30 flex items-center gap-3 px-4 border-b border-border bg-bg/85 backdrop-blur-md">
        <button onClick={() => setDrawer(true)} className="lg:hidden text-fg-muted hover:text-fg p-1" aria-label="Open menu">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <button onClick={toggleCollapse} className="hidden lg:block text-fg-faint hover:text-fg p-1" aria-label="Collapse sidebar">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <Link href="/" className="flex items-center gap-2 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="ORACLE" width={22} height={22} className="opacity-90" />
          <span className="font-mono text-sm font-semibold text-brand tracking-[0.18em]">ORACLE</span>
          <span className="text-micro text-fg-faint font-mono border border-border rounded px-1 py-px">v2</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <CoinSearch />
          <HealthDot />
          <UserMenu />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className={cx('hidden lg:block flex-shrink-0 border-r border-border bg-bg/40 sticky top-[var(--topbar-h)] h-[calc(100vh-var(--topbar-h))] overflow-y-auto thin-scroll transition-[width] duration-200 ease-standard', sidebarW)}>
          <SidebarContent collapsed={collapsed} />
        </aside>

        {/* Drawer (mobile) */}
        {drawer && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-[var(--sidebar-w)] bg-bg border-r border-border overflow-y-auto animate-fade-up">
              <div className="h-[var(--topbar-h)] flex items-center px-4 border-b border-border">
                <span className="font-mono text-sm font-semibold text-brand tracking-[0.18em]">ORACLE</span>
              </div>
              <SidebarContent collapsed={false} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-content mx-auto px-6 lg:px-8 py-6 lg:py-8 animate-fade-up">
            {children}
          </div>
          <footer className="border-t border-border mt-16">
            <div className="max-w-content mx-auto px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-micro text-fg-faint">
              <span className="uppercase tracking-wider">ORACLE · Operational Reconnaissance &amp; Analytical Crypto Logic Engine</span>
              <span>Decision-support only — not investment advice · v2</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
