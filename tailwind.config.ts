import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: '#1E40AF',
          soft: '#EFF6FF',
          ink: '#FFFFFF',
        },
        blue: {
          50: '#EFF6FF', 100: '#DBEAFE', 600: '#2563EB', 700: '#1E40AF', 800: '#1E3A8A',
        },
        em: {
          50: '#ECFDF5', 100: '#D1FAE5', 600: '#059669', 700: '#047857',
        },
        am: {
          50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 700: '#B45309',
        },
        rd: {
          50: '#FEF2F2', 100: '#FEE2E2', 600: '#DC2626', 700: '#B91C1C',
        },
        pu: {
          50: '#F5F3FF', 100: '#EDE9FE', 600: '#7C3AED', 700: '#6D28D9',
        },
        sky: {
          500: '#0EA5E9', 600: '#0284C7',
        },
        or: {
          500: '#EA580C',
        },
        // Surface tokens
        bg: 'var(--bg)',
        'bg-alt': 'var(--bg-alt)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        'muted-2': 'var(--muted-2)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        btn: '6px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,.06)',
        md: '0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.04)',
        lg: '0 8px 24px rgba(15,23,42,.08), 0 2px 6px rgba(15,23,42,.04)',
        xl: '0 20px 48px rgba(15,23,42,.14), 0 4px 12px rgba(15,23,42,.06)',
      },
      keyframes: {
        pulse: {
          '0%':   { boxShadow: '0 0 0 0 rgba(220,38,38,.65)' },
          '70%':  { boxShadow: '0 0 0 7px rgba(220,38,38,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(220,38,38,0)' },
        },
        slidein: { from: { transform: 'translateX(120%)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        slideup: { from: { transform: 'translateY(18px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        drop: { from: { transform: 'translateY(-22px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        'pin-pulse': 'pulse 1.8s infinite',
        'slide-in': 'slidein .28s cubic-bezier(.22,1,.36,1)',
        'slide-up': 'slideup .26s cubic-bezier(.22,1,.36,1)',
        drop: 'drop .45s cubic-bezier(.2,1.5,.4,1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
