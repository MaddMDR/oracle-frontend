export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type Mode = 'intraday' | 'swing';
export type Quality = 'high' | 'medium' | 'low';
export type Direction = 'long' | 'short' | 'none';

export type Derivatives = {
  oi_change_24h_pct: number | null;
  funding_rate_pct:  number;
  long_short_ratio:  number | null;
  crowded_flag:      string | null;
  squeeze_flag:      string | null;
  vp_score:          number;
  vp_label:          'STRONG' | 'MODERATE' | 'NEUTRAL' | 'AGAINST';
};

export type Signal = {
  id: number;
  symbol: string;
  mode: Mode;
  direction: Direction;
  bias_tf: string;
  exec_tf: string;
  score: number;
  quality: Quality;
  action: string;
  status: string;
  last_price: number;
  summary: string;
  features: any;
  context: any;
  created_at: string;
  expires_at: string;
  derivatives?: Derivatives | null;
};

export type MarketState = {
  btc?: { trend: string; regime: string; price: number; change_24h_pct: number };
  session?: string;
  notes?: string;
  updated_at?: string;
};

export type TradePlan = {
  id: number;
  signal_id?: number;
  symbol: string;
  mode: Mode;
  direction: Direction;
  entry_zone_low: number;
  entry_zone_high: number;
  entries: Array<{ price: number; weight: number; label: string }>;
  stop_loss: number;
  take_profits: Array<{ price: number; weight: number; label: string; rr: number }>;
  rr_min: number;
  rr_avg: number;
  position_size_usd: number;
  position_size_qty: number;
  risk_pct: number;
  risk_usd: number;
  leverage_hint: number;
  invalidation_note: string;
  status: string;
  rejected?: boolean;
  rejection_reason?: string;
  features?: any;
  created_at: string;
  expires_at: string;
  // Convenience fields from features (populated by API)
  scanner_score?: number | null;
  content_ready?: boolean;
  zone_quality?: number | null;
};

export type Checklist = {
  verdict: 'go' | 'caution' | 'no_go';
  score: number;
  fail_count: number;
  warn_count: number;
  items: Array<{ key: string; label: string; status: 'pass' | 'fail' | 'warn' | 'info'; detail?: string }>;
};

export type Alert = {
  id: number;
  type: string;
  symbol: string;
  mode?: Mode;
  direction?: Direction;
  target_price?: number;
  band_low?: number;
  band_high?: number;
  condition?: string;
  status: string;
  channel?: string;
  trade_plan_id?: number;
  signal_id?: number;
  label?: string;
  note?: string;
  created_at: string;
  triggered_at?: string;
  expires_at?: string;
};

export type BacktestRunSummary = {
  id: number;
  name: string;
  status: string;
  total_trades: number;
  win_rate: number;
  avg_r: number;
  expectancy: number;
  max_dd_pct?: number;
  sharpe_like?: number;
  started_at: string;
  completed_at: string;
  symbols?: string[];
  modes?: string[];
  summary?: any;
  config?: any;
};

export type EconomicEvent = {
  event_time: string;
  country: string;
  impact: string;
  title: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  source?: string;
};

export type Sector = {
  id: string;
  name: string;
  rank: number;
  top_3_coins: string[];
  market_cap_usd: number | null;
  volume_24h_usd: number | null;
  price_change_24h_pct: number;
  rs_z_24h: number;
};

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('oracle_token');
}

export function setToken(token: string): void {
  localStorage.setItem('oracle_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('oracle_token');
  localStorage.removeItem('oracle_user');
}

export function setUser(user: { username: string; role: string }): void {
  localStorage.setItem('oracle_user', JSON.stringify(user));
}

export function getUser(): { username: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('oracle_user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── API helpers (auto-attach token) ──────────────────────────────────────────

export const fetcher = (url: string) =>
  fetch(`${API}${url}`, { headers: authHeaders() }).then((r) => {
    if (r.status === 401) {
      clearToken();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export async function post(url: string, body?: any) {
  const r = await fetch(`${API}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function fmt(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 100) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return n.toFixed(Math.min(digits, 4));
  return n.toPrecision(4);
}

export function fmtUSD(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${fmt(n, 2)}`;
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export function dirColor(direction: string): string {
  if (direction === 'long') return 'text-long';
  if (direction === 'short') return 'text-short';
  return 'text-neutral';
}

export function signColor(n: number | null | undefined): string {
  if (n == null) return 'text-text-secondary';
  if (n > 0) return 'text-long';
  if (n < 0) return 'text-short';
  return 'text-text-secondary';
}

export function sessionLabel(s: string | undefined): string {
  const map: Record<string, string> = {
    asia: 'Asia',
    london: 'London',
    ny: 'New York',
    overlap_ln_ny: 'London / NY',
    overlap_asia_ln: 'Asia / London',
    off: 'Off hours',
  };
  return s ? (map[s] || s) : '—';
}

export function regimeLabel(r: string | undefined): string {
  return r ? r.replace(/_/g, ' ') : '—';
}

// ── Timestamp helpers (always WIB = Asia/Jakarta = UTC+7) ─────────────────────
const TZ = 'Asia/Jakarta';

/** Parse a backend timestamp as UTC.
 * The backend emits NAIVE UTC strings (datetime.utcnow().isoformat() → no 'Z').
 * JavaScript reads a tz-less datetime as LOCAL time, so it would skip the +7
 * conversion (showing 02:48 instead of 09:48). Append 'Z' so it's read as UTC. */
function parseUTC(iso: string): Date {
  if (iso.includes('T') && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) iso = iso + 'Z';
  return new Date(iso);
}

/** Full datetime: "5 Jun 2026, 06:53 WIB" */
export function fmtTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  return parseUTC(iso).toLocaleString('id-ID', {
    timeZone: TZ,
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' WIB';
}

/** Short time only: "06:53 WIB" */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return parseUTC(iso).toLocaleTimeString('id-ID', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit',
  }) + ' WIB';
}

/** Date only: "5 Jun 2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return parseUTC(iso).toLocaleDateString('id-ID', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Relative: "2j lalu", "5h lalu", "kemarin" */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - parseUTC(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'kemarin';
  return `${d}h lalu`;
}
