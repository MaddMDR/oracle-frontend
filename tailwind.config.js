/** @type {import('tailwindcss').Config} */
// Tokens map 1:1 to docs/DESIGN_SYSTEM.md. Semantic roles, not literal colors.
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'], // legacy alias
      },
      letterSpacing: { widest: '0.22em' },
      colors: {
        // Surfaces
        bg: { DEFAULT: '#0a0c12', sunken: '#070910' },
        surface: { DEFAULT: '#0f131c', 2: '#151a26' },
        border: { DEFAULT: '#1c2230', 2: '#2a3142' },
        // Text
        fg: { DEFAULT: '#e6e9f0', muted: '#9aa3b5', faint: '#5d6678' },
        // Brand + interactive
        brand: { DEFAULT: '#d4a857', dim: '#9a7733', 50: '#fbf4e4' },
        accent: { DEFAULT: '#5b9dd9', dim: '#3a6c97' },
        // Directional
        up: { DEFAULT: '#3fb27f', dim: '#266b4d', soft: '#13241c' },
        down: { DEFAULT: '#e0635e', dim: '#8f3a37', soft: '#241516' },
        warn: { DEFAULT: '#e0a23c', dim: '#8f6620' },

        // ── Legacy compat (v1 pages) — mapped onto the new palette ──
        canvas: { DEFAULT: '#0a0c12', deep: '#070910', raised: '#151a26', inset: '#0f131c' },
        rule: { DEFAULT: '#1c2230', strong: '#2a3142', faint: '#141926' },
        gold: { 50: '#fbf4e4', 200: '#f0dfb0', 400: '#e0b76a', 500: '#d4a857', 600: '#9a7733', DEFAULT: '#d4a857' },
        long: { DEFAULT: '#3fb27f', strong: '#5fc998', dim: '#266b4d' },
        short: { DEFAULT: '#e0635e', strong: '#ea8580', dim: '#8f3a37' },
        neutral: { DEFAULT: '#9aa3b5' },
        text: { primary: '#e6e9f0', secondary: '#9aa3b5', tertiary: '#5d6678', inverse: '#0a0c12' },
      },
      fontSize: {
        micro: ['10.5px', { lineHeight: '1.4', letterSpacing: '0.12em' }],
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['14px', { lineHeight: '1.55' }],
        lg: ['15px', { lineHeight: '1.4' }],
        h3: ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        h2: ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        h1: ['24px', { lineHeight: '1.2', fontWeight: '600' }],
        display: ['32px', { lineHeight: '1.15', fontWeight: '600' }],
        // legacy scale (v1 pages)
        xl: ['20px', { lineHeight: '1.4' }],
        '2xl': ['26px', { lineHeight: '1.3' }],
        '3xl': ['34px', { lineHeight: '1.2' }],
        '4xl': ['44px', { lineHeight: '1.1' }],
        '5xl': ['56px', { lineHeight: '1.05' }],
        '6xl': ['72px', { lineHeight: '1' }],
      },
      borderRadius: {
        sm: '6px', md: '10px', lg: '14px',
      },
      boxShadow: {
        e1: '0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)',
        e2: '0 8px 28px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.03) inset',
        e3: '0 24px 64px rgba(0,0,0,0.65)',
        glow: '0 0 0 1px rgba(212,168,87,0.35), 0 0 24px rgba(212,168,87,0.12)',
      },
      maxWidth: { content: '1400px' },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2,0.6,0.2,1)',
        exit: 'cubic-bezier(0.4,0,1,1)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        livepulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
        'fade-up': 'fade-up 0.24s cubic-bezier(0.2,0.6,0.2,1) both',
        livepulse: 'livepulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
