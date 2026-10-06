import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1220', // page background / text on accent
        sidebar: '#111b2e', // left navigation surface
        panel: '#182437', // cards / surfaces
        panel2: '#1f2d44', // inputs, hover, inset tracks
        line: '#263449', // borders (subtle)
        fg: '#e6edf6', // primary text
        muted: '#93a2ba', // secondary text
        accent: '#38bdf8', // primary cyan/blue
        ok: '#34d399', // success
        warn: '#fbbf24', // warning
        danger: '#f87171', // danger
        purple: '#a78bfa', // purple accent
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.30), 0 10px 30px -18px rgba(0,0,0,0.55)',
        pop: '0 8px 30px -8px rgba(0,0,0,0.55)',
      },
      transitionDuration: {
        DEFAULT: '160ms',
      },
    },
  },
  plugins: [],
};

export default config;
