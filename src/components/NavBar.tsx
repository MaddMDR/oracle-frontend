'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearToken } from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  desc: string;
}

interface NavGroup {
  label: string;
  href?: string;          // direct link (no dropdown)
  items?: NavItem[];      // dropdown items
}

const NAV: NavGroup[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Trading',
    items: [
      { href: '/setups',        label: 'Setups',       desc: 'Live canonical setups — SMC + VWAP + Volume Profile (matches Telegram exactly)' },
      { href: '/screener-v2',   label: 'Screener',     desc: 'All setup candidates ranked by confluence score' },
      { href: '/hypotheses',    label: 'Hypotheses',   desc: 'Research experiments — track which edges work (evidence-based)' },
      { href: '/stratagem',     label: 'Plans (v1)',   desc: 'Legacy trade plans board' },
      { href: '/zones',         label: 'Zones',        desc: 'SMC structure: OB · FVG · EQH/EQL' },
    ],
  },
  {
    label: 'Monitor',
    items: [
      { href: '/alerts',   label: 'Alerts',    desc: 'Price & signal alert triggers' },
      { href: '/sentinel', label: 'Watchlist', desc: 'Custom tracked pairs' },
      { href: '/news',     label: 'News',      desc: 'Market & coin news feed' },
    ],
  },
  {
    label: 'Research',
    items: [
      { href: '/sectors',        label: 'Sector Coins',    desc: 'Koin belum terbang per sektor' },
      { href: '/currents',       label: 'Sector Strength', desc: 'Relative strength by sector (CoinGecko)' },
      { href: '/heatmap',        label: 'Heatmap',         desc: 'Volume Profile confluence heatmap' },
      { href: '/constellation',  label: 'Correlation',     desc: 'Cross-pair correlation matrix' },
      { href: '/etymon',         label: 'On-chain',        desc: 'Onchain flow & holder metrics' },
      { href: '/almanac',        label: 'Calendar',        desc: 'Economic & macro events' },
    ],
  },
  { label: 'Journal',  href: '/journal' },
  { label: 'AI',       href: '/chat' },
  { label: 'Settings', href: '/settings' },
];

interface DropdownGroupProps {
  group: NavGroup;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;   // schedules a debounced close
  onCancelClose?: () => void; // cancels a pending debounced close
}

function DropdownGroup({ group, open, onOpen, onClose, onCancelClose }: DropdownGroupProps) {
  const ref  = useRef<HTMLDivElement>(null);
  const path = usePathname();

  const isActive = group.items?.some(i => path === i.href) ?? path === group.href;

  // Direct link (no dropdown)
  if (group.href) {
    const isAI = group.label === 'AI';
    return (
      <Link
        href={group.href}
        className={`px-3 py-1.5 text-[12px] tracking-wide rounded-sm transition-all ${
          isActive
            ? 'text-gold-400 bg-gold/8'
            : isAI
            ? 'text-gold/80 hover:text-gold hover:bg-gold/8 border border-gold/20 hover:border-gold/40'
            : 'text-text-secondary hover:text-text-primary hover:bg-rule-faint/50'
        }`}
      >
        {isAI ? <><span className="mr-1">◈</span>{group.label}</> : group.label}
      </Link>
    );
  }

  // Dropdown — uses debounced close (scheduleClose/cancelClose pattern).
  // onMouseLeave schedules a 120ms close; re-entering button or panel cancels it.
  // This is the standard approach used by Radix / HeadlessUI — immune to
  // gap flicker, absolute-position quirks, and fast cursor movement.
  return (
    <div ref={ref} className="relative">
      <button
        onMouseEnter={() => { onCancelClose?.(); onOpen(); }}
        onMouseLeave={onClose}
        onClick={onOpen}
        className={`flex items-center gap-1 px-3 py-1.5 text-[12px] tracking-wide rounded-sm transition-all ${
          isActive || open
            ? 'text-gold-400 bg-gold/8'
            : 'text-text-secondary hover:text-text-primary hover:bg-rule-faint/50'
        }`}
      >
        {group.label}
        <svg
          className={`w-2.5 h-2.5 opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 10 6"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 pt-1.5 w-56 z-50"
          onMouseEnter={onCancelClose}
          onMouseLeave={onClose}
        >
          <div className="bg-canvas-deep border border-rule shadow-2xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(4,7,16,0.8), inset 0 1px 0 rgba(31,37,51,0.4)' }}>
            {group.items!.map((item) => {
              const active = path === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex flex-col px-3 py-2.5 border-b border-rule-faint last:border-b-0 transition-colors ${
                    active
                      ? 'bg-gold/5 border-l-2 border-l-gold'
                      : 'hover:bg-canvas-raised border-l-2 border-l-transparent'
                  }`}
                >
                  <span className={`text-[11px] font-mono tracking-wide ${active ? 'text-gold' : 'text-text-secondary group-hover:text-text-primary'}`}>
                    {active && '> '}{item.label}
                  </span>
                  <span className="text-[10px] text-text-tertiary mt-0.5 leading-snug font-sans">
                    {item.desc}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CoinSearch() {
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const router  = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const coin = query.trim().toUpperCase().replace('/', '').replace('USDT', '');
    if (!coin) return;
    router.push(`/coin/${coin}`);
    setQuery('');
    inputRef.current?.blur();
  }

  return (
    <form onSubmit={submit} className="relative flex-shrink-0">
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border transition-all duration-150 ${
        focused
          ? 'border-gold/50 bg-canvas-raised w-40'
          : 'border-rule bg-canvas-inset/40 w-32 hover:border-rule-strong'
      }`}>
        <svg className="w-3 h-3 text-text-tertiary flex-shrink-0" fill="none" viewBox="0 0 14 14">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused ? 'BTC, ETH, SOL…' : 'Search coin'}
          className="bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary outline-none w-full tracking-wide"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="text-text-tertiary hover:text-text-secondary">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {!focused && !query && (
          <span className="text-[9px] text-text-tertiary/60 font-mono flex-shrink-0">⌘K</span>
        )}
      </div>
    </form>
  );
}

export default function NavBar() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const navRef    = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setActiveIdx(null), 120);
  }

  function openIdx(idx: number) {
    cancelClose();
    setActiveIdx(idx);
  }

  // Close all dropdowns when clicking outside the entire navbar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        cancelClose();
        setActiveIdx(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav className="border-b border-rule bg-canvas-deep/90 backdrop-blur-md sticky top-0 z-20" style={{ boxShadow: '0 1px 0 rgba(191,142,58,0.06)' }}>
      <div ref={navRef} className="max-w-[1440px] mx-auto px-5 py-1.5 flex items-center gap-1">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 group mr-5" onClick={() => setActiveIdx(null)}>
          <div className="w-6 h-6 flex-shrink-0 opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="ORACLE" width={24} height={24} className="w-full h-full object-contain" />
          </div>
          <span className="font-mono text-sm font-medium text-gold tracking-widest group-hover:text-gold-400 transition-colors">
            ORACLE
          </span>
          <span className="text-[9px] text-text-tertiary font-mono tracking-widest border border-rule px-1 py-px">v2</span>
        </Link>

        {/* Nav groups */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {NAV.map((group, idx) => (
            <DropdownGroup
              key={group.label}
              group={group}
              open={activeIdx === idx}
              onOpen={() => openIdx(idx)}
              onClose={scheduleClose}
              onCancelClose={cancelClose}
            />
          ))}
        </div>

        {/* Coin search */}
        <div className="ml-auto mr-3">
          <CoinSearch />
        </div>

        {/* Live pill */}
        <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary tracking-widest uppercase flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-gold" />
          <span>live</span>
        </div>

        {/* User + logout */}
        <UserMenu />
      </div>
    </nav>
  );
}

function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function logout() {
    clearToken();
    // Clear cookie too
    document.cookie = 'oracle_token=; path=/; max-age=0';
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-rule-faint flex-shrink-0">
      <span className="text-[10px] text-text-tertiary hidden sm:block">
        {user.username}
      </span>
      <button
        onClick={logout}
        title="Logout"
        className="text-text-tertiary hover:text-short transition-colors p-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
          <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
