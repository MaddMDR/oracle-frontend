'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, authHeaders } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant';

interface ToolCall {
  tool:    string;
  summary: string;   // result_summary from backend
  done:    boolean;
}

interface Message {
  id:        string;
  role:      Role;
  content:   string;
  sources?:  string[];
  error?:    boolean;
  done?:     boolean;   // stream finished
  ts:        number;
  toolCalls?: ToolCall[];  // agentic tool usage steps
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
// Handles Gemini's output: ###, ##, *, -, **, *, ```, ---, numbered lists

function md(raw: string): string {
  let s = raw;

  // Escape HTML entities first (before we inject our own HTML)
  s = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text** (must come before italic)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* or _text_ (single, not double)
  s = s.replace(/(?<![*_])\*([^*\n]+?)\*(?![*_])/g, '<em>$1</em>');
  s = s.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');

  // Inline code: `code`
  s = s.replace(/`([^`\n]+?)`/g, '<code class="font-mono text-[0.88em] text-gold bg-gold/10 px-1.5 py-0.5 rounded-sm">$1</code>');

  // Process line-by-line for block-level elements
  const lines = s.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H3: ### heading
    if (/^### (.+)/.test(line)) {
      out.push(
        `<div class="mt-5 mb-2 pb-1 border-b border-rule-faint text-xs font-semibold uppercase tracking-widest text-gold">${line.replace(/^### /, '')}</div>`
      );

    // H2: ## heading
    } else if (/^## (.+)/.test(line)) {
      out.push(
        `<div class="mt-4 mb-1 text-[10px] uppercase tracking-widest text-text-tertiary">${line.replace(/^## /, '')}</div>`
      );

    // H1: # heading
    } else if (/^# (.+)/.test(line)) {
      out.push(
        `<div class="mt-4 mb-2 font-display text-base text-text-primary">${line.replace(/^# /, '')}</div>`
      );

    // Horizontal rule: --- or ***
    } else if (/^[-*]{3,}$/.test(line.trim())) {
      out.push('<hr class="border-rule-faint my-3" />');

    // Bullet: * item  or  - item  or  • item
    } else if (/^[\*\-•] (.+)/.test(line)) {
      const content = line.replace(/^[\*\-•] /, '');
      out.push(
        `<div class="flex gap-2 my-0.5 leading-snug"><span class="text-gold/50 flex-shrink-0 mt-[3px] text-[10px]">▸</span><span>${content}</span></div>`
      );

    // Numbered list: 1. item
    } else if (/^\d+\. (.+)/.test(line)) {
      const [, num, content] = line.match(/^(\d+)\. (.+)/) ?? [];
      out.push(
        `<div class="flex gap-2 my-0.5 leading-snug"><span class="text-gold/60 flex-shrink-0 font-mono text-[11px] mt-[2px] w-4 text-right">${num}.</span><span>${content}</span></div>`
      );

    // Empty line → spacer
    } else if (line.trim() === '') {
      // Collapse consecutive blank lines into one spacer
      if (out.length && out[out.length - 1] !== '<div class="h-2"></div>') {
        out.push('<div class="h-2"></div>');
      }

    // Regular paragraph line
    } else {
      out.push(`<span>${line}</span><br />`);
    }

    i++;
  }

  return out.join('');
}

// ── Source chips ──────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  'Market State':      '🌐',
  'Active Signals':    '⚡',
  'Zone Engine':       '◈',
  'Trade Plans':       '📋',
  'Journal (30d)':     '📓',
  'Economic Calendar': '📅',
  'Watchlist':         '👁',
  'News Feed':         '📰',
};

function SourceChips({ sources }: { sources: string[] }) {
  if (!sources.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2.5">
      {sources.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-widest
                     bg-canvas border border-rule text-text-tertiary rounded-sm"
        >
          <span>{SOURCE_ICONS[s] ?? '◉'}</span>
          {s}
        </span>
      ))}
    </div>
  );
}

// ── Cursor blink (streaming indicator) ────────────────────────────────────────

function StreamCursor() {
  return (
    <span className="inline-block w-[2px] h-[14px] bg-gold/70 ml-0.5 align-middle animate-pulse" />
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser      = msg.role === 'user';
  const isStreaming = !isUser && !msg.done && !msg.error && msg.content.length > 0;

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[78%] bg-gold/10 border border-gold/20 rounded-sm px-4 py-3 text-sm text-text-primary leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-5">
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-sm bg-canvas-raised border border-rule flex items-center justify-center mt-0.5">
        <span className={`text-xs font-display ${isStreaming ? 'text-gold animate-pulse' : 'text-gold'}`}>◈</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-gold mb-2 flex items-center gap-2">
          ORACLE AI
          {isStreaming && (
            <span className="text-[9px] text-text-tertiary normal-case tracking-normal animate-pulse">
              sedang mengetik…
            </span>
          )}
        </div>

        {/* Tool call steps — shown while AI is using tools */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mb-2 flex flex-col gap-1">
            {msg.toolCalls.map((tc, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-1.5 border
                  ${tc.done
                    ? 'bg-surface-2/60 border-border/40 text-text-secondary'
                    : 'bg-accent/5 border-accent/20 text-accent animate-pulse'
                  }`}
              >
                <span className="mt-0.5 shrink-0">{tc.done ? '🔧' : '⚙️'}</span>
                <div className="min-w-0">
                  <span className="font-mono font-semibold">{tc.tool}</span>
                  <span className="mx-1.5 text-text-tertiary">→</span>
                  <span className="text-text-secondary">{tc.summary}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {msg.error ? (
          <div className="text-sm text-short leading-relaxed">{msg.content}</div>
        ) : msg.content ? (
          <div className="text-sm text-text-primary leading-relaxed oracle-chat-body">
            <span dangerouslySetInnerHTML={{ __html: md(msg.content) }} />
            {isStreaming && <StreamCursor />}
          </div>
        ) : (
          /* Empty message still streaming — show dots */
          <div className="flex items-center gap-1.5 py-1">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce"
                style={{ animationDelay: `${d}ms`, animationDuration: '1s' }}
              />
            ))}
          </div>
        )}

        {msg.done && msg.sources && <SourceChips sources={msg.sources} />}
      </div>
    </div>
  );
}

// ── Starter prompts ───────────────────────────────────────────────────────────

function StarterGrid({ starters, onSelect }: { starters: string[]; onSelect: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-12 px-6">
      <div className="text-center mb-10">
        <div className="w-16 h-16 mx-auto mb-4 rounded-[10px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="ORACLE" className="w-full h-full object-contain" />
        </div>
        <h1 className="font-display text-4xl text-text-primary mb-2">ORACLE AI</h1>
        <p className="text-text-tertiary text-sm max-w-sm leading-relaxed">
          Tanya kondisi pasar, analisa sinyal, atau cek performa trading —
          ORACLE punya akses ke semua data real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
        {starters.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s)}
            className="text-left px-4 py-3 bg-canvas-raised border border-rule hover:border-gold/40
                       hover:bg-gold/5 rounded-sm text-sm text-text-secondary hover:text-text-primary
                       transition-colors leading-snug"
          >
            <span className="text-gold/50 mr-2">✦</span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main chat page ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const scrollAreaRef  = useRef<HTMLDivElement>(null);
  const textRef        = useRef<HTMLTextAreaElement>(null);
  const sentInitRef    = useRef(false);
  const abortRef       = useRef<AbortController | null>(null);
  const justSentRef    = useRef(false);   // force-scroll when user hits send

  /** True if scroll position is within 120px of the bottom */
  const isNearBottom = () => {
    const el = scrollAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  /** Scroll the messages container (not the viewport) to the bottom */
  const scrollToBottom = (smooth = true) => {
    const el = scrollAreaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  };

  const { data: startersData } = useSWR('/api/chat/starters', fetcher, {
    revalidateOnFocus: false,
  });
  const starters: string[] = startersData?.starters ?? [];

  // Auto-scroll: only when user just sent (force) or already near the bottom.
  // Uses scrollTop on the container — NOT scrollIntoView which can scroll the viewport.
  useEffect(() => {
    if (justSentRef.current || isNearBottom()) {
      scrollToBottom();
      justSentRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto';
      textRef.current.style.height = `${Math.min(textRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Handle pre-filled question from homepage bar (via URL hash)
  useEffect(() => {
    if (sentInitRef.current) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
      sentInitRef.current = true;
      const question = decodeURIComponent(hash);
      window.history.replaceState(null, '', window.location.pathname);
      setTimeout(() => send(question), 120);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Cancel any in-progress stream
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    // Add user message
    const userMsg: Message = {
      id:      `u-${Date.now()}`,
      role:    'user',
      content: trimmed,
      ts:      Date.now(),
    };

    // Add empty assistant placeholder (we'll stream into it)
    const aiId = `a-${Date.now() + 1}`;
    const aiMsg: Message = {
      id:      aiId,
      role:    'assistant',
      content: '',
      sources: [],
      done:    false,
      ts:      Date.now() + 1,
    };

    // Capture history BEFORE adding new messages
    const historySnap = messages.map((m) => ({ role: m.role, content: m.content }));

    justSentRef.current = true;   // force-scroll for new message pair
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/chat/stream`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ message: trimmed, history: historySnap }),
        signal:  abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE lines end with \n\n
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';   // last (possibly incomplete) chunk stays

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              const event = JSON.parse(raw);

              if (event.type === 'sources') {
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, sources: event.sources } : m)
                );

              } else if (event.type === 'tool_call') {
                // AI is calling a tool — add pending entry
                setMessages((prev) => prev.map((m) => {
                  if (m.id !== aiId) return m;
                  const existing = m.toolCalls ?? [];
                  return { ...m, toolCalls: [...existing, { tool: event.tool, summary: '⏳ running…', done: false }] };
                }));

              } else if (event.type === 'tool_result') {
                // Tool finished — update the pending entry
                setMessages((prev) => prev.map((m) => {
                  if (m.id !== aiId) return m;
                  const calls = (m.toolCalls ?? []).map((tc) =>
                    tc.tool === event.tool && !tc.done
                      ? { ...tc, summary: event.result_summary, done: true }
                      : tc
                  );
                  return { ...m, toolCalls: calls };
                }));

              } else if (event.type === 'text') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiId ? { ...m, content: m.content + event.text } : m
                  )
                );

              } else if (event.type === 'done') {
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, done: true } : m)
                );

              } else if (event.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiId ? { ...m, content: event.error, error: true, done: true } : m
                  )
                );
              }
            } catch {
              // ignore malformed SSE line
            }
          }
        }
      }

      // Mark done in case 'done' event was missed
      setMessages((prev) =>
        prev.map((m) => m.id === aiId && !m.done ? { ...m, done: true } : m)
      );

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId
            ? { ...m, content: '⚠️ Gagal terhubung ke backend. Pastikan server berjalan.', error: true, done: true }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, messages]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col max-w-4xl mx-auto px-4">

      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-rule-faint flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs uppercase tracking-widest text-text-tertiary hover:text-gold link-underline">
            ← chamber
          </Link>
          <span className="text-rule/40">|</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${loading ? 'text-gold animate-pulse' : 'text-gold'}`}>◈</span>
            <span className="font-display text-lg text-text-primary">ORACLE AI</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-gold/10 text-gold border border-gold/25 rounded-sm uppercase tracking-widest">
              RAG · Live
            </span>
          </div>
        </div>

        {!isEmpty && (
          <button
            onClick={clearChat}
            className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto py-6 thin-scrollbar">
        {isEmpty ? (
          <StarterGrid starters={starters} onSelect={(s) => send(s)} />
        ) : (
          <div className="space-y-1">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-rule-faint py-4">
        <div className={`flex gap-3 items-end bg-canvas-raised border rounded-sm px-4 py-3 transition-colors ${
          loading
            ? 'border-gold/20'
            : 'border-rule hover:border-rule-strong focus-within:border-gold/40'
        }`}>
          <textarea
            ref={textRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Tanya ORACLE… (Enter kirim · Shift+Enter baris baru)"
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary
                       outline-none resize-none leading-relaxed min-h-[24px] disabled:opacity-60"
          />
          {loading ? (
            <button
              onClick={() => { abortRef.current?.abort(); setLoading(false); }}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-sm
                         border border-short/40 text-short hover:bg-short/10 transition-colors"
              title="Stop generating"
            >
              <span className="w-3 h-3 rounded-sm bg-short/80" />
            </button>
          ) : (
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-sm transition-all ${
                input.trim()
                  ? 'bg-gold text-canvas hover:bg-gold-400'
                  : 'bg-rule text-text-tertiary cursor-not-allowed'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 14 14">
                <path d="M1 13L13 7 1 1v4.5L9 7l-8 1.5V13z" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[10px] text-text-tertiary/50">
            ORACLE AI menganalisis data real-time — bukan prediksi, tapi keputusan tetap di tangan Anda.
          </p>
          {!isEmpty && (
            <span className="text-[10px] text-text-tertiary/50">
              {messages.filter((m) => m.role === 'user').length} pertanyaan
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
