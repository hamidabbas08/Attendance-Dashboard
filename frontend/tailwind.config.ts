import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080f1c', // page background / text on accent
        sidebar: '#0d1728', // left navigation surface
        panel: '#111d30', // cards / surfaces
        panel2: '#16243a', // elevated surface / inputs / hover
        line: '#223047', // borders (subtle, ~ white/8)
        fg: '#f8fafc', // primary text
        muted: '#94a3b8', // secondary text
        faint: '#64748b', // tertiary / captions
        accent: '#38bdf8', // primary cyan/blue
        ok: '#34d399', // success
        warn: '#fbbf24', // warning
        danger: '#f87171', // danger
        purple: '#a78bfa', // purple accent
      },
      borderRadius: {
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.30), 0 12px 32px -20px rgba(0,0,0,0.65)',
        pop: '0 12px 40px -10px rgba(0,0,0,0.6)',
      },
      transitionDuration: {
        DEFAULT: '160ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'scale-in': 'scale-in 160ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
